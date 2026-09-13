"""Local synthetic wire peer only: never connect to an existing database."""
import base64
import hashlib
import hmac
import importlib.util
import json
import os
from pathlib import Path
import socket
import ssl
import struct
import subprocess
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch
from types import SimpleNamespace

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("native_bridge", HERE / "native-bridge.py")
bridge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bridge)
PASSWORD = "synthetic-native-wire-only"
DEPENDENCIES = None


def recv_exact(sock, size):
    data = b""
    while len(data) < size:
        chunk = sock.recv(size - len(data))
        if not chunk:
            raise EOFError()
        data += chunk
    return data


def send(sock, kind, body):
    sock.sendall(kind + struct.pack("!I", len(body) + 4) + body)


def auth(sock, code, body=b""):
    send(sock, b"R", struct.pack("!I", code) + body)


def message(sock):
    kind = recv_exact(sock, 1)
    return kind, recv_exact(sock, struct.unpack("!I", recv_exact(sock, 4))[0] - 4)


class WirePeer:
    def __init__(self, certificate, key, mode):
        self.mode = mode
        self.password_frames = []
        self.query_frames = []
        self.failures = []
        self.startup = b""
        self.challenge_sent = False
        self.cert_hash = hashlib.sha256(ssl.PEM_cert_to_DER_cert(certificate.read_text())).digest()
        self.context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        self.context.load_cert_chain(certificate, key)
        self.listener = socket.socket()
        self.listener.bind(("127.0.0.1", 0))
        self.listener.listen(1)
        self.listener.settimeout(8)
        self.port = self.listener.getsockname()[1]
        self.thread = threading.Thread(target=self.run, daemon=True)
        self.thread.start()

    def read(self, sock):
        kind, body = message(sock)
        if kind == b"p":
            self.password_frames.append(body)
        if kind in (b"Q", b"P", b"B", b"E"):
            self.query_frames.append(kind)
        return kind, body

    def run(self):
        try:
            raw, _ = self.listener.accept()
            with raw:
                raw.settimeout(5)
                if recv_exact(raw, 8) != struct.pack("!II", 8, 80877103):
                    raise ValueError("SSL_REQUEST")
                raw.sendall(b"S")
                with self.context.wrap_socket(raw, server_side=True) as sock:
                    size = struct.unpack("!I", recv_exact(sock, 4))[0]
                    self.startup = recv_exact(sock, size - 4)
                    if self.mode == "cleartext":
                        auth(sock, 3)
                    elif self.mode == "md5":
                        auth(sock, 5, b"salt")
                    elif self.mode == "trust":
                        auth(sock, 0)
                        send(sock, b"Z", b"I")
                    elif self.mode == "plain-scram":
                        auth(sock, 10, b"SCRAM-SHA-256\0\0")
                    else:
                        self.scram_plus(sock)
                    self.challenge_sent = True
                    self.read(sock)  # Terminate/EOF only: tests never submit SQL.
        except (EOFError, ssl.SSLError, ConnectionError, socket.timeout):
            pass
        except BaseException as error:
            self.failures.append(type(error).__name__)  # No error text/frames.
        finally:
            self.listener.close()

    def scram_plus(self, sock):
        auth(sock, 10, b"SCRAM-SHA-256-PLUS\0SCRAM-SHA-256\0\0")
        kind, body = self.read(sock)
        mechanism, remainder = body.split(b"\0", 1)
        if kind != b"p" or mechanism != b"SCRAM-SHA-256-PLUS":
            raise ValueError("MECHANISM")
        initial = remainder[4:].decode()
        if struct.unpack("!I", remainder[:4])[0] != len(remainder[4:]):
            raise ValueError("FRAME")
        bare = initial.split(",,", 1)[1]
        nonce = bare.split("r=", 1)[1] + "synthetic-server-nonce"
        salt = b"synthetic-salt"
        first = "r=" + nonce + ",s=" + base64.b64encode(salt).decode() + ",i=4096"
        auth(sock, 11, first.encode())
        kind, final = self.read(sock)
        final = final.decode()
        without_proof, proof = final.rsplit(",p=", 1)
        attributes = dict(part.split("=", 1) for part in without_proof.split(","))
        if kind != b"p" or attributes["r"] != nonce or base64.b64decode(attributes["c"]) != b"p=tls-server-end-point,," + self.cert_hash:
            raise ValueError("BINDING")
        salted = hashlib.pbkdf2_hmac("sha256", PASSWORD.encode(), salt, 4096)
        auth_message = (bare + "," + first + "," + without_proof).encode()
        client_key = hmac.digest(salted, b"Client Key", "sha256")
        client_sig = hmac.digest(hashlib.sha256(client_key).digest(), auth_message, "sha256")
        expected = bytes(a ^ b for a, b in zip(client_key, client_sig))
        if base64.b64decode(proof) != expected:
            raise ValueError("PROOF")
        server_key = hmac.digest(salted, b"Server Key", "sha256")
        signature = hmac.digest(server_key, auth_message, "sha256")
        if self.mode == "bad-server-proof":
            signature = b"x" * 32
        auth(sock, 12, b"v=" + base64.b64encode(signature))
        auth(sock, 0)
        send(sock, b"S", b"server_version\00018.4\0")
        send(sock, b"S", b"client_encoding\0UTF8\0")
        send(sock, b"Z", b"I")

    def finish(self):
        self.thread.join(8)
        if self.thread.is_alive():
            raise AssertionError("synthetic peer did not stop")


class NativeWireTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.directory = tempfile.TemporaryDirectory(prefix="seo-native-wire-")
        cls.cert = Path(cls.directory.name) / "cert.pem"
        cls.key = Path(cls.directory.name) / "key.pem"
        cls.other_cert = Path(cls.directory.name) / "other.pem"
        cls.other_key = Path(cls.directory.name) / "other-key.pem"
        for cert, key in [(cls.cert, cls.key), (cls.other_cert, cls.other_key)]:
            subprocess.run([OPENSSL, "req", "-x509", "-newkey", "rsa:2048", "-nodes",
                "-keyout", str(key), "-out", str(cert), "-days", "1", "-subj", "/CN=localhost",
                "-addext", "subjectAltName=DNS:localhost"], check=True,
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=15)
        os.environ["SSL_CERT_FILE"] = str(cls.cert)  # Synthetic test process only.
        os.environ.pop("SSL_CERT_DIR", None)

    @classmethod
    def tearDownClass(cls):
        cls.directory.cleanup()

    def connect(self, mode, hostname="localhost", trusted=True):
        os.environ["SSL_CERT_FILE"] = str(self.cert if trusted else self.other_cert)
        peer = WirePeer(self.cert, self.key, mode)
        url = f"postgresql://synthetic:{PASSWORD}@{hostname}:{peer.port}/synthetic?sslmode=require&channel_binding=require"
        succeeded = False
        try:
            # PQconnectdb is blocking and may retain the GIL. Use the real bridge
            # child, so this synthetic server thread can always service TLS/auth.
            environment = {key: os.environ[key] for key in ['PATH', 'SystemRoot', 'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP'] if key in os.environ}
            environment.update(PSYCOPG_IMPL='binary', SSL_CERT_FILE=str(self.cert if trusted else self.other_cert))
            requests = json.dumps({'id': 1, 'op': 'initialize'}) + '\n' + json.dumps({'id': 2, 'op': 'connect', 'url': url}) + '\n' + json.dumps({'id': 3, 'op': 'close'}) + '\n'
            child = subprocess.run([sys.executable, '-I', '-S', str(HERE / 'native-bridge.py'),
                '--dependencies', DEPENDENCIES], input=requests, text=True, capture_output=True,
                timeout=8, env=environment)
            responses = [json.loads(line) for line in child.stdout.splitlines()]
            succeeded = child.returncode == 0 and len(responses) >= 2 and all(response.get('ok') is True for response in responses[:2])
        except BaseException as error:
            peer.failure_type = type(error).__name__
        finally:
            peer.finish()
        self.assertEqual(peer.failures, [])
        self.assertEqual(peer.query_frames, [])
        return succeeded, peer

    def test_real_libpq_positive_plus_and_certificate_binding_proof(self):
        succeeded, peer = self.connect("plus")
        self.assertTrue(succeeded, f"synthetic stage: {getattr(peer, 'failure_type', None)}, startup={bool(peer.startup)}, responses={len(peer.password_frames)}")
        self.assertEqual(len(peer.password_frames), 2)
        self.assertNotIn(b"options\0", peer.startup)
        self.assertNotIn(b"default_transaction_read_only", peer.startup)

    def test_no_downgrade_credential_response_for_cleartext_md5_plain_scram_or_trust(self):
        for mode in ["cleartext", "md5", "plain-scram", "trust"]:
            with self.subTest(mode=mode):
                succeeded, peer = self.connect(mode)
                self.assertFalse(succeeded)
                self.assertTrue(peer.startup, 'negative auth test must reach the challenge')
                self.assertTrue(peer.challenge_sent)
                self.assertEqual(peer.password_frames, [])

    def test_untrusted_certificate_and_wrong_hostname_fail_before_credentials(self):
        for hostname, trusted in [("127.0.0.1", True), ("localhost", False)]:
            with self.subTest(hostname=hostname, trusted=trusted):
                succeeded, peer = self.connect("plus", hostname, trusted)
                self.assertFalse(succeeded)
                self.assertEqual(peer.password_frames, [])

    def test_invalid_server_scram_proof_never_completes_connection(self):
        succeeded, peer = self.connect("bad-server-proof")
        self.assertFalse(succeeded)
        self.assertEqual(len(peer.password_frames), 2)


class ParameterTests(unittest.TestCase):
    def test_only_exact_verified_interpreter_abi_and_libpq_pairs_are_supported(self):
        self.assertTrue(bridge.supported_native_version("linux", "linux-x86_64", "cpython", (3, 12), 180006))
        self.assertTrue(bridge.supported_native_version("win32", "win-amd64", "cpython", (3, 12), 180004))
        for platform_name, abi, implementation, python_version, libpq_version in [
                ("linux", "linux-x86_64", "cpython", (3, 12), 180004),
                ("linux", "linux-x86_64", "cpython", (3, 12), 180007),
                ("win32", "win-amd64", "cpython", (3, 12), 180006),
                ("linux", "linux-aarch64", "cpython", (3, 12), 180006),
                ("linux", "linux-x86_64", "cpython", (3, 13), 180006),
                ("linux", "linux-x86_64", "pypy", (3, 12), 180006),
                ("win32", "win-arm64", "cpython", (3, 12), 180004),
                ("darwin", "macosx-x86_64", "cpython", (3, 12), 180004)]:
            self.assertFalse(bridge.supported_native_version(platform_name, abi, implementation, python_version, libpq_version))

    def test_emulated_windows_x64_uses_interpreter_abi_not_arm64_host_hardware(self):
        with patch("platform.machine", return_value="ARM64"):
            self.assertTrue(bridge.supported_native_version("win32", "win-amd64", "cpython", (3, 12), 180004))

    def test_bootstrap_failures_are_internal_codes_without_exception_details(self):
        directory = str(HERE)
        for expected in ["NATIVE_IMPORT", "NATIVE_ORIGIN", "NATIVE_VERSION", "NATIVE_CA"]:
            with self.subTest(expected=expected):
                file = str(HERE / "synthetic.py")
                pq = SimpleNamespace(__file__=file, __impl__="binary", version=lambda: 180004)
                psycopg = SimpleNamespace(__file__=file, __version__="3.3.5", pq=pq)
                binary = SimpleNamespace(__file__=file)
                modules = {"psycopg": psycopg, "psycopg_binary": binary,
                    "psycopg.conninfo": SimpleNamespace(make_conninfo=lambda *a, **k: None)}
                if expected == "NATIVE_IMPORT":
                    modules["psycopg"] = None
                elif expected == "NATIVE_ORIGIN":
                    binary.__file__ = str(HERE.parent / "outside.py")
                elif expected == "NATIVE_VERSION":
                    pq.version = lambda: 1
                original_path = list(sys.path)
                try:
                    # Isolate phase routing with the Windows-observed fake value;
                    # the real platform/version contract is tested separately.
                    with patch.dict(sys.modules, modules), \
                            patch.object(bridge, "supported_native_version", side_effect=lambda _p, _a, _i, _v, libpq: libpq == 180004), \
                            patch.object(bridge, "root_certificate", side_effect=RuntimeError("PRIVATE")):
                        value, phase = bridge.bootstrap(directory)
                    self.assertIsNone(value)
                    self.assertEqual(phase, expected)
                    self.assertNotIn("PRIVATE", phase)
                finally:
                    sys.path[:] = original_path

    def test_connection_configuration_has_no_pooler_incompatible_startup_options(self):
        captured = {}
        def conninfo(url, **options):
            captured.update(options)
            return "synthetic"
        conn = SimpleNamespace(status=1, ssl_in_use=True)
        pq = SimpleNamespace(PGconn=SimpleNamespace(connect=lambda info: conn), ConnStatus=SimpleNamespace(OK=1))
        self.assertIs(bridge.connect_native("synthetic", pq, conninfo, "/fixed/system/ca"), conn)
        self.assertNotIn("options", captured)
        self.assertEqual(captured["channel_binding"], "require")
        self.assertEqual(captured["sslmode"], "verify-full")
        self.assertEqual(captured["sslrootcert"], "/fixed/system/ca")

    def test_linux_uses_only_existing_documented_system_bundle(self):
        checked = []
        path = bridge.root_certificate("linux", lambda path: checked.append(path) or True)
        self.assertEqual(path, "/etc/pki/tls/certs/ca-bundle.crt")
        self.assertEqual(checked, [path])
        self.assertEqual(bridge.root_certificate("win32"), "system")

    def test_missing_linux_bundle_and_other_platform_fail_closed(self):
        with self.assertRaisesRegex(ValueError, "^TRUST_STORE$"):
            bridge.root_certificate("linux", lambda path: False)
        with self.assertRaisesRegex(ValueError, "^PLATFORM$"):
            bridge.root_certificate("darwin", lambda path: True)

    def test_arrays_and_scalar_values_are_bound_not_interpolated(self):
        self.assertEqual(bridge.parameter(['a"b', 'c\\d', None]), b'{"a\\"b","c\\\\d",NULL}')
        self.assertEqual(bridge.parameter(True), b"true")
        self.assertEqual(bridge.parameter(25), b"25")
        self.assertIsNone(bridge.parameter(None))

    def test_all_manifest_queries_and_parameters_are_unchanged_in_exec_params(self):
        manifest = json.loads((HERE / "manifest.json").read_text())
        calls = []
        result = SimpleNamespace(status=2, ntuples=0, nfields=0)
        conn = SimpleNamespace(exec_params=lambda text, values: (calls.append((text, values)) or result))
        fake_pq = SimpleNamespace(ExecStatus=SimpleNamespace(COMMAND_OK=1, TUPLES_OK=2))
        for query in manifest["queries"]:
            text = "EXPLAIN (FORMAT JSON) " + query["text"]
            self.assertEqual(bridge.execute(conn, fake_pq, text, query["values"]), [])
            self.assertEqual(calls[-1], (text.encode(), [bridge.parameter(v) for v in query["values"]]))
        text = "SELECT $2, $1, $2, '50%'::text"
        bridge.execute(conn, fake_pq, text, ["first", "second"])
        self.assertEqual(calls[-1], (text.encode(), [b"first", b"second"]))
        self.assertEqual(len(manifest["queries"]), 18)


if __name__ == "__main__":
    if len(sys.argv) != 5 or sys.argv[1] != "--dependencies" or sys.argv[3] != "--openssl":
        raise SystemExit("Requires explicit local dependency and OpenSSL paths")
    DEPENDENCIES = str(Path(sys.argv[2]).resolve())
    sys.path.insert(0, DEPENDENCIES)
    OPENSSL = sys.argv[4]
    os.environ["PSYCOPG_IMPL"] = "binary"
    from psycopg import pq
    from psycopg.conninfo import make_conninfo
    if pq.__impl__ != "binary" or not 180000 <= pq.version() < 190000:
        raise SystemExit("Unexpected native library version")
    unittest.main(argv=[sys.argv[0]] + ([os.environ['NATIVE_TEST_CASE']] if 'NATIVE_TEST_CASE' in os.environ else []), verbosity=2)

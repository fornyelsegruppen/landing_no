"""Private preflight IPC using supported libpq APIs. Never log native errors."""
import json
import sys

MAX_FRAME = 1024 * 1024


def parameter(value):
    """Encode a *bound* text-format libpq parameter, never SQL interpolation."""
    if value is None:
        return None
    if isinstance(value, list):
        def item(part):
            if part is None:
                return "NULL"
            if not isinstance(part, str):
                raise ValueError("PARAMETER")
            return '"' + part.replace('\\', '\\\\').replace('"', '\\"') + '"'
        return ("{" + ",".join(item(part) for part in value) + "}").encode("utf8")
    if isinstance(value, bool):
        return b"true" if value else b"false"
    if isinstance(value, (str, int)):
        return str(value).encode("utf8")
    raise ValueError("PARAMETER")


def root_certificate(platform=sys.platform, is_file=None):
    if platform == "linux":
        # AWS-documented AL2023 system store. Never copy or discover CA contents,
        # or depend on bundled OpenSSL's potentially different compiled paths.
        if is_file is None:
            from os.path import isfile
            is_file = isfile
        path = "/etc/pki/tls/certs/ca-bundle.crt"
        if not is_file(path):
            raise ValueError("TRUST_STORE")
        return path
    if platform == "win32":
        return "system"  # Synthetic local tests only; no Windows build claim.
    raise ValueError("PLATFORM")


def connect_native(url, pq, make_conninfo):
    # URL identity/password are not rewritten or supplied by another source.
    # Keyword overrides strengthen require/verify-ca to the existing strict TLS
    # policy; mandatory binding is enforced by libpq, never by pg internals.
    info = make_conninfo(url, channel_binding="require", sslmode="verify-full",
        sslrootcert=root_certificate(), sslcertmode="disable", gssencmode="disable",
        require_auth="scram-sha-256", connect_timeout="5",
        application_name="seo-one-ui-compat-preflight", client_encoding="UTF8",
        options="-c default_transaction_read_only=on -c statement_timeout=5000 -c lock_timeout=1000 -c idle_in_transaction_session_timeout=10000")
    conn = pq.PGconn.connect(info.encode("utf8"))
    if conn.status != pq.ConnStatus.OK or not conn.ssl_in_use:
        conn.finish()
        raise ValueError("CONNECT")
    return conn


def execute(conn, pq, text, values):
    # The caller verified the sealed manifest. PQexecParams preserves repeated
    # and out-of-order $n references and rejects multiple SQL commands.
    result = conn.exec_params(text.encode("utf8"), [parameter(v) for v in values])
    if result.status not in (pq.ExecStatus.COMMAND_OK, pq.ExecStatus.TUPLES_OK):
        raise ValueError("QUERY")
    if text.startswith("EXPLAIN (FORMAT JSON) "):
        return []  # No plans cross IPC or reach logs.
    rows = []
    for row_index in range(result.ntuples):
        row = {}
        for column in range(result.nfields):
            value = result.get_value(row_index, column)
            if value is not None:
                value = value.decode("utf8")
                if result.ftype(column) == 16:
                    value = value == "t"
            row[result.fname(column).decode("utf8")] = value
        rows.append(row)
    return rows


def serve(dependencies):
    # -I -S excludes user/site/PYTHONPATH injection. Only the hash-verified private
    # installation is added; force binary implementation, with no system fallback.
    sys.path.insert(0, dependencies)
    import psycopg
    import psycopg_binary
    from psycopg import pq
    from psycopg.conninfo import make_conninfo
    from pathlib import Path
    private_root = Path(dependencies).resolve()
    if any(not Path(module.__file__).resolve().is_relative_to(private_root)
           for module in (psycopg, psycopg_binary, pq)):
        raise ValueError("DRIVER")
    if (sys.implementation.name != "cpython" or sys.version_info[:2] not in ((3, 12), (3, 13), (3, 14))
            or psycopg.__version__ != "3.3.5" or pq.__impl__ != "binary" or pq.version() != 180004):
        raise ValueError("DRIVER")
    conn = None
    try:
        for _ in range(64):
            frame = sys.stdin.buffer.readline(MAX_FRAME + 1)
            if not frame:
                break
            if len(frame) > MAX_FRAME or not frame.endswith(b"\n"):
                raise ValueError("FRAME")
            request = json.loads(frame)
            response = {"id": request["id"], "ok": False}
            closing = request.get("op") == "close"
            try:
                if request.get("op") == "connect" and conn is None:
                    conn = connect_native(request["url"], pq, make_conninfo)
                    rows = []
                elif request.get("op") == "query" and conn is not None:
                    rows = execute(conn, pq, request["text"], request["values"])
                elif closing:
                    rows = []
                else:
                    raise ValueError("REQUEST")
                response.update(ok=True, rows=rows)
            except BaseException:
                pass  # Native error details never cross IPC, including causes.
            encoded = json.dumps(response, separators=(",", ":"))
            if len(encoded.encode("utf8")) > MAX_FRAME:
                raise ValueError("FRAME")
            print(encoded, flush=True)
            if closing or not response["ok"]:
                break
    finally:
        if conn is not None:
            try:
                if conn.transaction_status != pq.TransactionStatus.IDLE:
                    conn.exec_(b"ROLLBACK")
            finally:
                conn.finish()


if __name__ == "__main__":
    try:
        if len(sys.argv) != 3 or sys.argv[1] != "--dependencies":
            raise ValueError("ARGUMENTS")
        serve(sys.argv[2])
    except BaseException:
        sys.exit(1)  # Parent emits only its current fixed check ID.

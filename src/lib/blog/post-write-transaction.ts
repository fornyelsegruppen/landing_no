import { randomUUID } from "node:crypto";
import { sql } from "@payloadcms/db-postgres";
import { postRevision } from "./post-revision";
import {
  createLocalReq,
  type Payload,
  type PayloadRequest,
  type CollectionBeforeOperationHook,
  type CollectionAfterOperationHook,
} from "payload";

type Session = { execute(query: ReturnType<typeof sql>): Promise<unknown> };
type Database = {
  drizzle: {
    transaction<T>(work: (session: Session) => Promise<T>): Promise<T>;
  };
  sessions: Record<
    string,
    { db: Session; resolve(): Promise<unknown>; reject(): Promise<unknown> }
  >;
};

// Blog-only serialization includes native bulk writes, autosave and restore.
// No provider calls belong inside this short transaction. Other collections
// retain their configured transaction behavior.
const ownedOperations = new WeakSet<object>();
type Ownership = {
  id: string;
  poisoned: boolean;
  postsChanged?: boolean;
  session?: Database["sessions"][string];
};
const requestOwnership = new WeakMap<PayloadRequest, Ownership>();
const writeOperations = new Set([
  "create",
  "update",
  "delete",
  "restoreVersion",
]);

async function start(req: PayloadRequest, lock: "posts" | "queue") {
  const db = req.payload.db as unknown as Database;
  if (!db.drizzle?.transaction || !db.sessions) {
    throw new TypeError(
      "SEO writes require the PostgreSQL transaction adapter",
    );
  }
  const existing = await req.transactionID;
  const owner = requestOwnership.get(req);
  if (
    owner &&
    (owner.poisoned || existing !== owner.id || !db.sessions[owner.id])
  ) {
    throw new TypeError(
      "SEO transaction ownership was lost; request cannot continue",
    );
  }
  if (existing) {
    const session = db.sessions[String(existing)];
    if (!session) throw new TypeError("SEO transaction is unavailable");
    await session.db.execute(
      sql`select pg_advisory_xact_lock(731246, ${lock === "posts" ? 1 : 2})`,
    );
    return false;
  }
  const id = `seo-${randomUUID()}`;
  const ownership: Ownership = { id, poisoned: false };
  let ready!: () => void;
  let failed!: (error: unknown) => void;
  const started = new Promise<void>((resolve, reject) => {
    ready = resolve;
    failed = reject;
  });
  let release!: () => void;
  let abort!: (error: Error) => void;
  const done = db.drizzle.transaction(async (session) => {
    await session.execute(sql`set local lock_timeout = '5s'`);
    await session.execute(sql`set local statement_timeout = '15s'`);
    await session.execute(
      sql`set local idle_in_transaction_session_timeout = '20s'`,
    );
    await session.execute(
      sql`select pg_advisory_xact_lock(731246, ${lock === "posts" ? 1 : 2})`,
    );
    await new Promise<void>((resolve, reject) => {
      release = resolve;
      abort = reject;
      db.sessions[id] = {
        db: session,
        resolve: async () => {
          if (ownership.poisoned)
            throw new TypeError("SEO transaction was aborted");
          // PostgreSQL can respond to COMMIT with ROLLBACK after a swallowed
          // bulk SQL error. Probe before COMMIT so that cannot look successful.
          await session.execute(sql`select 1`);
          release();
          await done;
        },
        reject: async () => {
          ownership.poisoned = true;
          abort(new Error("SEO transaction rolled back"));
          await done.catch(() => undefined);
        },
      };
      req.transactionID = id;
      ownership.session = db.sessions[id];
      requestOwnership.set(req, ownership);
      ready();
    });
  });
  // Attach immediately: failure before acquiring the lock must reject start;
  // failure on commit is still propagated by the registered resolve method.
  void done.catch((error) => {
    ownership.poisoned = true;
    failed(error);
  });
  await started;
  return true;
}

async function finish(req: PayloadRequest, commit: boolean) {
  const requestID = await req.transactionID;
  const ownership = requestOwnership.get(req);
  const id = ownership?.id || requestID;
  const db = req.payload.db as unknown as Database;
  const session =
    ownership?.session || (id ? db.sessions[String(id)] : undefined);
  if (
    !id ||
    (commit &&
      ownership &&
      (ownership.id !== requestID ||
        ownership.poisoned ||
        db.sessions[ownership.id] !== session))
  ) {
    await session?.reject().catch(() => undefined);
    if (id) delete db.sessions[String(id)];
    delete req.transactionID;
    throw new TypeError("SEO transaction ownership was lost before completion");
  }
  if (!session) throw new TypeError("SEO transaction ended before completion");
  try {
    await (commit ? session.resolve() : session.reject());
    if (commit) requestOwnership.delete(req);
  } catch (error) {
    await session.reject().catch(() => undefined);
    throw error;
  } finally {
    delete db.sessions[String(id)];
    delete req.transactionID;
  }
  if (commit && ownership?.postsChanged) {
    // Nested native/bulk writes only mark the owner. Invalidation belongs after
    // the outermost real COMMIT, never an afterChange hook within a transaction.
    try {
      const { invalidatePublicBlog } = await import("./invalidate-public-blog");
      invalidatePublicBlog();
    } catch {
      // A cache failure cannot roll back an already committed publication or
      // invite a second provider run. Surface it for operations; ISR is fallback.
      req.payload.logger.warn(
        "Public blog cache invalidation failed after commit",
      );
    }
  }
}

export async function withSeoTransaction<T>(
  payload: Payload,
  work: (req: PayloadRequest) => Promise<T>,
  lock: "posts" | "queue" = "posts",
) {
  const req = await createLocalReq({}, payload);
  await start(req, lock);
  try {
    const result = await work(req);
    await finish(req, true);
    return result;
  } catch (error) {
    await finish(req, false).catch(() => undefined);
    throw error;
  }
}

export function withSeoPayloadTransaction<T>(
  payload: Payload,
  work: (scoped: Payload) => Promise<T>,
  lock: "posts" | "queue" = "queue",
) {
  return withSeoTransaction(
    payload,
    (req) => {
      const operations = new Set([
        "find",
        "findByID",
        "findVersions",
        "create",
        "update",
        "count",
      ]);
      const scoped = new Proxy(payload, {
        get(target, property) {
          const value = Reflect.get(target, property);
          if (operations.has(String(property)) && typeof value === "function") {
            return async (args: Record<string, unknown>) => {
              const owner = requestOwnership.get(req);
              const db = payload.db as unknown as Database;
              if (
                !owner ||
                owner.poisoned ||
                (await req.transactionID) !== owner.id ||
                !db.sessions[owner.id]
              )
                throw new TypeError("SEO transaction ownership was lost");
              return value.call(target, { ...args, req });
            };
          }
          return value;
        },
      });
      return work(scoped);
    },
    lock,
  );
}

export const beginPostWrite: CollectionBeforeOperationHook = async ({
  args,
  operation,
}) => {
  if (
    args.req &&
    writeOperations.has(operation) &&
    (await start(args.req, "posts"))
  )
    ownedOperations.add(args);
  return args;
};

export const finishPostWrite: CollectionAfterOperationHook = async ({
  args,
  result,
  operation,
}) => {
  if (
    ["update", "delete"].includes(operation) &&
    result &&
    typeof result === "object" &&
    "errors" in result &&
    Array.isArray(result.errors) &&
    result.errors.length
  ) {
    throw new TypeError(
      "Blog bulk operation failed; all changes were rolled back",
    );
  }
  // Payload names single-document afterOperation hooks updateByID/deleteByID,
  // although their beforeOperation hook names are update/delete.
  if (
    args.req &&
    (writeOperations.has(operation) ||
      operation === "updateByID" ||
      operation === "deleteByID")
  ) {
    const owner = requestOwnership.get(args.req);
    if (owner) owner.postsChanged = true;
  }
  if (args.req && ownedOperations.has(args)) {
    ownedOperations.delete(args);
    await finish(args.req, true);
  }
  return result;
};

export function assertExpectedPostRevision(
  context: Record<string, unknown>,
  original: { updatedAt?: string } | undefined,
) {
  const expected = context.expectedBlogUpdatedAt;
  if (typeof expected === "string" && original?.updatedAt !== expected) {
    throw new TypeError("Article changed; reload before applying this action");
  }
  if (
    typeof context.expectedBlogRevision === "string" &&
    (!original || postRevision(original) !== context.expectedBlogRevision)
  ) {
    throw new TypeError("Article changed; reload before applying this action");
  }
}

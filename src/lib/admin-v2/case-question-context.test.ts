import { PGlite } from "@electric-sql/pglite";
import type { Payload } from "payload";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { loadCaseQuestionContext } from "./case-question-context";

const admin = { id: 1, active: true, role: "admin" };

describe("bounded case question context", () => {
  let database: PGlite;
  let payload: Payload;

  beforeAll(async () => {
    database = new PGlite();
    await database.exec(`
      CREATE TABLE messages (
        id integer PRIMARY KEY,
        lead_id integer NOT NULL,
        direction text NOT NULL,
        category text NOT NULL,
        channel text,
        subject text,
        body_text text,
        body_html text,
        status text,
        idempotency_key text,
        ai_analysis jsonb,
        ai_assisted boolean,
        failure_code text,
        failure_message text,
        reply_to_message_id integer,
        delivered_at timestamptz,
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL
      );
      INSERT INTO messages (id, lead_id, direction, category, channel, subject, body_text, status, idempotency_key, created_at, updated_at)
      SELECT n, 7, 'inbound', 'customer_question', 'email', 'Question ' || n, 'Body ' || n, 'delivered', 'question-' || n, '2026-01-01T00:00:00Z'::timestamptz + n * interval '1 minute', '2026-01-01T00:00:00Z'::timestamptz + n * interval '1 minute'
      FROM generate_series(1, 126) AS series(n);
      INSERT INTO messages (id, lead_id, direction, category, channel, subject, body_text, status, idempotency_key, reply_to_message_id, created_at, updated_at)
      SELECT 1000 + n, 7, 'outbound', 'ai_reply', 'email', 'Reply ' || n, 'Reply body ' || n, 'delivered', 'reply-' || n, n, '2026-01-01T00:00:00Z'::timestamptz + n * interval '1 minute' + interval '1 second', '2026-01-01T00:00:00Z'::timestamptz + n * interval '1 minute' + interval '1 second'
      FROM generate_series(2, 126) AS series(n);
      INSERT INTO messages (id, lead_id, direction, category, channel, subject, body_text, status, idempotency_key, created_at, updated_at)
      SELECT 3000 + n, 9, 'inbound', 'customer_question', 'email', 'Isolated question ' || n, 'Body ' || n, 'delivered', 'isolated-question-' || n, '2026-01-01T00:00:00Z'::timestamptz + n * interval '1 minute', '2026-01-01T00:00:00Z'::timestamptz + n * interval '1 minute'
      FROM generate_series(1, 126) AS series(n);
      INSERT INTO messages (id, lead_id, direction, category, channel, subject, body_text, status, idempotency_key, reply_to_message_id, created_at, updated_at)
      SELECT 4000 + n, 9, 'outbound', 'ai_reply', 'email', 'Reply ' || n, 'Reply body ' || n, 'delivered', 'isolated-reply-' || n, 3000 + n, '2026-01-01T00:00:00Z'::timestamptz + n * interval '1 minute' + interval '1 second', '2026-01-01T00:00:00Z'::timestamptz + n * interval '1 minute' + interval '1 second'
      FROM generate_series(2, 126) AS series(n);
      INSERT INTO messages (id, lead_id, direction, category, channel, subject, body_text, status, idempotency_key, reply_to_message_id, created_at, updated_at)
      VALUES
        (200, 7, 'inbound', 'customer_question', 'email', 'Historical delivered', 'Old', 'delivered', 'question-200', NULL, '2026-02-01T00:00:00Z', '2026-02-01T00:00:00Z'),
        (201, 7, 'outbound', 'ai_reply', 'email', 'Historical delivered reply', 'Old reply', 'delivered', 'reply-200', 200, '2026-02-01T00:01:00Z', '2026-02-01T00:01:00Z'),
        (202, 7, 'inbound', 'customer_question', 'email', 'New failed', 'New', 'delivered', 'question-202', NULL, '2026-02-02T00:00:00Z', '2026-02-02T00:00:00Z'),
        (203, 7, 'outbound', 'ai_reply', 'email', 'New failed reply', 'Failed reply', 'failed', 'reply-202', 202, '2026-02-02T00:01:00Z', '2026-02-02T00:01:00Z'),
        (204, 10, 'inbound', 'customer_question', 'email', 'Cancelled only', 'Cancelled', 'delivered', 'question-204', NULL, '2026-02-03T00:00:00Z', '2026-02-03T00:00:00Z'),
        (205, 10, 'outbound', 'ai_reply', 'email', 'Cancelled reply', 'Cancelled reply', 'cancelled', 'reply-204', 204, '2026-02-03T00:01:00Z', '2026-02-03T00:01:00Z'),
        (206, 8, 'inbound', 'customer_question', 'email', 'Other lead', 'Other', 'delivered', 'question-other', NULL, '2026-03-01T00:00:00Z', '2026-03-01T00:00:00Z');
      INSERT INTO messages (id, lead_id, direction, category, channel, subject, body_text, status, idempotency_key, reply_to_message_id, created_at, updated_at)
      VALUES
        (211, 7, 'outbound', 'ai_reply', 'email', 'Older delivered reply', 'Delivered first', 'delivered', 'reply-202-old', 202, '2026-02-02T00:00:30Z', '2026-02-02T00:00:30Z'),
        (207, 7, 'outbound', 'ai_reply', 'email', 'Retry then delivered', 'Old attempt', 'failed', 'reply-208-old', 208, '2026-04-01T00:00:00Z', '2026-04-01T00:00:00Z'),
        (209, 7, 'outbound', 'ai_reply', 'email', 'Retry then delivered', 'New attempt', 'delivered', 'reply-208-new', 208, '2026-04-01T00:01:00Z', '2026-04-01T00:01:00Z'),
        (208, 7, 'inbound', 'customer_question', 'email', 'Delivered latest reply', 'Question with delivery', 'delivered', 'question-208', NULL, '2026-04-01T00:00:00Z', '2026-04-01T00:00:00Z');
    `);
    payload = {
      db: {
        name: "postgres",
        pool: {
          connect: async () => ({
            query: (text: string, values?: unknown[]) => database.query(text, values),
            release: () => {},
          }),
        },
      },
    } as unknown as Payload;
  }, 30_000);

  afterAll(async () => database?.close());

  it("finds an oldest-only unresolved question beyond 100 newer questions", async () => {
    const context = await loadCaseQuestionContext(payload, admin, 9);
    expect(context.latest?.question.id).toBe(3126);
    expect(context.unresolved?.question.id).toBe(3001);
    expect(context.unresolved?.reply).toBeNull();
    expect(context.threads.length).toBeLessThanOrEqual(2);
  });

  it("uses the latest non-cancelled reply and treats newer failure as unresolved", async () => {
    const context = await loadCaseQuestionContext(payload, admin, 7, [202, 204, 208]);
    expect(context.unresolved?.question.id).toBe(202);
    expect(context.threads.find((thread) => thread.question.id === 202)?.reply).toMatchObject({ id: 203, status: "failed" });
    expect(context.threads.find((thread) => thread.question.id === 208)?.reply).toMatchObject({ id: 209, status: "delivered" });
  });

  it("ignores cancelled replies and excludes cross-lead requested IDs", async () => {
    const context = await loadCaseQuestionContext(payload, admin, 10, [204, 206]);
    expect(context.threads.map((thread) => thread.question.id)).toContain(204);
    expect(context.threads.map((thread) => thread.question.id)).not.toContain(206);
    expect(context.unresolved?.question.id).toBe(204);
  });

  it("bounds requested IDs to 25 and rejects invalid lead/target IDs", async () => {
    await expect(loadCaseQuestionContext(payload, admin, 7, Array.from({ length: 26 }, (_, index) => index + 1))).rejects.toThrow("TOO_MANY_QUESTION_IDS");
    await expect(loadCaseQuestionContext(payload, admin, 0)).rejects.toThrow("INVALID_CASE_ID");
    await expect(loadCaseQuestionContext(payload, admin, 7, [0])).rejects.toThrow("INVALID_QUESTION_ID");
  });

  it("authenticates before acquiring a database connection", async () => {
    const connect = vi.fn();
    const unauthorised = {
      db: { name: "postgres", pool: { connect } },
    } as unknown as Pick<Payload, "db">;
    await expect(loadCaseQuestionContext(unauthorised, null, 7)).rejects.toMatchObject({ code: "ADMIN_REQUIRED" });
    expect(connect).not.toHaveBeenCalled();
  });
});

import { describe, expect, it } from "vitest";
import { postgresSslOptions } from "../../../scripts/postgres-ssl.mjs";

describe("PostgreSQL SSL selection", () => {
  it("disables TLS only when the connection explicitly requests it", () => {
    expect(postgresSslOptions("postgresql://postgres@127.0.0.1/test?sslmode=disable", {})).toBe(false);
    expect(postgresSslOptions("postgresql://postgres@127.0.0.1/test", { PGSSLMODE: "disable" })).toBe(false);
  });

  it("keeps encrypted hosted connections by default", () => {
    expect(postgresSslOptions("postgresql://example.invalid/test", {})).toEqual({ rejectUnauthorized: false });
    expect(postgresSslOptions("postgresql://example.invalid/test?sslmode=require", {})).toEqual({ rejectUnauthorized: false });
  });
});

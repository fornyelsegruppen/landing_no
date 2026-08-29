import { describe, expect, it } from "vitest";
import {
  customerReplyRecoveryCode,
  customerReplyRecoveryKind,
} from "./customer-reply-recovery";

describe("customer reply recovery", () => {
  it("classifies typed and legacy safety rejections", () => {
    expect(
      customerReplyRecoveryKind({
        code: "CUSTOMER_REPLY_SAFETY_REJECTED",
      }),
    ).toBe("safety_rejected");
    expect(
      customerReplyRecoveryCode({
        error:
          "AI reply contains a price that is not in the approved quote snapshot",
      }),
    ).toBe("CUSTOMER_REPLY_SAFETY_REJECTED");
  });

  it("classifies changed source evidence as requiring a replacement draft", () => {
    expect(
      customerReplyRecoveryKind({
        error:
          "The case documents, prices or active company terms changed after this draft was generated. Create a new reply draft before sending.",
      }),
    ).toBe("source_changed");
    expect(
      customerReplyRecoveryCode({
        code: "CUSTOMER_REPLY_SOURCE_CHANGED",
      }),
    ).toBe("CUSTOMER_REPLY_SOURCE_CHANGED");
  });

  it("keeps revision conflicts distinct from content recovery", () => {
    expect(
      customerReplyRecoveryKind({ code: "MESSAGE_REVISION_CONFLICT" }),
    ).toBe("refresh");
  });

  it("classifies typed and legacy AI quota failures separately", () => {
    expect(customerReplyRecoveryKind({ code: "AI_USAGE_LIMIT_REACHED" })).toBe(
      "quota_limited",
    );
    expect(
      customerReplyRecoveryKind({
        error: "AI daily request limit reached",
      }),
    ).toBe("quota_limited");
  });
});

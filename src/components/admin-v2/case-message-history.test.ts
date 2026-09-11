import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CaseMessageHistory } from "./case-message-history";

const messages = Array.from({ length: 7 }, (_, index) => ({
  id: index + 1,
  subject: `Message ${index + 1}`,
}));

const MessageHistory = CaseMessageHistory<(typeof messages)[number]>;

function renderHistory(
  items = messages.slice(0, 6),
  excludedMessageId?: number,
) {
  return renderToStaticMarkup(
    createElement(MessageHistory, {
      excludedMessageId,
      messages: items,
      olderLabel: "Show older messages",
      renderMessage: (message: (typeof messages)[number]) =>
        createElement(
          "article",
          { id: `message-${message.id}`, key: message.id },
          message.subject,
        ),
    }),
  );
}

describe("CaseMessageHistory", () => {
  it("renders nothing when there are no messages", () => {
    expect(renderHistory([])).toBe("");
  });

  it("renders five newest messages without an older-message disclosure", () => {
    const html = renderHistory(messages.slice(0, 5));

    expect(html).toContain('id="message-5"');
    expect(html).not.toContain("<details");
  });

  it("collapses the sixth message and keeps its message anchor in the older group", () => {
    const html = renderHistory();

    expect(html).toContain("Show older messages (1)");
    expect(html).toContain("<details");
    expect(html).toContain('id="message-6"');
  });

  it("does not render the reply already displayed in the primary question workbench", () => {
    const html = renderHistory(messages, 2);

    expect(html).not.toContain('id="message-2"');
    expect(html).toContain("Show older messages (1)");
  });
});

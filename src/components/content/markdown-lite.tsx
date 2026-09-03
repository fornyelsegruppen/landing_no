import type { ReactNode } from "react";
import { safeContentHref } from "@/lib/safe-content-link";

type Props = {
  content: string;
  locale?: "no" | "en";
};

export type MarkdownBlock =
  | { type: "heading"; level: 2 | 3 | 4; content: string }
  | { type: "paragraph"; content: string }
  | { type: "unordered-list"; items: string[] }
  | { type: "ordered-list"; items: string[] }
  | { type: "blockquote"; content: string };

export function parseMarkdownBlocks(content: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  let paragraph: string[] = [];
  let unordered: string[] = [];
  let ordered: string[] = [];
  let quote: string[] = [];

  function flush() {
    if (paragraph.length) {
      blocks.push({ type: "paragraph", content: paragraph.join(" ") });
      paragraph = [];
    }
    if (unordered.length) {
      blocks.push({ type: "unordered-list", items: unordered });
      unordered = [];
    }
    if (ordered.length) {
      blocks.push({ type: "ordered-list", items: ordered });
      ordered = [];
    }
    if (quote.length) {
      blocks.push({ type: "blockquote", content: quote.join(" ") });
      quote = [];
    }
  }

  for (const rawLine of content.replace(/\r\n?/g, "\n").split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      flush();
      continue;
    }

    const heading = line.match(/^(#{2,4})\s+(.+)$/);
    if (heading) {
      flush();
      blocks.push({
        type: "heading",
        level: heading[1]?.length === 4 ? 4 : heading[1]?.length === 3 ? 3 : 2,
        content: heading[2] || "",
      });
      continue;
    }

    const unorderedItem = line.match(/^[-*]\s+(.+)$/);
    if (unorderedItem) {
      if (paragraph.length || ordered.length || quote.length) flush();
      unordered.push(unorderedItem[1] || "");
      continue;
    }

    const orderedItem = line.match(/^\d+\.\s+(.+)$/);
    if (orderedItem) {
      if (paragraph.length || unordered.length || quote.length) flush();
      ordered.push(orderedItem[1] || "");
      continue;
    }

    const quoteLine = line.match(/^>\s?(.+)$/);
    if (quoteLine) {
      if (paragraph.length || unordered.length || ordered.length) flush();
      quote.push(quoteLine[1] || "");
      continue;
    }

    if (unordered.length || ordered.length || quote.length) flush();
    paragraph.push(line);
  }

  flush();
  return blocks;
}

function inlineMarkdown(value: string, locale: "no" | "en"): ReactNode[] {
  const pattern = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
  return value.split(pattern).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }

    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      const href = safeContentHref(link[2] ?? "", locale);
      if (!href) return <span key={index}>{link[1]}</span>;
      const external = /^https?:\/\//.test(href);
      return (
        <a
          className="text-accent decoration-accent/40 hover:text-accent-hover underline underline-offset-4"
          href={href}
          key={index}
          {...(external
            ? { rel: "noopener noreferrer", target: "_blank" }
            : {})}
        >
          {link[1]}
        </a>
      );
    }

    return part;
  });
}

export function MarkdownLite({ content, locale = "no" }: Props) {
  const blocks = parseMarkdownBlocks(content);

  return (
    <div className="space-y-5">
      {blocks.map((block, index) => {
        if (block.type === "heading" && block.level === 4) {
          return (
            <h4
              key={index}
              className="text-foreground pt-2 text-lg font-semibold tracking-tight"
            >
              {inlineMarkdown(block.content, locale)}
            </h4>
          );
        }

        if (block.type === "heading" && block.level === 3) {
          return (
            <h3
              key={index}
              className="text-foreground pt-3 text-xl font-semibold tracking-tight"
            >
              {inlineMarkdown(block.content, locale)}
            </h3>
          );
        }

        if (block.type === "heading") {
          return (
            <h2
              key={index}
              className="text-foreground pt-5 text-2xl font-semibold tracking-tight sm:text-3xl"
            >
              {inlineMarkdown(block.content, locale)}
            </h2>
          );
        }

        if (block.type === "unordered-list") {
          return (
            <ul
              key={index}
              className="text-muted-foreground list-disc space-y-2 pl-6"
            >
              {block.items.map((item, lineIndex) => (
                <li key={lineIndex}>{inlineMarkdown(item, locale)}</li>
              ))}
            </ul>
          );
        }

        if (block.type === "ordered-list") {
          return (
            <ol
              key={index}
              className="text-muted-foreground list-decimal space-y-2 pl-6"
            >
              {block.items.map((item, lineIndex) => (
                <li key={lineIndex}>{inlineMarkdown(item, locale)}</li>
              ))}
            </ol>
          );
        }

        if (block.type === "blockquote") {
          return (
            <blockquote
              key={index}
              className="border-accent text-muted-foreground border-l-2 pl-5 italic"
            >
              {inlineMarkdown(block.content, locale)}
            </blockquote>
          );
        }

        return (
          <p key={index} className="text-muted-foreground leading-8">
            {inlineMarkdown(block.content, locale)}
          </p>
        );
      })}
    </div>
  );
}

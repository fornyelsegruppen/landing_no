import type { ReactNode } from "react";
import { safeContentHref } from "@/lib/safe-content-link";

type Props = {
  content: string;
  locale?: "no" | "en";
};

function inlineMarkdown(
  value: string,
  locale: "no" | "en",
): ReactNode[] {
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
          className="text-accent underline decoration-accent/40 underline-offset-4 hover:text-accent-hover"
          href={href}
          key={index}
          {...(external ? { rel: "noopener noreferrer", target: "_blank" } : {})}
        >
          {link[1]}
        </a>
      );
    }

    return part;
  });
}

export function MarkdownLite({ content, locale = "no" }: Props) {
  const blocks = content.split(/\n{2,}/);

  return (
    <div className="space-y-5">
      {blocks.map((block, index) => {
        const trimmed = block.trim();
        if (!trimmed) return null;

        if (trimmed.startsWith("### ")) {
          return (
            <h3
              key={index}
              className="pt-3 text-xl font-semibold tracking-tight text-foreground"
            >
              {inlineMarkdown(trimmed.replace(/^###\s+/, ""), locale)}
            </h3>
          );
        }

        if (trimmed.startsWith("## ")) {
          return (
            <h2
              key={index}
              className="pt-5 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl"
            >
              {inlineMarkdown(trimmed.replace(/^##\s+/, ""), locale)}
            </h2>
          );
        }

        const lines = trimmed.split("\n");
        if (lines.every((line) => line.trimStart().startsWith("- "))) {
          return (
            <ul
              key={index}
              className="list-disc space-y-2 pl-6 text-muted-foreground"
            >
              {lines.map((line, lineIndex) => (
                <li key={lineIndex}>
                  {inlineMarkdown(
                    line.trimStart().replace(/^-\s+/, ""),
                    locale,
                  )}
                </li>
              ))}
            </ul>
          );
        }

        if (lines.every((line) => /^\s*\d+\.\s+/.test(line))) {
          return (
            <ol
              key={index}
              className="list-decimal space-y-2 pl-6 text-muted-foreground"
            >
              {lines.map((line, lineIndex) => (
                <li key={lineIndex}>
                  {inlineMarkdown(line.replace(/^\s*\d+\.\s+/, ""), locale)}
                </li>
              ))}
            </ol>
          );
        }

        if (lines.every((line) => line.trimStart().startsWith("> "))) {
          return (
            <blockquote
              key={index}
              className="border-l-2 border-accent pl-5 italic text-muted-foreground"
            >
              {inlineMarkdown(
                lines.map((line) => line.replace(/^\s*>\s?/, "")).join(" "),
                locale,
              )}
            </blockquote>
          );
        }

        return (
          <p
            key={index}
            className="whitespace-pre-line leading-8 text-muted-foreground"
          >
            {inlineMarkdown(trimmed, locale)}
          </p>
        );
      })}
    </div>
  );
}

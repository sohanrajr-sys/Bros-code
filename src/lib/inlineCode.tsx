import { Fragment } from "react";

/**
 * Problem descriptions are authored with backtick-wrapped identifiers
 * (e.g. "the array `nums`") but rendered as plain text — splits on
 * backtick pairs and wraps the code spans in <code>, leaving everything
 * else untouched.
 */
export function renderInlineCode(text: string): React.ReactNode {
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("`") && part.endsWith("`") && part.length > 1) {
      return (
        <code key={i} className="rounded bg-navy-800 px-1 py-0.5 font-mono text-[0.85em] text-cyan">
          {part.slice(1, -1)}
        </code>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

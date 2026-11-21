import type { DocumentBlock } from "@lazuli/shared";

import { NewTabIndicator } from "@/components/new-tab-indicator.tsx";
import type { AiSelectionPreviewPart } from "@/features/ai/ai-selection-types.ts";
import { cn } from "@/lib/utils.ts";

/** Inline text as it was in the document: bold, italic, colors and links kept. */
export const SelectionInlineContent = ({ content }: { content: DocumentBlock["content"] }) => {
  if (!Array.isArray(content)) return null;
  return content.map((item, itemIndex) => {
    const texts = item.type === "text" ? [item] : item.content;
    const rendered = texts.map((text, textIndex) => (
      <span
        className={cn(
          text.styles.bold && "font-semibold",
          text.styles.italic && "italic",
          text.styles.underline && "underline",
          text.styles.strike && "line-through",
        )}
        key={`${itemIndex}:${textIndex}`}
        style={{
          backgroundColor:
            typeof text.styles.backgroundColor === "string"
              ? text.styles.backgroundColor
              : undefined,
          color: typeof text.styles.textColor === "string" ? text.styles.textColor : undefined,
        }}
      >
        {text.text}
      </span>
    ));
    return item.type === "link" ? (
      <a
        className="text-primary underline underline-offset-2"
        href={item.href}
        key={itemIndex}
        rel="noreferrer"
        target="_blank"
      >
        {rendered}
        <NewTabIndicator />
      </a>
    ) : (
      rendered
    );
  });
};

/**
 * A selected passage as it reads in the document: each block on its own line (titles stronger,
 * quotes marked, list markers kept) and tables as tables, never glued into one run of text.
 */
export const SelectionPreview = ({ parts }: { parts: AiSelectionPreviewPart[] }) => (
  <div className="space-y-2 whitespace-normal">
    {parts.map((part, index) =>
      part.kind === "table" ? (
        <div className="overflow-x-auto lazuli-thin-scrollbar" key={index}>
          <table className="w-full border-collapse text-sm">
            <tbody>
              {part.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td className="border border-border px-2.5 py-1.5 align-top" key={cellIndex}>
                      <SelectionInlineContent content={cell.content} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p
          className={cn(
            "whitespace-pre-wrap",
            part.blockType === "heading" && "font-semibold text-foreground",
            part.blockType === "quote" && "border-l-2 border-border pl-3 italic",
          )}
          key={index}
        >
          {part.text.startsWith("• ") && "• "}
          {part.text.startsWith("☐ ") && "☐ "}
          {/^\d+\. /.exec(part.text)?.[0]}
          {part.text.startsWith("> ") && "> "}
          <SelectionInlineContent content={part.content} />
        </p>
      ),
    )}
  </div>
);

import { foldSearchText } from "../lib/text.ts";

type HighlightSegment = { highlighted: boolean; text: string };

const normalizeWithOffsets = (value: string) => {
  let normalized = "";
  const offsets: { end: number; start: number }[] = [];
  let originalOffset = 0;

  for (const character of value) {
    const folded = foldSearchText(character);
    for (let index = 0; index < folded.length; index += 1)
      offsets.push({ start: originalOffset, end: originalOffset + character.length });
    normalized += folded;
    originalOffset += character.length;
  }

  return { normalized, offsets };
};

export const getHighlightSegments = (text: string, query: string): HighlightSegment[] => {
  const normalizedQuery = foldSearchText(query.trim());
  if (!normalizedQuery) return [{ highlighted: false, text }];

  const { normalized, offsets } = normalizeWithOffsets(text);
  const matches: { end: number; start: number }[] = [];
  let searchFrom = 0;
  while (searchFrom < normalized.length) {
    const matchIndex = normalized.indexOf(normalizedQuery, searchFrom);
    if (matchIndex === -1) break;
    const start = offsets[matchIndex]?.start;
    const end = offsets[matchIndex + normalizedQuery.length - 1]?.end;
    if (start !== undefined && end !== undefined) matches.push({ start, end });
    searchFrom = matchIndex + normalizedQuery.length;
  }
  if (!matches.length) return [{ highlighted: false, text }];

  const segments: HighlightSegment[] = [];
  let cursor = 0;
  for (const match of matches) {
    if (match.start > cursor)
      segments.push({ highlighted: false, text: text.slice(cursor, match.start) });
    segments.push({ highlighted: true, text: text.slice(match.start, match.end) });
    cursor = match.end;
  }
  if (cursor < text.length) segments.push({ highlighted: false, text: text.slice(cursor) });
  return segments;
};

export const HighlightText = ({ query, text }: { query: string; text: string }) =>
  getHighlightSegments(text, query).map((segment, index) =>
    segment.highlighted ? (
      <mark className="bg-muted text-inherit" key={`${segment.text}-${index}`}>
        {segment.text}
      </mark>
    ) : (
      segment.text
    ),
  );

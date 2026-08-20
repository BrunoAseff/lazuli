import { ChevronDownIcon, ChevronUpIcon, SearchIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState, type RefObject } from "react";

import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";

const MATCH_HIGHLIGHT = "lazuli-document-search-match";
const CURRENT_HIGHLIGHT = "lazuli-document-search-current";
const MAX_SEARCH_RESULTS = 500;

type SearchHighlight = { priority?: number };
type SearchHighlightConstructor = new (...ranges: Range[]) => SearchHighlight;
type SearchHighlightRegistry = {
  delete: (name: string) => boolean;
  set: (name: string, highlight: SearchHighlight) => void;
};

const getHighlightApi = () => ({
  HighlightConstructor: (globalThis as unknown as { Highlight?: SearchHighlightConstructor })
    .Highlight,
  registry: (CSS as unknown as { highlights?: SearchHighlightRegistry }).highlights,
});

const clearSearchHighlights = () => {
  const { registry } = getHighlightApi();
  registry?.delete(MATCH_HIGHLIGHT);
  registry?.delete(CURRENT_HIGHLIGHT);
};

const findRanges = (root: HTMLElement, query: string) => {
  const ranges: Range[] = [];
  const normalizedQuery = query.toLocaleLowerCase("pt-BR");

  for (const block of Array.from(root.querySelectorAll<HTMLElement>(".bn-block-content"))) {
    const nodes: Array<{ node: Text; start: number; end: number }> = [];
    let text = "";
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) =>
        node.parentElement?.closest(".bn-block-content") === block
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT,
    });

    let current = walker.nextNode();
    while (current) {
      const node = current as Text;
      const start = text.length;
      text += node.data;
      if (node.data.length) nodes.push({ node, start, end: text.length });
      current = walker.nextNode();
    }

    const normalizedText = text.toLocaleLowerCase("pt-BR");
    let matchStart = normalizedText.indexOf(normalizedQuery);
    while (matchStart >= 0) {
      const matchEnd = matchStart + normalizedQuery.length;
      const startNode = nodes.find(({ start, end }) => matchStart >= start && matchStart < end);
      const endNode = nodes.find(({ start, end }) => matchEnd > start && matchEnd <= end);
      if (startNode && endNode) {
        const range = document.createRange();
        range.setStart(startNode.node, matchStart - startNode.start);
        range.setEnd(endNode.node, matchEnd - endNode.start);
        ranges.push(range);
        if (ranges.length === MAX_SEARCH_RESULTS) return { ranges, truncated: true };
      }
      matchStart = normalizedText.indexOf(normalizedQuery, matchStart + normalizedQuery.length);
    }
  }

  return { ranges, truncated: false };
};

export const DocumentFind = ({
  editorRef,
  showTrigger = true,
}: {
  editorRef: RefObject<HTMLDivElement | null>;
  showTrigger?: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<Range[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [navigationVersion, setNavigationVersion] = useState(0);
  const [contentRevision, setContentRevision] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = () => {
    clearSearchHighlights();
    setOpen(false);
    setQuery("");
    setMatches([]);
    setTruncated(false);
    setCurrentIndex(0);
  };

  useEffect(() => {
    const root = editorRef.current;
    if (!open || !root) return;
    let frame = 0;
    const observer = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setContentRevision((value) => value + 1));
    });
    observer.observe(root, { characterData: true, childList: true, subtree: true });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [editorRef, open]);

  useEffect(() => {
    const handleFind = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.key.toLowerCase() !== "f")
        return;
      event.preventDefault();
      setOpen(true);
      requestAnimationFrame(() => inputRef.current?.select());
    };
    window.addEventListener("keydown", handleFind);
    return () => window.removeEventListener("keydown", handleFind);
  }, []);

  useEffect(() => {
    if (!open || !query || !editorRef.current) {
      setMatches([]);
      setTruncated(false);
      setCurrentIndex(0);
      return;
    }
    const result = findRanges(editorRef.current, query);
    setMatches(result.ranges);
    setTruncated(result.truncated);
    setCurrentIndex((current) => Math.min(current, Math.max(0, result.ranges.length - 1)));
  }, [contentRevision, editorRef, open, query]);

  useEffect(() => {
    clearSearchHighlights();
    const current = matches[currentIndex];
    if (!current) return;

    const { HighlightConstructor, registry } = getHighlightApi();
    if (HighlightConstructor && registry) {
      const allMatches = new HighlightConstructor(...matches);
      const currentMatch = new HighlightConstructor(current);
      currentMatch.priority = 1;
      registry.set(MATCH_HIGHLIGHT, allMatches);
      registry.set(CURRENT_HIGHLIGHT, currentMatch);
    }

    const element = current.startContainer.parentElement;
    (element?.closest(".bn-block") ?? element)?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [currentIndex, matches, navigationVersion]);

  useEffect(
    () => () => {
      clearSearchHighlights();
    },
    [],
  );

  const move = (direction: 1 | -1) => {
    if (!matches.length) return;
    setCurrentIndex((current) => (current + direction + matches.length) % matches.length);
    setNavigationVersion((version) => version + 1);
  };

  return (
    <>
      <style>{`
        ::highlight(${MATCH_HIGHLIGHT}) {
          color: inherit;
          background-color: var(--search-match);
        }

        ::highlight(${CURRENT_HIGHLIGHT}) {
          color: inherit;
          background-color: var(--search-current);
        }
      `}</style>
      {showTrigger && (
        <Button
          aria-label="Pesquisar no documento"
          onClick={() => {
            setOpen(true);
            requestAnimationFrame(() => inputRef.current?.select());
          }}
          size="icon"
          variant="ghost"
        >
          <SearchIcon />
        </Button>
      )}
      {open && (
        <div className="absolute top-[calc(100%+0.5rem)] right-3 z-30 flex w-[min(30rem,calc(100vw-1.5rem))] items-center gap-1 border bg-popover p-1.5 shadow-lg sm:right-5">
          <div className="relative min-w-0 flex-1">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Pesquisar texto no documento"
              autoComplete="off"
              className="h-8 pr-12 pl-8"
              onChange={(event) => {
                setQuery(event.target.value);
                setCurrentIndex(0);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") move(event.shiftKey ? -1 : 1);
                if (event.key === "Escape") close();
              }}
              placeholder="Pesquisar no documento"
              ref={inputRef}
              type="text"
              value={query}
            />
            <span
              aria-live="polite"
              className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[0.6875rem] tabular-nums text-muted-foreground"
            >
              {query
                ? `${matches.length ? currentIndex + 1 : 0}/${matches.length}${truncated ? "+" : ""}`
                : ""}
            </span>
          </div>
          <Button
            aria-label="Resultado anterior"
            disabled={!matches.length}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => move(-1)}
            size="icon-sm"
            variant="ghost"
          >
            <ChevronUpIcon />
          </Button>
          <Button
            aria-label="Próximo resultado"
            disabled={!matches.length}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => move(1)}
            size="icon-sm"
            variant="ghost"
          >
            <ChevronDownIcon />
          </Button>
          <Button aria-label="Fechar pesquisa" onClick={close} size="icon-sm" variant="ghost">
            <XIcon />
          </Button>
        </div>
      )}
    </>
  );
};

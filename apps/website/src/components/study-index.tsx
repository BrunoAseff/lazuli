import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { BackLink } from "@/components/nav-link.tsx";
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  type Ref,
} from "react";
import { Link } from "react-router";

import { OverflowTooltip } from "@/components/overflow-tooltip.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import "./study-index.css";
import { spring, ease } from "@/lib/motion.ts";

/** Identity of the collection with the actions that act on it as a whole. */
export const StudyIndexHeader = ({
  actions,
  backTo,
  backLabel = "Coleções",
  meta,
  project,
  title,
}: {
  actions: ReactNode;
  backTo: string;
  backLabel?: string;
  meta: string;
  project: { id: string; title: string } | null;
  title: string;
}) => (
  <header className="study-index-header">
    <BackLink to={backTo}>{backLabel}</BackLink>
    <OverflowTooltip text={title}>
      {(ref) => (
        <h1 className="study-index-title" ref={ref as Ref<HTMLHeadingElement>}>
          {title}
        </h1>
      )}
    </OverflowTooltip>
    <p className="study-index-meta">
      {project ? (
        <Link className="study-index-project" to={`/documents/${project.id}`}>
          {project.title}
        </Link>
      ) : (
        <span>Sem projeto</span>
      )}
      <span aria-hidden="true">·</span>
      <span className="shrink-0 tabular-nums">{meta}</span>
    </p>
    <div className="study-index-actions">{actions}</div>
  </header>
);

/** Shared list region: one moving marker follows the item open in the editor. */
export const StudyIndexList = ({
  children,
  label,
  selecting,
}: {
  children: ReactNode;
  label: string;
  selecting: boolean;
}) => {
  const id = useId();
  const selection = useListSelection();
  return (
    <LayoutGroup id={id}>
      <SelectionContext.Provider value={selection.api}>
        <ul
          aria-label={label}
          className="study-index-list"
          data-dragging={selection.dragging || undefined}
          data-selecting={selecting || undefined}
          ref={selection.listRef}
        >
          {children}
        </ul>
      </SelectionContext.Provider>
    </LayoutGroup>
  );
};

/*
 * Selecting many at once, the way mail lists do: shift+click on a checkbox sets the whole range
 * from the last one clicked, and pressing a checkbox and dragging over the rows below or above
 * paints its new state on every row crossed (checking or clearing, never flipping each). Clicking
 * a title still opens the item: both gestures start on the checkbox only.
 */
type RowSelect = (selected: boolean) => void;
type SelectionApi = ReturnType<typeof useListSelection>["api"];
const SelectionContext = createContext<SelectionApi | null>(null);

const useListSelection = () => {
  const listRef = useRef<HTMLUListElement>(null);
  const [dragging, setDragging] = useState(false);
  // One stable api for the list's lifetime: rows register once and the anchor survives renders.
  const [api] = useState(() => {
    const rows = new Map<HTMLLIElement, RowSelect>();
    let anchor: HTMLLIElement | null = null;
    let drag: {
      origin: HTMLLIElement;
      last: HTMLLIElement;
      value: boolean;
      moved: boolean;
    } | null = null;
    const ordered = () =>
      Array.from(
        listRef.current?.querySelectorAll<HTMLLIElement>(":scope > .study-index-row") ?? [],
      );
    /** Sets every row from one to the other, inclusive, whichever comes first. */
    const paint = (from: HTMLLIElement, to: HTMLLIElement, value: boolean) => {
      const list = ordered();
      const [start, end] = [list.indexOf(from), list.indexOf(to)].sort((x, y) => x - y);
      if (start < 0) return false;
      for (const item of list.slice(start, end + 1)) rows.get(item)?.(value);
      return true;
    };
    return {
      register: (row: HTMLLIElement, select: RowSelect) => {
        rows.set(row, select);
        return () => {
          rows.delete(row);
          if (anchor === row) anchor = null;
        };
      },
      /** Returns true when the click was taken by a range or a finished drag. */
      click: (row: HTMLLIElement, value: boolean, shift: boolean) => {
        if (drag) {
          const moved = drag.moved;
          drag = null;
          if (moved) return true;
        }
        const from = anchor;
        anchor = row;
        if (!shift || !from || from === row) return false;
        return paint(from, row, value);
      },
      press: (row: HTMLLIElement, value: boolean) => {
        drag = { origin: row, last: row, value, moved: false };
      },
      // A fast pointer skips rows between two events, so the stroke fills from the last row it
      // painted to the one it is over now.
      enter: (row: HTMLLIElement) => {
        if (!drag || row === drag.last) return;
        if (!drag.moved) {
          drag.moved = true;
          setDragging(true);
          window.getSelection()?.removeAllRanges();
        }
        paint(drag.last, row, drag.value);
        drag.last = row;
        anchor = row;
      },
      /** A finished drag keeps its state for the click its release may still send to the box,
       * which it swallows; that click comes before any timer. */
      release: () => {
        if (!drag) return;
        if (drag.moved) window.setTimeout(() => (drag = null));
        else drag = null;
        setDragging(false);
      },
    };
  });

  useEffect(() => {
    window.addEventListener("pointerup", api.release);
    window.addEventListener("pointercancel", api.release);
    return () => {
      window.removeEventListener("pointerup", api.release);
      window.removeEventListener("pointercancel", api.release);
    };
  }, [api]);

  return { api, dragging, listRef };
};

export const StudyIndexRow = ({
  active,
  mark,
  meta,
  muted = false,
  onOpen,
  onSelect,
  selectLabel,
  selected = false,
  title,
  titleText,
}: {
  active: boolean;
  /** Small glyph that carries the item state at rest; selection replaces it on intent. */
  mark: ReactNode;
  meta?: ReactNode;
  /** The item stays in the list but will not be kept (e.g. a proposal left out of the collection). */
  muted?: boolean;
  onOpen: () => void;
  /** Batch selection is optional: lists without bulk actions show only the state glyph. */
  onSelect?: (selected: boolean) => void;
  selectLabel?: string;
  selected?: boolean;
  title: ReactNode;
  /** Plain text of the title, shown in a tooltip when the one-line title is cut. */
  titleText?: string;
}) => {
  const reduced = useReducedMotion();
  const selection = useContext(SelectionContext);
  const rowRef = useRef<HTMLLIElement>(null);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  useEffect(() => {
    const row = rowRef.current;
    if (!row || !selection || !onSelect) return;
    return selection.register(row, (value) => selectRef.current?.(value));
  }, [selection, Boolean(onSelect)]);

  const pressCheck = (event: PointerEvent) => {
    if (event.button !== 0 || event.pointerType !== "mouse" || !rowRef.current) return;
    selection?.press(rowRef.current, !selected);
  };
  const clickCheck = (event: MouseEvent) => {
    if (!rowRef.current || !selection) return;
    // Radix skips its own toggle when the click is already handled here.
    if (selection.click(rowRef.current, !selected, event.shiftKey)) event.preventDefault();
  };

  return (
    <li
      className="study-index-row"
      onPointerEnter={
        onSelect ? () => rowRef.current && selection?.enter(rowRef.current) : undefined
      }
      ref={rowRef}
      data-active={active || undefined}
      data-muted={muted || undefined}
      data-selectable={onSelect ? "" : undefined}
      data-selected={selected || undefined}
    >
      {active && (
        <motion.span
          aria-hidden="true"
          className="study-index-marker"
          layoutId="study-index-marker"
          transition={reduced ? { duration: 0 } : spring.morph}
        />
      )}
      <span className="study-index-lead">
        <span aria-hidden="true" className="study-index-mark">
          {mark}
        </span>
        {onSelect && (
          <Checkbox
            aria-label={selectLabel}
            checked={selected}
            className="study-index-check"
            onCheckedChange={(value) => onSelect(value === true)}
            onClick={clickCheck}
            onPointerDown={pressCheck}
          />
        )}
      </span>
      {/* The whole row is the open button (its hit area covers the row), so the tooltip for a cut
          title hangs on the button while the cut is measured on the title itself. */}
      {titleText ? (
        <OverflowTooltip side="right" text={titleText}>
          {(ref) => (
            <button
              aria-current={active ? "true" : undefined}
              className="study-index-open"
              onClick={onOpen}
              type="button"
            >
              <span className="study-index-row-title" ref={ref as Ref<HTMLSpanElement>}>
                {title}
              </span>
              {meta && (
                <span className="study-index-row-meta">
                  <span aria-hidden="true" className="study-index-meta-mark">
                    {mark}
                  </span>
                  <span>{meta}</span>
                </span>
              )}
            </button>
          )}
        </OverflowTooltip>
      ) : (
        <button
          aria-current={active ? "true" : undefined}
          className="study-index-open"
          onClick={onOpen}
          type="button"
        >
          <span className="study-index-row-title">{title}</span>
          {meta && (
            <span className="study-index-row-meta">
              <span aria-hidden="true" className="study-index-meta-mark">
                {mark}
              </span>
              <span>{meta}</span>
            </span>
          )}
        </button>
      )}
    </li>
  );
};

export const StudyIndexSkeleton = ({ label }: { label: string }) => (
  <div aria-label={label} className="study-index-skeleton" role="status">
    {Array.from({ length: 8 }, (_, index) => (
      <span key={index} style={{ width: `${62 + ((index * 17) % 30)}%` }} />
    ))}
  </div>
);

/** Scroll container whose top hairline appears only after the list moves under the tools. */
export const StudyIndexScroll = ({ children }: { children: ReactNode }) => {
  const [scrolled, setScrolled] = useState(false);
  return (
    <div
      className="study-index-scroll lazuli-thin-scrollbar"
      data-scrolled={scrolled || undefined}
      onScroll={(event) => setScrolled(event.currentTarget.scrollTop > 0)}
    >
      {children}
    </div>
  );
};

/** Search and filter at rest; the selection bar replaces them in the same row while items are selected. */
export const StudyIndexTools = ({
  children,
  selection,
  selecting,
}: {
  children: ReactNode;
  selection: ReactNode;
  selecting: boolean;
}) => {
  const reduced = useReducedMotion();
  const transition = reduced ? { duration: 0 } : { duration: 0.16, ease: ease.standard };
  return (
    <div className="study-index-tools">
      <AnimatePresence initial={false} mode="popLayout">
        {selecting ? (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="study-index-selection"
            exit={{ opacity: 0, y: reduced ? 0 : -4 }}
            initial={{ opacity: 0, y: reduced ? 0 : 4 }}
            key="selection"
            transition={transition}
          >
            {selection}
          </motion.div>
        ) : (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="study-index-tools-row"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0, y: reduced ? 0 : -4 }}
            key="tools"
            transition={transition}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

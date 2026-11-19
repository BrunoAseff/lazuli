import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { BackLink } from "@/components/nav-link.tsx";
import { useId, useState, type ReactNode, type Ref } from "react";
import { Link } from "react-router";

import { motionTokens } from "@/components/arc/motion-tokens.ts";
import { OverflowTooltip } from "@/components/overflow-tooltip.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import "./study-index.css";

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
  return (
    <LayoutGroup id={id}>
      <ul aria-label={label} className="study-index-list" data-selecting={selecting || undefined}>
        {children}
      </ul>
    </LayoutGroup>
  );
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
  return (
    <li
      className="study-index-row"
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
          transition={reduced ? { duration: 0 } : motionTokens.spring.morph}
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
  const transition = reduced
    ? { duration: 0 }
    : { duration: 0.16, ease: motionTokens.ease.standard };
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

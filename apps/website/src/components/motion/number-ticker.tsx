import { useEffect, useRef } from "react";
import { animate, useInView, useReducedMotion } from "motion/react";

/**
 * A number that counts up once, the first time it comes into view. The final value is in the DOM
 * from the start (no layout shift, correct for screen readers and copy); only the paint counts.
 */
export const NumberTicker = ({
  value,
  format = (n) => Math.round(n).toLocaleString("pt-BR"),
  className,
}: {
  value: number;
  format?: (value: number) => string;
  className?: string;
}) => {
  const node = useRef<HTMLSpanElement>(null);
  const inView = useInView(node, { once: true, margin: "-10% 0px" });
  const reduced = useReducedMotion();
  const played = useRef(false);
  const formatRef = useRef(format);
  formatRef.current = format;
  useEffect(() => {
    const format = formatRef.current;
    const element = node.current;
    if (!element || !inView || reduced || played.current || value === 0) return;
    played.current = true;
    const controls = animate(0, value, {
      duration: Math.min(1.1, 0.5 + Math.log10(Math.abs(value) + 1) * 0.25),
      ease: [0.23, 1, 0.32, 1],
      onUpdate: (current) => (element.textContent = format(current)),
      onComplete: () => (element.textContent = format(value)),
    });
    return () => controls.stop();
  }, [inView, reduced, value]);
  // Later value changes (refetch) render directly.
  useEffect(() => {
    if (played.current && node.current) node.current.textContent = formatRef.current(value);
  }, [value]);
  return (
    <span ref={node} className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      {format(value)}
    </span>
  );
};

/**
 * Formatted text that starts with a number ("35%", "1.234", "3 de 10"): the number counts up, the
 * rest stays. Anything else ("—", "Sem dados") renders as is.
 */
export const TickingText = ({ text, className }: { text: string; className?: string }) => {
  const match = /^(\d{1,3}(?:\.\d{3})*|\d+)(,\d+)?(.*)$/s.exec(text);
  if (!match) return <span className={className}>{text}</span>;
  const [, whole = "", fraction = "", rest = ""] = match;
  const decimals = fraction ? fraction.length - 1 : 0;
  const value = Number(`${whole.replaceAll(".", "")}.${fraction.slice(1) || "0"}`);
  const format = (current: number) =>
    `${current.toLocaleString("pt-BR", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}${rest}`;
  return <NumberTicker className={className} format={format} value={value} />;
};

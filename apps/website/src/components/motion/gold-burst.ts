/**
 * Pyrite flecks released from an element: a few small gold facets that drift up and fade. Gold
 * is scarce in Lazúli, so this marks mastery only (a flashcard rated "Fácil"). It lives outside
 * React on purpose: the element that triggered it usually unmounts right after (the card leaves).
 */
export function goldBurst(origin: Element, count = 6, force = false) {
  if (!force && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const rect = origin.getBoundingClientRect();
  const gold =
    getComputedStyle(document.documentElement).getPropertyValue("--gold").trim() || "#c9a14a";
  for (let index = 0; index < count; index++) {
    const fleck = document.createElement("span");
    const size = 6 + Math.random() * 4;
    // Spread across the top edge of the origin, rising in a narrow fan.
    const x = rect.left + rect.width * (0.2 + 0.6 * (index / Math.max(1, count - 1)));
    const y = rect.top + rect.height * 0.3;
    Object.assign(fleck.style, {
      position: "fixed",
      left: `${x}px`,
      top: `${y}px`,
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: "1px",
      background: gold,
      pointerEvents: "none",
      zIndex: "60",
    } satisfies Partial<CSSStyleDeclaration>);
    fleck.setAttribute("aria-hidden", "true");
    document.body.append(fleck);
    const drift = (Math.random() - 0.5) * 36;
    const rise = 34 + Math.random() * 30;
    const turn = 45 + (Math.random() - 0.5) * 90;
    const flight = fleck.animate(
      [
        { transform: "translate(-50%, -50%) rotate(45deg) scale(0.4)", opacity: 0 },
        {
          transform: `translate(calc(-50% + ${drift * 0.4}px), calc(-50% - ${rise * 0.4}px)) rotate(${turn}deg) scale(1)`,
          opacity: 1,
          offset: 0.3,
        },
        {
          transform: `translate(calc(-50% + ${drift}px), calc(-50% - ${rise}px)) rotate(${turn + 40}deg) scale(0.6)`,
          opacity: 0,
        },
      ],
      {
        duration: 700 + Math.random() * 250,
        delay: index * 25,
        easing: "cubic-bezier(0.23, 1, 0.32, 1)",
        fill: "both",
      },
    );
    flight.onfinish = flight.oncancel = () => fleck.remove();
  }
}

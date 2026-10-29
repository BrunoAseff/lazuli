import type { PaperOrigin } from "./study-sheet.tsx";

/** The pigment of the selected word travels to that same word in the question. */
export function transferInk(origin: PaperOrigin, target: HTMLElement, host: HTMLElement) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  if (!origin.ink || reduced.matches) return () => {};
  const source = origin.ink;
  const destination = target.getBoundingClientRect();
  const style = getComputedStyle(target);
  const canvas = document.createElement("canvas");
  canvas.className = "lp-ink-transfer";
  canvas.setAttribute("aria-hidden", "true");
  const context = canvas.getContext("2d");
  const stamp = document.createElement("canvas");
  const stampContext = stamp.getContext("2d", { willReadFrequently: true });
  if (!context || !stampContext) return () => {};
  stamp.width = 200;
  stamp.height = 100;
  stampContext.font = `60px ${style.fontFamily}`;
  stampContext.textBaseline = "top";
  stampContext.fillText("azul", 4, 4);
  const raster = stampContext.getImageData(0, 0, stamp.width, stamp.height).data;
  const dots: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < 100; y += 2)
    for (let x = 0; x < 200; x += 2) if (raster[(y * 200 + x) * 4 + 3]! > 90) dots.push({ x, y });
  if (!dots.length) return () => {};
  const left = Math.min(...dots.map((p) => p.x)),
    top = Math.min(...dots.map((p) => p.y));
  const width = Math.max(...dots.map((p) => p.x)) - left,
    height = Math.max(...dots.map((p) => p.y)) - top;
  const ratio = Math.min(devicePixelRatio, 1.5);
  canvas.width = innerWidth * ratio;
  canvas.height = innerHeight * ratio;
  context.scale(ratio, ratio);
  context.fillStyle = style.getPropertyValue("--lp-blue").trim();
  host.append(canvas);
  const originalOpacity = target.style.opacity;
  target.style.opacity = "0";
  let frame = 0,
    start = 0;
  let finished = false;
  const restore = () => {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(frame);
    if (originalOpacity) target.style.opacity = originalOpacity;
    else target.style.removeProperty("opacity");
    canvas.remove();
    reduced.removeEventListener("change", restore);
    window.removeEventListener("resize", restore);
    window.removeEventListener("orientationchange", restore);
    window.visualViewport?.removeEventListener("resize", restore);
    host.removeEventListener("scroll", restore);
  };
  const draw = (now: number) => {
    if (finished) return;
    if (!start) start = now;
    const progress = Math.min(1, (now - start) / 800);
    context.clearRect(0, 0, innerWidth, innerHeight);
    for (const dot of dots) {
      const u = (dot.x - left) / width,
        v = (dot.y - top) / height;
      const local = Math.min(1, Math.max(0, (progress - u * 0.12) / 0.88));
      const t = 1 - Math.pow(1 - local, 3);
      const sx = source.x + u * source.width,
        sy = source.y + v * source.height;
      const dx = destination.x + u * destination.width,
        dy = destination.y + v * destination.height;
      const arc = Math.sin(t * Math.PI);
      context.beginPath();
      context.ellipse(
        sx + (dx - sx) * t + arc * (v - 0.5) * 26,
        sy + (dy - sy) * t - arc * (35 + u * 35),
        Math.max(0.8, destination.width / width),
        Math.max(0.8, destination.height / height),
        0,
        0,
        Math.PI * 2,
      );
      context.fill();
    }
    if (progress < 1) frame = requestAnimationFrame(draw);
    else restore();
  };
  frame = requestAnimationFrame(draw);
  reduced.addEventListener("change", restore);
  window.addEventListener("resize", restore);
  window.addEventListener("orientationchange", restore);
  window.visualViewport?.addEventListener("resize", restore);
  host.addEventListener("scroll", restore, { passive: true });
  return restore;
}

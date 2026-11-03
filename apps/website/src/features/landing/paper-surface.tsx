import { useEffect, useRef } from "react";

type Vector = [number, number, number];

/** A rounded sheet bent at its margins; lighting is continuous, without mesh seams. */
export function PaperSurface() {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext("2d");
    if (!element || !context) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const style = getComputedStyle(element);
    const paper = style.getPropertyValue("--lp-sheet").trim();
    const shade = style.getPropertyValue("--lp-shade").trim();
    const rim = style.getPropertyValue("--lp-sheet-rim").trim();
    const rgb = (hex: string) =>
      [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16));
    const paperRgb = rgb(paper);
    const shadeRgb = rgb(style.getPropertyValue("--lp-blue-deep").trim());
    let width = 0,
      height = 0,
      frame = 0,
      amount = reduced.matches ? 1 : 0,
      start = 0;

    const surface = (u: number, v: number): Vector => {
      const compact = width < 700;
      const margin = compact ? 0.8 : 0.58;
      const edge = Math.max(0, (Math.abs(u) - margin) / (1 - margin));
      const side = Math.sign(u);
      const curve = edge * edge * (3 - 2 * edge);
      const bend = curve * (compact ? 0.18 : 1.05) * (1 + v * 0.12) * amount;
      return [u * 5 - side * bend * 0.35, v * 1.4, bend * (side < 0 ? 0.9 : -0.95)];
    };
    const project = ([x, y, z]: Vector): [number, number] => {
      const perspective = 9 / (9 - z);
      return [
        width * 0.5 + x * width * (width < 700 ? 0.095 : 0.088) * perspective,
        height * 0.5 + y * height * 0.27 * perspective - z * height * 0.07,
      ];
    };
    // Sample the corner arcs densely, then project them with the rest of the sheet.
    const outline = () => {
      const path = new Path2D();
      const ru = width < 700 ? 0.055 : 0.025;
      const rv = 0.07;
      let first = true;
      const point = (u: number, v: number) => {
        const [x, y] = project(surface(u, v));
        if (first) {
          path.moveTo(x, y);
          first = false;
        } else path.lineTo(x, y);
      };
      const arc = (getPoint: (angle: number) => [number, number]) => {
        for (let i = 0; i <= 24; i++) point(...getPoint(((i / 24) * Math.PI) / 2));
      };
      arc((t) => [-1 + ru * (1 - Math.cos(t)), -1 + rv * (1 - Math.sin(t))]);
      for (let i = 0; i <= 180; i++) point(-1 + ru + (i / 180) * (2 - 2 * ru), -1);
      arc((t) => [1 - ru + ru * Math.sin(t), -1 + rv * (1 - Math.cos(t))]);
      for (let i = 0; i <= 24; i++) point(1, -1 + rv + (i / 24) * (2 - 2 * rv));
      arc((t) => [1 - ru + ru * Math.cos(t), 1 - rv + rv * Math.sin(t)]);
      for (let i = 0; i <= 180; i++) point(1 - ru - (i / 180) * (2 - 2 * ru), 1);
      arc((t) => [-1 + ru - ru * Math.sin(t), 1 - rv + rv * Math.cos(t)]);
      for (let i = 0; i <= 24; i++) point(-1, 1 - rv - (i / 24) * (2 - 2 * rv));
      path.closePath();
      return path;
    };
    const draw = () => {
      if (!width || !height) return;
      const ratio = Math.min(devicePixelRatio, 2);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);
      const path = outline();
      context.save();
      context.shadowColor = shade;
      context.shadowBlur = width < 700 ? 16 : 24;
      context.shadowOffsetY = 14;
      context.fillStyle = paper;
      context.fill(path);
      context.restore();

      const light = context.createLinearGradient(0, 0, width, 0);
      for (let i = 0; i <= 100; i++) {
        const u = i / 50 - 1;
        const a = surface(u - 0.001, 0),
          b = surface(u + 0.001, 0);
        const dx = b[0] - a[0],
          dz = b[2] - a[2];
        const length = Math.hypot(dx, dz);
        const illumination = Math.min(1, Math.max(0, (dx + dz * 0.24) / length));
        const strength = (1 - illumination) * 0.16;
        const color = `rgb(${paperRgb.map((value, index) => Math.round(value + (shadeRgb[index]! - value) * strength)).join(",")})`;
        light.addColorStop(Math.max(0, Math.min(1, project(surface(u, 0))[0] / width)), color);
      }
      context.save();
      context.clip(path);
      context.fillStyle = light;
      context.fillRect(0, 0, width, height);
      context.restore();
      context.strokeStyle = rim;
      context.lineWidth = 0.7;
      context.stroke(path);
    };
    const resize = () => {
      const box = element.getBoundingClientRect();
      width = box.width;
      height = box.height;
      const ratio = Math.min(devicePixelRatio, 2);
      element.width = Math.round(width * ratio);
      element.height = Math.round(height * ratio);
      draw();
    };
    const tick = (now: number) => {
      if (!start) start = now;
      const progress = Math.min(1, (now - start) / 1100);
      amount = 1 - Math.pow(1 - progress, 4);
      draw();
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    const settle = () => {
      cancelAnimationFrame(frame);
      amount = 1;
      draw();
    };
    const onVisibility = () => {
      if (document.hidden) settle();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    element.dataset.ready = "true";
    if (!reduced.matches) frame = requestAnimationFrame(tick);
    reduced.addEventListener("change", settle);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      reduced.removeEventListener("change", settle);
      document.removeEventListener("visibilitychange", onVisibility);
      delete element.dataset.ready;
    };
  }, []);
  return <canvas ref={canvas} className="lp-paper-surface" aria-hidden="true" />;
}

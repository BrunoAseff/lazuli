import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils.ts";

/*
 * The material of Lazúli: a polished slab of lapis lazuli. Deep ultramarine with mottled, edged
 * patches and a fine grain; a faint light follows the pointer. Polished, not raw: it must
 * sit behind text without costing contrast.
 *
 * Cost control: rendered below device resolution, at most 30 fps, paused when off screen or when the
 * tab is hidden, a single still frame under reduced motion. Without WebGL the CSS gradient behind the
 * canvas is the fallback, and it is also what shows before the first frame.
 */

const vertex = `
attribute vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }
`;

const fragment = `
precision highp float;
uniform vec2 uResolution;
uniform float uTime;
uniform vec2 uPointer;
uniform float uPointerStrength;
uniform float uSeed;
uniform float uScale;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 5; i++) {
    value += amplitude * noise(p);
    p = p * 2.03 + vec2(17.0, 9.0);
    amplitude *= 0.5;
  }
  return value;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution.y;
  vec2 p = uv * 2.2 + uSeed;
  float t = uTime * 0.004;

  // A slow, large warp only breaks regularity; the body is mottled at two scales with narrow
  // transitions, so patches have edges (stone) instead of soft gradients (smoke).
  vec2 q = vec2(fbm(p * 0.6 + t), fbm(p * 0.6 + vec2(4.1, 2.7) - t));
  float body = fbm(p + 0.8 * q);
  float patches = fbm(p * 2.3 + q * 1.5 + 7.0);

  // Ultramarine without pale areas: the brightest tone stays dark enough for white text, and the
  // texture comes from contrast between tones, never from light patches.
  vec3 night = vec3(0.035, 0.050, 0.170);
  vec3 deep = vec3(0.070, 0.110, 0.400);
  vec3 main = vec3(0.125, 0.195, 0.580);

  vec3 color = mix(deep, main, smoothstep(0.40, 0.60, body));
  color = mix(color, night, smoothstep(0.57, 0.65, patches) * 0.55);

  // Mid-scale mottling, as the dense spotting of real lapis, and a fine crystalline grain.
  color *= 0.9 + 0.2 * fbm(p * 7.0 + q * 2.0);
  color *= 0.94 + 0.12 * noise(gl_FragCoord.xy / (1.8 * uScale));

  float lightDistance = length(uv - uPointer);
  float light = exp(-lightDistance * lightDistance * 3.0) * uPointerStrength;
  color += vec3(0.020, 0.030, 0.070) * light;

  color += (hash(gl_FragCoord.xy + fract(uTime)) - 0.5) * 0.008;
  gl_FragColor = vec4(color, 1.0);
}
`;

const compile = (gl: WebGLRenderingContext, type: number, source: string) => {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
};

export const LapisField = ({
  className,
  seed = 3.1,
  interactive = true,
  quality = 1,
}: {
  className?: string;
  seed?: number;
  /** Light follows the pointer. */
  interactive?: boolean;
  /** Render scale relative to CSS pixels (capped by device pixel ratio). */
  quality?: number;
}) => {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = host.current;
    if (!container) return;
    // A fresh canvas per mount: a context released on unmount is never reused (StrictMode remounts).
    const canvas = document.createElement("canvas");
    canvas.className =
      "absolute inset-0 size-full opacity-0 transition-opacity duration-700 data-[ready=true]:opacity-100";
    const gl = canvas.getContext("webgl", { antialias: false, alpha: false, depth: false });
    if (!gl) return;
    // If the browser drops the context (too many, GPU reset), the CSS gradient shows again.
    const onLost = () => (canvas.dataset.ready = "false");
    canvas.addEventListener("webglcontextlost", onLost);
    container.append(canvas);
    const vs = compile(gl, gl.VERTEX_SHADER, vertex);
    const fs = compile(gl, gl.FRAGMENT_SHADER, fragment);
    const program = gl.createProgram();
    if (!vs || !fs || !program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const uniform = (name: string) => gl.getUniformLocation(program, name);
    const uResolution = uniform("uResolution");
    const uTime = uniform("uTime");
    const uPointer = uniform("uPointer");
    const uPointerStrength = uniform("uPointerStrength");
    const uSeed = uniform("uSeed");
    const uScale = uniform("uScale");
    gl.uniform1f(uSeed, seed);

    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let width = 1;
    let height = 1;
    const resize = () => {
      const rect = container.getBoundingClientRect();
      const scale = Math.min(devicePixelRatio, 1.25) * quality;
      width = Math.max(1, Math.round(rect.width * scale));
      height = Math.max(1, Math.round(rect.height * scale));
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
      gl.uniform1f(uScale, scale);
      gl.uniform2f(uResolution, width, height);
      if (!running) draw(performance.now());
    };

    // Pointer in shader space (y up, units of height); eased so the light glides.
    const pointer = { x: 0.9, y: 0.7, targetX: 0.9, targetY: 0.7, strength: 0, target: 0 };
    const onPointer = (event: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      pointer.targetX = (event.clientX - rect.left) / rect.height;
      pointer.targetY = (rect.bottom - event.clientY) / rect.height;
      pointer.target = 1;
    };
    const onLeave = () => (pointer.target = 0);

    const start = performance.now();
    const draw = (now: number) => {
      pointer.x += (pointer.targetX - pointer.x) * 0.08;
      pointer.y += (pointer.targetY - pointer.y) * 0.08;
      pointer.strength += (pointer.target - pointer.strength) * 0.05;
      gl.uniform1f(uTime, (now - start) / 1000 + seed * 10);
      gl.uniform2f(uPointer, pointer.x, pointer.y);
      gl.uniform1f(uPointerStrength, interactive ? pointer.strength : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    let frame = 0;
    let last = 0;
    let running = false;
    let visible = true;
    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      if (now - last < 1000 / 30) return;
      last = now;
      draw(now);
    };
    const update = () => {
      const shouldRun = visible && !document.hidden && !reduced.matches;
      if (shouldRun && !running) {
        running = true;
        frame = requestAnimationFrame(loop);
      } else if (!shouldRun && running) {
        running = false;
        cancelAnimationFrame(frame);
      }
      if (!shouldRun) draw(performance.now());
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    const intersection = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting);
      update();
    });
    intersection.observe(container);
    document.addEventListener("visibilitychange", update);
    reduced.addEventListener("change", update);
    if (interactive) {
      container.addEventListener("pointermove", onPointer);
      container.addEventListener("pointerleave", onLeave);
    }
    resize();
    canvas.dataset.ready = "true";
    update();

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", update);
      reduced.removeEventListener("change", update);
      container.removeEventListener("pointermove", onPointer);
      container.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("webglcontextlost", onLost);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      canvas.remove();
    };
  }, [interactive, quality, seed]);

  return (
    <div
      ref={host}
      aria-hidden="true"
      className={cn(
        "relative overflow-hidden bg-[radial-gradient(120%_90%_at_70%_20%,var(--lapis-main),var(--lapis-deep)_45%,var(--lapis-night))]",
        className,
      )}
    />
  );
};

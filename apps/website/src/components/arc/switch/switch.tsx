"use client";

import { forwardRef, useRef, useState } from "react";
import type { ComponentPropsWithoutRef, ElementRef } from "react";
import { Switch as SwitchPrimitive } from "radix-ui";
import { motion, useReducedMotion } from "motion/react";
import type { Transition } from "motion/react";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./switch.module.css";

export interface SwitchProps extends ComponentPropsWithoutRef<typeof SwitchPrimitive.Root> {
  label?: string;
}

/** Track inner width (42 - 6 padding) minus the 18px thumb; keep in sync with switch.module.css. */
const size = 18;
const travel = 18;
/** How far the thumb widens toward the other side while pressed. */
const stretch = 5;
/** Critically damped: the thumb lands on its end without overshooting the state it reports. */
const glide: Transition = { ...motionTokens.spring.smooth };

export const Switch = forwardRef<ElementRef<typeof SwitchPrimitive.Root>, SwitchProps>(
  function Switch(
    {
      label,
      className,
      checked,
      defaultChecked,
      onCheckedChange,
      onPointerDown,
      onPointerUp,
      onPointerLeave,
      onPointerCancel,
      onKeyDown,
      onKeyUp,
      onBlur,
      ...props
    },
    ref,
  ) {
    const reduceMotion = useReducedMotion();
    const [internal, setInternal] = useState(defaultChecked ?? false);
    const [pressed, setPressed] = useState(false);
    const on = checked ?? internal;
    // Lazúli adaptation: keyboard changes are immediate; pointer feedback uses transforms,
    // never layout width or an extra pulse after the state has already changed.
    const keyboard = useRef(false);
    const extra = pressed && !reduceMotion && !props.disabled ? stretch : 0;
    const classes = [styles.switch, className].filter(Boolean).join(" ");

    return (
      <SwitchPrimitive.Root
        {...props}
        ref={ref}
        checked={on}
        onCheckedChange={(next) => {
          if (checked === undefined) setInternal(next);
          onCheckedChange?.(next);
        }}
        onPointerDown={(event) => {
          onPointerDown?.(event);
          keyboard.current = false;
          if (!event.defaultPrevented && event.button === 0) setPressed(true);
        }}
        onPointerUp={(event) => {
          onPointerUp?.(event);
          setPressed(false);
        }}
        onPointerLeave={(event) => {
          onPointerLeave?.(event);
          setPressed(false);
        }}
        onPointerCancel={(event) => {
          onPointerCancel?.(event);
          setPressed(false);
        }}
        onKeyDown={(event) => {
          keyboard.current = true;
          onKeyDown?.(event);
          setPressed(false);
        }}
        onKeyUp={(event) => {
          onKeyUp?.(event);
          setPressed(false);
        }}
        onBlur={(event) => {
          onBlur?.(event);
          setPressed(false);
        }}
        className={classes}
        aria-label={props["aria-label"] ?? label}
      >
        <span className={styles.track}>
          {/* The thumb stretches like a held finger and keeps its far edge anchored, then travels on a spring. */}
          <motion.span
            className={styles.thumb}
            style={{ transformOrigin: on ? "right center" : "left center" }}
            initial={false}
            animate={{ x: on ? travel : 0, scaleX: 1 + extra / size }}
            transition={
              reduceMotion || keyboard.current
                ? { duration: 0 }
                : { x: glide, scaleX: motionTokens.spring.snappy }
            }
          />
        </span>
        {label ? <span className={styles.label}>{label}</span> : null}
      </SwitchPrimitive.Root>
    );
  },
);

Switch.displayName = "Switch";

export default Switch;

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";
import { buttonTransition } from "@/components/ui/ui-styles.ts";
import { Spinner } from "@/components/ui/spinner.tsx";
import { MorphText } from "@/components/motion/morph-text.tsx";

const buttonVariants = cva(
  `group/button inline-flex shrink-0 items-center justify-center rounded-[var(--radius)] border border-transparent bg-clip-padding text-sm font-normal whitespace-nowrap outline-none select-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/35 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 ${buttonTransition}`,
  {
    variants: {
      variant: {
        default: "bg-action text-action-foreground hover:bg-[var(--action-hover)]",
        // Hover keeps the card surface and strengthens the edge: a muted fill would match the page.
        outline:
          "border-border bg-card hover:border-[color-mix(in_oklab,var(--foreground)_26%,transparent)] hover:text-foreground aria-expanded:border-[color-mix(in_oklab,var(--foreground)_26%,transparent)] aria-expanded:text-foreground",
        secondary:
          "border-border bg-secondary text-secondary-foreground hover:border-[color-mix(in_oklab,var(--foreground)_26%,transparent)] aria-expanded:border-[color-mix(in_oklab,var(--foreground)_26%,transparent)] aria-expanded:text-secondary-foreground",
        ghost:
          "text-muted-foreground hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:text-[var(--primary-hover)] hover:underline",
      },
      size: {
        default:
          "h-9 gap-1.5 px-3 active:not-aria-[haspopup]:scale-[0.97] has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs active:not-aria-[haspopup]:scale-[0.97] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] leading-none active:not-aria-[haspopup]:scale-[0.97] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg]:block [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-10 gap-2 px-4 active:not-aria-[haspopup]:scale-[0.97] has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        icon: "size-9",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

/** The plain text of a label, through icons and fragments. */
const textOf = (node: React.ReactNode): string => {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (React.isValidElement<{ children?: React.ReactNode }>(node))
    return textOf(node.props.children);
  return "";
};

/**
 * The running form of an action label: labels start with a verb in the infinitive ("Salvar
 * meta", "Excluir"), so "Salvando", "Excluindo". Nothing when the label does not start that way.
 */
export const pendingLabelFor = (label: string) => {
  const verb = label.trim().split(/\s+/)[0] ?? "";
  const match = /^(\p{L}{2,})([aei])r$/iu.exec(verb);
  return match ? `${match[1]}${match[2]}ndo` : undefined;
};

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  pending = false,
  pendingLabel,
  children,
  disabled,
  onClick,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    /**
     * The action is running. The button says so in words (`pendingLabel`, "Salvando"), keeps its
     * focus and ignores further presses instead of greying out. Icon buttons show a spinner.
     */
    pending?: boolean;
    /** What the button is doing while pending, as a gerund: "Salvando", "Criando". */
    pendingLabel?: string;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  if (asChild)
    return (
      <Comp
        data-slot="button"
        data-variant={variant}
        data-size={size}
        className={cn(buttonVariants({ variant, size, className }))}
        disabled={disabled}
        onClick={onClick}
        {...props}
      >
        {children}
      </Comp>
    );

  const iconOnly = typeof size === "string" && size.startsWith("icon");
  // While pending, the button reads as busy: dimmed, a spinner in place of its icon and the
  // running verb ("Salvando"), letters rising in. Idle, it is the plain label.
  const runningLabel = pendingLabel ?? pendingLabelFor(textOf(children)) ?? textOf(children);

  return (
    <Comp
      aria-busy={pending || undefined}
      aria-disabled={pending || undefined}
      data-pending={pending || undefined}
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(
        buttonVariants({ variant, size, className }),
        pending && "relative cursor-progress opacity-65",
      )}
      // It stays focusable and readable while busy; presses are simply ignored.
      disabled={pending ? false : disabled}
      onClick={(event) => {
        if (pending) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
      {...props}
    >
      {!pending ? (
        children
      ) : iconOnly || !runningLabel ? (
        <>
          {/* display: contents keeps the layout; hidden content still reserves its width. */}
          <span style={{ display: "contents", visibility: "hidden" }}>{children}</span>
          <Spinner aria-hidden="true" className="absolute inset-0 m-auto" role="presentation" />
        </>
      ) : (
        <>
          <Spinner aria-hidden="true" role="presentation" />
          <MorphText appear text={runningLabel} />
        </>
      )}
    </Comp>
  );
}

export { Button, buttonVariants };

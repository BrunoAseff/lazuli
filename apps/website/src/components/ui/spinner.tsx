import { cn } from "@/lib/utils";

/**
 * A ring with a quarter lit, drawn on a centred circle so it turns exactly in place (an icon arc
 * with round caps wobbles as it spins). Takes the text colour.
 */
function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg
      aria-label="Carregando"
      className={cn(
        "size-4 shrink-0 animate-spin motion-reduce:animate-[spin_1.6s_linear_infinite]",
        className,
      )}
      data-slot="spinner"
      fill="none"
      role="status"
      style={{ transformOrigin: "50% 50%" }}
      viewBox="0 0 24 24"
      {...props}
    >
      <circle cx="12" cy="12" opacity="0.22" r="9" stroke="currentColor" strokeWidth="2.25" />
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeDasharray="14.14 56.55"
        strokeLinecap="round"
        strokeWidth="2.25"
      />
    </svg>
  );
}

export { Spinner };

import { AutoHeight } from "@/components/auto-height.tsx";
import { cn } from "@/lib/utils.ts";

/**
 * A field's error. It opens its own height and fades in (and closes the same way), so the fields
 * below slide instead of jumping when a message appears. Inside a field's 8px grid the wrapper
 * takes the gap back and the message carries it, so an empty wrapper adds no space.
 */
export const FormFieldError = ({
  id,
  inGrid = true,
  message,
}: {
  id: string;
  /** The parent is a `gap-2` grid (the usual field layout). */
  inGrid?: boolean;
  message?: string;
}) => (
  <AutoHeight className={cn(inGrid && "-mt-2")}>
    {message ? (
      <p
        className={cn("message-in text-xs text-destructive", inGrid ? "pt-2" : "pt-1")}
        id={id}
        role="alert"
      >
        {message}
      </p>
    ) : null}
  </AutoHeight>
);

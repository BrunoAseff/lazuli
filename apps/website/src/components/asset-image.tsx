import { useEffect, useState } from "react";

import { ImageBrokenIcon } from "@/components/icons.tsx";
import { resolveAssetUrl } from "@/features/assets/asset-api.ts";
import { cn } from "@/lib/utils.ts";

/**
 * An image stored by the app (authenticated asset URL), shown as soon as it resolves.
 * The frame keeps its place while loading and says so when the image cannot be shown.
 */
export const AssetImage = ({
  alt,
  className,
  url,
}: {
  alt: string;
  className?: string;
  url: string;
}) => {
  const [state, setState] = useState<{ status: "loading" | "error" } | { src: string }>({
    status: "loading",
  });
  useEffect(() => {
    let active = true;
    setState({ status: "loading" });
    resolveAssetUrl(url)
      .then((src) => active && setState({ src }))
      .catch(() => active && setState({ status: "error" }));
    return () => {
      active = false;
    };
  }, [url]);

  if ("src" in state)
    return (
      <img
        alt={alt}
        className={cn("block h-auto max-w-full rounded-[var(--radius)]", className)}
        src={state.src}
      />
    );
  return (
    <div
      aria-busy={state.status === "loading" || undefined}
      className={cn(
        "grid aspect-[4/3] w-full place-items-center rounded-[var(--radius)] bg-muted/60 text-muted-foreground",
        state.status === "loading" && "animate-pulse",
        className,
      )}
      role="img"
      aria-label={state.status === "error" ? "Não foi possível carregar a imagem." : alt}
    >
      {state.status === "error" && <ImageBrokenIcon aria-hidden="true" className="size-6" />}
    </div>
  );
};

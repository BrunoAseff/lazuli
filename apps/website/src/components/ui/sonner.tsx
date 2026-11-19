import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import { CheckIcon, InfoIcon, Loader2Icon, XIcon } from "@/components/icons.tsx";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        // Plain glyphs: the tinted seal around them carries the type.
        success: <CheckIcon strokeWidth={2.2} />,
        info: <InfoIcon />,
        warning: <span className="text-sm leading-none font-bold">!</span>,
        error: <XIcon strokeWidth={2.2} />,
        loading: <Loader2Icon className="animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      closeButton
      toastOptions={{
        closeButtonAriaLabel: "Fechar aviso",
        classNames: {
          toast: "lz-toast",
          title: "lz-toast-title",
          description: "lz-toast-description",
          icon: "lz-toast-icon",
          closeButton: "lz-toast-close",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };

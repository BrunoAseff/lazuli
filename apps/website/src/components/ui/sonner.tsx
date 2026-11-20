import { Spinner } from "@/components/ui/spinner.tsx";
import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const ToastMark = () => (
  <>
    <span aria-hidden="true" className="lz-toast-facet" />
    <span aria-hidden="true" className="lz-toast-time-clip">
      <span className="lz-toast-time" />
    </span>
  </>
);

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      // The type is a facet in its colour, with the time left as a hairline at the base.
      icons={{
        success: <ToastMark />,
        info: <ToastMark />,
        warning: <ToastMark />,
        error: <ToastMark />,
        loading: <Spinner aria-hidden="true" role="presentation" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
          "--width": "20rem",
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

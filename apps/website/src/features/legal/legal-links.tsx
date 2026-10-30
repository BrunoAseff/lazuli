import { Link } from "react-router";
import { cn } from "@/lib/utils.ts";

export const LegalLinks = ({
  className,
  newTab = false,
}: {
  className?: string;
  newTab?: boolean;
}) => (
  <nav
    aria-label="Documentos legais"
    className={cn(
      "flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground print:hidden",
      className,
    )}
  >
    <Link
      className="underline underline-offset-4 hover:text-foreground"
      to="/termos"
      target={newTab ? "_blank" : undefined}
      rel={newTab ? "noopener noreferrer" : undefined}
    >
      Termos de Uso
    </Link>
    <Link
      className="underline underline-offset-4 hover:text-foreground"
      to="/privacidade"
      target={newTab ? "_blank" : undefined}
      rel={newTab ? "noopener noreferrer" : undefined}
    >
      Política de Privacidade
    </Link>
  </nav>
);

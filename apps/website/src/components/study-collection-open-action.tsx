import { ArrowRightIcon } from "lucide-react";
import { Link } from "react-router";

import { Button } from "@/components/ui/button.tsx";
import { cn } from "@/lib/utils.ts";

export const StudyCollectionOpenAction = ({
  className,
  href,
  title,
}: {
  className?: string;
  href: string;
  title: string;
}) => (
  <Button asChild className={cn("w-full lg:w-auto", className)} size="sm" variant="outline">
    <Link aria-label={`Abrir coleção ${title}`} to={href}>
      Abrir coleção
      <ArrowRightIcon aria-hidden="true" />
    </Link>
  </Button>
);

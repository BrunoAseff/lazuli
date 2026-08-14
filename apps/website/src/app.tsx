import { ArrowRight, BookOpenText, FileText, Layers3 } from "lucide-react";

import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover.tsx";
import { Separator } from "@/components/ui/separator.tsx";
import { Switch } from "@/components/ui/switch.tsx";

const foundations = [
  {
    description: "Organize textos e referências em projetos de estudo.",
    icon: FileText,
    title: "Documentos",
  },
  {
    description: "Transforme conhecimento em revisões recorrentes.",
    icon: Layers3,
    title: "Flashcards",
  },
  {
    description: "Pratique o conteúdo e acompanhe sua evolução.",
    icon: BookOpenText,
    title: "Quizzes",
  },
] as const;

export const App = () => (
  <main className="min-h-svh bg-background text-foreground">
    <header className="border-b">
      <div className="mx-auto flex min-h-16 w-full max-w-6xl items-center justify-between px-5 sm:px-8">
        <span className="font-heading text-2xl font-semibold tracking-tight">Lazúli</span>
        <Badge variant="outline">Fundação do produto</Badge>
      </div>
    </header>

    <div className="mx-auto grid w-full max-w-6xl gap-12 px-5 py-12 sm:px-8 sm:py-20">
      <section className="grid max-w-3xl gap-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Gestão de conhecimento e retenção ativa
        </p>
        <h1 className="font-heading text-5xl font-medium leading-[0.96] tracking-tight sm:text-7xl">
          Do que você lê ao que permanece.
        </h1>
        <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
          Uma base limpa e editorial para organizar documentos, criar materiais de estudo e revisar
          no momento certo.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button>
            Começar agora
            <ArrowRight data-icon="inline-end" />
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">Ver princípios</Button>
            </PopoverTrigger>
            <PopoverContent className="text-sm leading-6">
              Conteúdo em primeiro plano, hierarquia tipográfica e componentes consistentes por
              tokens.
            </PopoverContent>
          </Popover>
        </div>
      </section>

      <Separator />

      <section className="grid gap-4 md:grid-cols-3">
        {foundations.map(({ description, icon: Icon, title }) => (
          <Card className="rounded-none" key={title}>
            <CardHeader>
              <Icon aria-hidden="true" className="size-5" />
              <CardTitle className="font-heading text-2xl">{title}</CardTitle>
              <CardDescription className="leading-6">{description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>

      <Card className="max-w-xl rounded-none">
        <CardHeader>
          <CardTitle className="font-heading text-2xl">Preferências de revisão</CardTitle>
          <CardDescription>Exemplo da fundação de formulário e componentes.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="grid gap-2">
            <Label htmlFor="daily-goal">Meta diária</Label>
            <Input id="daily-goal" inputMode="numeric" placeholder="20 flashcards" />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="grid gap-1">
              <Label htmlFor="review-reminders">Lembretes de revisão</Label>
              <p className="text-sm text-muted-foreground">
                Receba avisos quando houver cards pendentes.
              </p>
            </div>
            <Switch id="review-reminders" />
          </div>
        </CardContent>
      </Card>
    </div>
  </main>
);

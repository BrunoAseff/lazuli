import { z } from "zod";
import { createTransactionalEmailHtml, escapeEmailHtml } from "./transactional-email.ts";
import { createAccountExportEmail } from "./account-export-email.ts";

export const lifecycleEmailKindSchema = z.enum([
  "welcome",
  "plan_changed",
  "cancellation_scheduled",
  "cancellation_reversed",
  "plan_ended",
  "account_deleted",
  "export_requested",
  "export_ready",
  "export_failed",
]);
export type LifecycleEmailKind = z.infer<typeof lifecycleEmailKindSchema>;
export const lifecycleEmailPayloadSchema = z.object({
  name: z.string(),
  plan: z.string().optional(),
  effectiveAt: z.string().optional(),
  categories: z.array(z.string()).optional(),
  exportId: z.string().optional(),
  attachmentKey: z.string().optional(),
  filename: z.string().optional(),
});
export type LifecycleEmailPayload = z.infer<typeof lifecycleEmailPayloadSchema>;

const exportCategoryLabels: Record<string, string> = {
  account: "conta e preferências",
  projects: "projetos e documentos",
  flashcards: "flashcards",
  quizzes: "quizzes",
  references: "referências",
};

export const createLifecycleEmail = (
  kind: LifecycleEmailKind,
  payload: LifecycleEmailPayload,
  websiteUrl: string,
) => {
  if (kind === "export_ready") return createAccountExportEmail({ name: payload.name });
  const date = payload.effectiveAt
    ? new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "long",
        timeStyle: "short",
        timeZone: "America/Sao_Paulo",
      }).format(new Date(payload.effectiveAt))
    : null;
  const messages: Record<
    Exclude<LifecycleEmailKind, "export_ready">,
    { title: string; body: string; action?: { path: string; label: string } }
  > = {
    welcome: {
      title: "Boas-vindas ao Lazúli",
      body: "Sua conta está pronta. Organize seus materiais em um projeto e transforme o que aprende em prática.",
      action: { path: "/dashboard", label: "Começar a estudar" },
    },
    plan_changed: {
      title: "Seu plano foi atualizado",
      body: `O plano ${payload.plan ?? "selecionado"} está ativo na sua conta. Você já pode usar os recursos disponíveis.`,
      action: { path: "/settings/account", label: "Ver minha conta" },
    },
    cancellation_scheduled: {
      title: "Cancelamento agendado",
      body: date
        ? `Seu plano não será renovado. O acesso atual continua até ${date} (horário de Brasília).`
        : "Seu plano não será renovado. Confira a data de encerramento na sua conta.",
      action: { path: "/settings/account", label: "Gerenciar assinatura" },
    },
    cancellation_reversed: {
      title: "Sua assinatura continua ativa",
      body: "O cancelamento agendado foi desfeito. Sua assinatura continuará sendo renovada conforme as condições do seu plano.",
      action: { path: "/settings/account", label: "Gerenciar assinatura" },
    },
    plan_ended: {
      title: "Sua assinatura foi encerrada",
      body: `O acesso à assinatura terminou. Sua conta continua disponível com os recursos do plano ${payload.plan ?? "Básico"}. Consulte sua conta para conferir os limites atuais.`,
      action: { path: "/settings/account", label: "Ver minha conta" },
    },
    account_deleted: {
      title: "Sua conta foi excluída",
      body: "A exclusão da sua conta do Lazúli foi concluída. Você não tem mais acesso à conta ou aos materiais associados a ela.",
    },
    export_requested: {
      title: "Recebemos seu pedido de cópia",
      body: `Estamos preparando a cópia dos dados que você selecionou. Quando estiver pronta, enviaremos o arquivo como anexo a este endereço de e-mail.${payload.categories?.length ? ` Dados selecionados: ${payload.categories.map((category) => exportCategoryLabels[category] ?? "outros dados").join(", ")}.` : ""}`,
    },
    export_failed: {
      title: "Não foi possível preparar sua cópia",
      body: "Não conseguimos concluir a preparação dos seus dados. Você pode solicitar uma nova cópia nas configurações da sua conta.",
      action: { path: "/settings/data", label: "Solicitar outra cópia" },
    },
  };
  const content = messages[kind];
  const greeting = `Olá, ${payload.name}.`;
  const body = `${greeting} ${content.body}`;
  const href = content.action ? new URL(content.action.path, websiteUrl).toString() : undefined;
  return {
    subject: `${content.title} · Lazúli`,
    text: `${body}${href ? `\n\n${content.action!.label}: ${href}` : ""}`,
    html: createTransactionalEmailHtml({
      title: content.title,
      preheader: content.body,
      childrenHtml: `<p style="margin:0;font-size:16px;line-height:1.65">${escapeEmailHtml(greeting)}</p><p style="margin:16px 0 0;font-size:15px;line-height:1.65">${escapeEmailHtml(content.body)}</p>`,
      footerHtml: "Esta mensagem confirma uma atividade da sua conta no Lazúli.",
      action: content.action && href ? { href, label: content.action.label } : undefined,
    }),
  };
};

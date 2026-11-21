# Vistorias do Lazúli — 20/11/2026

Quatro vistorias independentes (segurança, qualidade, DRY/YAGNI, consistência de design), cada uma feita por um agente que só leu o código. Os achados foram conferidos no código antes de entrar aqui; duplicados entre vistorias foram unidos. Testes e checagem de tipos estavam verdes (539 testes).

Códigos: **S** segurança · **Q** qualidade · **R** DRY/YAGNI · **D** design.

---

## P1 — Corrigir já

> **Corrigidos em 20/11** (a796e89, bfe77af, 291c43c, d1404f5). Falta rodar a migração 0039 e definir `LOG_LEVEL=info` (ou omitir) em produção.

1. **Q · Quiz otimista: desfazer uma resposta que falhou apaga ou ressuscita outras** — `apps/website/src/features/quizzes/api/quiz-queries.ts:127-148`
   Cada envio guarda uma cópia inteira do estado. Se duas respostas seguidas falham, a primeira restauração apaga a segunda (ainda em voo) e a segunda restaura uma resposta que não foi salva. "Concluir quiz" fica habilitado e o servidor recusa.
   **Correção:** desfazer só o item que falhou, ou invalidar a tentativa quando a última resposta pendente terminar.

2. **Q · Concluir o quiz com resposta ainda em voo volta a tela para "em andamento"** — `quiz-queries.ts:146-158`, `quiz-attempt-page.tsx:224-227`
   A conclusão não espera as respostas pendentes. A resposta que chega depois sobrescreve o cache da tentativa concluída (ou o servidor recusa a conclusão).
   **Correção:** pôr a conclusão na mesma fila das respostas e nunca sobrescrever um cache já `completed`.

3. **S · Tokens de redefinição de senha e de verificação ficam nos logs** — `apps/server/src/app.ts:56-59`, `logger.ts`
   O Fastify registra a URL completa de cada requisição (nível padrão `debug`, sem máscara). Os links de reset/verificação levam o token na URL. Quem tiver acesso aos logs pode tomar uma conta dentro da validade do token (1 h).
   **Correção:** máscara no serializador de requisição (ou log próprio pela rota, não pela URL) e `LOG_LEVEL=info` em produção.

4. **S · Upload e importação de imagem por URL sem limite de frequência** — `apps/server/src/documents/document-asset-routes.ts:37,96`, `document-routes.ts`, `project-routes.ts`
   Sem rate limit e com a cota de armazenamento desligada por padrão (`COMMERCIAL_LIMITS_ENFORCED=false`), uma conta grátis pode gravar imagens sem fim e usar a importação por URL como proxy de download contra terceiros.
   **Correção:** limitador por usuário nessas rotas (mais rígido no import remoto) e cota ligada em produção.

5. **Q · "Sua pedra" faz varredura completa das respostas de quiz a cada questão** — `apps/server/src/stone/stone-queries.ts:228-238`
   Não há índice em `quiz_attempt_item.question_id`. O custo cresce com as respostas de todos os usuários e roda em cada abertura de "Sua pedra", do cartão do Início e de cada resumo de prática.
   **Correção:** índice `quiz_attempt_item(question_id, answered_at)` ou reescrever a consulta agrupando só as tentativas do usuário.

---

## P2 — Importante

> **Corrigidos em 20/11** (84a5068, 255c44d, b70eaf7, 26adb9e, bca4bcf, dded390, db51b0b, 28f391e). Falta rodar a migração 0040 (uma meta por pessoa) junto com a 0039. Diálogos sem ícone no topo: o título e o rótulo da ação dizem o que acontece.

6. **Q · O momento de subir de nível pode tocar de novo em resumos antigos** — `apps/website/src/features/stone/components/stone-contribution.tsx:28-46`, `stone-queries.ts:400-412`
   A marca de "já mostrado" vale só para a aba (sessionStorage), e o ganho de domínio de quiz é atribuído também a tentativas antigas. Abrir um resultado antigo numa aba nova reabre o diálogo com som.
   **Correção:** só mostrar quando o nível foi alcançado depois do início da sessão (`reachedAt >= startedAt`) e atribuir o domínio de questão à tentativa que completou o segundo dia.

7. **Q · Um toque para pular a animação de nível pode fechar o diálogo** — `level-up-dialog.tsx:126,196-210`
   O botão "Continuar" está invisível mas clicável durante a animação; o toque que pula a animação também o aciona.
   **Correção:** `pointer-events-none` no botão até o fim da sequência.

8. **R · Duas definições diferentes de "item dominado"** — `flashcard-collection-queries.ts:69-72` vs. `stone-queries.ts:196,221,385`
   A faixa dourada da coleção exige que o card não esteja vencido; "Sua pedra" não. Os números podem divergir para o mesmo card.
   **Correção:** um único fragmento SQL de domínio usado pelos três lugares.

9. **D + R · Diálogos de confirmação montados de formas diferentes, vários sem estado de espera** — `project-item-delete-dialog.tsx:35-40`, `reference-delete-button.tsx:84-96`, `quiz-attempt-page.tsx:287-300`, `study-item-editor-controls.tsx:128-133`, `project-dialogs.tsx:325-350`, `flashcard-collection-page.tsx:636-662`
   Fecham antes de a ação terminar; ícone do topo varia (tile vermelho, triângulo, lixeira, nenhum); rótulos ora nomeiam o objeto ("Excluir projeto"), ora não ("Excluir", "Arquivar", "Encerrar").
   **Correção:** usar sempre `ConfirmationDialog`, uma regra de ícone e rótulos com o objeto ("Excluir questão").

10. **D · Três verbos para a mesma relação fonte ↔ material: conectar, ligar, vincular** — `reference-manager.tsx:150,175,208,235,270,294`, `document-references-dialog.tsx:67,94`, `existing-material-picker-dialog.tsx:114,270`, `document-formatting-toolbar.tsx:455`, `document-editor.tsx:266`, `landing-faq.ts:25`, `ai-proposal-review-list.tsx:472,517`
    Às vezes no mesmo diálogo. **Correção:** "Conectar / Desconectar / conectado" em tudo; "vincular" só para a conta Google.

11. **D · Botões preenchidos em todos os cards das listas de coleções** — `flashcard-collection-list.tsx:73`, `quiz-collection-list.tsx:80-89`
    N+1 ações preenchidas na tela, contra a regra de uma por painel (o Início e o projeto já seguem). Sem itens, flashcards e quiz desabilitam de jeitos diferentes. **Correção:** Praticar/Iniciar em outline nos cards; desabilitar igual, com o motivo.

12. **D · Estado "gerando" da IA com dois padrões, um com desfoque** — `ai-selection-generation-dialog.tsx:698-712` vs. `ai-collection-generation-dialog.tsx:1295-1318`
    Seleção usa overlay com `backdrop-blur` (padrão rejeitado), spinner e "Criando propostas…"; coleção usa a gema e "Gerando propostas…". **Correção:** um componente único (o da coleção).

13. **D · Cores de "Difícil" e "Fácil" diferentes em Estatísticas, e "Difícil" dourado no tema escuro** — `study-metrics/metrics-chart.tsx:48-53`, `tokens.css` (`--warning` escuro ≈ pirita)
    **Correção:** mesmas cores das coleções (Fácil = ouro, Difícil = neutro) e separar o tom de aviso da pirita no escuro.

14. **Q · Excluir um projeto não atualiza favoritos nem a busca** — `apps/website/src/features/projects/api/project-queries.ts:87-100`
    Projeto excluído continua na barra lateral até recarregar. **Correção:** `refreshNavigation` também na exclusão.

15. **R · Escopo "projeto de exemplo" repetido ~10 vezes, e quizzes de exemplo continuam no Início** — `dashboard-queries.ts:262-283,404-454,…`, `project-queries.ts:118`, `commercial-service.ts:51`
    A regra "mostrar o exemplo só sem material próprio" vale para flashcards mas não para quizzes. A coluna `quota_exempt` faz papel de "é exemplo". **Correção:** helpers únicos de escopo e aplicar a regra também aos quizzes.

16. **R · Meta com versões (`effectiveFrom`) que nada mais usa** — `database/schema/stone.ts`, `stone-queries.ts:23,35-40,97-109,336-358`
    Desde que editar a meta vale na hora, cada edição em dia novo cria uma linha que não serve para nada. **Correção:** uma linha por usuário (migração mantendo a mais recente) e remover `goalOn`/`tz` do salvamento.

---

## P3 — Corrigir quando passar pela área

> **Corrigidos em 20/11** (b32bc71, 0013df4, e207877, 7222941, 840764a, c7d70f7, 125a8a7). Notas:
>
> - 20: o CSP publicado é só a base (`base-uri`, `object-src`, `frame-ancestors`, `form-action`) mais HSTS. Restringir `script-src`/`connect-src` exige as origens de produção (API, PostHog, armazenamento) e um hash do script de tema. `TRUST_PROXY` no Railway ainda precisa ser conferido.
> - 26: a frase estava certa ("o histórico … será excluído"); só tirei a repetição.
> - 30: pickers (documento, coleção, projeto, material existente) mantêm o fundo de item de menu; listas de conteúdo sublinham.
> - 33: padrão "Novo X" / "Gerar X com IA".
> - 39: resolvido ao tirar a prévia da landing.

**Segurança** 17. **S · `returnTo` aceita `/\host`** — `features/documents/document-navigation.ts:1-2`. Ctrl+clique no "Voltar" abre o site externo. Validar a origem com `new URL`. 18. **S · Nome do usuário entra cru no texto dos e-mails** — `email/verification-email.ts:14`. Dá para mandar texto de golpe pelo domínio legítimo cadastrando o e-mail de outra pessoa. Restringir o nome ou omiti-lo no e-mail de cadastro. 19. **S · Injeção de fórmula no CSV da exportação** — `account-export-worker.ts:61`. Prefixar com `'` células que começam com `= + - @`. 20. **S · Sem Content-Security-Policy nem HSTS** — `apps/website/public/_headers`. Defesa em profundidade. Confirmar também `TRUST_PROXY` no Railway (sem ele o limite de reset/verificação vira global).

**Qualidade** 21. **Q · Prefetch das configurações não cobre "Uso" e analytics e busca `capabilities` duas vezes** — `account-settings-queries.ts:94-112`. 22. **Q · Gravar a revisão da IA no sessionStorage pode quebrar com muitas propostas** — `ai-review-session.ts:30-37` (sem try/catch). 23. **Q · E-mails leem `process.env.WEBSITE_URL` em vez do env validado** — `transactional-email.ts:38-45`. 24. **Q · Worker de e-mail descarta o erro ao falhar o envio** — `email-worker.ts:132,151` (`catch {}`). 25. **Q · "Continuar" no diálogo do quiz navega sem fechar o diálogo** — `quiz-start-dialog.tsx:37-39`. 26. **R · Erro de concordância** — `quiz-collection-dialogs.tsx:140`: "tentativas também **será excluído**" → "serão excluídas".

**Design** 27. **D · Rodapés e cabeçalhos de diálogo com e sem linha divisória** — 9 diálogos grandes somam `border-t`/`border-b` (ver relatório: ai-_, reference-manager, flashcard-import, editores, document-import). Uma variante única. 28. **D · Linha divisória no resumo da prática** — `stone/components/stone-contribution.tsx:122` (e `dashboard-page.tsx:94` no celular). Separar por espaço. 29. **D · Desfoque em barras fixas e overlays** — `document-editor.tsx:685`, `app-shell.tsx:36`, editores, `ui/dialog.tsx:37`, `alert-dialog.tsx:31`, `sheet.tsx:38`. 30. **D · Linhas com fundo no hover dentro de superfícies brancas** — reference-_, existing-material-picker, document-import-tray, study-collection-picker, project-filter. Decidir: sublinhado nas listas de conteúdo; pickers como itens de menu (exceção documentada). 31. **D · Cinco padrões de "não foi possível carregar"** — dashboard, configurações, projeto, sessão, páginas de erro. Unificar com `EmptyState` + "Tentar novamente" em outline. 32. **D · Esqueletos que não têm a forma do conteúdo** — `study-collection-list-states.tsx:9`, `project-list-states.tsx:12-24`, diálogos de referências. 33. **D · Rótulos de criação genéricos e variados** — "Adicionar" (quiz, flashcards, alternativas), "Criar documento em branco" vs "Novo documento", "Gerar com IA" vs "Criar materiais". Padrão: "Novo X" / "Gerar X com IA", sempre com o objeto. 34. **D · "card" / "cartões" no lugar de "flashcard"** — `flashcard-collection-page.tsx:647,773`, `flashcard-collection-dialogs.tsx:134`, `flashcard-import-dialog.tsx:82,139`, `data-section-page.tsx:59`. 35. **D · Ações de campo fora do padrão de link** — `quiz-alternatives-field.tsx:70-80`, "Adicionar orientação para a IA". Criar a variante `field-link` no Button. 36. **D · Ação destrutiva secundária feita por className em 6 lugares** — variante `destructive-ghost`; "Abandonar" usa lixeira sem apagar. 37. **D · Ações repetidas no mesmo card** — favoritar no coração e no menu; título-link e "Abrir coleção". 38. **D · Cards e painéis do mesmo papel com bordas e paddings diferentes** — `surface-panel` vs `Card` vs caixas avulsas; paddings p-4 a p-8. 39. **D · Prévia da landing diferente do app** — `landing-page.tsx:116-180` ("Revisar", painel "Ritmo de estudo", borda + sombra larga).

**DRY/YAGNI (remoções puras, ~500 linhas e 2 queries por carregamento do Início)** 40. **R · `weeklyActivity` do Início calculado e nunca exibido** — `dashboard-queries.ts:87-139,455-498`, contrato. 41. **R · Campos do Início e das coleções que o site não lê** — `isExample`, `oldestDueAt`, `dismissedAt`, `studiedCards`, `successRateLastSevenDays`, `lastReviewedAt`, `attemptsLastSevenDays`, `lastAttemptAt`. 42. **R · Arquivos e funções mortos** — `study-item-shell.tsx`, `study-summary-metric.tsx`, `recent-documents.tsx`, `send-account-export-email.ts`, `useAbandonPracticeSession` (+ rota sem consumidor), `splitSourceBlockId` (reimplementado), `getBucketBalance`, `planRank`, `getPlanDefinition`, `calculateFlashcardProgress`, constantes de métricas não usadas (e `total < 20` fixo no site), 14 ícones sem uso, tipos exportados sem uso, `packages/utils` vazio. 43. **R · SQL de "quando a prática contou" duplicado e `getStoneContribution` chamando a pedra inteira** — `stone-queries.ts:126-146,374-399,416`.

---

## P4 — Refatorações de manutenção (planejar)

> **Corrigidos em 21/11** (2502dcf, 2b05a28, b07087f, 184115b, 48f471e, 706bffb, c701bf6, 792ae1c). Notas:
>
> - 44: rotas e consultas de coleção numa fábrica comum (`study-collections/`); a exclusão continua por tipo, porque os itens apagados são diferentes. Paginação em `database/pagination.ts`.
> - 49: `try/catch` 500 → `sendInternalError` onde o código era `INTERNAL_ERROR`; rotas com código próprio (exclusão de conta, armazenamento, autenticação, Stripe) ficaram como estão.
> - 51: o marcador dos passos do início e o tema escuro neutro são decisões visuais e estão em /system/propostas, aguardando aprovação.

44. **R · Rotas e queries de coleção duplicadas entre flashcards e quizzes** (diferem em 37 linhas) e paginação repetida em 7 lugares.
45. **R · Estado do editor duplicado nas páginas de coleção** (`useStudyItemEditor`).
46. **R · Quatro implementações de data/fuso** (servidor, métricas, site, pedra) e schemas de `tz` idênticos.
47. **R · Aliases flashcard/quiz sobre `study-collection-contracts`** sem uso.
48. **R · Dois sistemas de tokens de movimento** com valores diferentes para o mesmo nome.
49. **R · Pequenas repetições** — invalidação de créditos 6×, chaves de query fora de `QUERY_KEY_ROOTS`, `MasteryPart` copiado de `MasteryLine`, `textToBlocks` copiado 4×, plural reimplementado, mapa de erros só nos flashcards (quizzes caem no texto genérico), `try/catch` 500 repetido em cada rota, contrato da pedra repetindo `week`/`today`.
50. **R · Comentários desatualizados após mudar meta e brilho** — `schema/stone.ts:8`, `stone-queries.ts:94`, `stone-contracts.ts:91`, `identity-page.tsx:425,458`, `proposals-page.tsx:30`; props só de desenvolvimento (`forceMotion`, `force`) para remover junto com a página de propostas.
51. **D · Detalhes visuais** — rótulo "PROJETOS" em caixa alta (`project-filter.tsx:129`); tamanhos de nome de item fora de 15/500; títulos com Manrope onde deveria ser Newsreader (`session-feedback.tsx`, `legal-page.tsx`, `stone-page.tsx:252`, `level-up-dialog.tsx:142`); ~14 variações de anel de foco; raios misturados; sombras fixas fora dos tokens; "..." vs "…"; marcador de passo do onboarding fora da identidade; margem lateral do projeto (`lg:px-12`); verbos de prática ("Continuar"/"Continuar prática", "ainda não praticado" num quiz); tema escuro ainda puxando para o azul (`--border`, `--background`).

---

## Lacunas de teste

- SQL da pedra sem teste (eventos, disponibilidade, domínio atual, níveis, contribuição) e nenhum banco real nos testes do servidor.
- Quiz otimista sem teste dos erros em sequência e da corrida resposta × conclusão.
- `StoneLevelUp`, `LevelUpDialog` e `useStoneContribution` sem teste.

## O que foi verificado e está sólido

- **Autorização:** todas as ~110 rotas filtram pelo usuário (sem IDOR); CSRF por origem exata; nenhum SQL com interpolação; validação zod com limites.
- **Uploads:** sem XSS nos uploads; magic bytes; proteção contra zip-bomb; SSRF bloqueado na importação remota.
- **Pagamentos e créditos:** webhook do Stripe verificado; créditos de IA com reserva atômica.
- **Conta:** exclusão de conta protegida.
- **Lógica:** idempotência do onboarding e dos níveis; fusos corretos no SQL da pedra.
- **Identidade:** um só conjunto de ícones; cores vindas dos tokens; ouro usado só para domínio (exceto o item 13); um só spinner.

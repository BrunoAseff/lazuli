# Sistema Lazúli — material, memória e origem

Implementação em curso na `develop`, novembro de 2026. Este documento é a referência técnica
vigente para as fundações e componentes migrados. Não representa aprovação visual do proprietário
nem certificação de acessibilidade. O plano e a cobertura de revisão ficam em
[`design-system-review.md`](./design-system-review.md).

## Ideia operacional

O Lazúli transforma material em prática recuperável, não em mais material acumulado. Expressar isso
por relações reais: coleção, situação e próxima ação juntas; pergunta estável ao revelar a resposta;
origem consultável no local de estudo; retorno ao documento preservando contexto.

O espaço de trabalho é neutro frio; a folha é espaço de leitura; tinta sustenta a leitura; lápis-lazúli
assinala ação, foco e vínculo. Essa distinção não exige desenhar papel, cartões inclinados ou
texturas em cada container. Não adicionar streaks, gráficos vazios com números fictícios, metas
ou congratulações que os dados não sustentam.

## Uma fundação, dois temas

Fonte de verdade: `apps/website/src/styles/tokens.css`. A landing usa aliases dessa fundação em
`features/landing/tokens.css`; não manter outra paleta de produto em paralelo.

| Papel              | Claro                  | Escuro            | Uso                             |
| ------------------ | ---------------------- | ----------------- | ------------------------------- |
| `background`       | `#f5f6f8`              | `#181c24`         | trabalho e espaço entre regiões |
| `card`             | folha `#ffffff`        | `#222834`         | unidade independente ou leitura |
| `popover`          | `#ffffff`              | `#272e3b`         | elevação temporária             |
| `foreground`       | `#252c3b`              | `#edf1f8`         | conteúdo e decisão              |
| `muted-foreground` | `#626b7b`              | `#aeb9cc`         | contexto ainda necessário       |
| `primary`          | lápis-lazúli `#40569b` | `#b1c2f6`         | ação e vínculo                  |
| `border`           | tinta a 15%            | tinta clara a 13% | limite semântico                |
| `input`            | tinta a 23%            | tinta clara a 23% | contorno de controle            |
| `line-subtle`      | tinta a 9%             | tinta clara a 8%  | divisão sem competir            |

Usar pares semânticos, sobretudo `primary`/`primary-foreground`, não texto branco fixo no escuro.
Success/danger/warning continuam exclusivos de resultados e consequências; não colorir a
navegação por domínio. Séries de prática usam lápis-lazúli e teal (`chart-3`), não warning para
identificar quizzes. Cor nunca é a única indicação de estado.

### Superfícies e limites

- Shell: orientação, sem uma moldura que percorre regiões de mesma função.
- Navegação: superfície própria, seleção neutra, peso normal; não um botão primário persistente.
- Leitura: uma superfície contínua; não encaixar molduras equivalentes sem uma nova relação.
- Card: objeto ou contexto independente, não uma embalagem automática de seção.
- Borda de campo: encontrável no repouso; foco acrescenta um sinal explícito, não só cor.
- Separador: somente entre grupos que precisam se distinguir, nunca para compensar mau espaçamento.
- Sombra: elevação temporária. Não aplicar elevação a cada item no hover.

Geometria: controles 10px, painéis 16px, overlays 20px. São papéis, não uma regra para aplicar o
mesmo raio a todas as camadas. Considerar distância interna e continuidade ao compor superfícies.

## Texto e densidade

Manrope Variable opera a interface, inclusive seus títulos fixos. Newsreader Variable identifica
fontes, perguntas e leitura sustentada (`font-reading`), não todo título de seção. Fonte e escala
de conteúdo escrito no editor permanecem sob controle
do autor; não confundir um H1 de documento com um título fixo do aplicativo.

| Papel                        | Referência                              | Aplicação                          |
| ---------------------------- | --------------------------------------- | ---------------------------------- |
| Página                       | Manrope `page-title`, 24→28px, peso 600 | título fixo da tela                |
| Seção                        | Manrope 16px, peso 600                  | início de um agrupamento           |
| Objeto principal             | Manrope 20→22px                         | coleção que será estudada          |
| Título editável de documento | Manrope 30px, peso 600                  | nome separado da folha editável    |
| Pergunta de estudo           | serifa 22→30px, entrelinha 1,3          | leitura sustentada, títulos longos |
| Corpo/controle               | sans 14px; leitura longa pode usar 16px | decisão e operação                 |
| Apoio                        | sans 12→14px                            | origem, datas, unidades, estado    |

Não resolver hierarquia apagando apoio nem aumentando todos os títulos. Julgar pares reais de
título, explicação e ação. Número grande só quando o número é a tarefa (por exemplo resultado),
não para separar a revisão da coleção que o usuário precisa abrir.

Ritmo: intervalos internos 8/12/16px; unidades 20/24px; regiões 28/32px. Esses valores não são
uma grade cega. Evitar alturas iguais artificiais: materiais não ficam distantes porque o gráfico
ao lado é mais alto. Na home, ações e biblioteca são uma coluna, ritmo é apoio independente;
abaixo de 1280px, prática precede retrospecto.

## Componentes e contratos

Reutilizar `components/ui` (primitivas acessíveis Radix), não criar controles HTML paralelos.

| Família                   | Dono                                                 | Contrato                                                                          |
| ------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------- |
| Ação                      | `ui/button.tsx`                                      | primária, outline, ghost, destrutiva e link têm papéis distintos                  |
| Campo/busca               | `ui/input`, `search-input`                           | limpar só quando há conteúdo; label independente do placeholder                   |
| Filtros                   | toolbars existentes + `FilterCount`                  | dropdown local, contagem e label acessível coerentes                              |
| Visualização              | `view-selector.tsx`                                  | grupo segmentado controlado; seta/Home/End, um tab stop                           |
| Quantidade discreta       | `quantity-selector.tsx`                              | mesmo contrato segmentado; só aceita os valores oferecidos                        |
| Navegação entre painéis   | `ui/tabs.tsx`                                        | Radix preserva tabs/panels; não substituir por links sem semântica                |
| Alternância               | `ui/switch.tsx`                                      | estado explícito, label associado, disabled; sem simular botão ativo              |
| Origem                    | `MaterialSourcesAction` / `MaterialReferencesButton` | consulta de leitura separada do gerenciamento                                     |
| Custo de IA               | `AiCreditCost`                                       | mesmo custo/saldo/unidades em todos os fluxos                                     |
| Preparar/revisar material | `CreationWorkspace`                                  | fonte estável à esquerda, operação à direita; etapa real, não wizard decorativo   |
| Tipo de material          | `MaterialKindPicker`                                 | escolha explícita de formato com radios, sem Select escondendo as opções          |
| Destino de material       | `StudyCollectionDestination`                         | busca compartilhada, título selecionado preservado, criação inline sem novo modal |
| Importação                | `file-drop-target` + `FileDropzone`                  | borda e superfície respondem, texto não vira azul arbitrariamente                 |
| Conteúdo truncado         | `OverflowTooltip`                                    | tooltip só quando corta; acessível por foco, não hover exclusivo                  |
| Revelação                 | `StudyReveal`                                        | pergunta fica estável; traço de tinta, depois resposta; teclado imediato          |
| Índice do workbench       | `study-index.tsx`                                    | identidade + ações da coleção; busca; linhas com glifo de estado e marcador único |
| Estado de coleção         | `StudyStrip` em `study-collection-card.tsx`          | faixa proporcional de contagens reais; mesmos tons dos glifos do índice           |
| Progresso de sessão       | `StudySessionProgress`                               | régua: uma marca por item (máx. 40), concluída sobe e ganha tinta                 |
| Navegação de quiz         | `QuizStations`                                       | estação por questão: posição, respondida e, no resultado, certa/errada            |
| Alternativa               | `StudyAnswerChoice` / `StudyAnswerOutcome`           | selo com letra; escolher não é corrigir; ✓/✕ só no resultado                      |
| Atalho                    | `ui/kbd.tsx`                                         | dica de tecla decorativa; a ação mantém seu nome acessível                        |
| Sobreposição              | Dialog/AlertDialog/Sheet existentes                  | título, contexto, fechar, retorno de foco; ação destrutiva confirmada             |

Não usar tooltip no lugar de rótulo necessário, nem confirmação para toda ação reversível.
Elementos sem ação não ganham hover. Em superfícies claras e escuras, conferir se o hover é
distinguível do repouso e não apenas assume exatamente a cor do container pai.

Estados obrigatórios por risco: repouso, hover, foco, ativo/selecionado, aberto, disabled,
pending, erro com recuperação, vazio e conteúdo longo. Não reconstruir a geometria inteira
quando muda loading/erro. O skeleton da home acompanha as regiões reais.

`StudyWorkspaceSkeleton` e as coleções compartilham `study-workspace`/`study-workspace-columns`:
mesma altura e mesmas colunas de índice. No celular, o editor toma o lugar da lista; não comprimir
as duas regiões lado a lado. Dentro do editor, status e ações podem ocupar linhas separadas:
a presença de fontes não pode criar overflow horizontal.

No workbench, salvar e refinar são visíveis no cabeçalho do item; duplicar pertence a Organização.
A alternativa de quiz usa texto multilinha com altura pelo conteúdo, resposta correta à esquerda
e botões visíveis de reorganização/remoção à direita; não reservar outra linha de botões nem truncar a resposta
num Input. Remoção continua confirmada, e limites de duas/seis alternativas permanecem inalterados.
O índice prioriza busca e itens: apenas a contagem acompanha o título da lista. Não duplicar ali
o painel de desempenho já disponível nas listagens de coleções e estatísticas. Ações em lote
só ocupam espaço quando há seleção. Não criar menu de uma única ação para remover alternativas.
Detalhes monta seus controles em apenas um lugar: painel quando há largura, drawer no restante.
Não manter uma segunda árvore oculta com diálogos controlados pelo mesmo estado/URL.

Criação manual, geração e refinamento compartilham fonte/destino, não apenas a cor do Dialog.
Na largura estreita, fonte somente de leitura começa recolhida e pode ser consultada; se contém
escolhas obrigatórias, começa aberta. Custo e decisão ficam no rodapé, fora da rolagem dos campos.
Revisão de IA apresenta uma proposta por vez, mantendo edição e inclusão ao navegar entre propostas.
Fontes sugeridas são visíveis e ajustáveis ali; não abrir dois diálogos só para mudar seu escopo.
Conectar uma fonte começa pelo documento e sua prévia, seguido da escolha explícita entre documento
inteiro e trecho. A ação primária muda conforme essa escolha; nenhuma vinculação ocorre só ao selecionar.

Visão geral de estatísticas separa resumo (faixa de quatro indicadores), série (largura útil)
e navegação para detalhes. Tabela não repete a legenda do gráfico: cabeçalhos identificam séries,
valores são tabulares e barras discretas usam os máximos reais da coluna, nunca valores ilustrativos.

Diálogos controlados sem `DialogTrigger` restauram o foco ao elemento que os abriu, respeitando
um `onCloseAutoFocus` explícito. `DialogContent animated={false}` desliga tanto a entrada do
conteúdo quanto a do backdrop; a busca global usa esse contrato por ser uma operação frequente.
Na busca, seleção por teclado é imediata e seleção por ponteiro usa a transição curta compartilhada.

Vazios usam `EmptyState surface="panel"` quando são uma unidade independente e `surface="inline"`
quando já pertencem a um painel. Borda tracejada indica destino de envio, não ausência de dados.
Não mostrar seletor cards/tabela quando não existem documentos para alternar.

## Iconografia

Única família de interface: **Hugeicons gratuito Stroke Rounded**. Imports estáticos de
`@hugeicons/core-free-icons`; renderização `@hugeicons/react` em `components/icons.tsx`.
Nomes antigos permanecem como adaptadores de migração, não significam manter a biblioteca antiga.
Papéis de domínio em `domain-icons.ts`. Traço default 1,65; tamanho definido pelo componente,
normalmente 16px operação e 20px identificação. Ícone decorativo: `aria-hidden`.

A marca de quatro facetas é um SVG próprio, não uma segunda família operacional. BlockNote
usa adaptadores locais para seus imports internos Lucide e Remix (`editor-icons.tsx`, aliases
de Vite espelhados na configuração de testes). Ao atualizar BlockNote, executar o build e
verificar menus: um novo import precisa ser mapeado, não silenciado com fallback vazio.

## Movimento: continuidade, não espera

Motor único: Motion; CSS para cor/contorno/resposta simples. Não manter Anime para um segundo
conjunto de timings. A demonstração pública tem uma exceção expressiva de entrada; o uso repetido
do app não herda esse tempo.

| Gesto                   | Âncora / mudança                                             | Tempo e alternativa                                            |
| ----------------------- | ------------------------------------------------------------ | -------------------------------------------------------------- |
| Hover                   | geometria fixa; cor/contorno                                 | 150ms; sem lift em toda superfície                             |
| Seleção de visualização | track fixo, indicador compartilhado                          | mola Arc; teclado/reduced imediato                             |
| Troca de aba            | texto e conteúdo estáveis, indicador contínuo                | mola Arc; teclado/reduced imediato                             |
| Switch                  | track fixo, thumb translada                                  | mola amortecida; press por escala, não width; teclado imediato |
| Resposta                | pergunta fixa; traço scaleX 0→1, depois resposta +6→0px      | 320ms traço, 240ms resposta (+140ms); teclado/reduced imediato |
| Próximo item na prática | item sai −20px, seguinte entra de +20px (direção no quiz)    | 180ms; reduced só opacity                                      |
| Item aberto no índice   | marcador lateral compartilhado (`layoutId`)                  | mola `morph`; reduced imediato                                 |
| Marca de sessão/estação | marca sobe (scaleY) ou indicador de estação desliza          | mola `snappy`/`morph`; reduced imediato                        |
| Escolha de alternativa  | preenchimento do selo cresce do centro; letra permanece      | mola `snappy`; glifo de resultado 140ms                        |
| Preparação → revisão    | fonte permanece, conteúdo da operação entra 12→0px + opacity | 220ms; reduced sem entrada                                     |
| Fonte no celular        | abertura da consulta, altura medida e opacity                | 180ms abrir / 140ms fechar; teclado/reduced imediato           |
| Demo pública            | material de origem → pergunta                                | 480ms; tinta e folha sincronizadas; reduced sem transferência  |
| Interromper demo        | restaurar transform/opacidade e cancelar canvas              | fechar, resize, orientação, scroll e mudança de preferência    |

Não animar a página inteira a cada navegação, números de uso nem carregamento de perguntas.
Não atrasar informação por stagger. Sem partículas na prática diária, cursor customizado, som
ou animações infinitas. O foco não desaparece para melhorar uma captura.

### UIArc: procedência e adaptações

Fontes gratuitas MIT copiadas: SegmentedControl, Switch e motion tokens. Licença completa em
`components/arc/LICENSE` (Elia Kuratli, 2026). Ponte semântica restrita a `.arc-control` em
`components/arc/foundation.css`; não importar um reset/global theme Arc sobre o produto.
Tabs usa o padrão de seleção compartilhada, mantendo a API Radix existente.

Adaptações: identidade e fontes Lazúli; foco explícito; teclado imediato; switch sem pulso extra
nem animação de largura; ausência de dependência Pro. Componentes Arc não são automaticamente
melhores para tabelas, calendário ou editor complexo já acessíveis. Não substituir por quantidade.

## Validação e manutenção

`/system` é uma bancada **somente em desenvolvimento**, autenticada, com os componentes reais e
exemplos inertes claramente rotulados. Não é uma nova proposta visual de Crivo nem substitui
as telas reais como prova. Nenhum exemplo salva preferências, gera IA ou cria prática.

As rotas autenticadas DEV-only `/system/public`, `/system/login` e `/system/register` renderizam
os componentes públicos reais sem encerrar a sessão de teste. Não são cópias alternativas nem
estão disponíveis no build de produção. Inspecionar uma prévia não valida submissão de cadastro.

Após alterações compartilhadas: `vp install`, `vp check`, `vp test`, `vp run website#build`.
No Node 26, a suíte de SDK analytics existente exige `NODE_OPTIONS=--no-experimental-webstorage`
quando localStorage experimental não tem arquivo configurado; registrar o comando usado.

Separadamente: capturar telas reais com conteúdo longo em claro/escuro, 390/768/1024/1440;
conferir foco, toque, redução de movimento, fechamento rápido e reabertura. Testes de DOM e build
não provam qualidade visual nem animação. Registrar cobertura e lacunas no plano, sem marcar
uma matriz inteira como concluída por inferência.

Referências: [Hugeicons React](https://hugeicons.com/docs/integrations/react/overview),
[UIArc](https://uiarc.dev/llms.txt), [Emil](https://aiforui.dev/skills), skills Crivo locais.

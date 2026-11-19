# Redesign Lazúli — registro de revisão

Estado: segunda rodada estrutural na `develop`, ainda sem aprovação visual do proprietário.
Base examinada: `299658c`, aplicação real; não usar `/design-preview` nem o redesign descartado
do Crivo como baseline. Registro de 16/11/2026; as verificações após quedas de energia fazem parte
da mesma sessão de trabalho. Atualizado em 17/11/2026. Nenhum commit, deploy ou push realizado.

## Revisão do diagnóstico após rejeição da primeira rodada

O proprietário rejeitou a primeira rodada: preservava os fluxos, a disposição e a linguagem tipográfica
que precisavam ser repensados. As tabelas históricas abaixo registram trabalho realizado, não aceitação
estética. A aprovação não pode ser inferida de testes passando nem das skills consultadas.

Segunda rodada: Crivo Design / Compose / System e suas referências de julgamento, expressão,
inspeção e diagnóstico orientaram a mudança de composição e tarefas, não uma nova troca de cor isolada.

| Problema confirmado                                                           | Implementação atual                                                                                                                |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Documento, controles e títulos de seção usavam a mesma assinatura serifada    | Manrope na interface e Newsreader no conteúdo de estudo/fonte; título do documento separado e 30px                                 |
| Ultramarino saturado, warning e neutros quentes não conversavam no contexto   | Fundação neutra fria, azul-lazúli menos saturado e teal para segunda série; hover da home mistura tinta com sua própria superfície |
| Geração empilhava fonte extensa e formulário, escondendo a relação entre eles | `CreationWorkspace`: fonte à esquerda, preparação/revisão à direita; fonte permanece ao avançar; consulta recolhível no celular    |
| Criar coleção exigia abandonar ou sobrepor o fluxo                            | `StudyCollectionDestination`: busca, seleção preservada e criação inline, compartilhado com criação manual                         |
| Revisão acumulava todas as propostas e seus controles numa pilha              | Um material por vez, seleção/edição preservadas entre propostas; citação e ações de fonte no próprio item                          |
| Melhoria escondia intenção em Select e repetia conteúdo em caixas             | Material atual ao lado das opções visíveis de refinamento e da proposta; usa snapshot do draft quando disponível                   |
| Conectar referência não tornava escopo e origem evidentes                     | Documento com prévia e escolha explícita inteiro/trecho; ação primária acompanha a escolha                                         |
| Estatísticas disputavam espaço com questões e botões competiam no rodapé      | Índice sem painel de desempenho; contagem junto da lista; salvar/refinar visíveis; duplicar em Organização                         |
| Estatísticas pareciam outro produto e repetiam indicadores lateralmente       | Resumo horizontal, série larga e navegação para detalhes; tabela com valores e barras proporcionais, sem legenda redundante        |

Correção após rejeição da expansão das métricas: o índice não deve virar um dashboard.
O painel 2×2 e o botão de atividade foram retirados, sem faixa vazia; desempenho continua nas
listagens de coleções e estatísticas. Na mesma viewport de 1135×805, a primeira questão passou
de y=327,34 para y=211,41. Contagem junto da lista e ações em lote somente com seleção.
Exclusão direta verificada abrindo a confirmação e cancelando, sem alterar dados.
Esta conferência não encerra os demais pontos do redesign nem valida todos os estados de movimento.

Alternativas de quiz: texto multilinha, marcação à esquerda e botões de reorganização/remoção à direita
substituem texto truncado e segunda linha de quatro botões. A confirmação de remoção foi exercitada
e cancelada na conta real; os testes também verificam o cancelamento e o mínimo de duas opções.

Defeitos concretos encontrados durante esta rodada: regra `md:text-sm` do Textarea sobrescrevia o
título do documento; ícones de abrir/recolher tinham sentidos trocados; ItemText do Select separava
ícone e texto; RadioGroupItem descartava conteúdo customizado das opções de tema; detalhes montava
controles duas vezes (painel oculto + drawer), abrindo dois gerenciadores de fontes. Corrigidos com
regressões de DOM para conteúdo customizado e montagem única. O painel usa a largura real da região,
não a largura da janela, para decidir onde montar os controles.

Cobertura adicional real: geração do documento em desktop e narrow, criação inline aberta/cancelada
com retorno de foco, criação vazia no workbench sem salvar, refinamento aberto sem gerar, fonte
selecionada com prévia e alternância inteiro/trecho sem vincular, visão geral e tabela com comparação
em narrow. No celular, a primeira inspeção mostrou rolagem aninhada da fonte e da tabela; fonte
consultável e tabela sem scroll interno móvel corrigem esses pontos. Capturas finais são evidência
dos estados registrados, não de todo movimento intermediário.

Evidências locais desta rodada: `/tmp/lazuli-redesign-evidence/criacao-fonte-claro.jpg`,
`refinamento-claro.jpg`, `conectar-fonte-claro.jpg`, `estatisticas-claro.jpg` e `tabela-claro.jpg`
no mesmo diretório. Capturas antigas da home não validam esta nova rodada.
`workbench-quiz-escuro.jpg` registra a nova composição das alternativas e `home-final.jpg`
o estado revisado compacto. Cadastro DEV real foi conferido com a nova tipografia sem submissão.
Tema foi restaurado para Sistema e o override de viewport foi removido ao finalizar esta rodada;
a API local respondeu `status: ok`.

Não houve geração cobrada, aplicação de propostas, criação persistida de material/coleção, nova
tentativa de prática, exportação ou exclusão na conta real. Submissões e preservação de estado têm
testes com mocks; isso não substitui integração ponta a ponta com cobrança real.

## Continuação dos pontos de 17/11 (não substitui a lista por uma correção isolada)

| Ponto do proprietário            | Intervenção e evidência atual                                                                                                                                                                                                                                                                                                                                                                          |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1. Fonte extensa                 | `SourceReading` preserva o texto, limita a prévia e permite leitura completa com rolagem. Usado na geração por coleção/documento, consulta e conexão de fontes. A prévia do documento preserva tabelas e filhos, sem corte arbitrário de quatro/dez blocos. Fonte extensa medida sem overflow horizontal.                                                                                              |
| 2–3. Header e salvamento         | Slot fixo para todos os estados de salvamento, conteúdo absoluto com troca de opacidade. Status à esquerda, ações agrupadas à direita. Corrigido o offset de 56px reservado indevidamente em desktop intermediário. Header real medido sem overflow; estados cobertos por teste, sem digitar/salvar na conta.                                                                                          |
| 4. Navegação documental          | Coluna de 18rem, título multilinha, criação/importação numa linha e busca sempre visível junto de pastas em outra. Conferido no documento real em tema claro e no popover de arquivos.                                                                                                                                                                                                                 |
| 5–6. Índice e ações do workbench | Sem painel de desempenho nem botão/faixa vazia; contagem junto da lista. Refinar e mover alternativas visíveis; duplicar em Organização; remoção direta confirmada.                                                                                                                                                                                                                                    |
| 7. Coleção inline                | Mesma linguagem de campos, marca lateral e entrada curta, sem caixa azul aninhada. Escape cancela somente a criação local; Radix é tratado em captura no painel e no diálogo. Regressão testada nos dois e repetida no navegador, com foco retornando ao seletor.                                                                                                                                      |
| 8. Galeria/upload                | Indicador medido em coordenadas locais, somente x/largura. Área de capa com altura definida e conteúdo rolável; mínimo anterior ainda variava 95px e foi rejeitado. Após correção, ambas as abas mediram 688,31px de modal e indicador em y=270,11 na mesma viewport.                                                                                                                                  |
| 9. Vocabulário                   | Fonte/fontes para a origem; busca sem ocorrências de referência/referências no produto, exceto identificadores técnicos e preview descartado.                                                                                                                                                                                                                                                          |
| 10–11. Prática/progresso         | Quiz separa navegação da leitura; alternativas com letra/marca e texto ancorado, sem pilha de caixas em fundos concorrentes. Flashcard revela anotação abaixo da pergunta. Progresso de sessão por intervalos reais, limitado a 24 marcas visuais, sem alterar total anunciado. Componentes reais exercitados na bancada explicitamente sem persistência; não foi criada uma sessão real nesta rodada. |
| 12. Calendário                   | Removidos pseudo-elementos nas extremidades; faixa no dia/célula e foco interno. No navegador, início de intervalo mediu raio de 10px e ring de 2px inset, sem sombra externa. Captura deste estado falhou na aba antiga; não registrar como aprovação visual por screenshot.                                                                                                                          |
| 13 e 15. Famílias e divisões     | Cabeçalhos/células/separadores de tabela compartilhados; linha de dados sem ação não recebe hover de botão. Home, documentos recentes e projetos usam hover misturado com a superfície de origem. Command conserva navegação imediata por teclado e seleção suave de ponteiro. Isso não certifica cada tela da aplicação nem encerra a avaliação estética de cards/listagens/command.                  |
| 14. Continuidade                 | Badge de filtros com entrada/saída; tabs com mola retargetável e caminho imediato por teclado/reduced; criação inline, escolha e revelação com respostas distintas. Testes cobrem estados/teclado; não equivalem a uma gravação de todos os movimentos intermediários.                                                                                                                                 |
| 16. Upload e fontes              | CSV/TXT de flashcards migrou para `FileDropzone`, como documentos e capas. Diálogo documental separa escolha, revisão de nomes e envio; removida moldura adicional por arquivo. Consulta de fontes reutiliza leitura limitada. Upload real, geração cobrada e aplicação não foram executados.                                                                                                          |

Encontrado durante a conferência: atualizar a árvore por HMR podia recriar o contexto de importação
e derrubar o documento. Contexto/hook foram separados do provider; uma recarga recuperou a aba
antiga. Conferência visual continuou em aba limpa do mesmo navegador integrado, sem Playwright
externo e sem trocar de branch. Evidências atuais adicionais em
`/tmp/lazuli-redesign-evidence/documento-composicao-atual.png` e
`/tmp/lazuli-redesign-evidence/importacao-documentos-atual.png`.

As skills Crivo motivaram a revisão das relações e a rejeição das correções insuficientes; não são
certificado de qualidade estética. O item amplo de expressão/consistência continua exigindo juízo
do conjunto, não pode ser marcado concluído só porque os defeitos de geometria têm teste.

## Terceira rodada · 17/11 (continuação do feedback de 14 pontos)

Base de conferência: conta local de teste criada só no banco de desenvolvimento, com coleções,
cards em estados FSRS variados e um quiz com questões longas. Capturas em 2x com Chrome headless
local (1280×800 e 390×844, claro/escuro). Nada foi enviado por e-mail nem gerado com IA cobrada.

| Ponto                      | Decisão desta rodada                                                                                                                                                                                                                                                                                                                                                                                                                          |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5. Índice do workbench     | Flashcards e quizzes duplicavam o mesmo cabeçalho; agora `study-index.tsx`. Ações da coleção (praticar, adicionar, gerar) ficam com a identidade; busca e filtro com a lista. Linha: glifo de estado de memória (anel vazio → meio → cheio; lapis = revisar agora) ou número da questão + resposta correta; checkbox aparece por intenção/seleção (sempre no toque); marcador lateral único desliza entre itens. Hairline só depois de rolar. |
| 9. Prática                 | Pergunta em Newsreader na escala de estudo, sem caixa. Revelar desenha um traço de tinta e a resposta assenta abaixo. Avaliação vira um instrumento único (Repetir → Fácil) com intervalo e tecla. Troca de item com deslocamento curto. Resumo reutiliza o mesmo instrumento como contagem.                                                                                                                                                  |
| 9. Quiz                    | Estações numeradas substituem botões-caixa e a barra duplicada; no resultado as estações mostram certo/errado. Alternativas com selo de letra; escolher não mostra ✓ antes da correção. Revisão antes de concluir lista pergunta e resposta escolhida.                                                                                                                                                                                        |
| 10. Progresso              | Pílulas trocadas por régua de marcas sobre uma linha de base.                                                                                                                                                                                                                                                                                                                                                                                 |
| 12/14. Listagens e command | Card de coleção sem divisória nem três colunas de métricas: faixa proporcional real (para revisar / em dia / novos; quiz: certas/erradas da última tentativa). Command com tipo e favoritos na linha da busca, sem checkbox; sem consulta oferece "Ir para"; rodapé com teclas.                                                                                                                                                               |
| 4. Árvore do documento     | Mesma anatomia do índice: voltar/recolher, título, criar documento/pasta/importar juntos, busca em largura total.                                                                                                                                                                                                                                                                                                                             |
| 8. Vocabulário             | E-mail de exportação também usa "fontes".                                                                                                                                                                                                                                                                                                                                                                                                     |
| Limpeza                    | Removido `/design-preview` (direção rejeitada, roteado em produção) e ~900 linhas de CSS `archive-*`; `StudyItemTitle` sem uso removido.                                                                                                                                                                                                                                                                                                      |

Não verificado nesta rodada: gravação do movimento intermediário, aparelho físico/toque real,
leitor de tela. Pontos 2, 3, 6, 7 e 11 não foram retrabalhados; o ponto 1 foi conferido (fonte
limitada com "Ler fonte completa") e só recebeu correção da fonte do controle. Sem aprovação visual
do proprietário.

## Quarta rodada · 17/11 (prints do proprietário)

| Problema apontado                                             | Correção                                                                                                                                                    |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Card de projeto sem capa vazio, título mudando de lugar       | Capa sempre presente; sem imagem, `MineralCover` gera facetas lápis-lazúli esparsas, determinísticas pelo id do projeto (sem inventar conteúdo)             |
| Diálogo de capa com altura travada e vazio                    | Altura fixa removida; `AutoHeight` anima a altura real ao trocar de aba                                                                                     |
| Ações e busca com alturas e bordas diferentes                 | Grade única: ações e busca/filtro com 36px e a mesma borda direita (workbench e árvore de documentos)                                                       |
| Barra de seleção empurrando a lista                           | Seleção substitui a linha de busca no mesmo lugar (`StudyIndexTools`)                                                                                       |
| Botões do cabeçalho do editor com tamanhos diferentes; "(1)"  | Todos `sm`; contagem como número discreto, sem parênteses                                                                                                   |
| "7 em dia" ambíguo; em dia parecia desativado                 | Legenda nomeia o que conta ("7 flashcards em dia"); em dia usa teal (`chart-3`), não cinza; volta "Próxima prática" quando nada está disponível             |
| Select empilhando ícone e texto                               | Radix descarta `className` de `ItemText`; layout num span interno                                                                                           |
| Abas "Questão N" cortadas sem navegação                       | Propostas usam as estações numeradas (incluída/fora da coleção)                                                                                             |
| Fonte com espaço sobrando e "ver mais"; questões com overflow | Na largura ampla a fonte ocupa a coluna com rolagem própria                                                                                                 |
| Fonte aparecendo duas vezes                                   | A proposta mostra só a origem (trecho ou fonte inteira) e o trecho é destacado na fonte ao lado (CSS Custom Highlight API); abrir no documento fica no menu |
| Criação de coleção caindo de cima                             | Campo aparece no lugar do seletor; só a altura muda, animada                                                                                                |
| Command sem continuidade                                      | Abre a partir do botão de busca (translação + recorte, sem escala); por atalho, fade curto                                                                  |
| Hover das ações de IA sem resposta                            | Varinha faz um único gesto no hover/foco (`AiActionIcon`)                                                                                                   |
| "Mover" fora do lugar no menu de ações                        | Resíduo `col-span-2` criava segunda coluna implícita                                                                                                        |
| Ponto cinza sem significado                                   | Estado sempre com texto ao lado, mesma cor; os glifos servem de legenda no filtro "Mostrar"                                                                 |
| Uploads só clicáveis no botão                                 | Área inteira abre o seletor; lavagem lápis e seta sobem ao arrastar; arquivos entram e saem da lista com altura animada                                     |
| Prática e quiz sem hierarquia (superfícies removidas demais)  | Leitura volta para uma folha; alternativas são controles com contorno; resultado compacto com ações visíveis                                                |

Fora desta rodada, a discutir: landing ainda fora do padrão; identidade/encantamento mais profundos.

## Quinta rodada · 18/11 (básico antes do fantástico)

- Retirados: gesto da varinha e morph do command (rápidos e estranhos). Transição de hover em 200ms na base para todo elemento interativo.
- Cabeçalhos de editor com botões de 36px; "Adicionar" e "Refinar com IA" nos dois domínios; ícone de fonte neutro; estado do flashcard em glifo + texto.
- Alternativas (workbench e revisão de IA) com a anatomia da prática: linha com contorno e selo de letra; a correta é o selo verde. Controles de ordem e remoção alinhados.
- Toast com estilo próprio, ícone semântico e fechar. Menu da fonte com ícones e item destrutivo com cores de perigo.
- Navegação de questões: fichas numeradas (mesma família dos selos), anel percorrendo a atual; estado por preenchimento. As barras uniformes anteriores foram rejeitadas: repetiam o estado "incluída" do checkbox e pareciam barra de progresso.
- Resultado: número → indicadores rotulados (aproveitamento, melhor, duração) → ações; revisão com título e posição.
- Revisão de IA: título concreto, sem etapas repetidas, cabeçalho da proposta com chave "Salvar na coleção", campo de pergunta proporcional, fonte única no painel da fonte (só o trecho quando há trecho).

Pendências: "trecho selecionado" vazio ao reabrir o fluxo com `aiGeneration` antigo na URL não foi reproduzido de forma determinística; uma carga de página dispara várias chamadas `get-session` e o rate limit de 20/min pode ser atingido com abas recarregando.

## Histórico das relações observadas

| Relação observada antes                                                                       | Implementação candidata                                                                                   | Consequência pretendida / verificação                                                                             |
| --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Home separava o número de revisões, a coleção e a ação em apresentações concorrentes          | Coleção real, situação e ação juntas em “Seu próximo estudo”; biblioteca e ritmo em colunas independentes | O próximo passo é identificável sem interpretar um placar; observado com dados reais em claro/escuro e narrow     |
| Landing ultramarina e produto ciano tinham fundações distintas                                | Tokens semânticos comuns, papel/folha/tinta/lápis-lazúli e dois temas                                     | A mudança de página não muda a identidade; não uniformizar o papel editorial da landing com uma tela de operação  |
| Títulos de interface e perguntas longas tomavam peso desproporcional                          | Papéis de texto menores e explícitos, preservando o conteúdo autoral do editor                            | Pergunta, resposta, apoio e ações continuam legíveis sem uma escala de apresentação aplicada a toda tela          |
| Moldura de shell e superfícies de leitura se encaixavam sem explicar outra relação            | Shell sem contorno ornamental; índice, leitura e detalhes com responsabilidades próprias                  | Remover contorno sem função não significa retirar borda de campos, opções, resultados ou overlays                 |
| Navegação recebia marca grande, seleção colorida e peso elevado                               | Marca compacta, seleção neutra, grupos discretos, mesma iconografia operacional                           | A orientação deixa de competir com o material; conteúdo longo recebe tooltip quando truncado                      |
| Duas bibliotecas diretas e ícones internos do editor tinham linguagens distintas              | Hugeicons Free Stroke Rounded + adaptadores estáticos de BlockNote                                        | Build e menu real do editor verificados; não usar fallback vazio para um import desconhecido                      |
| Quantidade, visualização e ordenação usavam controles paralelos                               | ViewSelector e QuantitySelector compartilhados, mantendo Radix para tabs reais                            | Navegação por setas e foco único cobertos por testes; estatísticas agora ligam tab e painel                       |
| Custo de IA e ações de melhoria variavam entre fluxos                                         | AiCreditCost comum no rodapé, intenções visíveis e quantidade segmentada                                  | Custo/saldo permanecem juntos, com unidades, fora da rolagem dos campos                                           |
| Abrir prática com sessão ativa expunha começar de novo sem esclarecer a perda de continuidade | Continuar como ação principal; iniciar outra com confirmação e consequência explícita                     | Teste verifica que não abandona antes da confirmação; nenhuma prática real iniciada na inspeção                   |
| Editor mobile deixava fonte e detalhes alargarem o cabeçalho                                  | Grid encolhível, status e ações quebram por grupo                                                         | Inspeção mobile encontrou o defeito; captura posterior e medidas do DOM confirmaram ausência do overflow da seção |
| Diálogos controlados podiam devolver foco ao body                                             | Retorno compartilhado, preservando callback específico do chamador                                        | Testes e fechamento real de exportação/IA conferidos                                                              |
| Projeto vazio ainda oferecia alternância sem dados                                            | Seletor só aparece com documentos carregados                                                              | Conferido em projeto com dois documentos e em projeto sem documentos                                              |

Preservados: regras de revisão, rankings, dados, consentimento, cobrança, direitos legais,
fontes autorais, destinos e conteúdo do usuário. A demonstração pública continua inerte.
Não foram inventadas séries, streaks, resultados ou fontes para preencher espaços vazios.

## Revisão de movimento — Emil / UIArc / Crivo

Referências: [Review Animations](https://aiforui.dev/skills/review-animations), seu SKILL e STANDARDS
oficiais, skills Crivo locais de revisão/polish e documentação gratuita UIArc. Os critérios guiam
o diagnóstico; não substituem uma observação de movimento nem a preferência do proprietário.

| Before                                                                  | After                                                                                                              | Why                                                                                                 |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Entrada da demo: canvas e folha com durações diferentes                 | `practiceEntranceDuration = 0.48`, compartilhado por `landing/ink-transfer.ts` e `landing/practice-experience.tsx` | Coordenar a passagem material → pergunta; é uma demonstração ocasional, não a navegação diária      |
| Segundo motor Anime coexistindo com os novos controles Motion           | Motion único; CSS para cor, contorno e feedback simples                                                            | Reduzir contratos concorrentes, não adicionar outra biblioteca de animação por efeito               |
| Switch Arc com pulso e alteração de largura                             | Thumb por translação/escala, mola retargetável, sem pulso extra                                                    | Indicar mudança de estado sem animar layout nem adicionar uma segunda celebração                    |
| Mudança de seleção por teclado poderia herdar deslocamento do indicador | Caminho imediato para teclado/reduced em segmented control, tabs e switch                                          | A resposta acompanha o comando repetido; testes cobrem foco e seleção                               |
| Resposta surgia sem um contrato comum de continuidade                   | `StudyReveal`: pergunta estável, 8px + opacity em 200ms; teclado/reduced imediato                                  | A resposta aparece abaixo do que está sendo lembrado, não substitui a pergunta nem gira uma face    |
| Workspace animava `grid-template-columns`                               | Troca de colunas sem animação de layout                                                                            | Evitar relayout repetido ao abrir/fechar navegação durante o trabalho                               |
| Busca global herdava `animate-in` do diálogo                            | `DialogContent animated={false}`, inclusive backdrop                                                               | Operação de alta frequência não deve esperar entrada; `animationName: none` confirmado no navegador |
| Resultados de command sem distinção de modalidade                       | Cor em 150ms no ponteiro, `transition-property: none` no teclado                                                   | Preservar continuidade no mouse e resposta imediata às setas; propriedade computada conferida       |
| Hover de controles da demonstração sem filtro de dispositivo            | Media query `(hover: hover) and (pointer: fine)`; foco visível independente                                        | Não transportar hover persistente para toque                                                        |

**Decisão: Block para aprovação global de movimento.** As correções acima têm testes e inspeção
dos estados finais, mas não há gravação frame a frame nem teste em dispositivo físico/reduced-motion
real suficiente para afirmar que toda a aplicação está aprovada. Não há autorização de merge implícita.
O caminho da demo foi exercitado pelo teclado (abrir, revelar, avançar, mudar tipo, fechar/retornar foco);
a fluidez intermediária não foi certificada por capturas estáticas.

Pontos que exigem revisão complementar antes de uma aprovação global:

- Conferir entradas/saídas dos overlays existentes por teclado e interrupção rápida em dispositivo real.
- Medir o indicador `layoutId` sob carga do editor; é uma escolha de continuidade, não garantia de 60fps.
- Confirmar hover de entrada/saída em todas as superfícies. A API de navegador usada não oferece hover;
  código, estados por clique/foco e testes não equivalem a essa observação.

## Cobertura efetiva

Dimensões abaixo são os overrides solicitados ao navegador integrado, não um aparelho físico.
Após a reconexão, zoom do navegador resultou em viewport CSS menor que o override (ex.: 390 → 355,
1440 → 1309); isso foi medido, não tratado como um teste físico de 390px. Não há matriz completa de
todas as telas em todos os tamanhos/temas.

| Área / estado        | O que foi efetivamente conferido                                                                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Home                 | Claro desktop/mobile; escuro desktop/intermediário; conteúdo real, estado sem atividade, título longo e nova relação prática/biblioteca/ritmo                      |
| Documentos           | Editor e menu de blocos reais; projeto com dois documentos em cards/tabela; projeto vazio sem seletor; importação aberta e cancelada sem enviar arquivo            |
| Flashcards           | Coleção, pergunta longa, editor mobile, status + ações responsivos, fonte com trecho e destino do documento; setup mobile; sem iniciar/enviar revisões             |
| Quizzes              | Coleção/editor, alternativas e seus controles; resultado de tentativa já concluída; nenhuma tentativa nova criada                                                  |
| Estatísticas         | Visão geral, tabela, comparação e navegação por teclado; histórico de quizzes/rank; gráfico mobile; 12 meses em largura intermediária com scroll interno explícito |
| IA                   | Melhoria antes/depois, geração da coleção, custo atualizado ao trocar quantidade; fechamentos/foco; nenhuma geração cobrada ou aplicada                            |
| Configurações        | Aparência, dados/privacidade e diálogo de cópia; alinhamento das checkboxes e retorno de foco; nenhuma exportação/exclusão solicitada                              |
| Busca global         | Grupos/separadores, foco, setas, fechamento, seletor de tipo; abertura sem animação e seleção por teclado sem transição verificadas                                |
| Público/autenticação | Componentes reais de login/cadastro via previews DEV, sem submissão; demo com teclado; termos no celular e navegação legal; não é teste de cadastro completo       |
| Bancada `/system`    | Componentes reais com dados de exemplo explícitos; não substitui os contextos anteriores nem salva estado de conta                                                 |

Estados de falha, loading, sessão ativa e redução de movimento têm cobertura parcial por testes e
inspeção de fonte; não foram todos provocados na conta real. Depois de uma atualização compartilhada
por HMR, DocumentTree perdeu o contexto de importação; recarga completa recuperou a tela. Não houve
reprodução desse erro na navegação após a recarga; não confundir isso com uma aprovação de produção.

## Validação técnica

- `vp install`: concluído; lockfile coerente.
- `vp env doctor`: passou; aviso de NVM coexistindo no ambiente.
- `vp check --fix`: formatação, lint e tipos passaram após a revisão mobile/diálogo.
- `NODE_OPTIONS=--no-experimental-webstorage vp test`: 122 arquivos, 514 testes passaram na segunda rodada.
- `vp run website#build`: passou; mantém aviso de chunks grandes (editor/referências ~1MB minificado).
- `git diff --check`: sem erro na revisão técnica.
- Busca de imports diretos Lucide/Phosphor/Anime/Remix no código do produto: nenhum. Dependência
  transitiva no lockfile não significa que seus glyphs são renderizados; aliases do editor são explícitos.

O flag de Node acima contorna o localStorage experimental sem arquivo, não mascara testes falhando.
Avisos de sourcemap de PostHog continuam emitidos pela dependência. Nenhum limite de chunk foi
aumentado para esconder o aviso do build.

## Retomada após queda de energia

Postgres e MinIO locais foram religados com `docker compose up -d postgres minio`; frontend 3000 e
API 3001 foram reiniciados. `/api/health` voltou a responder `status: ok`. Não adicionar políticas
de restart de infraestrutura nem fazer deploy remoto sem um pedido específico.

Este registro separa implementação, evidência e lacunas. Não é declaração de perfeição, auditoria
legal/acessível completa ou aprovação estética automática das skills utilizadas.

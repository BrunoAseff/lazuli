# Folha viva — contrato atualizado em 29/10/2026

A landing pública usa um campo de pigmento ultramarino e uma única folha em escala de leitura. O contorno único tem cantos suavizados antes da projeção, iluminação contínua e sombra; não há faixas sobrepostas. A folha se desdobra em prática, com a inscrição preservada, e a fonte reaparece depois da sessão. Não é uma miniatura da interface privada nem um filme obrigatório.

Arquivos substituídos: landing-page.tsx, landing.css, tokens.css. Removidos do bundle: study-story.tsx, sky-document.tsx, story-data.ts e use-story-motion.ts. Novos componentes: study-sheet.tsx, practice-experience.tsx, use-paper-motion.ts. Lógica/dados puros em practice-state.ts e practice-content.ts, com testes. Rotas existentes de autenticação preservadas.

Abertura: “Organize seus estudos. Aprenda praticando.” + materiais, flashcards e quizzes com IA + cadastro. O trecho de Física tem título de documento e conduz ao flashcard correspondente. A ação abre a prática; não finge gerar conteúdo com IA.

Movimento: folha se aplana ao abrir; resposta é impressa numa região própria; avaliação vira a página; referência reencontra o trecho após conclusão. Parallax curto apenas no material, nunca no texto em leitura. Respeitar reduced-motion, interromper animações e limpar listeners.

Continuação: organizar documentos com árvore e hierarquia de leitura, criar flashcards com IA revisável, responder a quizzes em seção própria, programar revisões a partir da avaliação. Demo de quiz seleciona, revisa, conclui e só então corrige. Fontes nunca antecipam resposta durante recuperação ativa. FAQ recolhida contém seis perguntas sobre plano gratuito, importação, funcionamento e uso opcional da IA, revisões e acesso ao material original. Não anuncia onboarding. Quiz usa os verdes e vermelhos semânticos da aplicação, com texto e ícone além da cor.

Copy limitada: cada frase define produto, demonstra conteúdo, orienta ação ou explica consequência real. Nada de prova social, contagens de clientes, cronograma FSRS ou imagens de produto inventadas.

Benchmark e estudos rejeitados: benchmark/research.md e concept-\*.html. Nenhum deles é aprovação de design. Verificação inclui desktop/celular e estados, não apenas compilação.

Acabamento de 29/10: seta com tangente e ponta alinhadas; encerramento “Organize, pratique e revise com Lazúli” em duas linhas desde 320 px. Cancelar entrada e partículas na troca de modalidade, resize e scroll do diálogo; foco e visibilidade na resposta revelada.

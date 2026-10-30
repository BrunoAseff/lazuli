# Documentos legais e aceite — operação

## Entrega técnica

- Documentos públicos: `/termos`, `/privacidade` e suas versões `/:version`, sem login.
- Cadastro por e-mail exige manifestação explícita validada no hook do Better Auth.
- Contas existentes e Google sem aceite passam pelo modal obrigatório antes da montagem do app.
- `/account-options` preserva exportação, exclusão, preferências de privacidade, suporte e acesso
  ao gerenciamento da assinatura. Não elimina conta nem cancela cobrança automaticamente.
- A API bloqueia uso normal sem aceite, preserva os endpoints essenciais e o webhook Stripe.
- Aceites têm horário do banco, canal, versões, texto da ação e hashes dos documentos. Repetir a
  confirmação não altera o primeiro registro daquela edição.
- Atualizar apenas a Política não é consentimento nem exige automaticamente aceitar novos Termos.
- Escolhas de analytics permanecem separadas e agora possuem histórico transacional. Os novos
  registros de aceite/preferências integram a categoria Conta na exportação.
- Não há frase sobre IA no cadastro, aviso no primeiro uso nem links nas jornadas de IA/exportação.

## Antes de publicar

1. Aplicar a migração `0035_legal_acceptance` antes de iniciar o servidor atualizado.
2. Publicar API e website de forma coordenada. O cliente antigo não conhece o modal; a API nova
   bloqueará operações sem aceite. Evitar uma janela prolongada entre os dois deploys e orientar
   atualização de abas antigas quando necessário. Não rebaixar o controle de acesso para ocultar
   incompatibilidade de versão.
3. Revisar os documentos e as condições reais dos fornecedores. O responsável autorizou nome,
   CPF e e-mail públicos, não forneceu endereço e optou por não abrir CNPJ. **A ausência de endereço
   continua pendente na identificação comercial; a entrega não certifica conformidade jurídica.**
4. Não há proibição geral de menores de 18 anos nos textos. Não foram implantados mecanismos de
   aferição de idade, representação/assistência ou supervisão parental nesta entrega. Avaliar o
   enquadramento e as medidas necessárias antes de tratar isso como resolvido juridicamente.
5. Prazos de retenção de logs, backups e fornecedores, mecanismos internacionais e procedimento
   de reembolso precisam de validação operacional/jurídica. Não foram inventados prazos fixos nem
   contratos, e não foram alterados pagamentos, assinaturas ou configurações externas.
6. Não foram enviados avisos, e-mails ou aceites em nome de usuários reais. A primeira formalização
   aparece na próxima entrada, não por migração retroativa de aceite.

## Publicar outra edição

1. Não modificar uma edição publicada. Preservar seu conteúdo, identificador e hash. Os testes de
   hash protegem a correspondência com registros já gravados; não atualizar a expectativa apenas
   para permitir reescrever texto antigo.
2. Acrescentar a nova edição em `packages/shared/src/legal/legal-documents.ts`, mantê-la no arquivo
   de edições e selecionar `CURRENT_TERMS`/`CURRENT_PRIVACY` conforme a publicação.
3. Atualizar a constante do tipo correspondente em `legal-constants.ts`. Termos e Política têm
   versões independentes. Testar compatibilidade entre constantes e documentos.
4. Mudança material dos Termos: definir vigência, comunicação e tratamento de assinantes antes
   de exigir nova versão. A primeira implantação não estabelece uma regra de bloqueio imediato
   para qualquer alteração futura.
5. Mudança da Política: comunicar proporcionalmente; não representar ciência como autorização
   genérica. Nova finalidade baseada em consentimento exige escolha própria, antes da coleta.
6. Registrar fonte da alteração, revisão, data, responsável e efeitos operacionais. Validar HTML,
   impressão, rotas históricas, cadastro, Google, erros de rede e acesso às opções essenciais.

## Atendimento de direitos e reembolso

- O contato público é o e-mail indicado nos documentos. O atendimento é manual; não há integração
  que apague automaticamente eventos históricos no PostHog ou trate todos os pedidos em fornecedores.
- Confirmar identidade proporcionalmente, registrar pedido e acompanhar prazo, resposta e execução
  num meio seguro. Não solicitar senha ou dados completos de cartão, nem registrar conteúdo pessoal
  de pedidos no repositório.
- Exportação local não inclui automaticamente todas as informações mantidas por prestadores. Para
  pedidos de acesso/eliminação, mapear dados locais e registros no provedor correspondente.
- PostHog: verificar eventos associados ao identificador da conta, inclusive sem perfil de pessoa;
  confirmar o procedimento suportado pelo provedor e sua conclusão. Não presumir que excluir o
  usuário local ou retirar consentimento apaga os eventos históricos.
- Stripe: separar cancelamento da renovação, restituição e conservação legal de registros. Não
  apagar evidência financeira exigida, nem alegar que cancelamento equivale a reembolso.
- Backups, retenções legais e cópias já recebidas por e-mail exigem explicação específica; não
  prometer exclusão imediata integral sem evidência.
- Comunicar resultado, eventual retenção e fundamento. Escalar dúvidas jurídicas em vez de negar
  genericamente o direito ou presumir que um checkbox resolveu a obrigação.

## Validação local desta entrega

A migração foi aplicada apenas ao PostgreSQL local. Uma verificação temporária com API real e
contas fictícias confirmou: bloqueio sem aceite, acesso ao perfil, rejeição de confirmação falsa,
aceite válido, idempotência, acesso posterior a projetos e cadastro por e-mail. HTTP externo ficou
bloqueado nessa verificação; nenhuma mensagem real foi enviada. As contas fictícias foram removidas.

O modal foi inspecionado com um estado fictício em navegador, nos temas claro/escuro e em desktop
e mobile. Não foi aceito contrato em nome de um usuário real. Páginas públicas e sumário mobile
também foram inspecionados; os arquivos temporários de revisão não fazem parte da aplicação.

No Node 26 deste ambiente, o teste já existente do SDK PostHog depende da desativação do Web Storage
experimental do Node, para usar o armazenamento do jsdom:

```sh
NODE_OPTIONS=--no-experimental-webstorage vp test
```

Isso é uma opção da execução local dos testes, não configuração da aplicação ou consentimento.

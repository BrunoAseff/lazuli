import { LEGAL_CONTACT } from "./legal-constants.ts";

export type LegalSection = { id: string; title: string; paragraphs: string[] };
export type LegalDocument = {
  kind: "terms" | "privacy";
  title: string;
  version: string;
  publishedAt: string;
  effectiveAt: string;
  summary: string;
  sections: LegalSection[];
};

// Published editions are immutable. Add a new edition instead of editing an accepted text.
export const terms20261029: LegalDocument = {
  kind: "terms",
  title: "Termos de Uso",
  version: "2026-10-29",
  publishedAt: "2026-10-29",
  effectiveAt: "2026-10-29",
  summary: "As condições para organizar seus materiais, estudar e usar os recursos do Lazúli.",
  sections: [
    {
      id: "responsavel",
      title: "1. Quem oferece o Lazúli",
      paragraphs: [
        `O Lazúli é oferecido por ${LEGAL_CONTACT.name}, pessoa física inscrita no CPF sob o nº ${LEGAL_CONTACT.taxId}. Para suporte, assuntos de assinatura e solicitações sobre dados pessoais, escreva para ${LEGAL_CONTACT.email}.`,
        "Estes Termos regem o uso da plataforma e dos recursos gratuitos e pagos. A Política de Privacidade explica como os dados são tratados e permanece disponível sem login. O aceite destes Termos não autoriza métricas opcionais de uso nem comunicações de marketing.",
      ],
    },
    {
      id: "servico",
      title: "2. O que você pode fazer",
      paragraphs: [
        "O Lazúli é uma ferramenta de organização e estudo: você pode criar projetos, editar e importar documentos, adicionar imagens, organizar coleções, criar flashcards e quizzes, praticar, consultar referências e acompanhar seu histórico e suas estatísticas. Alguns recursos utilizam inteligência artificial e podem consumir créditos conforme o plano e a operação apresentados na plataforma.",
        "Os recursos ajudam a estudar, mas não garantem aprovação, memorização, desempenho acadêmico ou certificação. As estatísticas e o agendamento de revisões são calculados a partir da prática registrada; não são diagnóstico clínico nem avaliação oficial do aprendizado. Alterações ou exclusões de materiais e históricos podem afetar os resultados disponíveis.",
      ],
    },
    {
      id: "conta",
      title: "3. Sua conta",
      paragraphs: [
        "Forneça informações corretas, mantenha acesso ao e-mail cadastrado e proteja suas credenciais. Você pode usar os métodos de acesso disponibilizados na plataforma, incluindo Google quando habilitado. Avise o suporte se identificar acesso indevido. A apuração de responsabilidade considera as circunstâncias, inclusive possíveis falhas do serviço.",
        "Não há uma restrição geral de uso a maiores de 18 anos. Quando a legislação exigir representação ou assistência de um responsável legal para a criação da conta ou contratação, essa participação deverá ser observada. O responsável pode entrar em contato pelo canal informado nestes Termos para questões relativas à conta do menor. Essa previsão não afasta as obrigações do Lazúli de proteção de crianças e adolescentes.",
      ],
    },
    {
      id: "materiais",
      title: "4. Seus materiais e direitos",
      paragraphs: [
        "Você mantém os direitos que possui sobre os materiais enviados ou criados. Para prestar o serviço, você permite ao Lazúli armazenar, copiar tecnicamente, converter, apresentar e processar esses materiais na medida necessária aos recursos que solicitar. Essa permissão não transfere a propriedade dos seus materiais nem concede uma licença geral para revendê-los ou utilizá-los em publicidade.",
        "Envie apenas conteúdos que você tenha direito de utilizar, respeitando direitos autorais, privacidade, confidencialidade e exceções previstas em lei. O fato de um material ser usado para estudo não autoriza automaticamente qualquer reprodução. Não utilize a plataforma para armazenar prontuários identificáveis, credenciais de terceiros ou informações pessoais sensíveis sem fundamento legal adequado.",
        "O software, a identidade visual e os conteúdos próprios do Lazúli são protegidos pela legislação aplicável. A utilização do serviço não transfere esses direitos. Para comunicar possível violação de direitos em um material, envie ao suporte a identificação do conteúdo, a descrição do problema e informações que permitam avaliar o pedido.",
      ],
    },
    {
      id: "ia",
      title: "5. Inteligência artificial e referências",
      paragraphs: [
        "Ao solicitar geração ou melhoria por IA, o conteúdo necessário ao pedido é processado por um fornecedor externo, atualmente a OpenAI. Conforme o recurso, esse conteúdo pode incluir trechos do documento, contexto relacionado, títulos, instruções, materiais existentes e imagens selecionadas. A Política de Privacidade detalha esse tratamento.",
        "A IA pode produzir informações incorretas, incompletas, inadequadas ou semelhantes às de outras pessoas. Revise as propostas antes de aplicá-las e confira as referências. Uma referência ajuda a localizar a origem, mas não certifica a exatidão do resultado. Não há garantia de exclusividade ou proteção autoral de todo resultado gerado.",
        "Os materiais não substituem orientação médica, jurídica ou de outro profissional habilitado. Os créditos e eventuais limites de geração são apresentados no produto. Erros técnicos e itens não entregues são tratados conforme as regras de créditos da operação; descartar voluntariamente uma proposta já entregue não equivale a falha técnica. Essas informações não afastam direitos legais do usuário.",
      ],
    },
    {
      id: "planos",
      title: "6. Planos, créditos e cobranças",
      paragraphs: [
        "Há um plano gratuito e planos pagos com recursos, limites e franquias apresentados antes da contratação. A oferta informa preço, periodicidade e condições aplicáveis. Confira esses dados no momento da compra; eventuais alterações futuras não modificam retroativamente uma oferta já contratada.",
        "As assinaturas são processadas pelo Stripe e possuem renovação recorrente conforme a oferta. Você pode consultar e gerenciar a assinatura pelos controles disponíveis na sua conta. Mudanças de plano e seus efeitos financeiros devem ser conferidos na confirmação da operação. Falhas de pagamento podem restringir benefícios pagos conforme a situação apresentada na plataforma.",
        "A franquia mensal de créditos de IA não acumula para o período seguinte. Bônus concedidos separadamente seguem as condições da concessão. Créditos permitem utilizar recursos do Lazúli; não são moeda, investimento ou promessa de resgate em dinheiro, preservados os direitos legais de restituição.",
        "Cancelar a renovação normalmente mantém os benefícios até o fim do período pago e impede a próxima cobrança. Downgrade ou cancelamento não apagam automaticamente os materiais. Quando a conta excede os novos limites, novas criações ou envios podem ficar restritos, mantendo-se acesso às operações permitidas pelo plano, inclusive consulta e exclusão dos materiais.",
      ],
    },
    {
      id: "cancelamento",
      title: "7. Cancelamento e reembolso",
      paragraphs: [
        "Cancelar a renovação, solicitar reembolso e excluir a conta são ações diferentes. Para cancelar a renovação, use o gerenciamento da assinatura. Para solicitar restituição, inclusive pelo direito de arrependimento, escreva para o contato informado no início destes Termos com dados suficientes para localizar a contratação. Não envie senha ou dados completos de cartão.",
        "Nas hipóteses previstas no Código de Defesa do Consumidor, contratações realizadas online estão sujeitas ao direito de arrependimento em sete dias, contado conforme a legislação aplicável. O pedido será analisado e a restituição devida será providenciada pelos meios de pagamento pertinentes. O uso de recursos de IA não implica renúncia automática a esse direito. Outros pedidos serão avaliados conforme a oferta, as circunstâncias e a legislação.",
        "A exclusão da conta encerra o acesso e aciona o fluxo de cancelamento da assinatura vinculada, quando houver. Ela não deve ser utilizada como substituto de um pedido de reembolso. Se você não concordar com estes Termos, ainda poderá acessar as opções de suporte, dados e assinatura necessárias ao encerramento da relação.",
      ],
    },
    {
      id: "uso-indevido",
      title: "8. Uso indevido e restrições",
      paragraphs: [
        "Não utilize o serviço para fraude, invasão, distribuição de conteúdo ilícito, violação de direitos de terceiros, tentativas de contornar limites ou ações que comprometam a segurança e disponibilidade da plataforma. Críticas e solicitações legítimas de suporte não constituem uso indevido.",
        "Podemos restringir recursos ou suspender acesso para conter riscos, cumprir obrigações legais ou apurar violações. As medidas devem ser proporcionais; quando cabível, informaremos o motivo e permitiremos esclarecimento pelo suporte. Risco grave ou exigência legal pode demandar ação imediata.",
      ],
    },
    {
      id: "encerramento",
      title: "9. Seus dados e encerramento",
      paragraphs: [
        "Você pode solicitar uma cópia dos seus dados e excluir a conta em Configurações, na seção Dados e privacidade. A exclusão remove o acesso à conta e aos materiais, mas alguns registros podem ser conservados quando houver obrigação legal ou outra justificativa válida, conforme a Política de Privacidade. A remoção de arquivos e cópias técnicas pode envolver processamento posterior.",
        "Se o serviço for descontinuado, informaremos as condições de encerramento e, quando viável e legalmente permitido, um período para exportação. Valores pagos e dados pessoais serão tratados de acordo com as obrigações aplicáveis. Não haverá perda automática de direitos por mero silêncio do usuário.",
      ],
    },
    {
      id: "responsabilidade",
      title: "10. Disponibilidade e responsabilidade",
      paragraphs: [
        "O serviço pode passar por manutenção, falhas ou indisponibilidade de infraestrutura e fornecedores. Não prometemos disponibilidade ininterrupta. Adotaremos medidas compatíveis com o serviço para prevenir e corrigir problemas e comunicar situações relevantes.",
        "Nenhuma previsão destes Termos exclui direitos obrigatórios do consumidor, responsabilidades por defeitos do serviço ou deveres de proteção de dados. Não há renúncia geral de direitos pelo usuário.",
      ],
    },
    {
      id: "alteracoes",
      title: "11. Alterações e solução de conflitos",
      paragraphs: [
        "A versão e a vigência aparecem no início deste documento. Alterações relevantes serão comunicadas de forma adequada e poderão exigir novo aceite para continuar utilizando o serviço. As versões anteriores permanecem consultáveis. Alterações não autorizam novos ônus retroativos nem dispensam as regras de uma assinatura já contratada.",
        "Estes Termos são regidos pela legislação brasileira. Procure o suporte para tentar solucionar dúvidas ou conflitos, sem prejuízo do acesso à ANPD, aos órgãos de defesa do consumidor e ao Poder Judiciário competente. Não se exige arbitragem nem foro que afaste as garantias legais do consumidor.",
      ],
    },
  ],
};

export const privacy20261029: LegalDocument = {
  kind: "privacy",
  title: "Política de Privacidade",
  version: "2026-10-29",
  publishedAt: "2026-10-29",
  effectiveAt: "2026-10-29",
  summary:
    "Quais dados o Lazúli utiliza, por que eles são necessários e como você exerce suas escolhas.",
  sections: [
    {
      id: "responsavel",
      title: "1. Responsável e contato",
      paragraphs: [
        `${LEGAL_CONTACT.name}, pessoa física inscrita no CPF sob o nº ${LEGAL_CONTACT.taxId}, é responsável pelas decisões sobre o tratamento de dados pessoais do Lazúli descrito nesta Política. O canal para suporte e privacidade é ${LEGAL_CONTACT.email}.`,
        "Esta Política abrange o site, a conta e os recursos da plataforma. Ela informa como usamos dados; não representa autorização genérica para qualquer finalidade. O consentimento para métricas opcionais é solicitado separadamente e pode ser recusado ou retirado.",
      ],
    },
    {
      id: "dados",
      title: "2. Dados utilizados e suas finalidades",
      paragraphs: [
        "Conta e acesso: nome, e-mail, verificação, imagem de perfil quando disponível, credenciais protegidas e informações de sessão, como IP e navegador. Esses dados permitem criar a conta, autenticar, recuperar acesso, gerenciar sessões e proteger o serviço. Se você escolher Google, recebemos os dados de autenticação necessários à integração; não recebemos sua senha do Google.",
        "Materiais: títulos e conteúdos de projetos, documentos, arquivos importados, imagens, capas, flashcards, quizzes, alternativas e referências. Tratamos esses dados para armazenar, editar, converter, organizar, buscar e apresentar seus materiais e executar as ações solicitadas. Materiais podem conter dados pessoais inseridos por você; evite informações sensíveis ou de terceiros sem necessidade e fundamento adequado.",
        "Estudo: respostas, tentativas, avaliações de flashcards, revisões, datas e preferências de estudo. Usamos essas informações para manter o histórico, calcular estatísticas e organizar revisões. Favoritos e preferências de organização ajudam a recuperar seus materiais. Esses resultados não são diagnósticos ou avaliações profissionais.",
        "Assinaturas e créditos: plano, identificadores de cliente e assinatura, situação de pagamento, eventos comerciais e movimentação de créditos. Usamos esses dados para disponibilizar benefícios, conferir limites, processar cobranças e atender obrigações relacionadas à contratação. O processamento dos dados de pagamento ocorre no Stripe; não solicitamos dados completos de cartão pelo suporte.",
        "Comunicações e operação: e-mail, mensagens de suporte e informações necessárias a verificações, avisos de segurança, exportação e atualizações da assinatura. Logs e registros técnicos auxiliam a investigar falhas, proteger o serviço e prevenir abuso. As informações podem ser fornecidas por você, produzidas durante o uso ou recebidas de integrações como Google e Stripe.",
      ],
    },
    {
      id: "bases",
      title: "3. Por que podemos tratar esses dados",
      paragraphs: [
        "Os dados necessários à conta e aos recursos solicitados são tratados para executar o contrato ou procedimentos relacionados. Obrigações legais podem exigir registros de natureza fiscal, comercial ou de segurança. O exercício regular de direitos pode justificar a conservação delimitada de evidências. Segurança e prevenção de abuso também podem envolver legítimo interesse, após avaliação de necessidade e dos direitos das pessoas afetadas.",
        "Métricas opcionais de produto dependem da sua autorização. Não utilizamos essa autorização como condição para estudar. Dados sensíveis e informações de crianças e adolescentes exigem análise e salvaguardas próprias; não presumimos que o contrato com quem enviou o material autorize todo uso de informações de terceiros.",
      ],
    },
    {
      id: "ia",
      title: "4. Como funcionam os recursos de IA",
      paragraphs: [
        "Ao solicitar recursos de IA, enviamos à OpenAI o conteúdo necessário à geração, melhoria ou análise solicitada. Conforme o recurso, podem ser enviados trechos de documentos, contexto relacionado, títulos, instruções, materiais existentes e imagens selecionadas. Importar ou armazenar um documento não significa, por si só, enviar todo o seu conteúdo à IA.",
        "Também podem ser enviados um identificador técnico derivado da conta e informações operacionais necessárias ao processamento. Armazenamos resultados e metadados, como estado da geração e consumo de créditos, para entregar a proposta, permitir sua revisão e administrar a operação.",
        "A integração utiliza a API da OpenAI com armazenamento de respostas desabilitado na requisição. Isso não equivale a ausência de qualquer retenção: o fornecedor possui regras próprias de segurança e monitoramento. Dados da API não são utilizados para treinamento por padrão, conforme as condições do fornecedor, diferentemente de configurações que possam existir em serviços de uso pessoal. Você pode pedir esclarecimentos sobre esse tratamento pelo canal de privacidade.",
      ],
    },
    {
      id: "fornecedores",
      title: "5. Fornecedores e compartilhamento",
      paragraphs: [
        "Utilizamos prestadores de hospedagem, banco de dados e armazenamento, incluindo Railway na infraestrutura, e Cloudflare para serviços de rede, proteção e entrega. Eles processam dados necessários ao funcionamento dos recursos contratados. A OpenAI recebe o conteúdo necessário aos pedidos de IA; o Stripe processa assinaturas e pagamentos; o Resend entrega e-mails; e o Google participa do acesso quando você escolhe esse método.",
        "Quando você solicita exportação, a cópia é enviada em arquivo ZIP anexado ao seu e-mail verificado. Assim, o conteúdo exportado também passa pelo provedor de e-mail e fica sujeito à proteção da sua caixa de entrada. Não compartilhe a cópia com pessoas que não devam acessar seus materiais.",
        "O PostHog recebe métricas opcionais somente quando você permite essa finalidade. Também podemos compartilhar dados para cumprir obrigações legais, determinações válidas ou atender direitos, limitando o compartilhamento ao necessário. Prestadores podem atuar sob nossas instruções ou assumir responsabilidades próprias conforme a atividade e a legislação.",
      ],
    },
    {
      id: "internacional",
      title: "6. Tratamento fora do Brasil",
      paragraphs: [
        "Os fornecedores podem processar dados fora do Brasil, inclusive em infraestrutura ou operações de suporte no exterior. Usar um domínio do Lazúli para transmitir informações não significa que todo o processamento ocorra no Brasil.",
        "Transferências internacionais devem observar os mecanismos e as salvaguardas previstos na legislação brasileira, conforme a operação e os contratos aplicáveis. Você pode solicitar informações sobre destinatários, finalidades e garantias do tratamento internacional pelo canal de privacidade. A mera utilização do serviço não é tomada como consentimento genérico para qualquer transferência.",
      ],
    },
    {
      id: "metricas",
      title: "7. Métricas de uso opcionais",
      paragraphs: [
        "Se você permitir, coletamos ações gerais da plataforma, como abrir uma área ou concluir uma prática, e informações técnicas de dispositivo e navegador para entender o uso e melhorar o produto. As métricas usam um identificador da conta, sem enviar nome, e-mail ou conteúdo dos seus materiais. Esse identificador é pseudônimo: as informações não devem ser consideradas anônimas.",
        "A configuração da integração não utiliza gravação de sessão nem captura automática do conteúdo das páginas. As métricas opcionais começam desativadas até a escolha afirmativa. Você pode recusar ou retirar a autorização em Configurações, na seção Dados e privacidade, sem perder os recursos de estudo.",
        "Retirar a autorização interrompe novas coletas dessa finalidade; não significa, por si só, eliminar todos os registros anteriores. Para solicitar eliminação ou obter esclarecimentos sobre registros já tratados, utilize o canal de privacidade. Históricos de prática necessários às suas próprias estatísticas não são as métricas opcionais do PostHog.",
      ],
    },
    {
      id: "dispositivo",
      title: "8. Cookies e dados no dispositivo",
      paragraphs: [
        "Usamos cookies e armazenamento do navegador para sessão, segurança e preferências de interface. Recursos locais podem guardar tema, modo de visualização, projetos recentes, estado da navegação e informações temporárias de tarefas. A revisão de propostas de IA pode manter conteúdo temporariamente no armazenamento da sessão do navegador.",
        "Cookies de sessão seguem sua validade de autenticação. Preferências locais podem permanecer até serem alteradas ou removidas; dados de sessão têm duração ligada à sessão da aba ou do navegador. Limpar o armazenamento pode remover preferências e exigir novo login, mas não equivale a excluir a conta ou os materiais armazenados no servidor.",
        "A escolha de métricas opcionais é independente dos recursos necessários ao serviço. Ela é vinculada à conta para ser respeitada nos acessos autenticados e pode ser alterada nas configurações.",
      ],
    },
    {
      id: "conservacao",
      title: "9. Conservação e exclusão",
      paragraphs: [
        "Dados da conta, materiais e histórico são conservados enquanto a conta estiver ativa e forem necessários às finalidades descritas. Você pode excluir materiais ou a conta pelos controles da plataforma. Arquivar um material não é excluí-lo. Algumas exclusões de arquivos são processadas em segundo plano e podem precisar de novas tentativas em caso de falha.",
        "Arquivos temporários de importação e exportação seguem o processamento e a limpeza das respectivas tarefas. Resultados de IA e registros operacionais podem permanecer enquanto necessários à entrega, recuperação da operação, controle de créditos, segurança ou apuração de problemas. A expiração de uma proposta para uso não deve ser confundida com garantia de eliminação imediata de todos os registros relacionados.",
        "Após a exclusão da conta, registros estritamente necessários podem ser mantidos para obrigações legais, exercício de direitos ou outras hipóteses válidas, com acesso restrito. Cópias de segurança e dados mantidos por fornecedores seguem seus ciclos de retenção e as obrigações aplicáveis. Não prometemos eliminação instantânea de backups, registros legalmente exigidos ou mensagens já recebidas na sua caixa de e-mail.",
        "Para informações sobre os prazos aplicáveis a uma categoria, solicitações de eliminação em fornecedores ou confirmação de uma exclusão, escreva ao canal de privacidade. A resposta deve esclarecer eventuais retenções e seus fundamentos. Retirar consentimento, cancelar assinatura e excluir conta são operações distintas.",
      ],
    },
    {
      id: "direitos",
      title: "10. Suas escolhas e seus direitos",
      paragraphs: [
        "Nos termos da legislação, você pode solicitar confirmação de tratamento, acesso, correção, informações sobre compartilhamento, anonimização, bloqueio ou eliminação, portabilidade quando aplicável, oposição e revogação de consentimento. Você também pode solicitar esclarecimentos e revisão de decisões automatizadas que afetem seus interesses, quando aplicável.",
        "Em Configurações, você pode atualizar informações disponíveis, gerenciar sessões, alterar a preferência de métricas, solicitar cópia dos dados e excluir a conta. Para outros pedidos, ou se não conseguir entrar, escreva ao canal de privacidade. Poderemos verificar sua identidade de forma proporcional antes de fornecer dados ou executar ações, para evitar acesso indevido.",
        "Pedidos são atendidos conforme os prazos legais aplicáveis. A confirmação e o acesso têm modalidades simplificada e completa previstas na LGPD; a declaração completa tem prazo legal próprio de até quinze dias, observadas as regras aplicáveis. Se não for possível atender integralmente um pedido, informaremos a justificativa. O canal de suporte não afasta seu direito de procurar a ANPD ou órgãos de defesa do consumidor.",
      ],
    },
    {
      id: "protecao",
      title: "11. Proteção e usuários menores",
      paragraphs: [
        "Adotamos controles de autenticação, restrição de acesso e proteção da infraestrutura compatíveis com o serviço. Nenhum sistema é totalmente livre de riscos. Acesso operacional a informações deve se limitar a pessoas autorizadas e finalidades justificadas, como suporte, segurança e cumprimento de obrigações. Não solicite nem envie senhas em mensagens de suporte.",
        "O tratamento de dados de crianças e adolescentes deve observar seu melhor interesse e as salvaguardas previstas na legislação. Quando necessária, a participação do responsável legal não dispensa essas obrigações. Responsáveis podem usar o canal de privacidade para esclarecer tratamentos e exercer direitos relativos à conta de quem representam. Não utilizamos o aceite dos Termos como autorização irrestrita de tratamento de dados de menores.",
        "Se identificar suspeita de exposição ou acesso indevido, avise o suporte. Incidentes serão avaliados e tratados conforme sua gravidade e as obrigações de comunicação aplicáveis.",
      ],
    },
    {
      id: "alteracoes",
      title: "12. Alterações desta Política",
      paragraphs: [
        "Publicamos a versão e a vigência desta Política no início da página e mantemos acesso às versões anteriores. Mudanças relevantes serão comunicadas de forma adequada. Se uma nova finalidade exigir consentimento, a escolha será solicitada separadamente antes de iniciar esse tratamento. Uma atualização do texto não autoriza automaticamente novas finalidades.",
      ],
    },
  ],
};

export const CURRENT_TERMS = terms20261029;
export const CURRENT_PRIVACY = privacy20261029;
export const LEGAL_DOCUMENTS = [terms20261029, privacy20261029] as const;

export const getLegalDocument = (kind: LegalDocument["kind"], version?: string) =>
  version
    ? LEGAL_DOCUMENTS.find((document) => document.kind === kind && document.version === version)
    : kind === "terms"
      ? CURRENT_TERMS
      : CURRENT_PRIVACY;

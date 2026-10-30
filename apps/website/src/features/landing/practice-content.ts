/** Concise study examples adapted from NASA Space Place, not claims about the product. */
const skySourceUrl = "https://spaceplace.nasa.gov/blue-sky/en/";

export const practiceSources = [
  {
    id: "sky-blue",
    title: "Por que o céu é azul?",
    text: "As moléculas do ar espalham a luz azul mais intensamente que a vermelha. Parte dessa luz chega aos nossos olhos de várias direções.",
    url: skySourceUrl,
    attribution: "NASA Space Place",
  },
  {
    id: "sunset-red",
    title: "A luz no pôr do sol",
    text: "No pôr do sol, a luz percorre mais atmosfera. Mais luz azul é espalhada para fora do caminho direto, deixando chegar mais tons vermelhos e amarelos.",
    url: skySourceUrl,
    attribution: "NASA Space Place",
  },
] as const;

export const practiceFlashcards = [
  {
    id: "sky-blue",
    question: "Por que o céu é azul?",
    answer: "Porque as moléculas do ar espalham mais a luz azul que a vermelha.",
    sourceIndex: 0,
  },
  {
    id: "sunset-red",
    question: "Por que o pôr do sol pode ser vermelho?",
    answer:
      "A luz percorre mais atmosfera. Mais azul é espalhado para fora do caminho direto; predominam os tons vermelhos e amarelos.",
    sourceIndex: 1,
  },
] as const;

export const practiceRatings = [
  { value: "again", label: "Repetir", help: "Não lembrei", key: "1" },
  { value: "hard", label: "Difícil", help: "Lembrei com bastante esforço", key: "2" },
  { value: "good", label: "Bom", help: "Lembrei com esforço normal", key: "3" },
  { value: "easy", label: "Fácil", help: "Lembrei imediatamente", key: "4" },
] as const;

export const practiceQuizQuestions = [
  {
    id: "quiz-sky-blue",
    question: "O que faz o céu parecer azul?",
    options: [
      "A atmosfera reflete a cor dos oceanos.",
      "As moléculas do ar espalham mais a luz azul.",
      "O Sol emite apenas luz azul durante o dia.",
    ],
    correctOptionIndex: 1,
    explanation: practiceFlashcards[0].answer,
    sourceIndex: 0,
  },
  {
    id: "quiz-sunset-red",
    question: "O que muda no caminho da luz ao pôr do sol?",
    options: [
      "A luz atravessa mais atmosfera até chegar a nós.",
      "A luz deixa de atravessar a atmosfera.",
      "A luz azul se transforma em luz vermelha.",
    ],
    correctOptionIndex: 0,
    explanation: practiceFlashcards[1].answer,
    sourceIndex: 1,
  },
] as const;

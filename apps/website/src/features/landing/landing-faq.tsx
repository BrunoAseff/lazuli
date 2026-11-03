import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";

const questions = [
  [
    "Tem plano gratuito?",
    "Sim. Há um plano gratuito e opções pagas. Você pode comparar os limites e os créditos de IA de cada plano na sua conta.",
  ],
  [
    "O que posso importar?",
    "Documentos em PDF com texto selecionável, DOCX, Markdown ou TXT, além de flashcards em CSV, TSV ou TXT. PDFs digitalizados como imagem ainda não são compatíveis.",
  ],
  [
    "Como funciona a IA?",
    "A IA sugere flashcards e questões a partir dos seus documentos. Você revisa e pode editar as sugestões antes de salvar. A geração usa créditos e envia o conteúdo necessário ao provedor de IA.",
  ],
  [
    "Preciso usar IA?",
    "Não. Você pode escrever documentos, criar flashcards e montar quizzes manualmente.",
  ],
  [
    "Quando devo revisar?",
    "Sua avaliação de cada flashcard ajuda o Lazúli a agendar a próxima revisão. A página inicial reúne os flashcards que estão na hora de revisar.",
  ],
  [
    "Posso reler o material?",
    "Sim. Flashcards e questões podem ser vinculados a um documento ou a um trecho dele. Assim, você pode voltar à explicação original quando precisar.",
  ],
];
function Answer({ open, answer, id }: { open: boolean; answer: string; id: string }) {
  const [mounted, setMounted] = useState(open);
  const [expanded, setExpanded] = useState(open);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let frame = 0,
      next = 0;
    if (open) {
      setMounted(true);
      frame = requestAnimationFrame(() => {
        next = requestAnimationFrame(() => setExpanded(true));
      });
    } else {
      setExpanded(false);
      timer = setTimeout(
        () => setMounted(false),
        matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 350,
      );
    }
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
      cancelAnimationFrame(next);
    };
  }, [open]);
  return (
    <div
      id={id}
      className={`lp-faq-answer ${expanded ? "is-open" : ""}`}
      inert={!open}
      onTransitionEnd={(event) => {
        if (
          event.target === event.currentTarget &&
          event.propertyName === "grid-template-rows" &&
          !open
        )
          setMounted(false);
      }}
    >
      <div>{mounted && <p>{answer}</p>}</div>
    </div>
  );
}
export function LandingFaq() {
  const [active, setActive] = useState<number | null>(null);
  return (
    <section className="lp-faq lp-shell" aria-labelledby="faq-title">
      <h2 id="faq-title">Dúvidas frequentes.</h2>
      <div className="lp-faq-list">
        {questions.map(([title, answer], index) => (
          <div className="lp-faq-item" key={title}>
            <h3>
              <button
                aria-expanded={active === index}
                aria-controls={`answer-${index}`}
                onClick={() => setActive(active === index ? null : index)}
              >
                {title}
                {active === index ? (
                  <Minus aria-hidden="true" size={22} />
                ) : (
                  <Plus aria-hidden="true" size={22} />
                )}
              </button>
            </h3>
            <Answer open={active === index} answer={answer!} id={`answer-${index}`} />
          </div>
        ))}
      </div>
    </section>
  );
}

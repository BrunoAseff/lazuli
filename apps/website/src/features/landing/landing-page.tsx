import { useState } from "react";
import { Link } from "react-router";
import { ArrowRight, ArrowUpRight, FileText, FolderOpen } from "lucide-react";
import { BrandMark } from "@/components/brand-mark.tsx";
import { StudySheet, type PaperOrigin } from "./study-sheet.tsx";
import { PracticeExperience } from "./practice-experience.tsx";
import { resetAccountEntryScroll } from "./account-navigation.ts";
import { LandingFaq } from "./landing-faq.tsx";
import "./landing.css";

export default function LandingPage() {
  const [practice, setPractice] = useState<{
    mode: "cards" | "quiz";
    origin: PaperOrigin | null;
  } | null>(null);
  return (
    <div className="lp">
      <a className="lp-skip" href="#conteudo">
        Pular para o conteúdo
      </a>
      <main id="conteudo">
        <section className="lp-intro" aria-labelledby="lp-title">
          <header className="lp-mast lp-shell">
            <a href="#conteudo" className="lp-wordmark" aria-label="Lazúli, início">
              Lazúli
              <BrandMark className="lp-brand-symbol" size={24} />
            </a>
            <Link to="/login" onClick={resetAccountEntryScroll} className="lp-login">
              Entrar <ArrowUpRight aria-hidden="true" size={18} />
            </Link>
          </header>
          <div className="lp-head lp-shell">
            <h1 id="lp-title">
              Organize seus estudos.
              <br />
              Aprenda praticando.
            </h1>
            <p>Reúna seus materiais e crie flashcards e quizzes com IA.</p>
            <Link
              to="/register"
              onClick={resetAccountEntryScroll}
              className="lp-button lp-button-light"
            >
              Começar grátis <ArrowUpRight aria-hidden="true" size={20} />
            </Link>
          </div>
          <StudySheet onPractice={(origin) => setPractice({ mode: "cards", origin })} />
          <div className="lp-intro-foot lp-shell">
            <a href="#seu-material" className="lp-underline">
              Ver como funciona <span aria-hidden="true">↓</span>
            </a>
          </div>
        </section>

        <section
          className="lp-material lp-shell"
          id="seu-material"
          aria-labelledby="material-title"
        >
          <div className="lp-material-copy">
            <h2 id="material-title">
              Seu material de estudo,
              <br />
              em um só lugar.
            </h2>
            <p>Importe arquivos ou escreva seus resumos. Organize tudo por matéria.</p>
          </div>
          <div className="lp-document-preview" aria-label="Exemplo de organização de documentos">
            <aside className="lp-document-tree" aria-label="Documentos de Física">
              <strong>Física</strong>
              <div>
                <FolderOpen size={20} aria-hidden="true" /> Luz e cor
              </div>
              <ul>
                <li className="is-current">
                  <FileText size={18} aria-hidden="true" /> Céu azul
                </li>
                <li>
                  <FileText size={18} aria-hidden="true" /> Pôr do sol
                </li>
              </ul>
            </aside>
            <article className="lp-manuscript" aria-labelledby="sample-document-title">
              <h3 id="sample-document-title">Por que o céu é azul?</h3>
              <p>
                A luz do Sol reúne diferentes cores. Ao atravessar a atmosfera, ela encontra as
                moléculas do ar.
              </p>
              <h4>O espalhamento da luz</h4>
              <p>
                <mark>A luz azul se espalha mais do que a vermelha.</mark> Por isso, vemos o azul
                chegar de várias direções.
              </p>
            </article>
          </div>
        </section>

        <section className="lp-make" aria-labelledby="make-title">
          <div className="lp-shell lp-make-inner">
            <h2 id="make-title">
              Crie flashcards
              <br />
              com ajuda da IA.
            </h2>
            <p className="lp-section-description">
              A IA sugere perguntas a partir dos seus documentos. Você revisa antes de salvar.
            </p>
            <div className="lp-extraction">
              <div className="lp-extraction-source">
                <span>
                  <FileText size={18} aria-hidden="true" /> Céu azul
                </span>
                <p>A luz azul se espalha mais do que a vermelha.</p>
              </div>
              <svg className="lp-extraction-arrow" viewBox="0 0 120 60" aria-hidden="true">
                <path d="M 4 34 C 36 10 76 30 112 30" />
                <path d="M 102 20 L 112 30 L 102 40" />
              </svg>
              <p>
                Por que o céu
                <br />é azul?
              </p>
            </div>
            <div className="lp-make-bottom">
              <button
                className="lp-button"
                onClick={() => setPractice({ mode: "cards", origin: null })}
              >
                Experimentar flashcards <ArrowRight aria-hidden="true" size={20} />
              </button>
            </div>
          </div>
        </section>

        <section className="lp-quiz-section lp-shell" aria-labelledby="quiz-title">
          <div className="lp-quiz-copy">
            <h2 id="quiz-title">
              Teste o que
              <br />
              você aprendeu.
            </h2>
            <p>
              Responda a quizzes sobre seus materiais. Confira os acertos e volte ao conteúdo que
              precisa revisar.
            </p>
            <button
              className="lp-button"
              onClick={() => setPractice({ mode: "quiz", origin: null })}
            >
              Experimentar quiz <ArrowRight aria-hidden="true" size={20} />
            </button>
          </div>
          <div className="lp-quiz-preview" aria-label="Questão do quiz de Física">
            <h3>O que faz o céu parecer azul?</h3>
            <ol type="A">
              <li>A atmosfera reflete a cor dos oceanos.</li>
              <li>As moléculas do ar espalham mais a luz azul.</li>
              <li>O Sol emite apenas luz azul durante o dia.</li>
            </ol>
            <a
              className="lp-underline"
              href="https://spaceplace.nasa.gov/blue-sky/en/"
              target="_blank"
              rel="noreferrer"
            >
              Conteúdo do exemplo: NASA <ArrowUpRight aria-hidden="true" size={16} />
            </a>
          </div>
        </section>

        <section className="lp-continuity" aria-labelledby="continuity-title">
          <div className="lp-shell lp-continuity-inner">
            <div>
              <h2 id="continuity-title">
                Saiba o que
                <br />
                revisar a seguir.
              </h2>
              <p>
                Depois de cada flashcard, diga como foi lembrar. O Lazúli usa sua resposta para
                programar as próximas revisões.
              </p>
            </div>
            <div className="lp-memory" aria-label="Avaliações de um flashcard">
              <span>Repetir</span>
              <span>Difícil</span>
              <span>Bom</span>
              <span>Fácil</span>
            </div>
          </div>
        </section>

        <LandingFaq />

        <footer className="lp-footer">
          <div className="lp-shell">
            <p>
              Organize, pratique
              <br />
              e revise com Lazúli
            </p>
            <Link className="lp-button" to="/register" onClick={resetAccountEntryScroll}>
              Começar grátis <ArrowUpRight size={22} aria-hidden="true" />
            </Link>
            <div className="lp-footer-bottom">
              <a href="#conteudo" className="lp-wordmark">
                Lazúli
              </a>
              <Link to="/login" onClick={resetAccountEntryScroll} className="lp-underline">
                Já tenho uma conta
              </Link>
            </div>
          </div>
        </footer>
      </main>
      {practice && (
        <PracticeExperience
          origin={practice.origin}
          initialMode={practice.mode}
          onClose={() => setPractice(null)}
        />
      )}
    </div>
  );
}

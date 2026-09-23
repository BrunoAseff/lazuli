import { ArticleIcon } from "@phosphor-icons/react/Article";
import { CardsThreeIcon } from "@phosphor-icons/react/CardsThree";
import { ExamIcon } from "@phosphor-icons/react/Exam";
import { FolderIcon } from "@phosphor-icons/react/Folder";
import { FolderOpenIcon } from "@phosphor-icons/react/FolderOpen";
import { UserCircleIcon } from "@phosphor-icons/react/UserCircle";

import { BrandMark } from "@/components/brand-mark.tsx";
import { cn } from "@/lib/utils.ts";

const navigation = [
  { Icon: ArticleIcon, label: "Documentos" },
  { Icon: CardsThreeIcon, label: "Flashcards" },
  { Icon: ExamIcon, label: "Quizzes" },
] as const;

const collections = [
  { label: "Espanha", open: true },
  { label: "Fundamentos de redes", open: false },
  { label: "História da arte", open: false },
] as const;

export const EditorialSidebar = () => (
  <aside className="archive-sidebar">
    <div className="archive-sidebar-top">
      <a className="archive-brand" href="#preview-top">
        <BrandMark aria-hidden="true" />
        <span>Lazúli</span>
      </a>

      <nav aria-label="Navegação do laboratório" className="archive-nav">
        <p className="archive-nav-caption">Biblioteca</p>
        {navigation.map(({ Icon, label }) => {
          const active = label === "Flashcards";
          return (
            <button
              aria-current={active ? "page" : undefined}
              className={cn("archive-nav-item", active && "is-active")}
              key={label}
              type="button"
            >
              <Icon aria-hidden="true" size={19} weight="duotone" />
              <span>{label}</span>
              {label === "Flashcards" && <small>132</small>}
            </button>
          );
        })}
      </nav>

      <div className="archive-collection-index">
        <div className="archive-index-heading">
          <p>Fichários recentes</p>
          <button aria-label="Ver todos os fichários" type="button">
            Todos
          </button>
        </div>
        {collections.map(({ label, open }) => {
          const FolderStateIcon = open ? FolderOpenIcon : FolderIcon;
          return (
            <button
              className={cn("archive-index-item", open && "is-current")}
              key={label}
              type="button"
            >
              <FolderStateIcon aria-hidden="true" size={17} weight="duotone" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </div>

    <button className="archive-user" type="button">
      <UserCircleIcon aria-hidden="true" size={25} weight="duotone" />
      <span>
        <strong>Bruno</strong>
        <small>Biblioteca pessoal</small>
      </span>
    </button>
  </aside>
);

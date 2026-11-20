import { resolveActiveResult } from "./search-selection.ts";
import {
  favoriteListSchema,
  favoriteKindSchema,
  globalSearchResponseSchema,
  type SearchKind,
  type SearchResult,
} from "@lazuli/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  createContext,
  Fragment,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router";
import { HeartIcon, XIcon } from "@/components/icons.tsx";
import { MagnifyingGlassIcon } from "@/components/icons.tsx";
import {
  DocumentDomainIcon,
  ProjectClosedIcon,
  FlashcardDomainIcon,
  QuizDomainIcon,
} from "@/components/domain-icons.ts";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog.tsx";
import {
  Command,
  CommandInput,
  CommandList,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Kbd } from "@/components/ui/kbd.tsx";
import { primaryNavigation } from "@/components/primary-navigation.ts";
import { Button } from "@/components/ui/button.tsx";
import { EmptyState } from "@/components/empty-state.tsx";
import { HighlightText } from "@/components/highlight-text.tsx";
import { apiRequest } from "@/lib/api-client.ts";
import { useRecentProjects } from "@/features/projects/use-recent-projects.ts";
import { favoriteKeys } from "@/features/favorites/favorite-provider.tsx";

export const searchLabels: Record<SearchKind, string> = {
  project: "Projetos",
  document: "Documentos",
  flashcards: "Coleções de flashcards",
  flashcard: "Flashcards",
  quizzes: "Quizzes",
  question: "Questões",
};
const resultIcons = {
  project: ProjectClosedIcon,
  document: DocumentDomainIcon,
  flashcards: FlashcardDomainIcon,
  flashcard: FlashcardDomainIcon,
  quizzes: QuizDomainIcon,
  question: QuizDomainIcon,
};
const SearchContext = createContext<{
  openSearch: (favorites?: boolean) => void;
} | null>(null);
export const useGlobalSearch = () => {
  const context = useContext(SearchContext);
  if (!context) throw new Error("Search provider is missing");
  return context;
};

export const GlobalSearchProvider = ({
  userId,
  children,
}: {
  userId: string;
  children: ReactNode;
}) => {
  const navigate = useNavigate();
  const recent = useRecentProjects(userId);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [kind, setKind] = useState<SearchKind>();
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState("");
  const [viewportHeight, setViewportHeight] = useState<number>();
  const opener = useRef<HTMLElement | null>(null);
  const openSearch = (favorites = false) => {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setQuery("");
    setDebounced("");
    setKind(undefined);
    setOnlyFavorites(favorites);
    setPage(1);
    setSelected("");
    setOpen(true);
  };
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (open) setOpen(false);
        else openSearch();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open]);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    if (!open) return;
    const resize = () => setViewportHeight(window.visualViewport?.height ?? window.innerHeight);
    resize();
    window.visualViewport?.addEventListener("resize", resize);
    return () => window.visualViewport?.removeEventListener("resize", resize);
  }, [open]);
  const favorites = useQuery({
    queryKey:
      page === 1 && !kind ? [...favoriteKeys, "list"] : [...favoriteKeys, "list", page, kind],
    enabled: open && !debounced,
    queryFn: ({ signal }) => {
      if (kind && !favoriteKindSchema.safeParse(kind).success)
        return Promise.resolve({ items: [], hasMore: false });
      const params = new URLSearchParams({ page: String(page) });
      if (kind) params.set("kind", kind);
      return apiRequest(`/api/favorites?${params}`, favoriteListSchema, { signal });
    },
  });
  const results = useQuery({
    queryKey: ["global-search", userId, debounced, kind, onlyFavorites, page],
    enabled: open && Boolean(debounced),
    staleTime: 0,
    // Typing refines what is on screen instead of blanking it between keystrokes.
    placeholderData: keepPreviousData,
    queryFn: ({ signal }) =>
      apiRequest("/api/search", globalSearchResponseSchema, {
        method: "POST",
        signal,
        body: JSON.stringify({ query: debounced, kind, favorites: onlyFavorites, page }),
      }),
  });
  const suggested: SearchResult[] = (favorites.data?.items ?? []).map((item) => ({
    ...item,
    snippet: "",
  }));
  if (!onlyFavorites)
    for (const item of recent)
      if (!suggested.some((candidate) => candidate.id === item.id && candidate.kind === "project"))
        suggested.push({
          kind: "project",
          id: item.id,
          title: item.title,
          context: "Projeto recente",
          snippet: "",
          href: `/documents/${item.id}`,
        });
  const waiting = query.trim() !== debounced;
  const narrowed = Boolean(debounced || onlyFavorites || kind);
  const loading = waiting || (debounced ? results.isFetching : favorites.isPending);
  const failed = debounced ? results.isError : favorites.isError;
  // While a new search runs, the previous results stay (dimmed) so the list never flashes empty.
  const items = debounced
    ? (results.data?.items ?? [])
    : favorites.isPending
      ? []
      : suggested.filter((item) => !kind || item.kind === kind);
  const groups = Object.entries(searchLabels)
    .map(([key, label]) => ({
      key: key as SearchKind,
      label,
      items: items.filter((item) => item.kind === key),
    }))
    .filter((group) => group.items.length);
  // Enter opens the active result: whenever the results change, the first one becomes active
  // unless the current choice is still listed (typing used to leave nothing selected).
  const showsNavigation = !debounced && !kind && !onlyFavorites && !failed;
  const resultValues = [
    ...groups.flatMap((group) => group.items.map((item) => `${item.kind}:${item.id}`)),
    ...(showsNavigation ? primaryNavigation.map(({ path }) => `nav:${path}`) : []),
  ];
  const activeResult = resolveActiveResult(resultValues, selected);
  useEffect(() => {
    if (activeResult !== selected) setSelected(activeResult);
  }, [activeResult, selected]);
  const changeFilter = () => {
    setPage(1);
    setSelected("");
  };
  const go = (item: SearchResult) => {
    setOpen(false);
    void navigate(item.href, {
      state:
        item.kind === "document" && debounced
          ? { globalSearch: { documentId: item.id, query: debounced } }
          : undefined,
    });
  };
  const clear = () => {
    setQuery("");
    setDebounced("");
    setKind(undefined);
    setOnlyFavorites(false);
    changeFilter();
  };
  return (
    <SearchContext value={{ openSearch }}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          className="flex max-h-[min(34rem,85dvh)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl max-sm:top-0 max-sm:left-0 max-sm:h-[var(--search-viewport-height)] max-sm:max-h-[var(--search-viewport-height)] max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none"
          style={
            {
              "--search-viewport-height": viewportHeight ? `${viewportHeight}px` : "100dvh",
            } as CSSProperties
          }
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (opener.current?.isConnected) opener.current.focus();
          }}
        >
          <DialogTitle className="sr-only">Pesquisar no Lazúli</DialogTitle>
          <DialogDescription className="sr-only">
            Encontre projetos e materiais pelo nome ou conteúdo. Use as setas e Enter para abrir um
            resultado.
          </DialogDescription>
          <Command shouldFilter={false} value={selected} onValueChange={setSelected}>
            <div className="flex shrink-0 flex-wrap items-center gap-x-1.5 gap-y-2 border-b border-[var(--line-subtle)] px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2">
              <div className="min-w-0 flex-[1_1_16rem]">
                <CommandInput
                  aria-label="Pesquisar em todos os materiais"
                  placeholder="Pesquisar no Lazúli"
                  value={query}
                  maxLength={200}
                  onValueChange={(value) => {
                    setQuery(value);
                    changeFilter();
                  }}
                />
              </div>
              <div className="ml-auto flex items-center gap-1 max-sm:order-last max-sm:w-full max-sm:px-1">
                <Select
                  value={kind ?? "all"}
                  onValueChange={(value) => {
                    setKind(value === "all" ? undefined : (value as SearchKind));
                    changeFilter();
                  }}
                >
                  <SelectTrigger
                    aria-label="Tipo de material"
                    className="h-8 w-auto gap-1.5 border-transparent bg-transparent px-2.5 text-muted-foreground shadow-none hover:border-transparent hover:bg-muted hover:text-foreground data-[state=open]:border-transparent data-[state=open]:bg-muted"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="end">
                    <SelectItem value="all">Todos os tipos</SelectItem>
                    {Object.entries(searchLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  aria-pressed={onlyFavorites}
                  className="h-8 gap-1.5 px-2.5 aria-pressed:bg-primary-soft aria-pressed:text-primary"
                  onClick={() => {
                    setOnlyFavorites((value) => !value);
                    changeFilter();
                  }}
                  size="sm"
                  variant="ghost"
                >
                  <HeartIcon
                    aria-hidden="true"
                    className={onlyFavorites ? "fill-primary text-primary" : undefined}
                  />
                  Favoritos
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Fechar pesquisa"
                  className="sm:ml-1"
                  onClick={() => setOpen(false)}
                >
                  <XIcon />
                </Button>
              </div>
            </div>
            <CommandList
              label="Resultados da pesquisa"
              aria-busy={loading}
              className="min-h-40 pb-[max(0.5rem,env(safe-area-inset-bottom))] aria-busy:[&_[cmdk-group]]:opacity-60 [&_[cmdk-group]]:transition-opacity sm:h-[calc(var(--cmdk-list-height,9.5rem)+0.5rem)] sm:flex-[0_1_auto] sm:transition-[height] sm:duration-200 sm:ease-[var(--ease-out)] motion-reduce:transition-none"
            >
              {loading && !items.length && (
                <p role="status" className="px-5 py-8 text-sm text-muted-foreground">
                  Pesquisando…
                </p>
              )}
              {failed && (
                <div className="p-4">
                  <EmptyState
                    surface="inline"
                    minHeight="sm"
                    icon={MagnifyingGlassIcon}
                    title="Não foi possível pesquisar"
                    description="Tente novamente para carregar seus materiais."
                    action={
                      <Button
                        variant="outline"
                        onClick={() => void (debounced ? results.refetch() : favorites.refetch())}
                      >
                        Tentar novamente
                      </Button>
                    }
                  />
                </div>
              )}
              {!loading && !failed && !items.length && narrowed && (
                <div className="p-4">
                  <EmptyState
                    surface="inline"
                    minHeight="sm"
                    icon={MagnifyingGlassIcon}
                    title="Nenhum material encontrado"
                    description="Tente outras palavras ou limpe os filtros."
                    action={
                      <Button variant="outline" onClick={clear}>
                        Limpar pesquisa e filtros
                      </Button>
                    }
                  />
                </div>
              )}
              {groups.map((group, index) => (
                <Fragment key={group.key}>
                  {index > 0 && <CommandSeparator alwaysRender />}
                  <CommandGroup
                    heading={
                      <span className="flex items-center justify-between gap-3">
                        {group.label}
                        {debounced && !kind && group.items.length === 5 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setKind(group.key);
                              changeFilter();
                            }}
                          >
                            {/* Names what there is more of: "Ver mais documentos". */}
                            Ver mais {group.label.toLocaleLowerCase("pt-BR")}
                          </Button>
                        )}
                      </span>
                    }
                  >
                    {group.items.map((item) => {
                      const Icon = resultIcons[item.kind];
                      return (
                        <CommandItem
                          key={`${item.kind}:${item.id}`}
                          value={`${item.kind}:${item.id}`}
                          onSelect={() => go(item)}
                        >
                          <Icon
                            aria-hidden="true"
                            className="mt-0.5 size-[1.125rem] shrink-0 text-muted-foreground"
                          />
                          <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                            <p className="text-sm leading-5">
                              <HighlightText query={debounced} text={item.title} />
                            </p>
                            {item.context && (
                              <p className="mt-0.5 text-xs leading-4 text-muted-foreground">
                                {item.context}
                              </p>
                            )}
                            {item.snippet && (
                              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                                <HighlightText query={debounced} text={item.snippet} />
                              </p>
                            )}
                          </div>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </Fragment>
              ))}
              {showsNavigation && (
                <>
                  {groups.length > 0 && <CommandSeparator alwaysRender />}
                  <CommandGroup heading="Ir para">
                    {primaryNavigation.map(({ Icon, label, path }) => (
                      <CommandItem
                        key={path}
                        value={`nav:${path}`}
                        onSelect={() => {
                          setOpen(false);
                          void navigate(path);
                        }}
                      >
                        <Icon
                          aria-hidden="true"
                          className="size-[1.125rem] shrink-0 text-muted-foreground"
                        />
                        <span className="text-sm">{label}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
              {((debounced && kind) || !debounced) &&
                (page > 1 || (debounced ? results.data?.hasMore : favorites.data?.hasMore)) && (
                  <div className="flex justify-between gap-3 px-4 py-3">
                    <Button
                      variant="outline"
                      disabled={page === 1 || loading}
                      onClick={() => {
                        setPage((value) => value - 1);
                        setSelected("");
                      }}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      disabled={
                        loading || !(debounced ? results.data?.hasMore : favorites.data?.hasMore)
                      }
                      onClick={() => {
                        setPage((value) => value + 1);
                        setSelected("");
                      }}
                    >
                      Próxima
                    </Button>
                  </div>
                )}
            </CommandList>
          </Command>
          <p className="hidden shrink-0 items-center gap-4 border-t border-[var(--line-subtle)] px-4 py-2.5 text-xs text-muted-foreground sm:flex">
            <span className="flex items-center gap-1.5">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd> navegar
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd>Enter</Kbd> abrir
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd>Esc</Kbd> fechar
            </span>
          </p>
        </DialogContent>
      </Dialog>
    </SearchContext>
  );
};

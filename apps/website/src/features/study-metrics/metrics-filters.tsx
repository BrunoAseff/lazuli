import { useEffect, useState } from "react";
import type { StudyMetricsQuery, StudyMetricsView } from "@lazuli/shared";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import {
  ArrowLeftIcon,
  CalendarDaysIcon,
  CheckIcon,
  ChevronsUpDownIcon,
  SlidersHorizontalIcon,
  LoaderCircleIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Calendar } from "@/components/ui/calendar.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover.tsx";
import { Command, CommandInput, CommandList, CommandItem } from "@/components/ui/command.tsx";
import { useMetricsCollections, useMetricsCollectionOptions } from "./metrics-api.ts";
import { useDebouncedSearch } from "@/hooks/use-debounced-search.ts";
import {
  formatDate,
  formatFullDate,
  presetRange,
  todayLocal,
  validRange,
} from "./metrics-format.ts";

export const metricsPresets = [
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
  { value: "365", label: "Últimos 12 meses" },
];
const asDate = (date: string) => new Date(`${date}T12:00:00`);
const asString = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export const rangeLabel = (from: string, to: string) =>
  from === to
    ? formatFullDate(from)
    : from.slice(0, 4) === to.slice(0, 4)
      ? `${formatDate(from)} – ${formatDate(to)}`
      : `${formatFullDate(from)} – ${formatFullDate(to)}`;

export function MetricsPeriod({
  input,
  preset,
  open,
  onOpenChange,
  onChange,
}: {
  input: StudyMetricsQuery;
  preset: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (input: StudyMetricsQuery, preset: string) => void;
}) {
  const [custom, setCustom] = useState(preset === "custom");
  const [range, setRange] = useState<DateRange | undefined>({
    from: asDate(input.from),
    to: asDate(input.to),
  });
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (open) {
      setCustom(preset === "custom");
      setTouched(false);
      setRange({ from: asDate(input.from), to: asDate(input.to) });
    }
  }, [open, input.from, input.to, preset]);
  const changeOpen = (value: boolean) => {
    if (value) {
      setCustom(preset === "custom");
      setTouched(false);
      setRange({ from: asDate(input.from), to: asDate(input.to) });
    }
    onOpenChange(value);
  };
  const from = range?.from ? asString(range.from) : "",
    to = range?.to ? asString(range.to) : "";
  const valid = validRange(from, to);
  return (
    <Popover open={open} onOpenChange={changeOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          aria-label="Período das estatísticas"
          className="min-h-11 sm:min-h-9"
        >
          <CalendarDaysIcon />
          {metricsPresets.find((p) => p.value === preset)?.label ??
            rangeLabel(input.from, input.to)}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        collisionPadding={8}
        className="max-h-(--radix-popover-content-available-height) w-auto max-w-[calc(100vw-16px)] overflow-y-auto p-1.5"
      >
        {!custom ? (
          <div className="w-60 max-w-full space-y-1">
            <p className="px-3 py-2 text-xs text-muted-foreground">
              {rangeLabel(input.from, input.to)}
            </p>
            {metricsPresets.map((p) => (
              <Button
                key={p.value}
                variant="ghost"
                className="min-h-11 w-full justify-between"
                onClick={() => {
                  onChange({ ...input, ...presetRange(Number(p.value)) }, p.value);
                  onOpenChange(false);
                }}
              >
                {p.label}
                {preset === p.value && <CheckIcon />}
              </Button>
            ))}
            <Button
              variant="ghost"
              className="min-h-11 w-full justify-start"
              onClick={() => setCustom(true)}
            >
              Personalizado
            </Button>
          </div>
        ) : (
          <div>
            <Button
              variant="ghost"
              className="min-h-11 w-full justify-start"
              onClick={() => setCustom(false)}
            >
              <ArrowLeftIcon /> Períodos rápidos
            </Button>
            <Calendar
              autoFocus
              mode="range"
              locale={ptBR}
              weekStartsOn={1}
              defaultMonth={range?.from}
              selected={range}
              onSelect={(value) => {
                setTouched(true);
                setRange(value);
              }}
              disabled={{ after: asDate(todayLocal()) }}
              labels={{
                labelNext: () => "Próximo mês",
                labelPrevious: () => "Mês anterior",
                labelNav: () => "Navegar pelos meses",
              }}
            />
            <div className="grid grid-cols-2 gap-3 px-3 py-2 text-sm">
              <div>
                <span className="block text-xs text-muted-foreground">Início</span>
                {from
                  ? to && from.slice(0, 4) !== to.slice(0, 4)
                    ? formatFullDate(from)
                    : formatDate(from)
                  : "—"}
              </div>
              <div>
                <span className="block text-xs text-muted-foreground">Fim</span>
                {to
                  ? from && from.slice(0, 4) !== to.slice(0, 4)
                    ? formatFullDate(to)
                    : formatDate(to)
                  : "—"}
              </div>
            </div>
            {touched && !valid && (
              <p role="status" className="px-3 py-1 text-sm text-destructive">
                {!to ? "Selecione a data final." : "Escolha até 366 dias."}
              </p>
            )}
            <div className="flex justify-end gap-2 px-2 pb-2 pt-1">
              <Button
                variant="outline"
                className="max-sm:min-h-11"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                className="max-sm:min-h-11"
                disabled={!valid}
                onClick={() => {
                  onChange({ ...input, from, to }, "custom");
                  onOpenChange(false);
                }}
              >
                Aplicar
              </Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function CollectionFilter({
  view,
  value,
  onChange,
}: {
  view: StudyMetricsView;
  value?: string;
  onChange: (id?: string) => void;
}) {
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState("");
  const [typedQuery, setTypedQuery] = useDebouncedSearch(query, setQuery);
  const selected = useMetricsCollections(view, "", 1, value);
  const result = useMetricsCollectionOptions(view, query, open);
  const items = result.data?.pages.flatMap((p) => p.items) ?? [];
  const label = selected.data?.items.find((i) => i.id === value)?.title;
  const choose = (id?: string) => {
    onChange(id);
    setOpen(false);
    setTypedQuery("");
    setQuery("");
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-label="Filtrar por coleção"
          aria-expanded={open}
          className="min-h-11 w-full min-w-0 justify-between sm:min-h-9 sm:max-w-72"
        >
          <span className="min-w-0 truncate">
            {value
              ? (label ?? (selected.isSuccess ? "Coleção indisponível" : "Carregando…"))
              : "Todas as coleções"}
          </span>
          <ChevronsUpDownIcon className="shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        collisionPadding={8}
        className="w-[min(24rem,calc(100vw-16px))] overflow-hidden p-1.5"
      >
        <Command
          shouldFilter={false}
          className="rounded-[calc(var(--radius-overlay)-6px)] bg-transparent"
        >
          <CommandInput
            placeholder="Pesquisar coleções"
            aria-label="Pesquisar coleções"
            value={typedQuery}
            onValueChange={setTypedQuery}
          />
          {value && label && (
            <p className="px-3 py-2 text-xs text-muted-foreground break-words">{label}</p>
          )}
          <CommandList className="max-h-[min(20rem,45dvh)] p-1">
            <CommandItem className="min-h-11 rounded-md" onSelect={() => choose()}>
              Todas as coleções{!value && <CheckIcon className="ml-auto" />}
            </CommandItem>
            {items.map((item) => (
              <CommandItem
                className="min-h-11 rounded-md"
                key={item.id}
                value={item.id}
                onSelect={() => choose(item.id)}
              >
                <span className="min-w-0 flex-1 whitespace-normal break-words">
                  {item.title}
                  <span className="block text-xs text-muted-foreground">
                    {[item.project, item.archived ? "Arquivada" : null].filter(Boolean).join(" · ")}
                  </span>
                </span>
                {value === item.id && <CheckIcon className="shrink-0" />}
              </CommandItem>
            ))}
            {result.isPending && (
              <p role="status" className="p-3 text-sm text-muted-foreground">
                Carregando…
              </p>
            )}
            {result.isError && (
              <div className="p-3 text-sm">
                <p>Não foi possível carregar as coleções.</p>
                <Button
                  variant="outline"
                  className="mt-2 min-h-11"
                  onClick={() => void result.refetch()}
                >
                  Tentar novamente
                </Button>
              </div>
            )}
            {result.isSuccess && !items.length && (
              <p className="p-3 text-sm text-muted-foreground">
                {query ? "Nenhuma coleção encontrada." : "Você ainda não tem coleções."}
              </p>
            )}
            {result.hasNextPage && (
              <Button
                variant="ghost"
                className="min-h-11 w-full"
                disabled={result.isFetchingNextPage}
                onClick={() => void result.fetchNextPage()}
              >
                Carregar mais
              </Button>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function MetricsCompare({
  input,
  onChange,
  mobile = false,
}: {
  input: StudyMetricsQuery;
  onChange: (input: StudyMetricsQuery) => void;
  mobile?: boolean;
}) {
  const checked = input.compare === "true";
  const toggle = () => onChange({ ...input, compare: checked ? "false" : "true" });
  return (
    <label
      className={`flex items-center gap-3 text-sm ${mobile ? "min-h-11 justify-between" : "min-h-11 rounded-[var(--radius)] border border-border bg-card px-3 sm:min-h-9"}`}
    >
      <span>Comparar com período anterior</span>
      <Switch
        aria-label="Comparar com período anterior"
        checked={checked}
        onCheckedChange={toggle}
      />
    </label>
  );
}

export function MetricsMobileFilters({
  view,
  input,
  onChange,
}: {
  view: StudyMetricsView;
  input: StudyMetricsQuery;
  onChange: (input: StudyMetricsQuery) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="min-h-11 sm:min-h-9"
          aria-label="Filtros das estatísticas"
        >
          <SlidersHorizontalIcon />
          Filtros
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        collisionPadding={8}
        className="w-[min(20rem,calc(100vw-16px))] space-y-3 overflow-visible p-3"
      >
        {view !== "overview" && (
          <CollectionFilter
            view={view}
            value={input.collectionId}
            onChange={(collectionId) => onChange({ ...input, collectionId })}
          />
        )}
        <MetricsCompare mobile input={input} onChange={onChange} />
      </PopoverContent>
    </Popover>
  );
}

export function MetricsUpdating({ active }: { active: boolean }) {
  return active ? (
    <span
      role="status"
      aria-label="Atualizando estatísticas"
      className="inline-flex text-muted-foreground"
    >
      <LoaderCircleIcon className="size-4 animate-spin motion-reduce:animate-none" />
    </span>
  ) : null;
}

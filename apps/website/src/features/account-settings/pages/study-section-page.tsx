import {
  ACCOUNT_RETENTION_MAX,
  ACCOUNT_RETENTION_MIN,
  ACCOUNT_RETENTION_RECOMMENDED,
} from "@lazuli/shared";
import { MinusIcon, PlusIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { useStudyPreference, useUpdateStudyPreference } from "../api/account-settings-queries.ts";
import {
  InlineFeedback,
  SettingsError,
  SettingsLoading,
  SettingsSectionHeader,
  SettingsSurface,
} from "../components/settings-ui.tsx";

const clampRetention = (value: number) =>
  Math.min(ACCOUNT_RETENTION_MAX, Math.max(ACCOUNT_RETENTION_MIN, Math.round(value)));

export const StudySectionPage = () => {
  const preference = useStudyPreference();
  const updatePreference = useUpdateStudyPreference();
  const [retention, setRetention] = useState(ACCOUNT_RETENTION_RECOMMENDED);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (preference.data) setRetention(preference.data.desiredRetention);
  }, [preference.data]);

  if (preference.isPending) return <SettingsLoading />;
  if (preference.isError || !preference.data)
    return <SettingsError onRetry={() => void preference.refetch()} />;

  const changed = retention !== preference.data.desiredRetention;
  const valid = retention >= ACCOUNT_RETENTION_MIN && retention <= ACCOUNT_RETENTION_MAX;

  const setValue = (value: number) => {
    setRetention(value);
    setSaved(false);
    updatePreference.reset();
  };

  const save = async () => {
    setSaved(false);
    try {
      await updatePreference.mutateAsync({ desiredRetention: clampRetention(retention) });
      setSaved(true);
    } catch {
      // The mutation state renders the contextual error below.
    }
  };

  return (
    <div>
      <SettingsSectionHeader title="Estudo" />

      <SettingsSurface title="Retenção desejada">
        <p className="max-w-xl text-sm text-muted-foreground" id="retention-explanation">
          Valores maiores geram revisões mais frequentes. A alteração afeta apenas os próximos
          agendamentos; seu histórico não muda.
        </p>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-grid h-9 grid-cols-[2.25rem_5rem_2.25rem] overflow-hidden rounded-[var(--radius)] border border-input bg-card">
              <Button
                aria-label="Diminuir meta"
                className="size-auto rounded-none border-0"
                disabled={retention <= ACCOUNT_RETENTION_MIN || updatePreference.isPending}
                onClick={() => setValue(clampRetention(retention - 1))}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <MinusIcon aria-hidden="true" />
              </Button>
              <label className="relative" htmlFor="retention-value">
                <Input
                  aria-describedby="retention-explanation retention-recommendation"
                  className="h-full rounded-none border-y-0 pr-7 text-center tabular-nums focus-visible:relative"
                  id="retention-value"
                  max={ACCOUNT_RETENTION_MAX}
                  min={ACCOUNT_RETENTION_MIN}
                  inputMode="numeric"
                  onBlur={() => setValue(clampRetention(retention))}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    if (Number.isFinite(value)) setValue(value);
                  }}
                  type="text"
                  value={retention}
                />
                <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-sm text-muted-foreground">
                  %
                </span>
              </label>
              <Button
                aria-label="Aumentar meta"
                className="size-auto rounded-none border-0"
                disabled={retention >= ACCOUNT_RETENTION_MAX || updatePreference.isPending}
                onClick={() => setValue(clampRetention(retention + 1))}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <PlusIcon aria-hidden="true" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground" id="retention-recommendation">
              {retention === ACCOUNT_RETENTION_RECOMMENDED
                ? "Recomendado"
                : `Recomendado: ${ACCOUNT_RETENTION_RECOMMENDED}%`}
            </p>
          </div>

          {changed && (
            <div className="flex min-h-9 items-center gap-2">
              <Button
                disabled={updatePreference.isPending}
                onClick={() => setValue(ACCOUNT_RETENTION_RECOMMENDED)}
                variant="outline"
              >
                Restaurar padrão
              </Button>
              <Button disabled={!valid || updatePreference.isPending} onClick={() => void save()}>
                {updatePreference.isPending && <Spinner aria-hidden="true" />}
                Salvar
              </Button>
            </div>
          )}
        </div>

        {updatePreference.isError ? (
          <div className="mt-3">
            <InlineFeedback kind="error">Não foi possível salvar a preferência.</InlineFeedback>
          </div>
        ) : saved ? (
          <div className="mt-3">
            <InlineFeedback kind="success">Preferência salva.</InlineFeedback>
          </div>
        ) : null}
      </SettingsSurface>
    </div>
  );
};

export default StudySectionPage;

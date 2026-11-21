import type { ComponentProps as BlockNoteComponentProps, Components } from "@blocknote/react";
import { components as shadcnComponents } from "@blocknote/shadcn";
import {
  Children,
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { UploadIcon } from "@/components/icons.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { useAnimatedSize, useMergedRef } from "@/components/ui/use-animated-size.ts";
import { Spinner } from "@/components/ui/spinner.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { cn } from "@/lib/utils.ts";

/*
 * BlockNote's small forms and its image panel, built from the app's own tabs, fields and buttons
 * instead of BlockNote's shadcn copies: the same 36px field, focus ring and segmented tabs as any
 * other form here, and no box drawn inside another box.
 */

type FormTextInputProps = BlockNoteComponentProps["Generic"]["Form"]["TextInput"];
type FilePanelProps = BlockNoteComponentProps["FilePanel"];

/** Password managers read "file-name" and "url" as login fields: these never are. */
const notCredentials = { autoComplete: "off", "data-1p-ignore": "", "data-lpignore": "true" };

/** Each of BlockNote's small forms by its field name, labelled the way the app labels fields. */
const formLabels: Record<string, string> = {
  "file-caption": "Legenda",
  "file-name": "Nome",
  title: "Texto do link",
  url: "Link",
};

/**
 * A form with several fields (editing a link: its address and its text) saves once, at the end;
 * its fields hand it their submit instead of each drawing a "Salvar".
 */
const FormSubmitContext = createContext<((submit: (() => void) | undefined) => void) | null>(null);

const FormRoot = ({ children }: BlockNoteComponentProps["Generic"]["Form"]["Root"]) => {
  const [submit, setSubmit] = useState<(() => void) | undefined>();
  // Stable, so a field's effect runs when its submit changes, not on every render.
  const register = useCallback((next: (() => void) | undefined) => setSubmit(() => next), []);
  if (Children.toArray(children).length < 2) return <>{children}</>;
  return (
    <FormSubmitContext.Provider value={register}>
      <div className="grid gap-3">
        {children}
        {submit && (
          <Button className="justify-self-end" onClick={submit} type="button">
            Salvar
          </Button>
        )}
      </div>
    </FormSubmitContext.Provider>
  );
};

/** Link, caption and file name: a labelled field, and "Salvar" beside a lone field that submits. */
const FormTextInput = forwardRef<HTMLInputElement, FormTextInputProps>(
  (
    {
      "aria-activedescendant": activeDescendant,
      autoComplete,
      autoFocus,
      className,
      disabled,
      label,
      name,
      onChange,
      onKeyDown,
      onSubmit,
      placeholder,
      rightSection,
      value,
    },
    ref,
  ) => {
    const id = useId();
    const title = label ?? formLabels[name];
    const registerSubmit = useContext(FormSubmitContext);
    useEffect(() => {
      if (registerSubmit && onSubmit) registerSubmit(onSubmit);
    }, [registerSubmit, onSubmit]);
    return (
      <div className={cn("grid gap-2", className)}>
        {title && <Label htmlFor={id}>{title}</Label>}
        <div className="flex items-center gap-2">
          <Input
            {...notCredentials}
            aria-activedescendant={activeDescendant}
            aria-label={title ? undefined : placeholder}
            autoComplete={autoComplete ?? "off"}
            autoFocus={autoFocus}
            disabled={disabled}
            id={id}
            name={name}
            onChange={onChange}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            ref={ref}
            value={value}
          />
          {rightSection}
          {onSubmit && !registerSubmit && (
            <Button disabled={disabled} onClick={onSubmit} type="button">
              Salvar
            </Button>
          )}
        </div>
      </div>
    );
  },
);
FormTextInput.displayName = "LazuliFormTextInput";

const FilePanelSurface = forwardRef<HTMLDivElement, { children: ReactNode; className?: string }>(
  ({ children, className }, ref) => {
    const animated = useMergedRef(useAnimatedSize<HTMLDivElement>(), ref);
    return (
      <div className={cn("lazuli-file-panel", className)} ref={animated}>
        {children}
      </div>
    );
  },
);
FilePanelSurface.displayName = "LazuliFilePanelSurface";

/**
 * "Enviar" and "Incorporar" as the app's segmented tabs, on one surface that grows to the taller
 * tab instead of jumping.
 */
const FilePanelRoot = forwardRef<HTMLDivElement, FilePanelProps["Root"]>(
  ({ className, loading, openTab, setOpenTab, tabs }, ref) => (
    <FilePanelSurface className={className} ref={ref}>
      <Tabs onValueChange={setOpenTab} value={openTab}>
        {tabs.length > 1 && (
          <TabsList className="w-full">
            {tabs.map((tab) => (
              <TabsTrigger disabled={loading} key={tab.name} value={tab.name}>
                {tab.name}
              </TabsTrigger>
            ))}
          </TabsList>
        )}
        {tabs.map((tab) => (
          <TabsContent key={tab.name} value={tab.name}>
            {loading ? (
              <p className="flex h-9 items-center justify-center gap-2 text-sm text-muted-foreground">
                <Spinner className="size-4" />
                Enviando…
              </p>
            ) : (
              tab.tabPanel
            )}
          </TabsContent>
        ))}
      </Tabs>
    </FilePanelSurface>
  ),
);
FilePanelRoot.displayName = "LazuliFilePanelRoot";

const FilePanelTabPanel = forwardRef<HTMLDivElement, FilePanelProps["TabPanel"]>(
  ({ children, className }, ref) => (
    <div className={cn("grid gap-2", className)} ref={ref}>
      {children}
    </div>
  ),
);
FilePanelTabPanel.displayName = "LazuliFilePanelTabPanel";

/** A plain button that opens the file picker (the native input shows "no file chosen"). */
const FilePanelFileInput = forwardRef<HTMLInputElement, FilePanelProps["FileInput"]>(
  ({ accept, onChange, placeholder }, ref) => {
    const input = useRef<HTMLInputElement | null>(null);
    return (
      <>
        <input
          accept={accept}
          className="sr-only"
          onChange={(event) => {
            onChange(event.target.files?.[0] ?? null);
            event.target.value = "";
          }}
          ref={(node) => {
            input.current = node;
            if (typeof ref === "function") ref(node);
            else if (ref) ref.current = node;
          }}
          tabIndex={-1}
          type="file"
        />
        <Button
          className="w-full"
          onClick={() => input.current?.click()}
          type="button"
          variant="outline"
        >
          <UploadIcon aria-hidden="true" />
          {placeholder}
        </Button>
      </>
    );
  },
);
FilePanelFileInput.displayName = "LazuliFilePanelFileInput";

const FilePanelTextInput = forwardRef<HTMLInputElement, FilePanelProps["TextInput"]>(
  ({ onChange, onKeyDown, placeholder, value }, ref) => (
    <Input
      {...notCredentials}
      aria-label={placeholder}
      autoFocus
      inputMode="url"
      onChange={onChange}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      ref={ref}
      value={value}
    />
  ),
);
FilePanelTextInput.displayName = "LazuliFilePanelTextInput";

const FilePanelButton = forwardRef<HTMLButtonElement, FilePanelProps["Button"]>(
  ({ children, label, onClick }, ref) => (
    <Button aria-label={label} className="w-full" onClick={onClick} ref={ref} type="button">
      {children ?? label}
    </Button>
  ),
);
FilePanelButton.displayName = "LazuliFilePanelButton";

export const lazuliBlockNoteComponents: Components = {
  ...shadcnComponents,
  FilePanel: {
    Root: FilePanelRoot,
    Button: FilePanelButton,
    FileInput: FilePanelFileInput,
    TabPanel: FilePanelTabPanel,
    TextInput: FilePanelTextInput,
  },
  Generic: {
    ...shadcnComponents.Generic,
    Form: { Root: FormRoot, TextInput: FormTextInput },
  },
};

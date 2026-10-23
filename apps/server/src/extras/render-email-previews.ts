import { mkdir, writeFile } from "node:fs/promises";
import { createLifecycleEmail, lifecycleEmailKindSchema } from "../email/lifecycle-email.ts";

const directory = new URL("../../../../codex/artifacts/extras-01/emails/", import.meta.url);
await mkdir(directory, { recursive: true });
for (const kind of lifecycleEmailKindSchema.options) {
  const message = createLifecycleEmail(
    kind,
    {
      name: "Ana de Oliveira",
      plan: "Essencial",
      effectiveAt: "2026-11-20T12:00:00.000Z",
      categories: ["account", "projects", "flashcards"],
    },
    "https://lazuli.example",
  );
  await writeFile(new URL(`${kind}.html`, directory), message.html);
}
console.info(
  "Generated nine local email previews in codex/artifacts/extras-01/emails. No emails were sent.",
);

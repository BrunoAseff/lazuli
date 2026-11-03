import { readFile } from "node:fs/promises";
import { getTableConfig, PgDialect } from "drizzle-orm/pg-core";
import { expect, it } from "vitest";
import { analyticsConsentEvent } from "./legal.ts";

it("declares the same consent status constraint in the schema and migration", async () => {
  const check = getTableConfig(analyticsConsentEvent).checks.find(
    (item) => item.name === "analytics_consent_event_status_check",
  );
  expect(check).toBeDefined();
  const expression = new PgDialect().sqlToQuery(check!.value).sql;
  expect(expression).toBe("\"analytics_consent_event\".\"status\" in ('granted', 'denied')");
  const migration = await readFile(
    new URL("../../../migrations/0035_legal_acceptance.sql", import.meta.url),
    "utf8",
  );
  expect(migration).toContain(`CONSTRAINT "${check!.name}" CHECK (${expression})`);
});

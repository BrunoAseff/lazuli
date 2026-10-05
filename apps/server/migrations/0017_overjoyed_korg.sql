ALTER TABLE "ai_credit_ledger" DROP CONSTRAINT "ai_credit_ledger_generation_id_ai_generation_id_fk";
--> statement-breakpoint
ALTER TABLE "ai_generation" ADD CONSTRAINT "ai_generation_regeneration_of_id_ai_generation_id_fk" FOREIGN KEY ("regeneration_of_id") REFERENCES "public"."ai_generation"("id") ON DELETE no action ON UPDATE no action DEFERRABLE INITIALLY DEFERRED;--> statement-breakpoint
ALTER TABLE "ai_credit_ledger" ADD CONSTRAINT "ai_credit_ledger_generation_id_ai_generation_id_fk" FOREIGN KEY ("generation_id") REFERENCES "public"."ai_generation"("id") ON DELETE no action ON UPDATE no action DEFERRABLE INITIALLY DEFERRED;

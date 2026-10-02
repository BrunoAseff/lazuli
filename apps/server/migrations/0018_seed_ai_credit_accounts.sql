INSERT INTO "ai_credit_account" ("user_id")
SELECT "id" FROM "user"
ON CONFLICT ("user_id") DO NOTHING;

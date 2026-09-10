DROP TABLE IF EXISTS "telegram_rule" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "telegram_chat" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "telegram_bot" CASCADE;--> statement-breakpoint
CREATE TABLE "telegram_bot" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"bot_token" text NOT NULL,
	"name" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "telegram_bot_user_token_unique" UNIQUE("user_id","bot_token")
);--> statement-breakpoint
CREATE TABLE "telegram_chat" (
	"id" text PRIMARY KEY NOT NULL,
	"bot_id" text NOT NULL,
	"chat_id" text NOT NULL,
	"label" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "telegram_chat_bot_chat_unique" UNIQUE("bot_id","chat_id")
);--> statement-breakpoint
CREATE TABLE "telegram_rule" (
	"id" text PRIMARY KEY NOT NULL,
	"chat_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"project_id" text,
	"thread_id" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "telegram_bot" ADD CONSTRAINT "telegram_bot_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "telegram_chat" ADD CONSTRAINT "telegram_chat_bot_id_telegram_bot_id_fk" FOREIGN KEY ("bot_id") REFERENCES "public"."telegram_bot"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "telegram_rule" ADD CONSTRAINT "telegram_rule_chat_id_telegram_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."telegram_chat"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "telegram_rule" ADD CONSTRAINT "telegram_rule_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "telegram_rule" ADD CONSTRAINT "telegram_rule_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "telegram_bot_userId_idx" ON "telegram_bot" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "telegram_chat_botId_idx" ON "telegram_chat" USING btree ("bot_id");--> statement-breakpoint
CREATE INDEX "telegram_rule_chatId_idx" ON "telegram_rule" USING btree ("chat_id");--> statement-breakpoint
CREATE INDEX "telegram_rule_workspaceId_idx" ON "telegram_rule" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "telegram_rule_projectId_idx" ON "telegram_rule" USING btree ("project_id");

CREATE TABLE "workspace_invite_link" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"token" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"expires_at" timestamp,
	"max_uses" integer,
	"used_count" integer DEFAULT 0 NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_invite_link_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "workspace_invite_link" ADD CONSTRAINT "workspace_invite_link_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invite_link" ADD CONSTRAINT "workspace_invite_link_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workspaceInviteLink_workspaceId_idx" ON "workspace_invite_link" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "workspaceInviteLink_token_idx" ON "workspace_invite_link" USING btree ("token");
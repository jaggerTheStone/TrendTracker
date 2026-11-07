CREATE TABLE "alert_log" (
	"user_id" text NOT NULL,
	"repo_id" integer NOT NULL,
	"kind" text NOT NULL,
	"day" text NOT NULL,
	CONSTRAINT "alert_log_user_id_repo_id_kind_day_pk" PRIMARY KEY("user_id","repo_id","kind","day")
);
--> statement-breakpoint
CREATE TABLE "alert_prefs" (
	"user_id" text PRIMARY KEY NOT NULL,
	"trending" boolean DEFAULT false NOT NULL,
	"spikes" boolean DEFAULT false NOT NULL,
	"weekly" boolean DEFAULT false NOT NULL,
	"last_weekly_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "alert_log" ADD CONSTRAINT "alert_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_log" ADD CONSTRAINT "alert_log_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_prefs" ADD CONSTRAINT "alert_prefs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
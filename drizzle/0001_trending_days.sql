CREATE TABLE "trending_days" (
	"day" text NOT NULL,
	"repo_id" integer NOT NULL,
	"rank" integer NOT NULL,
	"gained" integer NOT NULL,
	CONSTRAINT "trending_days_day_repo_id_pk" PRIMARY KEY("day","repo_id")
);
--> statement-breakpoint
ALTER TABLE "trending_days" ADD CONSTRAINT "trending_days_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trending_days_repo_idx" ON "trending_days" USING btree ("repo_id");
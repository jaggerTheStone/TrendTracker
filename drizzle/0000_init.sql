CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analyses" (
	"repo_id" integer PRIMARY KEY NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "board_repos" (
	"board_id" text NOT NULL,
	"repo_id" integer NOT NULL,
	"note" text,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "board_repos_board_id_repo_id_pk" PRIMARY KEY("board_id","repo_id")
);
--> statement-breakpoint
CREATE TABLE "boards" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"share_id" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "boards_share_id_unique" UNIQUE("share_id")
);
--> statement-breakpoint
CREATE TABLE "mention_repos" (
	"mention_id" integer NOT NULL,
	"repo_id" integer NOT NULL,
	CONSTRAINT "mention_repos_mention_id_repo_id_pk" PRIMARY KEY("mention_id","repo_id")
);
--> statement-breakpoint
CREATE TABLE "mentions" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"external_id" text NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"author" text,
	"score" integer DEFAULT 0 NOT NULL,
	"comments" integer,
	"image" text,
	"published_at" timestamp with time zone NOT NULL,
	"first_seen_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repo_cache" (
	"repo_id" integer PRIMARY KEY NOT NULL,
	"readme_html" text,
	"languages" jsonb,
	"releases" jsonb,
	"star_history" jsonb,
	"commits" jsonb,
	"contributors" integer,
	"fetched_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repo_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"repo_id" integer NOT NULL,
	"captured_at" timestamp with time zone NOT NULL,
	"stars" integer NOT NULL,
	"forks" integer
);
--> statement-breakpoint
CREATE TABLE "repos" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"owner" text NOT NULL,
	"name" text NOT NULL,
	"github_id" bigint,
	"description" text,
	"homepage" text,
	"language" text,
	"topics" text[] DEFAULT '{}' NOT NULL,
	"license" text,
	"avatar" text,
	"stars" integer,
	"forks" integer,
	"open_issues" integer,
	"archived" boolean DEFAULT false NOT NULL,
	"gh_created_at" timestamp with time zone,
	"pushed_at" timestamp with time zone,
	"enriched_at" timestamp with time zone,
	"misses" integer DEFAULT 0 NOT NULL,
	"first_seen_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "source_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone NOT NULL,
	"status" text NOT NULL,
	"item_count" integer DEFAULT 0 NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "trending" (
	"period" text NOT NULL,
	"language" text NOT NULL,
	"rank" integer NOT NULL,
	"repo_id" integer NOT NULL,
	"gained" integer NOT NULL,
	"captured_at" timestamp with time zone NOT NULL,
	CONSTRAINT "trending_period_language_rank_pk" PRIMARY KEY("period","language","rank")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_repos" ADD CONSTRAINT "board_repos_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_repos" ADD CONSTRAINT "board_repos_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boards" ADD CONSTRAINT "boards_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mention_repos" ADD CONSTRAINT "mention_repos_mention_id_mentions_id_fk" FOREIGN KEY ("mention_id") REFERENCES "public"."mentions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mention_repos" ADD CONSTRAINT "mention_repos_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repo_cache" ADD CONSTRAINT "repo_cache_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repo_snapshots" ADD CONSTRAINT "repo_snapshots_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trending" ADD CONSTRAINT "trending_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "board_repos_repo_idx" ON "board_repos" USING btree ("repo_id");--> statement-breakpoint
CREATE INDEX "boards_user_idx" ON "boards" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "mention_repos_repo_idx" ON "mention_repos" USING btree ("repo_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mentions_source_ext_idx" ON "mentions" USING btree ("source","external_id");--> statement-breakpoint
CREATE INDEX "mentions_pub_idx" ON "mentions" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "repo_snapshots_repo_idx" ON "repo_snapshots" USING btree ("repo_id","captured_at");--> statement-breakpoint
CREATE UNIQUE INDEX "repos_key_idx" ON "repos" USING btree ("key");--> statement-breakpoint
CREATE INDEX "repos_last_seen_idx" ON "repos" USING btree ("last_seen_at");--> statement-breakpoint
CREATE INDEX "source_runs_source_idx" ON "source_runs" USING btree ("source","finished_at");
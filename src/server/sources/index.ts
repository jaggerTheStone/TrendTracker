import { hackernewsSource } from "./hackernews";
import { lobstersSource } from "./lobsters";
import { mastodonSource } from "./mastodon";
import { searchSource } from "./search";
import { trendingSource } from "./trending";
import type { SourceAdapter } from "./types";
import { youtubeSource } from "./youtube";

export const adapters: SourceAdapter[] = [
  trendingSource,
  searchSource,
  youtubeSource,
  hackernewsSource,
  lobstersSource,
  mastodonSource,
];

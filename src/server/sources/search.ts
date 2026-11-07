import { searchRepos } from "../github/api";
import { daysAgo, fromApi, type SourceAdapter } from "./types";

const day = (d: Date) => d.toISOString().slice(0, 10);

/** Newly created repositories that already gather stars: what trending lists miss in their first days. */
export const searchSource: SourceAdapter = {
  id: "search",
  async fetch(signal) {
    const [week, month] = await Promise.all([
      searchRepos(`created:>${day(daysAgo(7))} stars:>=40 fork:false`, signal),
      searchRepos(`created:>${day(daysAgo(30))} stars:>=300 fork:false`, signal),
    ]);
    return { repos: [...week, ...month].map(fromApi), mentions: [] };
  },
};

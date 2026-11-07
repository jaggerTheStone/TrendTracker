import { extractRepos } from "@/lib/links";
import { asArray, daysAgo, fetchXml, type MentionInput, type SourceAdapter } from "./types";

/** Developer channels whose video descriptions link the repositories they show. */
const CHANNELS = [
  "UC9Rrud-8CaHokDtK9FszvRg", // Github Awesome
  "UCsBjURrPoezykLs9EqgamOA", // Fireship
  "UCbRP3c757lWg9M-U7TyEkXA", // Theo - t3.gg
  "UC7c3Kb6jYCRj4JOHHZTxKsQ", // GitHub
  "UC9x0AN7BWHpCDHSm9NiJFJQ", // NetworkChuck
  "UCbfYPyITQ-7l4upoX8nvctg", // Two Minute Papers
  "UCFbNIlppjAuEX4znoulh0Cw", // Web Dev Simplified
  "UC29ju8bIPH5as8OGnQzwJyA", // Traversy Media
  "UCfz8x0lVzJpb_dgWm9kPVrw", // DevOps & AI Toolkit
  "UC55ODQSvARtgSyc8ThfiepQ", // Sam Witteveen
  "UCMwVTLZIRRUyyVrkjDpn4pA", // Cole Medin
  "UCkVfrGwV-iG9bSsgCbrNPxQ", // Better Stack
  "UCR-DXc1voovS8nhAvccRZhg", // Jeff Geerling
  "UCj_iGliGCkLcHSZ8eqVNPDQ", // Grafikart
  "UC0m81bQuthaQZmFbXEY9QSw", // AICodeKing
  "UC_x36zCEGilGpB1m-V4gmjg", // IndyDevDan
  "UC1kBxkk2bcG78YBX7LMl9pQ", // code_report
  "UCR9j1jqqB5Rse69wjUnbYwA", // All About AI
  "UC8ENHE5xdFSwx71u3fDH5Xw", // ThePrimeagen
  "UCcefcZRL2oaA_uBNeo5UOWg", // Y Combinator
];

interface Feed {
  feed?: {
    title?: string;
    entry?: Entry | Entry[];
  };
}

interface Entry {
  "yt:videoId": string;
  title: string;
  published: string;
  author?: { name?: string };
  "media:group"?: {
    "media:description"?: string;
    "media:thumbnail"?: { "@url"?: string };
    "media:community"?: { "media:statistics"?: { "@views"?: string } };
  };
}

/** A repository linked in this many videos of one channel is boilerplate (the creator's own repo), not news. */
const BOILERPLATE_THRESHOLD = 4;

export const youtubeSource: SourceAdapter = {
  id: "youtube",
  async fetch(signal) {
    const since = daysAgo(30);
    const feeds = await Promise.allSettled(
      CHANNELS.map((id) => fetchXml<Feed>(`https://www.youtube.com/feeds/videos.xml?channel_id=${id}`, signal)),
    );
    const failures = feeds.filter((f) => f.status === "rejected").length;
    if (failures === CHANNELS.length) throw new Error("Aucun flux YouTube accessible");

    const mentions: MentionInput[] = [];
    for (const result of feeds) {
      if (result.status !== "fulfilled") continue;
      const entries = asArray(result.value.feed?.entry);
      const linked = entries.map((entry) => extractRepos(String(entry["media:group"]?.["media:description"] ?? "")));
      const frequency = new Map<string, number>();
      for (const list of linked) for (const key of list) frequency.set(key, (frequency.get(key) ?? 0) + 1);

      entries.forEach((entry, i) => {
        const published = new Date(entry.published);
        const repos = linked[i].filter((key) => (frequency.get(key) ?? 0) < BOILERPLATE_THRESHOLD);
        if (repos.length === 0 || published < since) return;
        const group = entry["media:group"];
        mentions.push({
          source: "youtube",
          externalId: entry["yt:videoId"],
          title: String(entry.title),
          url: `https://www.youtube.com/watch?v=${entry["yt:videoId"]}`,
          author: entry.author?.name ?? result.value.feed?.title ?? null,
          score: Number(group?.["media:community"]?.["media:statistics"]?.["@views"] ?? 0),
          image: `https://i.ytimg.com/vi/${entry["yt:videoId"]}/mqdefault.jpg`,
          publishedAt: published,
          repos,
        });
      });
    }
    return { repos: [], mentions };
  },
};

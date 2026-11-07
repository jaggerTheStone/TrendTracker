import type { MentionSource } from "@/lib/types";

/** Small monochrome marks for the platforms a mention comes from. */
export function SourceGlyph({ source, size = 14 }: { source: MentionSource | "github"; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    "aria-hidden": true,
    fill: "currentColor",
  } as const;
  switch (source) {
    case "youtube":
      return (
        <svg {...common}>
          <path d="M21.6 7.2a2.7 2.7 0 0 0-1.9-1.9C18 4.8 12 4.8 12 4.8s-6 0-7.7.5a2.7 2.7 0 0 0-1.9 1.9C2 8.9 2 12 2 12s0 3.1.4 4.8a2.7 2.7 0 0 0 1.9 1.9c1.7.5 7.7.5 7.7.5s6 0 7.7-.5a2.7 2.7 0 0 0 1.9-1.9c.4-1.7.4-4.8.4-4.8s0-3.1-.4-4.8ZM10 15.1V8.9l5.2 3.1L10 15.1Z" />
        </svg>
      );
    case "hackernews":
      return (
        <svg {...common}>
          <path d="M3 3h18v18H3V3Zm8.2 10.4V17h1.6v-3.6L16 7h-1.8l-2.2 4.5L9.8 7H8l3.2 6.4Z" />
        </svg>
      );
    case "lobsters":
      return (
        <svg {...common}>
          <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-2.4 5h1.9v8.3h4.3V17H9.6V7Z" />
        </svg>
      );
    case "mastodon":
      return (
        <svg {...common}>
          <path d="M21.3 8.1c0-4.3-2.8-5.5-2.8-5.5C17 1.9 14.6 1.6 12 1.6h-.1c-2.6 0-5 .3-6.4 1 0 0-2.8 1.2-2.8 5.5 0 1-.1 2.2 0 3.4.1 4.2.8 8.4 4.7 9.4 1.8.5 3.4.6 4.6.5 2.3-.1 3.5-.8 3.5-.8l-.1-1.6s-1.6.5-3.4.5c-1.8-.1-3.7-.2-4-2.4v-.6s1.8.4 4 .5c1.4.1 2.6-.1 4-.2 2.5-.3 4.7-1.9 5-3.3.4-2.2.4-5.4.4-5.4Zm-3.4 5.6h-2.1V8.6c0-1.1-.5-1.6-1.4-1.6-1 0-1.5.6-1.5 1.9v2.8h-2.1V8.9c0-1.3-.5-1.9-1.5-1.9-.9 0-1.4.5-1.4 1.6v5.1H5.8V8.4c0-1.1.3-1.9.8-2.6.6-.6 1.3-.9 2.2-.9 1.1 0 1.9.4 2.4 1.2l.5.9.5-.9c.5-.8 1.3-1.2 2.4-1.2.9 0 1.7.3 2.2.9.6.7.8 1.5.8 2.6v5.3Z" />
        </svg>
      );
    case "bluesky":
      return (
        <svg {...common}>
          <path d="M5.5 3.5c2.5 1.9 5.1 5.8 6.5 8.2 1.4-2.4 4-6.3 6.5-8.2 1.8-1.4 4.7-2.5 4.7.9 0 .7-.4 5.6-.6 6.4-.8 2.8-3.5 3.5-5.9 3.1 4.2.7 5.2 3.2 2.9 5.7-4.4 4.8-6.4-1.2-6.9-2.8-.1-.3-.2-.6-.3-.8-.1.2-.2.5-.3.8-.5 1.6-2.5 7.6-6.9 2.8-2.3-2.5-1.3-5 2.9-5.7-2.4.4-5.1-.3-5.9-3.1-.2-.8-.6-5.7-.6-6.4 0-3.4 2.9-2.3 4.7-.9Z" />
        </svg>
      );
    case "github":
      return (
        <svg {...common}>
          <path d="M12 1.5a10.5 10.5 0 0 0-3.3 20.5c.5.1.7-.2.7-.5v-1.8c-2.9.6-3.5-1.4-3.5-1.4-.5-1.2-1.2-1.5-1.2-1.5-.9-.7.1-.6.1-.6 1 .1 1.6 1.1 1.6 1.1.9 1.6 2.5 1.1 3.1.9.1-.7.4-1.1.7-1.4-2.3-.3-4.8-1.2-4.8-5.2 0-1.1.4-2.1 1.1-2.8-.1-.3-.5-1.4.1-2.8 0 0 .9-.3 2.9 1.1a10 10 0 0 1 5.2 0c2-1.4 2.9-1.1 2.9-1.1.6 1.4.2 2.5.1 2.8.7.7 1.1 1.7 1.1 2.8 0 4-2.5 4.9-4.8 5.2.4.3.7 1 .7 2v3c0 .3.2.6.7.5A10.5 10.5 0 0 0 12 1.5Z" />
        </svg>
      );
  }
}

export const SOURCE_LABEL: Record<MentionSource, string> = {
  youtube: "YouTube",
  hackernews: "Hacker News",
  lobsters: "Lobsters",
  mastodon: "Mastodon",
  bluesky: "Bluesky",
};

export function GoogleMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.6 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1-3.7 1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23Z"
      />
      <path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.1a11 11 0 0 0 0 9.8l3.7-2.8Z" />
      <path
        fill="#EA4335"
        d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4Z"
      />
    </svg>
  );
}

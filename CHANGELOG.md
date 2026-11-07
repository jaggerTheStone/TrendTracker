# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org).

## [Unreleased]

### Added

- Bluesky as a buzz source: public posts that link to a GitHub repository, skipping posts with no likes or reposts
  and keeping one post per author and repository ([#11](https://github.com/jaggerTheStone/TrendTracker/pull/11), thanks
  @shubhambaghel34).

## [0.1.0] - 2026-11-07

First public release: a complete rewrite of the earlier Express prototype (kept under the git tag `legacy-v1`).

### Added

- Live data: star counts of every repository on screen re-read every minute (GitHub GraphQL) and pushed to the browser
  over Server-Sent Events; full collection every 5 minutes.
- Radar: one spoke per repository, sectors by domain, ranking by momentum, stars in 24 h or acceleration, acceleration
  ticks, ripples on new stars, "what moves in the last 30 minutes" feed.
- Pulse home page, GitHub Trending mirror with a daily archive, Explorer with search and paste-a-link, topics,
  developers, compare (up to 4 repositories), buzz from YouTube, Hacker News, Lobsters and Mastodon.
- Repository page: live gains, momentum, dated badges, stars / forks / merged PRs per day, star history with ranges,
  commits, languages, releases, mentions, similar projects, README badge, optional AI analyst.
- Accounts (e-mail code, Google pop-up), boards with notes and public sharing, e-mail alerts.
- GitHub Primer look, light and dark themes, phone layout.
- Embedded Postgres (PGlite) for zero-setup local use, any Postgres in production.

[Unreleased]: https://github.com/jaggerTheStone/TrendTracker/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/jaggerTheStone/TrendTracker/releases/tag/v0.1.0

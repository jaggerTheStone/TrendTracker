# Contributing to TrendTracker

Thanks for taking the time to help. Bug reports, ideas, documentation fixes and code are all welcome.

## Getting set up

```bash
git clone https://github.com/jaggerTheStone/TrendTracker.git
cd TrendTracker
npm install
cp .env.example .env.local   # add a GITHUB_TOKEN for realistic data
npm run dev
```

No database to install: an embedded Postgres (PGlite) is created in `.data/pglite` on first run. Delete that folder to
start from scratch.

## Before you open a pull request

Run the same checks as CI:

```bash
npm run typecheck
npm run lint
npm run format:check   # or `npm run format` to fix
npm run build
```

- Keep pull requests focused: one change per PR is easier to review.
- If you change the database schema in `src/server/db/schema.ts`, run `npm run db:generate` and commit the new
  migration in `drizzle/`.
- If you change how a number is computed (gains, momentum, status), update "How the numbers work" in both READMEs.
- Only use public, anonymous data sources. Never simulate data.
- UI text is in French for now; keep it short. English strings will come with i18n.

## Commit messages

We use [Conventional Commits](https://www.conventionalcommits.org): `feat: …`, `fix: …`, `docs: …`, `refactor: …`,
`chore: …`.

## Where to start

Issues labelled [`good first issue`](https://github.com/jaggerTheStone/TrendTracker/labels/good%20first%20issue) are a
good entry point. The [roadmap](README.md#roadmap) lists the bigger pieces; comment on an issue before starting one so
work is not duplicated.

## Code of conduct

This project follows the [code of conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold it.

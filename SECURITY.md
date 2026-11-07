# Security policy

## Supported versions

Only the latest release receives security fixes.

## Reporting a vulnerability

Please **do not open a public issue**. Use GitHub's private vulnerability reporting instead:
[Report a vulnerability](https://github.com/jaggerTheStone/TrendTracker/security/advisories/new).

Include what you found, how to reproduce it and its impact. You will get an answer within a week, and credit in the
release notes if you wish.

## Good practice when self-hosting

- Never commit `.env.local`: it holds your GitHub token, SMTP password and auth secret.
- In production, set `BETTER_AUTH_SECRET` and `CRON_SECRET` to long random values (`openssl rand -base64 32`).
- A GitHub token for TrendTracker needs **no scope at all**: do not grant it access to your repositories.

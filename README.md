# TrendTracker

Real-time trending data from GitHub, Twitter, and Reddit in a beautiful glass-morphism UI.

## Features

- 📊 **GitHub Trends**: Top repositories by recent stars (no API key needed)
- 🐦 **Twitter Trends**: Real-time trending topics (requires Twitter API)
- 📈 **Reddit Trends**: Hot posts across all subreddits (no API key needed)
- 🔄 **Auto-refresh**: Updates every 10 minutes
- 🎨 **Glass UI**: Modern glass-morphism design
- 📱 **Responsive**: Works on desktop and mobile

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables (optional for Twitter):**
   ```bash
   cp .env.example .env
   ```

   For real Twitter data, get a Bearer Token from [Twitter Developer Portal](https://developer.twitter.com/) and add it to `.env`:
   ```
   TWITTER_BEARER_TOKEN=your_token_here
   ```

3. **Start the app:**
   ```bash
   npm start
   ```

4. **Open in browser:**
   ```
   http://localhost:3000
   ```

## API Sources

- **GitHub**: Uses GitHub's search API for recently created repos with high star counts (no API key needed)
- **Twitter**: Uses curated trending topics that simulate real Twitter trends (no API key needed - falls back to realistic data)
- **Reddit**: Uses Reddit's public API for hot posts (no API key needed)

## Optional: Real Twitter API

For real Twitter trending data (optional):
1. Go to https://developer.twitter.com/
2. Create a developer account
3. Get your Bearer Token and add to `.env`:
   ```
   TWITTER_BEARER_TOKEN=your_token_here
   ```

## Troubleshooting

- **GitHub not loading**: Should work automatically (uses public API)
- **Twitter shows no data**: Check your `TWITTER_BEARER_TOKEN` in `.env`
- **Reddit not loading**: Check internet connection (uses public API)
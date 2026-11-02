require("dotenv").config();
const express = require("express");
const path = require("path");
const fs = require("fs");
const cron = require("node-cron");
const fetchGithubTrends = require("./services/fetchGithub");
const fetchTwitterTrends = require("./services/fetchTwitter");
const fetchRedditTrends = require("./services/fetchReddit");

const app = express();
const githubRoute = require("./routes/github");
const twitterRoute = require("./routes/twitter");
const redditRoute = require("./routes/reddit");

app.use(express.static(path.join(__dirname, "../frontend")));
app.use("/api/github", githubRoute);
app.use("/api/twitter", twitterRoute);
app.use("/api/reddit", redditRoute);

app.get("*", (req, res) => {
  res.sendFile(path.resolve(__dirname, "../frontend/index.html"));
});

const cachePaths = {
  github: path.join(__dirname, "./data/github.json"),
  twitter: path.join(__dirname, "./data/twitter.json"),
  reddit: path.join(__dirname, "./data/reddit.json")
};

async function refreshAllTrends() {
  console.log("🔄 Cron: Refreshing all trend sources...");

  try {
    const [githubData, twitterData, redditData] = await Promise.all([
      fetchGithubTrends(),
      fetchTwitterTrends(),
      fetchRedditTrends()
    ]);

    fs.writeFileSync(cachePaths.github, JSON.stringify(githubData, null, 2));
    fs.writeFileSync(cachePaths.twitter, JSON.stringify(twitterData, null, 2));
    fs.writeFileSync(cachePaths.reddit, JSON.stringify(redditData, null, 2));

    console.log("✅ All trends updated.");
  } catch (err) {
    console.error("❌ Trend refresh failed:", err.message);
  }
}

refreshAllTrends();
cron.schedule("*/10 * * * *", refreshAllTrends);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});

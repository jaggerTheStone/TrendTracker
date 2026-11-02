const cron = require("node-cron");
const fetchGithubTrends = require("../services/fetchGithub");
const fs = require("fs");
const path = require("path");

const dataPath = path.join(__dirname, "../data/github.json");

async function cacheGithubTrends() {
  const trends = await fetchGithubTrends();
  fs.writeFileSync(dataPath, JSON.stringify(trends, null, 2));
  console.log("✅ GitHub trends updated at", new Date().toLocaleTimeString());
}

// Run every hour
cron.schedule("0 * * * *", cacheGithubTrends);

// Initial run
cacheGithubTrends();

const fetchGithubTrends = require("../services/fetchGithub");
const fs = require("fs");
const path = require("path");

(async () => {
  try {
    const data = await fetchGithubTrends();
    const outputPath = path.join(__dirname, "../data/github.json");
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
    console.log("✅ GitHub trending data cached successfully.");
  } catch (err) {
    console.error("❌ Failed to fetch GitHub trends:", err.message);
  }
})();

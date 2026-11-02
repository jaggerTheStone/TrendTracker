async function fetchGithubTrends() {
  try {
    const fetch = (await import("node-fetch")).default;

    // Use GitHub's search API to find trending repos (created in last week, sorted by stars)
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const dateString = oneWeekAgo.toISOString().split('T')[0];

    const query = `created:>${dateString} stars:>10`;
    const apiUrl = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=10`;

    const res = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'TrendTracker/1.0'
      }
    });

    if (!res.ok) {
      throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    const repos = data.items || [];

    return repos.map(repo => ({
      name: repo.name,
      author: repo.owner.login,
      url: repo.html_url,
      stars: repo.stargazers_count,
      language: repo.language,
      description: repo.description
    }));
  } catch (err) {
    console.error("GitHub trend fetch failed:", err.message);

    // Fallback to some popular repos if API fails
    return [
      { name: "freeCodeCamp", author: "freeCodeCamp", url: "https://github.com/freeCodeCamp/freeCodeCamp", stars: 390000, language: "JavaScript" },
      { name: "996.ICU", author: "996icu", url: "https://github.com/996icu/996.ICU", stars: 268000, language: null },
      { name: "vue", author: "vuejs", url: "https://github.com/vuejs/vue", stars: 207000, language: "JavaScript" },
      { name: "react", author: "facebook", url: "https://github.com/facebook/react", stars: 223000, language: "JavaScript" },
      { name: "tensorflow", author: "tensorflow", url: "https://github.com/tensorflow/tensorflow", stars: 183000, language: "C++" },
      { name: "awesome", author: "sindresorhus", url: "https://github.com/sindresorhus/awesome", stars: 299000, language: null },
      { name: "ohmyzsh", author: "ohmyzsh", url: "https://github.com/ohmyzsh/ohmyzsh", stars: 170000, language: "Shell" },
      { name: "flutter", author: "flutter", url: "https://github.com/flutter/flutter", stars: 165000, language: "Dart" },
      { name: "gitignore", author: "github", url: "https://github.com/github/gitignore", stars: 160000, language: null },
      { name: "javascript-algorithms", author: "trekhleb", url: "https://github.com/trekhleb/javascript-algorithms", stars: 190000, language: "JavaScript" }
    ];
  }
}

module.exports = fetchGithubTrends;

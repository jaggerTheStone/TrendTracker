async function fetchRedditTrends() {
  try {
    const fetch = (await import("node-fetch")).default;
    const res = await fetch("https://www.reddit.com/r/all/hot.json?limit=10", {
      headers: {
        "User-Agent": "TrendTracker/1.0"
      }
    });

    if (!res.ok) {
      throw new Error(`Reddit API error: ${res.status} ${res.statusText}`);
    }

    const json = await res.json();
    const items = json?.data?.children || [];

    return items.map(item => ({
      title: item.data.title,
      subreddit: item.data.subreddit_name_prefixed,
      url: `https://reddit.com${item.data.permalink}`,
      score: item.data.score,
      comments: item.data.num_comments
    }));
  } catch (err) {
    console.error("Reddit trend fetch failed:", err.message);
    return [];
  }
}

module.exports = fetchRedditTrends;

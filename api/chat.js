module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { userMessage } = req.body;
  if (!userMessage) {
    return res.status(400).json({ error: "No message provided" });
  }

  try {
    // 1. Search ONLY credible websites via Tavily (with answer ready as backup!)
    const tavilyResponse = await fetch("https://api.tavily.com/search", 
      {
       method: "POST",
       signal: AbortSignal.timeout(6000),
       headers: { "Content-Type": "application/json" },
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
       search_depth: "basic",
     include_answer: "basic",
        max_results: 5,
        include_domains: [
          "mayoclinic.org",
          "celiac.org",
          "foodallergy.org",
          "eatright.org",
          "nhs.uk",
          "nih.gov",
          "monashfodmap.com",
          "myplate.gov"
        ]
      })
    });

    const searchData = await tavilyResponse.json();
    const results = searchData.results || [];

    if (results.length === 0) {
      return res.status(200).json({
        reply:
          "I couldn't find a verified recipe in our credible sources for that request. Try asking about a differe

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { userMessage } = req.body;
  if (!userMessage) {
    return res.status(400).json({ error: "No message provided" });
  }

  try {
    const tavilyResponse = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query: `${userMessage} recipe`,
        search_depth: "advanced",
        include_answer: "advanced",
        max_results: 4,
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

    const data = await tavilyResponse.json();

    if (!data.results || data.results.length === 0) {
      return res.status(200).json({
        reply: "I couldn't find a verified result in our credible sources for that request. Try asking about a specific dietary restriction or ingredient!"
      });
    }

    const sourcesList = data.results
      .map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}`)
      .join("\n\n");

    const formattedReply =
      `📋 Summary:\n${data.answer || "Here are verified resources for your request:"}\n\n` +
      `🔗 Credible Sources:\n${sourcesList}\n\n` +
      `⚠️ Safety Note: Always double-check product labels for hidden allergens or cross-contamination.`;

    res.status(200).json({ reply: formattedReply });
  } catch (error) {
    res.status(500).json({ error: "Server error: " + error.message });
  }
};

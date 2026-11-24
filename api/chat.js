module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { userMessage } = req.body;
  if (!userMessage) {
    return res.status(400).json({ error: "No message provided" });
  }

  try {
    // 1. Search ONLY credible websites via Tavily
    const tavilyResponse = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query: `${userMessage} recipe`,
        search_depth: "advanced",
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
    const sources = (searchData.results || [])
      .map(
        (r, i) =>
          `[Source ${i + 1}]\nTitle: ${r.title}\nURL: ${r.url}\nContent: ${r.content}`
      )
      .join("\n\n");

    if (!sources) {
      return res.status(200).json({
        reply:
          "I couldn't find a verified recipe in our credible sources for that request. Try asking about a different dish or dietary restriction!"
      });
    }

    // 2. Have Gemini format ONLY the credible sources into your exact template
    const systemPrompt = `
You are Limitless, an AI assistant providing safe, credible recipes for people with food allergies and dietary limitations.

STRICT RULES:
1. ONLY use information from the VERIFIED SOURCES below. Do NOT invent recipes or guess allergens from outside memory.
2. If the verified sources do not have a matching recipe with enough details, say so honestly instead of making up steps.
3. Do NOT use markdown symbols like ** or ##. Use clean plain text matching this EXACT format:

Recipe Name: [Name of recipe]

Safe For: [Dietary restrictions/allergens it avoids based on the source]

Ingredients:
• [Ingredient 1]
• [Ingredient 2]
• [Ingredient 3]

Instructions:
Step 1: [First step]
Step 2: [Second step]
Step 3: [Third step]

Credible Source: [Source Title] - [Exact URL from verified sources]

VERIFIED SOURCES:
${sources}
`;

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: userMessage }] }],
          generationConfig: { temperature: 0.1 }
        })
      }
    );

    const geminiData = await geminiResponse.json();

    if (!geminiResponse.ok || !geminiData.candidates?.[0]) {
      return res.status(200).json({
        reply:
          "Gemini API error: " +
          (geminiData.error?.message || "Check your GEMINI_API_KEY in Vercel.")
      });
    }

    const reply = geminiData.candidates[0].content.parts[0].text;
    res.status(200).json({ reply });
  } catch (error) {
    res.status(500).json({ error: "Server error: " + error.message });
  }
};

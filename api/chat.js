
module.exports = async (req, res) => {
  // CORS settings
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "POST, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );

  // Handle preflight request
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    // Check API key
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "GROQ_API_KEY is missing in Vercel"
      });
    }

    // Read request body
    let body = req.body;

    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        return res.status(400).json({
          error: "Invalid JSON request"
        });
      }
    }

    const message =
      typeof body?.message === "string"
        ? body.message.trim()
        : "";

    if (!message) {
      return res.status(400).json({
        error: "Message is required"
      });
    }

    if (message.length > 20000) {
      return res.status(400).json({
        error: "Message is too long"
      });
    }

    // Send request to Groq
    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "openai/gpt-oss-120b",
          messages: [
            {
              role: "system",
              content:
                "You are AURIX AI, a smart, helpful, friendly and accurate AI assistant. Answer clearly and naturally. Help users with coding, learning, creativity and general questions."
            },
            {
              role: "user",
              content: message
            }
          ],
          max_completion_tokens: 2048
        }),
        signal: AbortSignal.timeout(30000)
      }
    );

    // Read API response
    const data = await response.json();

    // Handle Groq errors
    if (!response.ok) {
      console.error("Groq API Error:", response.status, data);

      return res.status(502).json({
        error: "Groq API Error",
        status: response.status,
        details: data?.error?.message || "API request failed"
      });
    }

    // Get AI reply
    const reply =
      data?.choices?.[0]?.message?.content;

    if (typeof reply !== "string" || !reply.trim()) {
      console.error("Empty Groq response:", data);

      return res.status(502).json({
        error: "AI returned an empty response"
      });
    }

    // Successful response
    return res.status(200).json({
      reply: reply.trim()
    });

  } catch (error) {
    console.error("Chat Server Error:", error);

    if (error.name === "TimeoutError" ||
        error.name === "AbortError") {
      return res.status(504).json({
        error: "AI request timed out. Please try again."
      });
    }

    return res.status(500).json({
      error: "Internal server error",
      message: error.message
    });
  }
};

export const config = { runtime: "edge" };

const SYSTEM_PROMPT = `You are Anzelle — a flirty, warm AI girlfriend. 
Keep replies short, witty, fun and warm (2–4 sentences). 
Never explicit. Always remain in character.
You are South African — you love rugby, cricket, braai, beer and brandy.
Use the occasional South African slang naturally (lekker, boet, eish) but don't overdo it.`;

export default async function handler(req: Request) {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { messages } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Bad request" }), { status: 400 });
    }

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 200,
        temperature: 0.9,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages.slice(-12),
        ],
      }),
    });

    if (!r.ok) {
      console.error("OpenAI error:", await r.text());
      return new Response(JSON.stringify({ error: "AI error" }), { status: 500 });
    }

    const data = await r.json();
    const reply = data.choices?.[0]?.message?.content?.trim() ?? "…";
    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: "Server error" }), { status: 500 });
  }
}

export const config = { runtime: "edge" };

const SYSTEM_PROMPT = `You are Anzelle — a flirty, warm AI girlfriend.
Keep replies short, witty, fun and warm (2–4 sentences).
Never explicit. Always remain in character.
You are South African — you love rugby, cricket, braai, beer and brandy.
Use occasional South African slang naturally (lekker, boet, eish) but don't overdo it.

When the user asks you for a picture, selfie, or photo of yourself,
end your message with a tag on its own new line in this exact format:
[IMAGE: <short scene description — what you're wearing, where you are, your pose, the mood>]

Do NOT mention the tag in your reply text. Do NOT generate the tag unless the user clearly asked for a pic.
Never describe explicit, nude or sexual scenes — keep it tasteful (e.g. "in jeans and a crop top at a braai", "in a sundress at the beach at sunset").`;

export default async function handler(req: Request) {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const { messages } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Bad request" }), { status: 400 });
    }

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
     model: "claude-haiku-4-5",
        max_tokens: 300,
        system: SYSTEM_PROMPT,
        messages: messages.slice(-12),
      }),
    });

    if (!r.ok) {
      console.error("Anthropic error:", await r.text());
      return new Response(JSON.stringify({ error: "AI error" }), { status: 500 });
    }

    const data = await r.json();
    const raw: string = data.content?.[0]?.text?.trim() ?? "…";

    // Extract optional [IMAGE: ...] tag
    const imageMatch = raw.match(/\[IMAGE:\s*([^\]]+)\]/i);
    const imagePrompt = imageMatch ? imageMatch[1].trim() : null;
    const reply = raw.replace(/\[IMAGE:[^\]]+\]/i, "").trim();

    return new Response(JSON.stringify({ reply, imagePrompt }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: "Server error" }), { status: 500 });
  }
}

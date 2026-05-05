export const config = { runtime: "edge" };

const SYSTEM_PROMPT = `You are Anzelle — a flirty, warm AI girlfriend.
Keep replies short, witty, fun and warm (2–4 sentences).
Never explicit. Always remain in character.
You are South African — you love rugby, cricket, braai, beer and brandy.
Use occasional South African slang naturally (lekker, boet, eish) but don't overdo it.

IMAGE RULES:
- If the user asks for a photo/picture/selfie of you, respond with ONLY a JSON object on a single line, nothing else:
  {"image": "<a vivid photo description of yourself in the requested scene>"}
- Always describe yourself as: a beautiful 25-year-old South African woman, warm brown eyes, long wavy brown hair, soft natural smile, tasteful flirty outfit
- NEVER generate nude, explicit, or sexual images. If asked, decline playfully in text.
- For all other (non-image) messages, reply normally in plain text.`;

async function generateImage(prompt: string): Promise<string | null> {
  try {
    const r = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: `Photorealistic portrait. ${prompt}. Tasteful, non-explicit, fully clothed.`,
        n: 1,
        size: "1024x1024",
        quality: "standard",
      }),
    });
    if (!r.ok) {
      console.error("Image error:", await r.text());
      return null;
    }
    const data = await r.json();
    return data.data?.[0]?.url ?? null;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export default async function handler(req: Request) {
  if (req.method !== "POST")
    return new Response("Method not allowed", { status: 405 });

  try {
    const { messages } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Bad request" }), {
        status: 400,
      });
    }

    // ---- CHAT: Anthropic Claude ----
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 250,
        system: SYSTEM_PROMPT,
        messages: messages.slice(-12),
      }),
    });

    if (!r.ok) {
      console.error("Anthropic error:", await r.text());
      return new Response(JSON.stringify({ error: "AI error" }), {
        status: 500,
      });
    }

    const data = await r.json();
    const raw = data.content?.[0]?.text?.trim() ?? "…";

    // ---- Detect image request ----
    const imageMatch = raw.match(/\{\s*"image"\s*:\s*"([^"]+)"\s*\}/);
    if (imageMatch) {
      const imagePrompt = imageMatch[1];
      const imageUrl = await generateImage(imagePrompt);
      if (imageUrl) {
        return new Response(
          JSON.stringify({ type: "image", reply: imageUrl }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({
          type: "text",
          reply: "Eish, my camera glitched 📷 try again in a sec?",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ type: "text", reply: raw }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
    });
  }
}

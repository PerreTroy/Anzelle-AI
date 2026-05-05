export const config = { runtime: "edge" };

const ANZELLE_LOOK = 
  "A 27 year old South African woman, sun-kissed olive skin, " +
  "short bob length honey-blonde hair, warm hazel eyes, soft natural makeup, " +
  "playful smile, athletic slim build, freckles across nose, dimples";

const BLOCKED = /\b(nude|naked|nsfw|topless|sex|porn|xxx|)\b/i;

export default async function handler(req: Request) {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const { prompt } = await req.json();

    if (!prompt || typeof prompt !== "string") {
      return new Response(JSON.stringify({ error: "Bad request" }), { status: 400 });
    }

    if (BLOCKED.test(prompt)) {
      return new Response(JSON.stringify({ error: "blocked" }), { status: 400 });
    }

    const fullPrompt = `${ANZELLE_LOOK}, ${prompt}, photorealistic, natural lighting, instagram selfie style, high quality`;

    // Replicate sync API — returns the result directly
    const r = await fetch(
      "https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}`,
          Prefer: "wait",
        },
        body: JSON.stringify({
          input: {
            prompt: fullPrompt,
            num_outputs: 1,
            aspect_ratio: "3:4",
            output_format: "jpg",
            output_quality: 85,
          },
        }),
      }
    );

    if (!r.ok) {
      console.error("Replicate error:", await r.text());
      return new Response(JSON.stringify({ error: "Image error" }), { status: 500 });
    }

    const data = await r.json();
    const url = Array.isArray(data.output) ? data.output[0] : data.output;

    if (!url) {
      return new Response(JSON.stringify({ error: "No image" }), { status: 500 });
    }

    return new Response(JSON.stringify({ url }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: "Server error" }), { status: 500 });
  }
}

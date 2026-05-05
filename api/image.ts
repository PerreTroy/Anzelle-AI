export const config = { runtime: "edge" };

const BLOCKED = /\b(nude|naked|nsfw|porn|sex|explicit|topless|nipple|pussy|tits)\b/i;

const STYLE = "professional photo of Anzelle, a beautiful young South African woman, " +
  "long honey blonde hair, soft natural makeup, warm smile, tan skin, athletic body, " +
  "natural lighting, instagram aesthetic, photorealistic, sharp focus, 35mm";

export default async function handler(req: Request) {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const { scene } = await req.json();

    if (BLOCKED.test(scene || "")) {
      return new Response(JSON.stringify({ error: "blocked" }), { status: 400 });
    }

    // Let Claude turn the user's message into a clean image prompt
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 120,
        system:
          "You convert a user's casual message into a short safe-for-work image prompt scene. " +
          "Reply ONLY with a comma-separated visual scene (location, outfit, pose, mood). " +
          "No nudity. Bikini/underwear/dresses fine. No people other than Anzelle. " +
          "Keep under 25 words.",
        messages: [{ role: "user", content: scene || "selfie" }],
      }),
    });

    const claudeData = await claudeRes.json();
    const sceneDesc = claudeData.content?.[0]?.text?.trim() || "selfie, casual outfit, smiling";

    const prompt = `${STYLE}, ${sceneDesc}`;

    // Call Replicate Flux Schnell (fast + cheap)
    const replicate = await fetch("https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.REPLICATE_API_TOKEN}`,
        "Prefer": "wait",
      },
      body: JSON.stringify({
        input: {
          prompt,
          aspect_ratio: "3:4",
          num_outputs: 1,
          output_format: "webp",
          output_quality: 85,
        },
      }),
    });

    if (!replicate.ok) {
      console.error("Replicate error:", await replicate.text());
      return new Response(JSON.stringify({ error: "img fail" }), { status: 500 });
    }

    const repData = await replicate.json();
    const url = Array.isArray(repData.output) ? repData.output[0] : repData.output;

    if (!url) {
      console.error("No image URL:", repData);
      return new Response(JSON.stringify({ error: "no url" }), { status: 500 });
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

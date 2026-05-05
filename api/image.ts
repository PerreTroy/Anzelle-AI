export const config = { runtime: "edge" };

// Keep Anzelle visually consistent across images
const ANZELLE_LOOK =
  "beautiful South African woman, mid-20s, short bob length sun-kissed blonde hair, hazel eyes, warm playful smile, athletic figure, lightly tanned skin";

const BLOCKED = [
  "nude", "naked", "nsfw", "sex", "porn", "topless",
  "explicit", "xxx", "bare", "boob", "breast", "nipple",
];

export default async function handler(req: Request) {
  if (req.method !== "POST")
    return new Response("Method not allowed", { status: 405 });

  try {
    const { scene } = await req.json();

    if (typeof scene !== "string" || !scene.length || scene.length > 300) {
      return new Response(JSON.stringify({ error: "Bad request" }), { status: 400 });
    }

    const lower = scene.toLowerCase();
    if (BLOCKED.some((t) => lower.includes(t))) {
      return new Response(JSON.stringify({ error: "blocked" }), { status: 400 });
    }

    const prompt = `Casual selfie photo of ${ANZELLE_LOOK}. ${scene}. Natural lighting, photorealistic, candid, high quality, instagram style.`;

    const r = await fetch(
      "https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN ?? ""}`,
          Prefer: "wait",
        },
        body: JSON.stringify({
          input: {
            prompt,
            aspect_ratio: "3:4",
            output_format: "jpg",
            output_quality: 85,
            num_outputs: 1,
            go_fast: true,
          },
        }),
      }
    );

    if (!r.ok) {
      console.error("Replicate error:", await r.text());
      return new Response(JSON.stringify({ error: "image error" }), { status: 500 });
    }

    const data = await r.json();
    const url = Array.isArray(data.output) ? data.output[0] : data.output;

    if (!url) {
      return new Response(JSON.stringify({ error: "no image" }), { status: 500 });
    }

    return new Response(JSON.stringify({ url }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: "server" }), { status: 500 });
  }
}

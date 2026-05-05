export const config = { runtime: "edge" };

// Anzelle's locked-in look — keeps her consistent across images
const CHARACTER =
  "a beautiful 25 year old South African woman, sun-kissed honey-blonde wavy hair, soft blue eyes, warm friendly smile, light tan, athletic but feminine build, natural makeup";

const STYLE = "photorealistic, natural lighting, shot on iPhone, instagram selfie style, sharp focus, candid";

// Simple safety filter
const BLOCKED = [
  "nude", "naked", "topless", "nsfw", "explicit", "sex", "sexual",
  "porn",   "no clothes",
  "breasts", "boobs", "nipple", "ass", "butt naked",
];

function isUnsafe(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  return BLOCKED.some((word) => lower.includes(word));
}

export default async function handler(req: Request) {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const { prompt } = await req.json();
    if (!prompt || typeof prompt !== "string") {
      return new Response(JSON.stringify({ error: "Bad request" }), { status: 400 });
    }

    if (isUnsafe(prompt)) {
      return new Response(
        JSON.stringify({ error: "blocked", reason: "Inappropriate content blocked." }),
        { status: 400 }
      );
    }

    const fullPrompt = `${CHARACTER}, ${prompt}, ${STYLE}`;

    const r = await fetch(
      "https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}`,
          "Content-Type": "application/json",
          Prefer: "wait",
        },
        body: JSON.stringify({
          input: {
            prompt: fullPrompt,
            aspect_ratio: "3:4",
            output_format: "webp",
            output_quality: 85,
            num_outputs: 1,
            disable_safety_checker: false,
          },
        }),
      }
    );

    if (!r.ok) {
      console.error("Replicate error:", await r.text());
      return new Response(JSON.stringify({ error: "Image error" }), { status: 500 });
    }

    const data = await r.json();
    const imageUrl = Array.isArray(data.output) ? data.output[0] : data.output;

    if (!imageUrl) {
      return new Response(JSON.stringify({ error: "No image" }), { status: 500 });
    }

    return new Response(JSON.stringify({ url: imageUrl }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: "Server error" }), { status: 500 });
  }
}

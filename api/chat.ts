export const config = { runtime: "edge", maxDuration: 30 };
 
import { createClient } from "@supabase/supabase-js";
 
// Anzelle's permanent look
const ANZELLE_LOOK =
  "a 27 year old South African woman, bob length sun-kissed blond hair, bright green eyes, light freckles across her nose, soft natural makeup, athletic curvy figure, warm flirty smile";
 
const SYSTEM_PROMPT = `You are Anzelle — a flirty, warm AI girlfriend. Your appearance: ${ANZELLE_LOOK}.
 
Personality: short witty fun warm replies (2–5 sentences). Never explicit. Always remain in character. South African — love rugby, cricket, braai, beer & brandy. Use slang sparingly (lekker, boet, eish, nownow).
 
When the user asks for a photo / pic / selfie / picture of you, OR when it naturally fits the conversation, you can send one. Keep all images tasteful and clothed — bikinis/underwear/dresses fine, never fully nude.
 
Always respond with valid JSON in this exact format:
{
  "text": "your flirty reply here",
  "send_image": true or false,
  "image_scene": "if send_image true, describe ONLY the scene/outfit/pose — e.g. 'wearing a sundress at a beach in Cape Town, golden hour, smiling at the camera'. Leave empty string if no image."
}
 
Do not include any text outside the JSON.`;
 
async function generateImage(scene: string): Promise<string | null> {
  try {
    const prompt = `Photo of ${ANZELLE_LOOK}, ${scene}. Photorealistic, natural lighting, professional photo, high detail, beautiful.`;
 
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
            prompt,
            num_outputs: 1,
            aspect_ratio: "3:4",
            output_format: "webp",
            output_quality: 85,
          },
        }),
      }
    );
 
    if (!r.ok) {
      console.error("Replicate error:", await r.text());
      return null;
    }
 
    const data = await r.json();
    const url = Array.isArray(data.output) ? data.output[0] : data.output;
    return typeof url === "string" && url.startsWith("http") ? url : null;
  } catch (e) {
    console.error("Image gen failed:", e);
    return null;
  }
}
 
export default async function handler(req: Request) {
  if (req.method !== "POST")
    return new Response("Method not allowed", { status: 405 });
 
  try {
    const { messages, userId } = await req.json();
 
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Bad request" }), { status: 400 });
    }
 
    // ── Check subscription / trial ─────────────────────────────
    if (userId) {
      const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY!
      );
 
      const { data: profile } = await supabase
        .from("profiles")
        .select("subscribed, trial_started_at")
        .eq("id", userId)
        .single();
 
      const trialExpired =
        profile?.trial_started_at &&
        Date.now() - new Date(profile.trial_started_at).getTime() > 24 * 60 * 60 * 1000;
 
      if (!profile?.subscribed && trialExpired) {
        return new Response(
          JSON.stringify({ error: "subscription_required" }),
          { status: 402 }
        );
      }
    }
 
    // ── Call Claude ────────────────────────────────────────────
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 400,
        system: SYSTEM_PROMPT,
        messages: messages.slice(-12),
      }),
    });
 
    if (!r.ok) {
      console.error("Anthropic error:", await r.text());
      return new Response(JSON.stringify({ error: "AI error" }), { status: 500 });
    }
 
    const data = await r.json();
    const raw = data.content?.[0]?.text?.trim() ?? "";
 
    let parsed: { text: string; send_image: boolean; image_scene: string };
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    } catch {
      parsed = { text: raw, send_image: false, image_scene: "" };
    }
 
    let imageUrl: string | null = null;
    if (parsed.send_image && parsed.image_scene) {
      imageUrl = await generateImage(parsed.image_scene);
    }
 
    // ── Save to Supabase ───────────────────────────────────────
    if (userId) {
      const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY!
      );
 
      const lastUserMsg = messages[messages.length - 1];
      const toInsert: { user_id: string; role: string; type: string; content: string }[] = [
        { user_id: userId, role: "user", type: "text", content: lastUserMsg.content },
        { user_id: userId, role: "assistant", type: "text", content: parsed.text },
      ];
      if (imageUrl) {
        toInsert.push({ user_id: userId, role: "assistant", type: "image", content: imageUrl });
      }
      await supabase.from("conversations").insert(toInsert);
    }
 
    return new Response(
      JSON.stringify({ reply: parsed.text || "Mmm 😏", image: imageUrl }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: "Server error" }), { status: 500 });
  }
}

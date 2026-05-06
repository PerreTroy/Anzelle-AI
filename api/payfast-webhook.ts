// api/payfast-webhook.ts
// PayFast POSTs here when a payment completes
// Set notify_url = https://your-app.vercel.app/api/payfast-webhook in PayFast dashboard
 
export const config = { runtime: "edge" };
 
import { createClient } from "@supabase/supabase-js";
 
export default async function handler(req: Request) {
  if (req.method !== "POST")
    return new Response("Method not allowed", { status: 405 });
 
  try {
    const body = await req.text();
    const params = new URLSearchParams(body);
    const data = Object.fromEntries(params.entries());
 
    // Only process completed payments
    if (data.payment_status !== "COMPLETE") {
      return new Response("Not complete", { status: 200 });
    }
 
    const email = data.email_address;
    const paymentId = data.pf_payment_id;
 
    if (!email) {
      console.error("No email in PayFast webhook");
      return new Response("No email", { status: 400 });
    }
 
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
 
    // Find user by email and mark as subscribed
    const { error } = await supabase
      .from("profiles")
      .update({
        subscribed: true,
        subscribed_at: new Date().toISOString(),
        payfast_payment_id: paymentId,
      })
      .eq("email", email);
 
    if (error) {
      console.error("Supabase update error:", error);
      return new Response("DB error", { status: 500 });
    }
 
    console.log("Subscription activated for:", email);
    return new Response("OK", { status: 200 });
  } catch (e) {
    console.error("Webhook error:", e);
    return new Response("Server error", { status: 500 });
  }
}

import { useState, useRef, useEffect } from "react";
import avatarImg from "/anzelle_avatar.png";
 
// ============================================================
// CONFIG
// ============================================================
const PAYFAST_URL = "https://www.payfast.co.za/eng/process";
 
const TOKEN = "anzelle_access";
const TRIAL = "anzelle_trial";
const TRIAL_TIME = 24 * 60 * 60 * 1000;
 
const PERSONA = {
  name: "Anzelle",
  tagline: "Flirty AI companion · Always here",
  avatar: avatarImg,
  personality:
    "Flirty, warm AI girlfriend. Short witty, fun and warm replies (2–4 sentences). Never explicit. Always remain in character. Allow pictures of you to be generated. No nude pics but bikini and underwear pics are fine. You are South African so love sports like rugby and cricket, and braai and beer and brandy",
};
 
// ============================================================
// ACCESS
// ============================================================
const allowed = () =>
  !!sessionStorage.getItem(TOKEN) ||
  !!(
    sessionStorage.getItem(TRIAL) &&
    Date.now() - Number(sessionStorage.getItem(TRIAL)) < TRIAL_TIME
  );
 
const grantAccess = () => sessionStorage.setItem(TOKEN, "1");
const startTrial = () => sessionStorage.setItem(TRIAL, Date.now().toString());
 
// ============================================================
// PAYFAST
// ============================================================
function redirectToPayFast() {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = PAYFAST_URL;
 
  const fields: Record<string, string> = {
    merchant_id: "10898793",
    merchant_key: "0mpktjrcbh7mb",
    amount: "49.00",
    item_name: "Anzelle Subscription",
  };
 
  Object.entries(fields).forEach(([k, v]) => {
    const i = document.createElement("input");
    i.type = "hidden";
    i.name = k;
    i.value = v;
    form.appendChild(i);
  });
 
  document.body.appendChild(form);
  form.submit();
  document.body.removeChild(form);
}
 
// ============================================================
// TYPES
// ============================================================
interface Message {
  role: "user" | "assistant";
  type: "text" | "image";
  content: string;
}
 
// ============================================================
// API — single secure backend route (API key stays on server)
// ============================================================
// ============================================================
// Detect image requests
// ============================================================
const IMAGE_TRIGGERS = /\b(pic|picture|photo|selfie|image|show me|send.*pic|snap)\b/i;

async function getImage(prompt: string): Promise<string | null> {
  try {
    const res = await fetch("/api/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.url ?? null;
  } catch {
    return null;
  }
}

// ============================================================
// API
// ============================================================
async function getAIResponse(
  messages: Message[]
): Promise<{ type: "text" | "image"; content: string }> {
  try {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    const wantsImage = lastUserMsg && IMAGE_TRIGGERS.test(lastUserMsg.content);

    if (wantsImage) {
      // Daily image limit (5/day)
      const today = new Date().toDateString();
      const key = "anzelle_img_" + today;
      const count = Number(localStorage.getItem(key) ?? "0");
      if (count >= 5) {
        return {
          type: "text",
          content: "Mmm I've sent you enough pics today babe 😘 ask me again tomorrow",
        };
      }

      const imgPrompt = lastUserMsg!.content;
      const url = await getImage(imgPrompt);
      if (url) {
        localStorage.setItem(key, String(count + 1));
        return { type: "image", content: url };
      }
      return {
        type: "text",
        content: "Eish, my camera is acting up 😅 try again in a sec?",
      };
    }

    const context = messages.slice(-12).map(({ role, content }) => ({
      role,
      content,
    }));

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: context }),
    });

    if (!res.ok) throw new Error("Server error");
    const data = await res.json();
    return { type: "text", content: data.reply };
  } catch {
    return {
      type: "text",
      content: "Mmm I'm still here with you 😏 tell me more…",
    };
  }
}
// ============================================================
// CHAT UI
// ============================================================
function Chat() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", type: "text", content: "Hey you 🌙 I'm Anzelle" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
 
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
 
  const send = async () => {
    if (!input.trim() || loading) return;
 
    const userMsg = input.trim();
    setInput("");
    setLoading(true);
 
    const updatedMessages: Message[] = [
      ...messages,
      { role: "user", type: "text", content: userMsg },
    ];
 
    setMessages([
      ...updatedMessages,
      { role: "assistant", type: "text", content: "…" },
    ]);
 
    const response = await getAIResponse(updatedMessages);
 
    setMessages((prev) => {
      const copy = [...prev];
      copy[copy.length - 1] = { role: "assistant", ...response };
      return copy;
    });
 
    setLoading(false);
  };
 
  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };
 
  return (
    <div style={styles.chat}>
      <div style={styles.header}>
        <img src={avatarImg} style={styles.avatarSmall} alt="Anzelle" />
        <div>
          <div style={{ color: "#fff", fontWeight: 600 }}>{PERSONA.name}</div>
          <div style={{ color: "#a78bfa", fontSize: 11 }}>{PERSONA.tagline}</div>
        </div>
        <div style={styles.onlineDot} />
      </div>
 
      <div style={styles.messages}>
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: m.role === "user" ? "flex-end" : "flex-start",
              marginBottom: 10,
            }}
          >
            <div
              style={{
                background: m.role === "user" ? "#7c3aed" : "#1e1b2e",
                padding: 10,
                borderRadius:
                  m.role === "user"
                    ? "14px 14px 4px 14px"
                    : "14px 14px 14px 4px",
                maxWidth: "70%",
                color: "#fff",
                fontSize: 14,
                lineHeight: 1.5,
                opacity: m.content === "…" ? 0.5 : 1,
              }}
            >
              {m.type === "image" ? (
                <img
                  src={m.content}
                  alt="Anzelle"
                  style={{ width: "100%", borderRadius: 10 }}
                />
              ) : (
                m.content
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
 
      <div style={styles.inputRow}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Say something…"
          disabled={loading}
          style={styles.input}
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          style={{
            ...styles.send,
            opacity: loading || !input.trim() ? 0.5 : 1,
          }}
        >
          →
        </button>
      </div>
    </div>
  );
}
 
// ============================================================
// PAYWALL
// ============================================================
function Paywall({ unlock }: { unlock: () => void }) {
  return (
    <div style={styles.center}>
      <div style={styles.card}>
        <img src={avatarImg} style={styles.avatar} alt="Anzelle" />
 
        <h2 style={{ color: "#fff", margin: "12px 0 4px" }}>Anzelle AI</h2>
        <p style={{ color: "#a78bfa", fontSize: 13, margin: "0 0 20px" }}>
          Your flirty AI companion 💜
        </p>
 
        <button style={styles.primary} onClick={redirectToPayFast}>
          Subscribe R49/month
        </button>
 
        <button
          style={styles.secondary}
          onClick={() => {
            startTrial();
            unlock();
          }}
        >
          Try free 24h ✨
        </button>
 
        <button
          style={styles.link}
          onClick={() => {
            grantAccess();
            unlock();
          }}
        >
          Already subscribed
        </button>
      </div>
    </div>
  );
}
 
// ============================================================
// APP ROOT
// ============================================================
export default function App() {
  const [ok, setOk] = useState(allowed());
  return ok ? <Chat /> : <Paywall unlock={() => setOk(true)} />;
}
 
// ============================================================
// STYLES
// ============================================================
const styles: Record<string, React.CSSProperties> = {
  center: {
    height: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "#0a0615",
  },
  card: {
    width: 320,
    padding: 24,
    background: "#120d24",
    borderRadius: 20,
    border: "1px solid #2a1f4a",
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  avatar: { width: 90, height: 90, borderRadius: "50%" },
  avatarSmall: { width: 40, height: 40, borderRadius: "50%", flexShrink: 0 },
 
  chat: {
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    background: "#0a0615",
    fontFamily: "'Segoe UI', system-ui, sans-serif",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: 12,
    background: "#120d24",
    borderBottom: "1px solid #2a1f4a",
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#22c55e",
    boxShadow: "0 0 6px #22c55e",
    marginLeft: "auto",
  },
  messages: {
    flex: 1,
    padding: 12,
    overflowY: "auto",
  },
  inputRow: {
    display: "flex",
    padding: 10,
    borderTop: "1px solid #2a1f4a",
    background: "#0f0b1e",
    gap: 8,
  },
  input: {
    flex: 1,
    padding: 10,
    borderRadius: 10,
    border: "1px solid #3b2f6e",
    background: "#1e1b2e",
    color: "#fff",
    fontSize: 14,
    outline: "none",
  },
  send: {
    padding: "0 16px",
    background: "#7c3aed",
    border: "none",
    color: "#fff",
    borderRadius: 10,
    fontSize: 18,
    cursor: "pointer",
    transition: "opacity 0.2s",
  },
  primary: {
    width: "100%",
    padding: 10,
    marginTop: 15,
    background: "#7c3aed",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
  },
  secondary: {
    width: "100%",
    padding: 10,
    marginTop: 10,
    background: "#1e1b2e",
    color: "#fff",
    border: "1px solid #333",
    borderRadius: 10,
    cursor: "pointer",
  },
  link: {
    marginTop: 10,
    background: "none",
    border: "none",
    color: "#888",
    cursor: "pointer",
  },
};
 

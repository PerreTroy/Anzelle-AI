import { useState, useRef, useEffect } from "react";
import { createClient, Session, User } from "@supabase/supabase-js";
import avatarImg from "/anzelle_avatar.png";

// ============================================================
// SUPABASE
// ============================================================
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ============================================================
// CONFIG
// ============================================================
const PAYFAST_URL = "https://www.payfast.co.za/eng/process";

const PERSONA = {
  name: "Anzelle",
  tagline: "Flirty AI companion · Always here",
};

// ============================================================
// TYPES
// ============================================================
interface Message {
  role: "user" | "assistant";
  type: "text" | "image";
  content: string;
}

interface Profile {
  subscribed: boolean;
  trial_started_at: string | null;
}

// ============================================================
// PAYFAST — passes user email so webhook can match the user
// ============================================================
function redirectToPayFast(email: string) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = PAYFAST_URL;

  const fields: Record<string, string> = {
    merchant_id: "10898793",
    merchant_key: "0mpktjrcbh7mb",
    amount: "49.00",
    item_name: "Anzelle Subscription",
    email_address: email,
    notify_url: `${window.location.origin}/api/payfast-webhook`,
    return_url: `${window.location.origin}?payment=success`,
    cancel_url: `${window.location.origin}?payment=cancelled`,
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
// AUTH SCREEN
// ============================================================
function AuthScreen() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const submit = async () => {
    setError("");
    setLoading(true);
    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else setMessage("Check your email to confirm your account!");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
    }
    setLoading(false);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") submit();
  };

  return (
    <div style={styles.center}>
      <div style={styles.card}>
        <img src={avatarImg} style={styles.avatar} alt="Anzelle" />
        <h2 style={{ color: "#fff", margin: "12px 0 4px" }}>Anzelle AI</h2>
        <p style={{ color: "#a78bfa", fontSize: 13, margin: "0 0 20px" }}>
          {mode === "login" ? "Welcome back 💜" : "Create your account 💜"}
        </p>

        {message ? (
          <p style={{ color: "#22c55e", fontSize: 13 }}>{message}</p>
        ) : (
          <>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={handleKey}
              style={styles.authInput}
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKey}
              style={{ ...styles.authInput, marginTop: 10 }}
            />
            {error && (
              <p style={{ color: "#f87171", fontSize: 12, marginTop: 8 }}>{error}</p>
            )}
            <button
              onClick={submit}
              disabled={loading}
              style={{ ...styles.primary, opacity: loading ? 0.6 : 1 }}
            >
              {loading ? "…" : mode === "login" ? "Log in" : "Sign up"}
            </button>
            <button
              style={styles.ghostBtn}
              onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}
            >
              {mode === "login" ? "No account? Sign up" : "Have an account? Log in"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================
// PAYWALL SCREEN
// ============================================================
function Paywall({ user, onTrial }: { user: User; onTrial: () => void }) {
  const startTrial = async () => {
    await supabase
      .from("profiles")
      .update({ trial_started_at: new Date().toISOString() })
      .eq("id", user.id);
    onTrial();
  };

  return (
    <div style={styles.center}>
      <div style={styles.card}>
        <img src={avatarImg} style={styles.avatar} alt="Anzelle" />
        <h2 style={{ color: "#fff", margin: "12px 0 4px" }}>Anzelle AI</h2>
        <p style={{ color: "#a78bfa", fontSize: 13, margin: "0 0 20px" }}>
          Your flirty AI companion 💜
        </p>

        <button style={styles.primary} onClick={() => redirectToPayFast(user.email ?? "")}>
          Subscribe R49/month
        </button>

        <button style={styles.secondary} onClick={startTrial}>
          Try free 24h ✨
        </button>

        <button style={styles.ghostBtn} onClick={() => supabase.auth.signOut()}>
          Sign out
        </button>
      </div>
    </div>
  );
}

// ============================================================
// CHAT SCREEN
// ============================================================
function Chat({ user }: { user: User }) {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", type: "text", content: "Hey you 🌙 I'm Anzelle" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load conversation history on mount
  useEffect(() => {
    async function loadHistory() {
      const { data } = await supabase
        .from("conversations")
        .select("role, type, content")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(50);

      if (data && data.length > 0) {
        setMessages(data as Message[]);
      }
      setHistoryLoaded(true);
    }
    loadHistory();
  }, [user.id]);

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

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages.slice(-12).map(({ role, content }) => ({ role, content })),
          userId: user.id,
        }),
      });

      if (res.status === 402) {
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = {
            role: "assistant",
            type: "text",
            content: "Ag shame, your trial ended 😢 Subscribe to keep chatting with me!",
          };
          return copy;
        });
        setLoading(false);
        return;
      }

      const data = await res.json();
      const { reply, image } = data;

      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: "assistant", type: "text", content: reply };
        return copy;
      });

      if (image) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", type: "image", content: image },
        ]);
      }
    } catch {
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = {
          role: "assistant",
          type: "text",
          content: "Mmm something went quiet 😅 try again?",
        };
        return copy;
      });
    }

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
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={styles.onlineDot} />
          <button
            onClick={() => supabase.auth.signOut()}
            style={styles.signOutBtn}
            title="Sign out"
          >
            ↩
          </button>
        </div>
      </div>

      <div style={styles.messages}>
        {!historyLoaded && (
          <div style={{ color: "#666", fontSize: 12, textAlign: "center", padding: 10 }}>
            Loading your chat history…
          </div>
        )}
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
                padding: m.type === "image" ? 4 : 10,
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
                  style={{ width: "100%", borderRadius: 10, display: "block" }}
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
          style={{ ...styles.send, opacity: loading || !input.trim() ? 0.5 : 1 }}
        >
          →
        </button>
      </div>
    </div>
  );
}

// ============================================================
// APP ROOT
// ============================================================
export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Listen for auth changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  // Load profile when session changes
  useEffect(() => {
    if (!session?.user) {
      setProfile(null);
      setLoadingProfile(false);
      return;
    }
    async function loadProfile() {
      setLoadingProfile(true);
      const { data } = await supabase
        .from("profiles")
        .select("subscribed, trial_started_at")
        .eq("id", session!.user.id)
        .single();
      setProfile(data);
      setLoadingProfile(false);
    }
    loadProfile();
  }, [session]);

  if (loadingProfile) {
    return (
      <div style={{ ...styles.center, color: "#a78bfa", fontSize: 14 }}>
        Loading…
      </div>
    );
  }

  if (!session) return <AuthScreen />;

  const isSubscribed = profile?.subscribed;
  const trialStarted = profile?.trial_started_at;
  const trialValid =
    trialStarted &&
    Date.now() - new Date(trialStarted).getTime() < 24 * 60 * 60 * 1000;

  if (!isSubscribed && !trialValid) {
    return (
      <Paywall
        user={session.user}
        onTrial={() =>
          setProfile((p) => ({ ...p!, trial_started_at: new Date().toISOString() }))
        }
      />
    );
  }

  return <Chat user={session.user} />;
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
    fontFamily: "'Segoe UI', system-ui, sans-serif",
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
  authInput: {
    width: "100%",
    padding: 10,
    borderRadius: 10,
    border: "1px solid #3b2f6e",
    background: "#1e1b2e",
    color: "#fff",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
  },
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
  },
  signOutBtn: {
    background: "none",
    border: "none",
    color: "#666",
    fontSize: 18,
    cursor: "pointer",
    padding: 0,
  },
  messages: { flex: 1, padding: 12, overflowY: "auto" },
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
  ghostBtn: {
    marginTop: 10,
    background: "none",
    border: "none",
    color: "#888",
    cursor: "pointer",
    fontSize: 13,
  },
};

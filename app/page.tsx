"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { login, register, Auth } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (Auth.isLoggedIn()) router.push("/dashboard");
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      if (mode === "register") {
        await register(email, password);
        setSuccess("Account created. Logging you in...");
        const data = await login(email, password);
        Auth.save(data.access_token, data.email, data.user_id);
        setTimeout(() => router.push("/dashboard"), 800);
      } else {
        const data = await login(email, password);
        Auth.save(data.access_token, data.email, data.user_id);
        router.push("/dashboard");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (!mounted) return null;

  return (
    <div className="min-h-screen grid-bg flex items-center justify-center p-4" style={{ fontFamily: "var(--font-display)" }}>
      {/* Background glow */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse 60% 60% at 50% 50%, rgba(0,229,255,0.04) 0%, transparent 70%)"
      }} />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        style={{ width: "100%", maxWidth: 420, position: "relative" }}
      >
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            marginBottom: 16,
            padding: "4px 12px",
            border: "1px solid var(--border-bright)",
            borderRadius: 4,
            background: "var(--bg-elevated)"
          }}>
            <span className="status-dot dot-green pulse" />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)", letterSpacing: "0.1em" }}>
              SYSTEM ONLINE
            </span>
          </div>

          <h1 style={{
            fontFamily: "var(--font-display)",
            fontSize: 42,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            lineHeight: 1,
            marginBottom: 8,
            color: "var(--text-primary)",
          }}>
            AGENT
            <span className="glow-cyan" style={{ color: "var(--cyan)" }}>_OS</span>
          </h1>

          <p style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--text-dim)",
            letterSpacing: "0.15em",
            textTransform: "uppercase"
          }}>
            Autonomous Task Automation Platform
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-bright)",
          borderRadius: 8,
          padding: 32,
          position: "relative",
          boxShadow: "0 0 40px rgba(0,229,255,0.06), 0 20px 60px rgba(0,0,0,0.5)"
        }}>
          {/* Corner accents */}
          {["tl","tr","bl","br"].map(pos => (
            <div key={pos} style={{
              position: "absolute",
              width: 12, height: 12,
              ...(pos === "tl" ? { top: -1, left: -1, borderTop: "2px solid var(--cyan)", borderLeft: "2px solid var(--cyan)" } : {}),
              ...(pos === "tr" ? { top: -1, right: -1, borderTop: "2px solid var(--cyan)", borderRight: "2px solid var(--cyan)" } : {}),
              ...(pos === "bl" ? { bottom: -1, left: -1, borderBottom: "2px solid var(--cyan)", borderLeft: "2px solid var(--cyan)" } : {}),
              ...(pos === "br" ? { bottom: -1, right: -1, borderBottom: "2px solid var(--cyan)", borderRight: "2px solid var(--cyan)" } : {}),
            }} />
          ))}

          {/* Mode toggle */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr",
            gap: 4, marginBottom: 28,
            background: "var(--bg-base)",
            border: "1px solid var(--border-default)",
            borderRadius: 6, padding: 4
          }}>
            {(["login", "register"] as const).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(""); }}
                style={{
                  padding: "8px 0",
                  borderRadius: 4,
                  border: "none",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  background: mode === m ? "var(--cyan-glow)" : "transparent",
                  color: mode === m ? "var(--cyan)" : "var(--text-dim)",
                  boxShadow: mode === m ? "0 0 16px var(--cyan-glow-sm)" : "none",
                }}
              >
                {m === "login" ? "Sign In" : "Register"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{
                display: "block", marginBottom: 6,
                fontFamily: "var(--font-mono)", fontSize: 10,
                color: "var(--text-secondary)", letterSpacing: "0.12em",
                textTransform: "uppercase"
              }}>
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="operator@domain.com"
                required
                className="input-cyber"
              />
            </div>

            <div>
              <label style={{
                display: "block", marginBottom: 6,
                fontFamily: "var(--font-mono)", fontSize: 10,
                color: "var(--text-secondary)", letterSpacing: "0.12em",
                textTransform: "uppercase"
              }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="input-cyber"
              />
            </div>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{
                    background: "var(--red-glow)",
                    border: "1px solid var(--red)",
                    borderRadius: 4, padding: "8px 12px",
                    fontFamily: "var(--font-mono)", fontSize: 12,
                    color: "var(--red)"
                  }}
                >
                  ⚠ {error}
                </motion.div>
              )}
              {success && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  style={{
                    background: "var(--green-glow)",
                    border: "1px solid var(--green)",
                    borderRadius: 4, padding: "8px 12px",
                    fontFamily: "var(--font-mono)", fontSize: 12,
                    color: "var(--green)"
                  }}
                >
                  ✓ {success}
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
              style={{ marginTop: 4, opacity: loading ? 0.7 : 1 }}
            >
              {loading ? (
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <span className="status-dot dot-cyan pulse" />
                  Processing...
                </span>
              ) : (
                mode === "login" ? "Initialize Session" : "Create Account"
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p style={{
          textAlign: "center", marginTop: 20,
          fontFamily: "var(--font-mono)", fontSize: 10,
          color: "var(--text-dim)", letterSpacing: "0.1em"
        }}>
          AGENT_OS v2.0 // MULTI-AGENT PLATFORM
          <span className="blink" style={{ marginLeft: 4 }}>_</span>
        </p>
      </motion.div>
    </div>
  );
}

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
        setSuccess("Case file created. Signing you in...");
        const data = await login(email, password);
        Auth.save(data.access_token, data.email, data.user_id);
        setTimeout(() => router.push("/dashboard"), 700);
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
    <div style={{ minHeight: "100vh", display: "flex", fontFamily: "var(--font-body)" }}>

      {/* ── Left: Case File Cover ── */}
      <div style={{
        flex: "0 0 42%",
        background: "var(--ink)",
        color: "var(--paper)",
        padding: "3rem",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Ledger rule texture */}
        <div style={{
          position: "absolute", inset: 0, opacity: 0.06,
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 27px, var(--paper) 27px, var(--paper) 28px)"
        }} />

        <div style={{ position: "relative" }}>
          <div className="case-number" style={{ color: "var(--rule)", marginBottom: 40 }}>
            CASE FILE NO. 000{Math.floor(Math.random() * 900 + 100)}
          </div>

          <h1 className="font-display" style={{
            fontSize: 56, fontWeight: 600, lineHeight: 1.05, letterSpacing: "-0.01em",
            marginBottom: 20
          }}>
            Due<span style={{ fontStyle: "italic", color: "var(--rule)" }}>Sight</span>
          </h1>

          <p style={{ fontSize: 15, color: "var(--rule)", lineHeight: 1.7, maxWidth: 380 }}>
            Investment due diligence, compiled by a desk of five specialist AI analysts —
            research, competitive mapping, risk assessment, and a signed-off memo in minutes.
          </p>
        </div>

        <div style={{ position: "relative" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 30 }}>
            {["Company Research", "Competitor Mapping", "Risk Assessment", "Investment Memo"].map((step, i) => (
              <div key={step} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span className="font-mono" style={{ fontSize: 11, color: "var(--rule-dark)", width: 20 }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span style={{ fontSize: 13, color: "var(--rule)" }}>{step}</span>
              </div>
            ))}
          </div>
          <div className="case-number" style={{ color: "var(--rule-dark)" }}>
            Prepared for internal review · Confidential
          </div>
        </div>
      </div>

      {/* ── Right: Sign-in form ── */}
      <div style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        padding: "2rem", background: "var(--paper)",
      }}>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          style={{ width: "100%", maxWidth: 380 }}
        >
          <div className="dossier-card" style={{ padding: "2.2rem 2.4rem" }}>

            <div style={{ display: "flex", gap: 24, marginBottom: 28, borderBottom: "1px solid var(--rule)" }}>
              {(["login", "register"] as const).map(m => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setError(""); }}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    padding: "0 0 12px 0",
                    fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 500,
                    letterSpacing: "0.08em", textTransform: "uppercase",
                    color: mode === m ? "var(--ink)" : "var(--ink-faint)",
                    borderBottom: mode === m ? "2px solid var(--stamp-red)" : "2px solid transparent",
                    marginBottom: -1,
                  }}
                >
                  {m === "login" ? "Sign In" : "New Analyst"}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <label className="case-number" style={{ display: "block", marginBottom: 8 }}>Email</label>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="analyst@firm.com" required className="input-ledger"
                />
              </div>
              <div>
                <label className="case-number" style={{ display: "block", marginBottom: 8 }}>Password</label>
                <input
                  type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required className="input-ledger"
                />
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    style={{
                      fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--stamp-red)",
                      background: "var(--stamp-red-glow)", padding: "8px 12px", borderLeft: "3px solid var(--stamp-red)"
                    }}>
                    ⚠ {error}
                  </motion.div>
                )}
                {success && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    style={{
                      fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--verified)",
                      background: "var(--verified-glow)", padding: "8px 12px", borderLeft: "3px solid var(--verified)"
                    }}>
                    ✓ {success}
                  </motion.div>
                )}
              </AnimatePresence>

              <button type="submit" disabled={loading} className="btn-ink" style={{ marginTop: 6 }}>
                {loading ? "Processing…" : mode === "login" ? "Open Case File" : "Create Analyst Account"}
              </button>
            </form>
          </div>

          <p className="case-number" style={{ textAlign: "center", marginTop: 20 }}>
            DueSight · AI Due Diligence Desk
          </p>
        </motion.div>
      </div>
    </div>
  );
}
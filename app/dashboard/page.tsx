"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { LogOut, Send, CheckCircle, XCircle, RotateCcw } from "lucide-react";
import { Auth, createAgentSocket, getHistory, approveTask, AgentEvent } from "@/lib/api";

interface StatusMessage { id: number; text: string; type: "info"|"success"|"warning"|"error"; ts: number; }
interface HistoryItem { id: number; task_prompt: string; status: string; loop_count: number; tokens_used: number; cost_usd: number; started_at: string; }
interface HumanReview { threadId: string; draft: string; score: number; }

let msgId = 0;

const AGENTS = [
  { name: "PLANNER",    desc: "Research strategy",     node: "planner" },
  { name: "RESEARCHER", desc: "Company profile",       node: "researcher" },
  { name: "COMPETITOR", desc: "Competitive landscape",  node: "competitor" },
  { name: "RISK",       desc: "Risk assessment",        node: "risk" },
  { name: "REPORT",     desc: "Investment memo",        node: "report" },
];

export default function Dashboard() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [task, setTask] = useState("");
  const [running, setRunning] = useState(false);
  const [messages, setMessages] = useState<StatusMessage[]>([]);
  const [result, setResult] = useState("");
  const [cost, setCost] = useState<{tokens:number; usd:number}|null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [humanReview, setHumanReview] = useState<HumanReview|null>(null);
  const [reviewFeedback, setReviewFeedback] = useState("");
  const [approvingLoading, setApprovingLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"stream"|"result"|"history">("stream");
  const [finalScore, setFinalScore] = useState<number|null>(null);
  const wsRef = useRef<WebSocket|null>(null);
  const streamRef = useRef<HTMLDivElement>(null);
  const threadCounter = useRef(1);

  useEffect(() => {
    if (!Auth.isLoggedIn()) { router.push("/"); return; }
    setEmail(Auth.getEmail());
    loadHistory();
  }, [router]);

  useEffect(() => {
    if (streamRef.current) streamRef.current.scrollTop = streamRef.current.scrollHeight;
  }, [messages]);

  async function loadHistory() {
    try { setHistory(await getHistory(Auth.getToken())); } catch {}
  }

  function addMessage(text: string, type: StatusMessage["type"] = "info") {
    setMessages(prev => [...prev, { id: msgId++, text, type, ts: Date.now() }]);
  }

  const handleEvent = useCallback((e: AgentEvent) => {
    switch (e.event) {
      case "status": {
        const type = e.message.includes("⚠") ? "warning"
          : e.message.includes("✅") || e.message.includes("✓") ? "success"
          : e.message.includes("❌") ? "error" : "info";
        addMessage(e.message, type);
        break;
      }
      case "human_review":
        setHumanReview({ threadId: e.thread_id, draft: e.current_draft, score: e.review_score });
        setActiveTab("stream");
        addMessage("Memo ready — awaiting your sign-off.", "warning");
        break;
      case "complete":
        setResult(e.result);
        setRunning(false);
        setActiveTab("result");
        addMessage("Case closed. Memo finalized.", "success");
        loadHistory();
        break;
      case "cost":
        setCost({ tokens: e.tokens, usd: e.cost_usd });
        break;
      case "error":
        addMessage(`Error: ${e.message}`, "error");
        setRunning(false);
        break;
    }
  }, []);

  function runTask() {
    if (!task.trim() || running) return;
    const threadId = `session_${Date.now()}_${threadCounter.current++}`;
    setRunning(true);
    setMessages([]);
    setResult("");
    setCost(null);
    setHumanReview(null);
    setFinalScore(null);
    setActiveTab("stream");

    const ws = createAgentSocket(Auth.getToken(), handleEvent,
      () => {
        addMessage(`Case opened for "${task.trim()}".`, "success");
        ws.send(JSON.stringify({ task: task.trim(), thread_id: threadId }));
      },
      () => {}
    );
    wsRef.current = ws;
  }

  async function handleApproval(approved: boolean) {
    if (!humanReview) return;
    setApprovingLoading(true);
    try {
      await approveTask(humanReview.threadId, approved, reviewFeedback, Auth.getToken());
      addMessage(approved ? "Signed off — memo approved." : "Sent back for revision.", approved ? "success" : "warning");
      setHumanReview(null);
      setReviewFeedback("");
    } catch (err: unknown) {
      addMessage(`Sign-off failed: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setApprovingLoading(false);
    }
  }

  function logout() {
    wsRef.current?.close();
    Auth.clear();
    router.push("/");
  }

  function msgColor(type: StatusMessage["type"]) {
    switch (type) {
      case "success": return "var(--verified)";
      case "warning": return "var(--brass)";
      case "error":   return "var(--stamp-red)";
      default:        return "var(--ink-soft)";
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", fontFamily: "var(--font-body)", background: "var(--paper)" }}>

      {/* ── Header ── */}
      <header style={{
        height: 56, borderBottom: "1px solid var(--rule-dark)",
        background: "var(--paper-card)",
        display: "flex", alignItems: "center", padding: "0 24px", gap: 20, flexShrink: 0,
      }}>
        <div className="font-display" style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--ink)" }}>
          Due<span style={{ fontStyle: "italic" }}>Sight</span>
        </div>

        <div style={{ flex: 1 }} />

        {cost && (
          <div className="font-mono" style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--ink-faint)" }}>
            <span>{cost.tokens.toLocaleString()} tok</span>
            <span style={{ color: "var(--verified)" }}>${cost.usd.toFixed(6)}</span>
          </div>
        )}

        <div className="font-mono" style={{ fontSize: 12, color: "var(--ink-soft)", display: "flex", alignItems: "center", gap: 6 }}>
          <span className="status-dot dot-verified" /> {email}
        </div>

        <button onClick={logout} className="btn-outline" style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px" }}>
          <LogOut size={13} /> Log Out
        </button>
      </header>

      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 280px", overflow: "hidden" }}>

        {/* ── Main panel ── */}
        <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", borderRight: "1px solid var(--rule)" }}>

          {/* Task input */}
          <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--rule)", background: "var(--paper-card)" }}>
            <div style={{ display: "flex", gap: 10 }}>
              <input
                value={task} onChange={e => setTask(e.target.value)}
                onKeyDown={e => e.key === "Enter" && runTask()}
                placeholder="Enter company name to analyze — e.g. Stripe, Notion, Ramp…"
                disabled={running}
                className="input-ledger"
                style={{ borderBottom: "1.5px solid var(--rule-dark)" }}
              />
              <button onClick={runTask} disabled={running || !task.trim()} className="btn-ink"
                style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
                {running ? <><RotateCcw size={13} style={{ animation: "spin 1s linear infinite" }} /> Working</> : <><Send size={13} /> Open Case</>}
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: "1px solid var(--rule)", background: "var(--paper-card)" }}>
            {(["stream", "result", "history"] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className="font-mono" style={{
                padding: "10px 20px", background: "none", cursor: "pointer",
                border: "none", borderBottom: activeTab === tab ? "2px solid var(--stamp-red)" : "2px solid transparent",
                color: activeTab === tab ? "var(--ink)" : "var(--ink-faint)",
                fontSize: 11, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase",
              }}>
                {tab === "stream" ? "Case Log" : tab === "result" ? "Memo" : "Archive"}
              </button>
            ))}
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
            <AnimatePresence mode="wait">

              {activeTab === "stream" && (
                <motion.div key="stream" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  ref={streamRef} style={{ height: "100%", overflowY: "auto", padding: 24 }}>

                  <AnimatePresence>
                    {humanReview && (
                      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="dossier-card" style={{ padding: 20, marginBottom: 20, background: "var(--paper-card)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                          <span className="stamp stamp-review">Pending Review</span>
                        </div>
                        <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 12 }}>
                          Draft memo compiled. Review the excerpt below and sign off, or send back with notes.
                        </p>
                        <div className="font-mono" style={{
                          background: "var(--paper)", border: "1px solid var(--rule)", padding: 14, marginBottom: 12,
                          maxHeight: 180, overflowY: "auto", fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.7, whiteSpace: "pre-wrap"
                        }}>
                          {humanReview.draft.slice(0, 700)}{humanReview.draft.length > 700 ? "…" : ""}
                        </div>
                        <textarea value={reviewFeedback} onChange={e => setReviewFeedback(e.target.value)}
                          placeholder="Notes for revision (required if sending back)…" rows={2}
                          className="input-ledger" style={{ marginBottom: 12, resize: "none" }} />
                        <div style={{ display: "flex", gap: 10 }}>
                          <button onClick={() => handleApproval(true)} disabled={approvingLoading} className="btn-ink"
                            style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--verified)" }}>
                            <CheckCircle size={13} /> Sign Off
                          </button>
                          <button onClick={() => handleApproval(false)} disabled={approvingLoading || !reviewFeedback.trim()}
                            className="btn-outline" style={{ display: "flex", alignItems: "center", gap: 6, borderColor: "var(--stamp-red)", color: "var(--stamp-red)" }}>
                            <XCircle size={13} /> Send Back
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {messages.length === 0 ? (
                    <p className="font-mono" style={{ fontSize: 12, color: "var(--ink-faint)", paddingTop: 40, textAlign: "center" }}>
                      No case open. Enter a company name to begin.
                    </p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {messages.map((m, i) => (
                        <motion.div key={m.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }}
                          style={{ display: "flex", gap: 10 }}>
                          <span className="font-mono" style={{ fontSize: 10, color: "var(--ink-faint)", marginTop: 2, flexShrink: 0 }}>
                            {new Date(m.ts).toLocaleTimeString("en", { hour12: false })}
                          </span>
                          <span style={{ fontSize: 13, color: msgColor(m.type), lineHeight: 1.5 }}>{m.text}</span>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {activeTab === "result" && (
                <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  style={{ height: "100%", overflowY: "auto", padding: 24 }}>
                  {result ? (
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
                        <span className="stamp stamp-approved">Approved</span>
                        {cost && <span className="font-mono" style={{ fontSize: 11, color: "var(--ink-faint)", marginLeft: "auto" }}>
                          {cost.tokens.toLocaleString()} tokens · ${cost.usd.toFixed(6)}
                        </span>}
                      </div>
                      <div className="font-body" style={{
                        background: "var(--paper-card)", border: "1px solid var(--rule)", padding: 28,
                        fontSize: 14, color: "var(--ink)", lineHeight: 1.8, whiteSpace: "pre-wrap"
                      }}>
                        {result}
                      </div>
                    </div>
                  ) : (
                    <p className="font-mono" style={{ fontSize: 12, color: "var(--ink-faint)", paddingTop: 40, textAlign: "center" }}>
                      No memo yet. Open a case first.
                    </p>
                  )}
                </motion.div>
              )}

              {activeTab === "history" && (
                <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  style={{ height: "100%", overflowY: "auto", padding: 24 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
                    <span className="case-number">Case Archive</span>
                    <button onClick={loadHistory} className="font-mono" style={{ background: "none", border: "none", color: "var(--stamp-red)", fontSize: 10, cursor: "pointer" }}>
                      Refresh
                    </button>
                  </div>
                  {history.length === 0 ? (
                    <p className="font-mono" style={{ fontSize: 12, color: "var(--ink-faint)" }}>No cases filed yet.</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {history.map(item => (
                        <div key={item.id} className="dossier-card" style={{ padding: 14 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                            <span className={`status-dot ${item.status === "completed" ? "dot-verified" : item.status === "running" ? "dot-review" : "dot-revise"}`} />
                            <span className="font-mono" style={{ fontSize: 10, color: "var(--ink-faint)", letterSpacing: "0.06em" }}>{item.status.toUpperCase()}</span>
                            <span className="font-mono" style={{ marginLeft: "auto", fontSize: 10, color: "var(--ink-faint)" }}>
                              {new Date(item.started_at).toLocaleDateString()}
                            </span>
                          </div>
                          <p style={{ fontSize: 13, color: "var(--ink)", marginBottom: 6 }}>{item.task_prompt}</p>
                          <div className="font-mono" style={{ display: "flex", gap: 14, fontSize: 10, color: "var(--ink-faint)" }}>
                            <span>{item.loop_count} loops</span>
                            <span>{item.tokens_used.toLocaleString()} tok</span>
                            <span style={{ color: "var(--verified)" }}>${item.cost_usd.toFixed(6)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── Sidebar ── */}
        <div style={{ background: "var(--paper-card)", overflowY: "auto" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--rule)" }}>
            <span className="case-number">The Desk</span>
          </div>
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
            {AGENTS.map((a, i) => (
              <div key={a.name} className="dossier-card" style={{ padding: "10px 12px", display: "flex", gap: 10, alignItems: "center" }}>
                <span className="font-mono" style={{ fontSize: 10, color: "var(--ink-faint)" }}>{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <div className="font-mono" style={{ fontSize: 11, fontWeight: 600, color: "var(--ink)", letterSpacing: "0.04em" }}>{a.name}</div>
                  <div style={{ fontSize: 11, color: "var(--ink-faint)" }}>{a.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ padding: "14px 18px", borderTop: "1px solid var(--rule)", borderBottom: "1px solid var(--rule)" }}>
            <span className="case-number">Process</span>
          </div>
          <div style={{ padding: 16 }}>
            {["Intake", "Research", "Compete", "Risk", "Memo", "Sign-off", "Closed"].map((step, i, arr) => (
              <div key={step}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0" }}>
                  <span className="font-mono" style={{ fontSize: 10, color: "var(--ink-faint)", width: 16 }}>{i + 1}</span>
                  <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>{step}</span>
                </div>
                {i < arr.length - 1 && <div style={{ marginLeft: 8, width: 1, height: 8, background: "var(--rule-dark)" }} />}
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
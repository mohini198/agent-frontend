"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { LogOut, Send, Clock, Zap, DollarSign, RotateCcw, CheckCircle, XCircle, ChevronRight, Terminal } from "lucide-react";
import { Auth, createAgentSocket, getHistory, approveTask, AgentEvent } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────
interface StatusMessage { id: number; text: string; type: "info"|"success"|"warning"|"error"; ts: number; }
interface HistoryItem { id: number; task_prompt: string; status: string; loop_count: number; tokens_used: number; cost_usd: number; started_at: string; }
interface HumanReview { threadId: string; draft: string; score: number; }

let msgId = 0;

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
  const wsRef = useRef<WebSocket|null>(null);
  const streamRef = useRef<HTMLDivElement>(null);
  const threadCounter = useRef(1);

  useEffect(() => {
    if (!Auth.isLoggedIn()) { router.push("/"); return; }
    setEmail(Auth.getEmail());
    loadHistory();
  }, [router]);

  useEffect(() => {
    if (streamRef.current) {
      streamRef.current.scrollTop = streamRef.current.scrollHeight;
    }
  }, [messages]);

  async function loadHistory() {
    try {
      const data = await getHistory(Auth.getToken());
      setHistory(data);
    } catch {}
  }

  function addMessage(text: string, type: StatusMessage["type"] = "info") {
    setMessages(prev => [...prev, { id: msgId++, text, type, ts: Date.now() }]);
  }

  const handleEvent = useCallback((e: AgentEvent) => {
    switch (e.event) {
      case "status":
        const type = e.message.includes("⚠") ? "warning"
          : e.message.includes("✅") || e.message.includes("✓") ? "success"
          : e.message.includes("❌") ? "error" : "info";
        addMessage(e.message, type);
        break;
      case "human_review":
        setHumanReview({ threadId: e.thread_id, draft: e.current_draft, score: e.review_score });
        setActiveTab("stream");
        addMessage("✋ Pipeline paused — awaiting your review.", "warning");
        break;
      case "complete":
        setResult(e.result);
        setRunning(false);
        setActiveTab("result");
        addMessage("✅ Pipeline complete. Output ready.", "success");
        loadHistory();
        break;
      case "cost":
        setCost({ tokens: e.tokens, usd: e.cost_usd });
        break;
      case "error":
        addMessage(`❌ Error: ${e.message}`, "error");
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
    setActiveTab("stream");

    const ws = createAgentSocket(Auth.getToken(), handleEvent,
      () => {
        addMessage("🔌 Connected to Agent Engine.", "success");
        ws.send(JSON.stringify({ task: task.trim(), thread_id: threadId }));
        addMessage(`📋 Task dispatched: "${task.trim()}"`, "info");
      },
      () => { if (running) addMessage("Connection closed.", "info"); }
    );
    wsRef.current = ws;
  }

  async function handleApproval(approved: boolean) {
    if (!humanReview) return;
    setApprovingLoading(true);
    try {
      await approveTask(humanReview.threadId, approved, reviewFeedback, Auth.getToken());
      addMessage(`👤 You ${approved ? "APPROVED ✅" : "REJECTED 🔄"} the draft.`, approved ? "success" : "warning");
      setHumanReview(null);
      setReviewFeedback("");
    } catch (err: unknown) {
      addMessage(`❌ Approval failed: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setApprovingLoading(false);
    }
  }

  function logout() {
    wsRef.current?.close();
    Auth.clear();
    router.push("/");
  }

  function getMsgColor(type: StatusMessage["type"]) {
    switch(type) {
      case "success": return "var(--green)";
      case "warning": return "var(--amber)";
      case "error":   return "var(--red)";
      default:        return "var(--text-secondary)";
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", fontFamily: "var(--font-display)" }}>

      {/* ── Top Bar ── */}
      <header style={{
        height: 52, borderBottom: "1px solid var(--border-default)",
        background: "var(--bg-surface)",
        display: "flex", alignItems: "center",
        padding: "0 20px", gap: 16, flexShrink: 0,
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Terminal size={16} color="var(--cyan)" />
          <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: "-0.01em" }}>
            AGENT<span style={{ color: "var(--cyan)" }}>_OS</span>
          </span>
        </div>

        <div style={{ flex: 1 }} />

        {cost && (
          <motion.div initial={{ opacity:0, x:10 }} animate={{ opacity:1, x:0 }}
            style={{
              display: "flex", alignItems: "center", gap: 12,
              fontFamily: "var(--font-mono)", fontSize: 11,
            }}>
            <span style={{ color: "var(--text-dim)" }}>
              <span style={{ color: "var(--cyan)" }}>{cost.tokens.toLocaleString()}</span> tokens
            </span>
            <span style={{ color: "var(--text-dim)" }}>
              <span style={{ color: "var(--green)" }}>${cost.usd.toFixed(6)}</span> USD
            </span>
          </motion.div>
        )}

        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "4px 10px",
          border: "1px solid var(--border-default)",
          borderRadius: 4,
          fontFamily: "var(--font-mono)", fontSize: 11,
          color: "var(--text-secondary)"
        }}>
          <span className="status-dot dot-green" style={{ width: 5, height: 5 }} />
          {email}
        </div>

        <button onClick={logout} style={{
          background: "transparent", border: "none",
          color: "var(--text-dim)", cursor: "pointer",
          display: "flex", alignItems: "center", gap: 4,
          fontFamily: "var(--font-mono)", fontSize: 11,
          padding: "4px 8px", borderRadius: 4,
          transition: "color 0.2s"
        }}
          onMouseEnter={e => (e.currentTarget.style.color = "var(--red)")}
          onMouseLeave={e => (e.currentTarget.style.color = "var(--text-dim)")}
        >
          <LogOut size={13} /> LOGOUT
        </button>
      </header>

      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 300px", gap: 0, overflow: "hidden" }}>

        {/* ── Main Panel ── */}
        <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", borderRight: "1px solid var(--border-default)" }}>

          {/* Task Input */}
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-default)", background: "var(--bg-surface)" }}>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1, position: "relative" }}>
                <span style={{
                  position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
                  fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--cyan)", pointerEvents: "none"
                }}>›</span>
                <input
                  value={task}
                  onChange={e => setTask(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && runTask()}
                  placeholder="Enter task for the agent pipeline..."
                  disabled={running}
                  style={{
                    width: "100%", background: "var(--bg-elevated)",
                    border: "1px solid var(--border-default)",
                    borderRadius: 4, padding: "10px 14px 10px 28px",
                    color: "var(--text-primary)",
                    fontFamily: "var(--font-mono)", fontSize: 13,
                    outline: "none", transition: "border-color 0.2s",
                  }}
                  onFocus={e => (e.target.style.borderColor = "var(--cyan-dim)")}
                  onBlur={e => (e.target.style.borderColor = "var(--border-default)")}
                />
              </div>
              <button
                onClick={runTask}
                disabled={running || !task.trim()}
                style={{
                  background: running ? "var(--bg-elevated)" : "var(--cyan-glow)",
                  border: `1px solid ${running ? "var(--border-default)" : "var(--cyan)"}`,
                  borderRadius: 4,
                  color: running ? "var(--text-dim)" : "var(--cyan)",
                  cursor: running ? "not-allowed" : "pointer",
                  padding: "0 16px",
                  display: "flex", alignItems: "center", gap: 6,
                  fontFamily: "var(--font-mono)", fontSize: 12,
                  fontWeight: 700, letterSpacing: "0.08em",
                  transition: "all 0.2s",
                  whiteSpace: "nowrap"
                }}
              >
                {running ? (
                  <><RotateCcw size={13} style={{ animation: "spin 1s linear infinite" }} /> RUNNING</>
                ) : (
                  <><Send size={13} /> EXECUTE</>
                )}
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div style={{
            display: "flex", gap: 0,
            borderBottom: "1px solid var(--border-default)",
            background: "var(--bg-surface)",
          }}>
            {(["stream","result","history"] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{
                padding: "10px 20px",
                background: "transparent", border: "none",
                borderBottom: activeTab === tab ? "2px solid var(--cyan)" : "2px solid transparent",
                color: activeTab === tab ? "var(--cyan)" : "var(--text-dim)",
                fontFamily: "var(--font-mono)", fontSize: 11,
                fontWeight: 700, letterSpacing: "0.1em",
                textTransform: "uppercase", cursor: "pointer",
                transition: "all 0.15s",
              }}>
                {tab === "stream" ? "AGENT STREAM" : tab === "result" ? "OUTPUT" : "HISTORY"}
                {tab === "stream" && running && (
                  <span className="status-dot dot-cyan pulse" style={{ marginLeft: 6, verticalAlign: "middle" }} />
                )}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>

            {/* Agent Stream */}
            <AnimatePresence mode="wait">
              {activeTab === "stream" && (
                <motion.div key="stream"
                  initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
                  ref={streamRef}
                  style={{ height: "100%", overflowY: "auto", padding: 20 }}
                >
                  {/* Human Review Card */}
                  <AnimatePresence>
                    {humanReview && (
                      <motion.div
                        initial={{ opacity:0, y:-10 }}
                        animate={{ opacity:1, y:0 }}
                        exit={{ opacity:0, y:-10 }}
                        style={{
                          border: "1px solid var(--amber)",
                          borderRadius: 8,
                          background: "var(--amber-glow)",
                          padding: 20, marginBottom: 20,
                          boxShadow: "0 0 30px rgba(255,170,0,0.08)"
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                          <span className="status-dot dot-amber pulse" />
                          <span style={{
                            fontFamily: "var(--font-mono)", fontSize: 11,
                            color: "var(--amber)", fontWeight: 700,
                            letterSpacing: "0.1em"
                          }}>
                            HUMAN REVIEW REQUIRED
                          </span>
                        </div>
                        <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12 }}>
                          The Writer Agent has completed a draft. Review it and approve or request revisions.
                        </p>
                        <div style={{
                          background: "var(--bg-base)",
                          border: "1px solid var(--border-default)",
                          borderRadius: 4, padding: 14, marginBottom: 14,
                          maxHeight: 200, overflowY: "auto",
                          fontFamily: "var(--font-mono)", fontSize: 12,
                          color: "var(--text-secondary)", lineHeight: 1.7,
                          whiteSpace: "pre-wrap"
                        }}>
                          {humanReview.draft.slice(0, 800)}{humanReview.draft.length > 800 ? "..." : ""}
                        </div>
                        <textarea
                          value={reviewFeedback}
                          onChange={e => setReviewFeedback(e.target.value)}
                          placeholder="Optional feedback for the Writer (required if rejecting)..."
                          rows={2}
                          style={{
                            width: "100%", background: "var(--bg-elevated)",
                            border: "1px solid var(--border-default)",
                            borderRadius: 4, padding: "8px 12px",
                            color: "var(--text-primary)",
                            fontFamily: "var(--font-mono)", fontSize: 12,
                            outline: "none", resize: "none", marginBottom: 12
                          }}
                        />
                        <div style={{ display: "flex", gap: 10 }}>
                          <button onClick={() => handleApproval(true)}
                            disabled={approvingLoading}
                            className="btn-green"
                            style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <CheckCircle size={13} />
                            APPROVE
                          </button>
                          <button onClick={() => handleApproval(false)}
                            disabled={approvingLoading || !reviewFeedback.trim()}
                            className="btn-red"
                            style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <XCircle size={13} />
                            REJECT
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Messages */}
                  {messages.length === 0 ? (
                    <div style={{ textAlign: "center", paddingTop: 60 }}>
                      <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-dim)" }}>
                        Awaiting task input
                        <span className="blink">_</span>
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {messages.map((msg, i) => (
                        <motion.div key={msg.id}
                          initial={{ opacity:0, x:-8 }}
                          animate={{ opacity:1, x:0 }}
                          transition={{ delay: i * 0.02 }}
                          style={{ display: "flex", gap: 10, alignItems: "flex-start" }}
                        >
                          <span style={{
                            fontFamily: "var(--font-mono)", fontSize: 10,
                            color: "var(--text-dim)", marginTop: 2, flexShrink: 0
                          }}>
                            {new Date(msg.ts).toLocaleTimeString("en", { hour12: false })}
                          </span>
                          <span style={{
                            fontFamily: "var(--font-mono)", fontSize: 12,
                            color: getMsgColor(msg.type), lineHeight: 1.5
                          }}>
                            {msg.text}
                          </span>
                        </motion.div>
                      ))}
                      {running && !humanReview && (
                        <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 4 }}>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>
                            {new Date().toLocaleTimeString("en", { hour12: false })}
                          </span>
                          <span style={{ display: "flex", gap: 4 }}>
                            {[0,1,2].map(i => (
                              <span key={i} style={{
                                width: 4, height: 4, borderRadius: "50%",
                                background: "var(--cyan)",
                                display: "inline-block",
                                animation: `pulse-cyan 1.2s ease-in-out ${i * 0.2}s infinite`
                              }} />
                            ))}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              )}

              {/* Result */}
              {activeTab === "result" && (
                <motion.div key="result"
                  initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
                  style={{ height: "100%", overflowY: "auto", padding: 20 }}
                >
                  {result ? (
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                        <span className="status-dot dot-green" />
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--green)", letterSpacing: "0.1em" }}>
                          PIPELINE OUTPUT
                        </span>
                        {cost && (
                          <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>
                            {cost.tokens.toLocaleString()} tokens · ${cost.usd.toFixed(6)} USD
                          </span>
                        )}
                      </div>
                      <div style={{
                        background: "var(--bg-elevated)",
                        border: "1px solid var(--border-default)",
                        borderRadius: 6, padding: 20,
                        fontFamily: "var(--font-mono)", fontSize: 13,
                        color: "var(--text-primary)", lineHeight: 1.8,
                        whiteSpace: "pre-wrap"
                      }}>
                        {result}
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: "center", paddingTop: 60 }}>
                      <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-dim)" }}>
                        No output yet. Run a task first.
                      </p>
                    </div>
                  )}
                </motion.div>
              )}

              {/* History */}
              {activeTab === "history" && (
                <motion.div key="history"
                  initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
                  style={{ height: "100%", overflowY: "auto", padding: 20 }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", letterSpacing: "0.1em" }}>
                      TASK HISTORY
                    </span>
                    <button onClick={loadHistory} style={{
                      background: "transparent", border: "none",
                      color: "var(--cyan)", cursor: "pointer",
                      fontFamily: "var(--font-mono)", fontSize: 10,
                      display: "flex", alignItems: "center", gap: 4
                    }}>
                      <RotateCcw size={10} /> REFRESH
                    </button>
                  </div>
                  {history.length === 0 ? (
                    <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-dim)" }}>
                      No tasks run yet.
                    </p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {history.map(item => (
                        <div key={item.id} style={{
                          background: "var(--bg-elevated)",
                          border: "1px solid var(--border-default)",
                          borderRadius: 6, padding: 14,
                          transition: "border-color 0.2s",
                        }}
                          onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--border-bright)")}
                          onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border-default)")}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                            <span className={`status-dot ${item.status === "completed" ? "dot-green" : item.status === "running" ? "dot-cyan pulse" : "dot-red"}`} />
                            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", letterSpacing: "0.08em" }}>
                              {item.status.toUpperCase()}
                            </span>
                            <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>
                              {new Date(item.started_at).toLocaleString()}
                            </span>
                          </div>
                          <p style={{ fontSize: 13, color: "var(--text-primary)", marginBottom: 8, lineHeight: 1.4 }}>
                            {item.task_prompt.slice(0, 100)}{item.task_prompt.length > 100 ? "..." : ""}
                          </p>
                          <div style={{ display: "flex", gap: 16, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>
                            <span><span style={{ color: "var(--cyan)" }}>{item.loop_count}</span> loops</span>
                            <span><span style={{ color: "var(--cyan)" }}>{item.tokens_used.toLocaleString()}</span> tokens</span>
                            <span><span style={{ color: "var(--green)" }}>${item.cost_usd.toFixed(6)}</span> USD</span>
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

        {/* ── Right Sidebar ── */}
        <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--bg-surface)" }}>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border-default)" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", letterSpacing: "0.12em" }}>
              AGENT ROSTER
            </span>
          </div>
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { name: "PLANNER", icon: "🧠", desc: "Strategy & roadmap" },
              { name: "RESEARCHER", icon: "🔍", desc: "Live web search" },
              { name: "WRITER", icon: "✍️", desc: "Draft synthesis" },
              { name: "REVIEWER", icon: "🛡️", desc: "Quality scoring 0–10" },
              { name: "HUMAN", icon: "👤", desc: "Approval gate" },
            ].map(agent => (
              <div key={agent.name} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 12px",
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-default)",
                borderRadius: 6,
              }}>
                <span style={{ fontSize: 14 }}>{agent.icon}</span>
                <div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "0.08em" }}>
                    {agent.name}
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>
                    {agent.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ padding: "14px 16px", borderTop: "1px solid var(--border-default)", borderBottom: "1px solid var(--border-default)", marginTop: "auto" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", letterSpacing: "0.12em" }}>
              PIPELINE FLOW
            </span>
          </div>
          <div style={{ padding: 16 }}>
            {["START","Planner","Researcher","Writer","Human Review","Reviewer","END"].map((step, i, arr) => (
              <div key={step}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "6px 0",
                }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: "50%",
                    background: step === "START" || step === "END" ? "var(--cyan-glow)" : "var(--bg-elevated)",
                    border: `1px solid ${step === "START" || step === "END" ? "var(--cyan)" : "var(--border-default)"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0
                  }}>
                    <div style={{
                      width: 4, height: 4, borderRadius: "50%",
                      background: step === "START" || step === "END" ? "var(--cyan)" : "var(--border-bright)"
                    }} />
                  </div>
                  <span style={{
                    fontFamily: "var(--font-mono)", fontSize: 10,
                    color: step === "START" || step === "END" ? "var(--cyan)" : "var(--text-secondary)",
                    letterSpacing: "0.06em"
                  }}>
                    {step}
                  </span>
                </div>
                {i < arr.length - 1 && (
                  <div style={{
                    marginLeft: 9, width: 2, height: 10,
                    background: "var(--border-dim)"
                  }} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";

const BASE = "http://localhost:8000";

// ── Helpers ───────────────────────────────────────────────
function SectionLabel({ children, color = "var(--accent)" }) {
  return (
    <div style={{
      fontFamily: "var(--mono)",
      fontSize: "0.65rem",
      letterSpacing: "0.12em",
      color,
      marginBottom: "0.5rem",
    }}>
      {children}
    </div>
  );
}

function Card({ children, style = {} }) {
  return (
    <div style={{
      background: "var(--bg2)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius-lg)",
      padding: "1.25rem",
      ...style,
    }}>
      {children}
    </div>
  );
}

// ── Stage 1 read-only view ────────────────────────────────
function ReplayStage1({ responses }) {
  const [tabs, setTabs] = useState({});
  const getTab = (id) => tabs[id] || "reasoning";
  const setTab = (id, t) => setTabs((p) => ({ ...p, [id]: t }));

  return (
    <div>
      <SectionLabel>01 — INDEPENDENT OPINIONS</SectionLabel>
      <div className="response-grid">
        {responses.map((r) => {
          const tab = getTab(r.model_id);
          return (
            <div key={r.model_id} className="response-card">
              <div className="card-header">
                <div className="model-identity">
                  <span className="model-name">{r.model_name}</span>
                </div>
                <div className="card-tabs">
                  <button className={`tab-btn ${tab === "reasoning" ? "active" : ""}`} onClick={() => setTab(r.model_id, "reasoning")}>Reasoning</button>
                  <button className={`tab-btn ${tab === "answer" ? "active" : ""}`} onClick={() => setTab(r.model_id, "answer")}>Answer</button>
                </div>
              </div>
              <div className="card-body">
                {tab === "reasoning" ? (
                  <div className="reasoning-block">
                    <div className="reasoning-tag">THINKING</div>
                    <ReactMarkdown>{r.reasoning}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="answer-block">
                    <ReactMarkdown>{r.answer}</ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Stage 2 read-only view ────────────────────────────────
function ReplayStage2({ reviews }) {
  return (
    <div>
      <SectionLabel>02 — PEER REVIEW</SectionLabel>
      <div className="response-grid">
        {reviews.map((rv) => (
          <div key={rv.reviewer_id} className="response-card">
            <div className="card-header">
              <div className="model-identity">
                <span className="model-provider-tag" style={{ color: "var(--accent2)" }}>REVIEWER</span>
                <span className="model-name">{rv.reviewer_name}</span>
              </div>
            </div>
            <div className="card-body">
              <div className="review-section">
                <div className="review-section-label">CRITIQUE</div>
                <div className="review-content">
                  <ReactMarkdown>{rv.critique}</ReactMarkdown>
                </div>
              </div>
              <div className="review-section">
                <div className="review-section-label">RANKING</div>
                <div className="review-content ranking-content">
                  <ReactMarkdown>{rv.ranking}</ReactMarkdown>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Stage 3 read-only view ────────────────────────────────
function ReplayStage3({ stage3 }) {
  return (
    <div>
      <SectionLabel>03 — FINAL VERDICT</SectionLabel>
      <div className="verdict-container">
        <div className="verdict-card">
          <div className="verdict-section">
            <div className="verdict-section-label">SUMMARY</div>
            <div className="verdict-summary">
              <ReactMarkdown>{stage3.summary}</ReactMarkdown>
            </div>
          </div>
          <div className="verdict-divider" />
          <div className="verdict-section">
            <div className="verdict-section-label">FINAL VERDICT</div>
            <div className="verdict-body">
              <ReactMarkdown>{stage3.verdict}</ReactMarkdown>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Session detail view ───────────────────────────────────
function SessionDetail({ sessionId, onBack }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeStage, setActiveStage] = useState(1);

  useEffect(() => {
    fetch(`${BASE}/sessions/${sessionId}`)
      .then((r) => { if (!r.ok) throw new Error("Session not found"); return r.json(); })
      .then((d) => { setSession(d); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, [sessionId]);

  if (loading) return <div className="loader-text" style={{ padding: "4rem", textAlign: "center" }}>Loading session...</div>;
  if (error)   return <div className="error-banner"><span className="error-tag">ERROR</span> {error}</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button className="btn-ghost" onClick={onBack}>← Back to Sessions</button>
        <span style={{ fontFamily: "var(--mono)", fontSize: "0.72rem", color: "var(--text3)" }}>
          {new Date(session.timestamp).toLocaleString()} · {Math.round(session.duration)}s
        </span>
      </div>

      {/* Question bar */}
      <div className="question-display">
        <span className="question-display-label">QUESTION</span>
        <span className="question-display-text">{session.question}</span>
      </div>

      {/* Stage tabs */}
      <div style={{ display: "flex", gap: "0.25rem" }}>
        {[
          { n: 1, label: "Opinions" },
          { n: 2, label: "Review" },
          { n: 3, label: "Verdict" },
        ].map(({ n, label }) => (
          <button
            key={n}
            className={`tab-btn ${activeStage === n ? "active" : ""}`}
            onClick={() => setActiveStage(n)}
            style={{ padding: "0.4rem 1rem" }}
          >
            {n} — {label}
          </button>
        ))}
      </div>

      {/* Stage content */}
      {activeStage === 1 && session.stage1 && <ReplayStage1 responses={session.stage1} />}
      {activeStage === 2 && session.stage2 && <ReplayStage2 reviews={session.stage2} />}
      {activeStage === 3 && session.stage3 && <ReplayStage3 stage3={session.stage3} />}
    </div>
  );
}

// ── Session list ──────────────────────────────────────────
export default function SessionBrowser({ onClose }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch(`${BASE}/sessions`)
      .then((r) => r.json())
      .then((d) => { setSessions(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (selected) {
    return (
      <div className="stage-screen">
        <SessionDetail sessionId={selected} onBack={() => setSelected(null)} />
      </div>
    );
  }

  const filtered = sessions.filter((s) =>
    s.question?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ maxWidth: "860px", margin: "0 auto" }}>
      <Card>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <div className="question-label">SESSION HISTORY</div>
          <button className="btn-ghost" onClick={onClose}>Close</button>
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search questions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%",
            background: "var(--bg3)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            color: "var(--text)",
            fontFamily: "var(--sans)",
            fontSize: "0.88rem",
            padding: "0.6rem 1rem",
            outline: "none",
            marginBottom: "1.25rem",
          }}
        />

        {/* List */}
        {loading ? (
          <div style={{ color: "var(--text3)", fontFamily: "var(--mono)", fontSize: "0.82rem", padding: "2rem", textAlign: "center" }}>
            Loading sessions...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ color: "var(--text3)", fontFamily: "var(--mono)", fontSize: "0.82rem", padding: "2rem", textAlign: "center" }}>
            {sessions.length === 0 ? "No sessions yet. Complete a council run first." : "No sessions match your search."}
          </div>
        ) : (
          <div className="history-list">
            {filtered.map((s) => (
              <div
                key={s.session_id}
                className="history-item"
                onClick={() => setSelected(s.session_id)}
                style={{ cursor: "pointer", transition: "border-color 0.2s" }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--accent)"}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = "" }
              >
                <div className="history-main">
                  <span className="history-qid">#{s.session_id?.slice(0, 8)}</span>
                  <span className="history-question">{s.question}</span>
                </div>
                <div className="history-meta">
                  <span className="history-duration">{Math.round(s.duration || 0)}s</span>
                  <span className="history-time">{new Date(s.timestamp).toLocaleDateString()}</span>
                  <span style={{
                    fontFamily: "var(--mono)",
                    fontSize: "0.65rem",
                    color: "var(--accent)",
                    border: "1px solid var(--accent)",
                    padding: "0.1rem 0.4rem",
                    borderRadius: "3px",
                  }}>VIEW →</span>
                </div>
              </div>
            ))}
          </div>
        )}

      </Card>
    </div>
  );
}


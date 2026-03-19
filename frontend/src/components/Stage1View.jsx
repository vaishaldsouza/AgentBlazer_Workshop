import { useState } from "react";
import ReactMarkdown from "react-markdown";
import ChainOfThoughtViz from "./ChainOfThoughtViz";
import CommentThread, { CommentBadge } from "./CommentThread";

const MODEL_COLORS = {
  llama:    { accent: "#00D9FF", label: "GROQ" },
  compound: { accent: "#A78BFA", label: "GROQ" },
};

function getColor(modelId) {
  return MODEL_COLORS[modelId] || { accent: "#4ADE80", label: "AI" };
}

export default function Stage1View({ responses, sessionKey = "" }) {
  const [activeTab, setActiveTab] = useState({});

  function getTab(id) { return activeTab[id] || "reasoning"; }
  function setTab(id, tab) { setActiveTab((p) => ({ ...p, [id]: tab })); }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div className="response-grid">
        {responses.map((resp) => {
          const { accent, label } = getColor(resp.model_id);
          const tab = getTab(resp.model_id);
          return (
            <div key={resp.model_id} className="response-card" style={{ "--accent": accent }}>
              <div className="card-header">
                <div className="model-identity">
                  <span className="model-provider-tag" style={{ color: accent }}>{label}</span>
                  <span className="model-name">{resp.model_name}</span>
                  {resp.confidence_score != null && (
                    <ConfidenceBadge score={resp.confidence_score} />
                  )}
                </div>
                <div className="card-tabs">
                  <button
                    className={`tab-btn ${tab === "reasoning" ? "active" : ""}`}
                    onClick={() => setTab(resp.model_id, "reasoning")}
                  >
                    Reasoning
                    <CommentBadge commentKey={`${sessionKey}:s1:${resp.model_id}:reasoning`} />
                  </button>
                  <button
                    className={`tab-btn ${tab === "answer" ? "active" : ""}`}
                    onClick={() => setTab(resp.model_id, "answer")}
                  >
                    Answer
                    <CommentBadge commentKey={`${sessionKey}:s1:${resp.model_id}:answer`} />
                  </button>
                  <button
                    className={`tab-btn ${tab === "confidence" ? "active" : ""}`}
                    onClick={() => setTab(resp.model_id, "confidence")}
                  >
                    Confidence
                  </button>
                </div>
              </div>
              <div className="card-body">
                {tab === "reasoning" && (
                  <div className="reasoning-block">
                    <div className="reasoning-tag">THINKING</div>
                    <ReactMarkdown>{resp.reasoning}</ReactMarkdown>
                    {sessionKey && (
                      <CommentThread
                        commentKey={`${sessionKey}:s1:${resp.model_id}:reasoning`}
                        label="reasoning"
                      />
                    )}
                  </div>
                )}
                {tab === "answer" && (
                  <div className="answer-block">
                    <ReactMarkdown>{resp.answer}</ReactMarkdown>
                    {sessionKey && (
                      <CommentThread
                        commentKey={`${sessionKey}:s1:${resp.model_id}:answer`}
                        label="answer"
                      />
                    )}
                  </div>
                )}
                {tab === "confidence" && (
                  <ConfidencePanel
                    score={resp.confidence_score}
                    reason={resp.confidence_reason}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Chain-of-Thought Visualiser — only shown when all models done */}
      {responses && responses.length > 0 && (
        <ChainOfThoughtViz responses={responses} />
      )}
    </div>
  );
}

function ConfidenceBadge({ score }) {
  const color = score >= 8 ? "var(--green)"
              : score >= 5 ? "var(--gold)"
              : "var(--red)";
  return (
    <span style={{
      fontFamily: "var(--mono)",
      fontSize: "0.65rem",
      fontWeight: "700",
      color,
      border: `1px solid ${color}`,
      padding: "0.1rem 0.4rem",
      borderRadius: "3px",
      letterSpacing: "0.05em",
    }}>
      {score}/10
    </span>
  );
}

function ConfidencePanel({ score, reason }) {
  if (score == null) return (
    <div style={{ color: "var(--text3)", fontSize: "0.82rem" }}>
      No confidence score returned.
    </div>
  );

  const color = score >= 8 ? "var(--green)"
              : score >= 5 ? "var(--gold)"
              : "var(--red)";

  const label = score >= 8 ? "HIGH CONFIDENCE"
              : score >= 5 ? "MODERATE"
              : "LOW CONFIDENCE";

  const pct = (score / 10) * 100;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: "0.75rem" }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: "2.2rem", fontWeight: "700", color }}>
          {score}
        </span>
        <span style={{ fontFamily: "var(--mono)", fontSize: "0.9rem", color: "var(--text3)" }}>/ 10</span>
        <span style={{
          fontFamily: "var(--mono)",
          fontSize: "0.65rem",
          letterSpacing: "0.1em",
          color,
          border: `1px solid ${color}`,
          padding: "0.15rem 0.5rem",
          borderRadius: "3px",
          marginLeft: "0.25rem",
        }}>
          {label}
        </span>
      </div>

      <div style={{
        height: "6px",
        background: "var(--border)",
        borderRadius: "3px",
        overflow: "hidden",
      }}>
        <div style={{
          height: "100%",
          width: `${pct}%`,
          background: color,
          borderRadius: "3px",
          transition: "width 0.6s ease",
        }} />
      </div>

      {reason && (
        <div style={{
          fontSize: "0.84rem",
          color: "var(--text2)",
          lineHeight: "1.6",
          padding: "0.6rem 0.85rem",
          background: "var(--bg3)",
          borderLeft: `3px solid ${color}`,
          borderRadius: "var(--radius)",
        }}>
          {reason}
        </div>
      )}
    </div>
  );
}
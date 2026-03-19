import { useState } from "react";
import ReactMarkdown from "react-markdown";

const PROVIDER_COLORS = {
  groq:      "#00D9FF",
  mistral:   "#FF7B54",
  openai:    "#74AA9C",
  anthropic: "#C96442",
  gemini:    "#4285F4",
  ollama:    "#4ADE80",
};

function getAccent(modelId, catalog) {
  const provider = catalog?.[modelId]?.provider || "groq";
  return PROVIDER_COLORS[provider] || "#4ADE80";
}

function ConfidenceBadge({ score }) {
  if (score == null) return null;
  const color = score >= 8 ? "var(--green)" : score >= 5 ? "var(--gold)" : "var(--red)";
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

export default function Stage4View({ refinements, catalog }) {
  const [tabs, setTabs] = useState({});
  const getTab = (id) => tabs[id] || "refinement";
  const setTab = (id, t) => setTabs((p) => ({ ...p, [id]: t }));

  return (
    <div className="response-grid">
      {(refinements || []).map((r) => {
        const accent = getAccent(r.model_id, catalog);
        const tab = getTab(r.model_id);
        const providerLabel = catalog?.[r.model_id]?.provider?.toUpperCase() || "AI";
        const displayName = r.model_name || catalog?.[r.model_id]?.name || r.model_id;

        return (
          <div key={r.model_id} className="response-card" style={{ "--accent": accent }}>
            <div className="card-header">
              <div className="model-identity">
                <span className="model-provider-tag" style={{ color: accent }}>
                  {providerLabel}
                </span>
                <span className="model-name">{displayName}</span>
                <ConfidenceBadge score={r.confidence_score} />
              </div>
              <div className="card-tabs">
                <button
                  className={`tab-btn ${tab === "refinement" ? "active" : ""}`}
                  onClick={() => setTab(r.model_id, "refinement")}
                >
                  Refinement
                </button>
                <button
                  className={`tab-btn ${tab === "reflection" ? "active" : ""}`}
                  onClick={() => setTab(r.model_id, "reflection")}
                >
                  Reflection
                </button>
              </div>
            </div>

            <div className="card-body">
              {tab === "refinement" ? (
                <div className="answer-block">
                  <ReactMarkdown>{r.refinement || ""}</ReactMarkdown>
                </div>
              ) : (
                <div className="reasoning-block">
                  <div className="reasoning-tag">REFLECTING ON VERDICT</div>
                  <ReactMarkdown>{r.reflection || ""}</ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}


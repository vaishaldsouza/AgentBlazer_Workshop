import Stage1View from "./Stage1View";
import Stage2View from "./Stage2View";
import Stage3View from "./Stage3View";
import Stage4View from "./Stage4View";
import Loader from "./Loader";
import { exportMarkdown, exportPDF } from "../utils/exportReport";
import { useState as useLocalState, useState } from "react";

export default function StageView({
  stage, loading, question,
  stage1Data, stage2Data, stage3Data, stage4Data,
  catalog,
  humanVote, onVoteChange,
  onNext, onReset,
  onStage4,
  detectedLanguage,
}) {
  // Use session_id when available, fall back to question hash
  const sessionKey = stage3Data?.session_id || btoa(encodeURIComponent(question)).slice(0, 16);

  const stageLabels = {
    1: { num: "01", title: "Independent Opinions", sub: "Each model reasons and answers independently" },
    2: { num: "02", title: "Peer Review",           sub: "Models critique each other's reasoning anonymously" },
    3: { num: "03", title: "Final Verdict",          sub: "A judge model synthesises the council's best thinking" },
    4: { num: "04", title: "Iterative Refinement",   sub: "Models reflect on the verdict and push the thinking further" },
  };

  const info = stageLabels[stage];

  return (
    <div className="stage-screen">
      <div className="stage-meta">
        <div className="stage-num">{info.num}</div>
        <div className="stage-meta-text">
          <div className="stage-title">{info.title}</div>
          <div className="stage-sub">{info.sub}</div>
        </div>
      </div>

      <div className="question-display">
        <span className="question-display-label">QUESTION</span>
        <span className="question-display-text">{question}</span>
        {detectedLanguage && detectedLanguage !== "English" && (
          <span style={{
            fontFamily: "var(--mono)",
            fontSize: "0.65rem",
            letterSpacing: "0.08em",
            color: "var(--accent2)",
            border: "1px solid var(--accent2)",
            padding: "0.1rem 0.45rem",
            borderRadius: "3px",
            flexShrink: 0,
          }}>
            {detectedLanguage.toUpperCase()}
          </span>
        )}
      </div>

      {loading ? (
        <Loader stage={stage} />
      ) : (
        <>
          {stage === 1 && stage1Data && <Stage1View responses={stage1Data} sessionKey={sessionKey} />}
          {stage === 2 && stage2Data && <Stage2View reviews={stage2Data} catalog={catalog} sessionKey={sessionKey} />}
          {stage === 3 && stage3Data && <Stage3View data={stage3Data} stage1Data={stage1Data} sessionKey={sessionKey} />}
          {stage === 4 && stage4Data && <Stage4View refinements={stage4Data} catalog={catalog} />}

          {/* Human Vote panel — shown after Stage 1 completes, before Stage 3 */}
          {stage === 1 && !loading && stage1Data && (
            <HumanVotePanel
              responses={stage1Data}
              humanVote={humanVote}
              onVoteChange={onVoteChange}
            />
          )}

          {/* Stage 4 launch — shown after Stage 3 completes */}
          {stage === 3 && !loading && stage3Data && !stage4Data && (
            <Stage4Launcher catalog={catalog} onLaunch={onStage4} />
          )}

          <div className="stage-nav">
            <button className="btn-ghost" onClick={onReset}>
              New Question
            </button>

            {stage === 3 && stage3Data?.session_id && (
              <ShareButton sessionId={stage3Data.session_id} />
            )}

            {/* Export buttons — appear once Stage 3 is done */}
            {stage === 3 && stage3Data && (
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  className="btn-ghost"
                  onClick={() => exportMarkdown(question, stage1Data, stage2Data, stage3Data)}
                  style={{ fontSize: "0.75rem" }}
                >
                  ↓ Markdown
                </button>
                <button
                  className="btn-ghost"
                  onClick={() => exportPDF(question, stage1Data, stage2Data, stage3Data)}
                  style={{ fontSize: "0.75rem", color: "var(--accent2)", borderColor: "var(--accent2)" }}
                >
                  ↓ PDF
                </button>
              </div>
            )}

            {onNext && (
              <button className="btn-primary" onClick={onNext}>
                {stage === 1 ? "Proceed to Peer Review →" : "Deliver Final Verdict →"}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Stage4Launcher({ catalog, onLaunch }) {
  const [selected, setSelected] = useLocalState([]);

  function toggle(id) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  }

  const models = Object.values(catalog || {});

  return (
    <div style={{
      background: "var(--bg2)",
      border: "1px solid var(--border)",
      borderLeft: "3px solid var(--accent2)",
      borderRadius: "var(--radius-lg)",
      padding: "1.25rem 1.5rem",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
        <div>
          <span style={{ fontFamily: "var(--mono)", fontSize: "0.65rem", letterSpacing: "0.12em", color: "var(--accent2)" }}>
            🔁 STAGE 4 — ITERATIVE REFINEMENT
          </span>
          <p style={{ fontSize: "0.8rem", color: "var(--text3)", marginTop: "0.3rem" }}>
            Select models to reflect on the verdict and push the thinking further.
          </p>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
        {models.map((m) => {
          const isSelected = selected.includes(m.id);
          return (
            <button
              key={m.id}
              onClick={() => toggle(m.id)}
              style={{
                background: isSelected ? "rgba(167,139,250,0.1)" : "var(--bg3)",
                border: `1px solid ${isSelected ? "var(--accent2)" : "var(--border)"}`,
                borderRadius: "var(--radius)",
                color: isSelected ? "var(--accent2)" : "var(--text2)",
                fontFamily: "var(--mono)",
                fontSize: "0.75rem",
                padding: "0.4rem 0.85rem",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {m.name}
            </button>
          );
        })}
      </div>

      <button
        className="btn-primary"
        disabled={selected.length === 0}
        onClick={() => onLaunch(selected)}
        style={{ background: "var(--accent2)", color: "#0A0A0F" }}
      >
        Launch Refinement →
      </button>
    </div>
  );
}

function HumanVotePanel({ responses, humanVote, onVoteChange }) {
  const ranked = humanVote?.ranked || [];

  function toggleRank(modelId) {
    const current = ranked.filter(Boolean);
    if (current.includes(modelId)) {
      // Remove from ranking
      onVoteChange((prev) => ({
        ...prev,
        ranked: current.filter((id) => id !== modelId),
      }));
    } else {
      // Append to ranking (order = click order)
      onVoteChange((prev) => ({
        ...prev,
        ranked: [...current, modelId],
      }));
    }
  }

  function clearVote() {
    onVoteChange({ ranked: [], reason: "" });
  }

  const hasVote = ranked.length > 0;

  return (
    <div style={{
      background: "var(--bg2)",
      border: "1px solid var(--border)",
      borderLeft: "3px solid var(--gold)",
      borderRadius: "var(--radius-lg)",
      padding: "1.25rem 1.5rem",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={{
            fontFamily: "var(--mono)",
            fontSize: "0.65rem",
            letterSpacing: "0.12em",
            color: "var(--gold)",
          }}>
            🗳 YOUR VOTE (OPTIONAL)
          </span>
          <span style={{ fontSize: "0.78rem", color: "var(--text3)" }}>
            Rank the responses — the judge will factor in your preference
          </span>
        </div>
        {hasVote && (
          <button
            onClick={clearVote}
            style={{
              background: "none",
              border: "none",
              color: "var(--text3)",
              fontFamily: "var(--mono)",
              fontSize: "0.68rem",
              cursor: "pointer",
            }}
          >
            CLEAR
          </button>
        )}
      </div>

      {/* Model ranking buttons — click in order of preference */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem", marginBottom: "0.9rem" }}>
        {responses.map((r) => {
          const rank = ranked.indexOf(r.model_id);
          const isRanked = rank !== -1;
          return (
            <button
              key={r.model_id}
              onClick={() => toggleRank(r.model_id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                background: isRanked ? "rgba(245,200,66,0.08)" : "var(--bg3)",
                border: `1px solid ${isRanked ? "var(--gold)" : "var(--border)"}`,
                borderRadius: "var(--radius)",
                padding: "0.5rem 0.9rem",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {isRanked && (
                <span style={{
                  background: "var(--gold)",
                  color: "#0A0A0F",
                  fontFamily: "var(--mono)",
                  fontSize: "0.65rem",
                  fontWeight: "700",
                  borderRadius: "50%",
                  width: "18px",
                  height: "18px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}>
                  {rank + 1}
                </span>
              )}
              <span style={{
                fontFamily: "var(--mono)",
                fontSize: "0.78rem",
                color: isRanked ? "var(--gold)" : "var(--text2)",
              }}>
                {r.model_name}
              </span>
            </button>
          );
        })}
      </div>

      {/* Optional reason */}
      <input
        type="text"
        placeholder="Optional: explain your preference (e.g. 'more concise', 'better example')..."
        value={humanVote?.reason || ""}
        onChange={(e) => onVoteChange((prev) => ({ ...prev, reason: e.target.value }))}
        style={{
          width: "100%",
          background: "var(--bg3)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          color: "var(--text)",
          fontFamily: "var(--sans)",
          fontSize: "0.82rem",
          padding: "0.5rem 0.85rem",
          outline: "none",
        }}
      />

      {/* Live preview of what gets sent to judge */}
      {hasVote && (
        <div style={{
          marginTop: "0.75rem",
          padding: "0.6rem 0.85rem",
          background: "var(--bg)",
          border: "1px solid var(--border)",
          borderLeft: "3px solid var(--gold)",
          borderRadius: "var(--radius)",
          fontFamily: "var(--mono)",
          fontSize: "0.72rem",
          color: "var(--text3)",
        }}>
          Will tell the judge: ranked{" "}
          <span style={{ color: "var(--gold)" }}>
            {ranked.map((id) => responses.find((rr) => rr.model_id === id)?.model_name || id).join(" → ")}
          </span>
          {humanVote?.reason && (
            <span> · "{humanVote.reason}"</span>
          )}
        </div>
      )}
    </div>
  );
}

function ShareButton({ sessionId }) {
  const [copied, setCopied] = useState(false);

  const url = `http://localhost:8000/sessions/${sessionId}/share`;

  function copy() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="btn-ghost"
        style={{ fontSize: "0.75rem", textDecoration: "none" }}
      >
        🔗 View Share Page
      </a>
      <button
        className="btn-ghost"
        onClick={copy}
        style={{ fontSize: "0.75rem" }}
      >
        {copied ? "✓ Copied" : "Copy Link"}
      </button>
    </div>
  );
}
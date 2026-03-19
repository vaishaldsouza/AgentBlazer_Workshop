import { useState } from "react";
import ReactMarkdown from "react-markdown";
import CommentThread from "./CommentThread";

const BASE = "http://localhost:8000";

function extractSection(text, startHeader, endHeader) {
  if (!text) return "";
  const start = text.indexOf(startHeader);
  if (start === -1) return text;
  const contentStart = start + startHeader.length;
  if (!endHeader) return text.slice(contentStart).trim();
  const end = text.indexOf(endHeader, contentStart);
  if (end === -1) return text.slice(contentStart).trim();
  return text.slice(contentStart, end).trim();
}

function TypingCursor() {
  return <span className="typing-cursor">▋</span>;
}

function ScoreBar({ value, max = 10, color = "var(--accent)" }) {
  if (value == null) return <span style={{ color: "var(--text3)", fontSize: "0.72rem" }}>—</span>;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
      <div style={{
        flex: 1, height: "5px", background: "var(--border)",
        borderRadius: "3px", overflow: "hidden",
      }}>
        <div style={{
          height: "100%",
          width: `${(value / max) * 100}%`,
          background: color,
          borderRadius: "3px",
          transition: "width 0.6s ease",
        }} />
      </div>
      <span style={{
        fontFamily: "var(--mono)", fontSize: "0.7rem",
        color, minWidth: "32px", textAlign: "right",
      }}>
        {value}/10
      </span>
    </div>
  );
}

function scoreColor(score) {
  if (score == null) return "var(--text3)";
  if (score >= 8) return "var(--green)";
  if (score >= 5) return "var(--gold)";
  return "var(--red)";
}

function QualityScorePanel({ scores, loading, onRequest }) {
  if (loading) return (
    <div style={{
      padding: "1.25rem",
      background: "var(--bg3)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius)",
      fontFamily: "var(--mono)",
      fontSize: "0.78rem",
      color: "var(--text3)",
      display: "flex",
      alignItems: "center",
      gap: "0.75rem",
    }}>
      <span style={{ animation: "pulse 1.2s ease infinite" }}>⏳</span>
      Scoring responses against verdict...
    </div>
  );

  if (!scores) return (
    <div style={{
      background: "var(--bg3)",
      border: "1px solid var(--border)",
      borderLeft: "3px solid var(--accent)",
      borderRadius: "var(--radius)",
      padding: "1rem 1.25rem",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    }}>
      <div>
        <div style={{ fontFamily: "var(--mono)", fontSize: "0.68rem", color: "var(--accent)", letterSpacing: "0.1em", marginBottom: "0.2rem" }}>
          📊 ANSWER QUALITY SCORING
        </div>
        <div style={{ fontSize: "0.8rem", color: "var(--text3)" }}>
          Score each model's Stage 1 answer against the final verdict
        </div>
      </div>
      <button className="btn-ghost" onClick={onRequest} style={{ fontSize: "0.75rem", flexShrink: 0 }}>
        Score Answers →
      </button>
    </div>
  );

  const ranked = [...scores].filter(s => s.score != null).sort((a, b) => b.score - a.score);
  const maxScore = Math.max(...ranked.map(s => s.score), 1);

  return (
    <div style={{
      background: "var(--bg3)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius-lg)",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding: "0.85rem 1.1rem",
        borderBottom: "1px solid var(--border)",
        background: "var(--bg2)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: "0.68rem", color: "var(--accent)", letterSpacing: "0.1em" }}>
          📊 ANSWER QUALITY SCORES
        </span>
        <span style={{ fontFamily: "var(--mono)", fontSize: "0.65rem", color: "var(--text3)" }}>
          scored vs final verdict
        </span>
      </div>

      {/* Score rows */}
      <div style={{ padding: "0.75rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
        {ranked.map((s, i) => {
          const col    = scoreColor(s.score);
          const medal  = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`;
          return (
            <div key={s.model_id} style={{
              background: "var(--bg2)",
              border: `1px solid ${i === 0 ? col : "var(--border)"}`,
              borderRadius: "var(--radius)",
              padding: "0.85rem 1rem",
            }}>
              {/* Model name + overall score */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ fontSize: "1rem" }}>{medal}</span>
                  <span style={{ fontFamily: "var(--mono)", fontSize: "0.82rem", fontWeight: "700", color: "var(--text)" }}>
                    {s.model_name}
                  </span>
                </div>
                <span style={{
                  fontFamily: "var(--mono)", fontSize: "1.2rem",
                  fontWeight: "700", color: col,
                }}>
                  {s.score}/10
                </span>
              </div>

              {/* Overall bar */}
              <ScoreBar value={s.score} color={col} />

              {/* Dimension breakdown */}
              {(s.accuracy != null || s.completeness != null || s.clarity != null) && (
                <div style={{
                  marginTop: "0.75rem",
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: "0.5rem",
                }}>
                  {[
                    { label: "ACCURACY",     value: s.accuracy,     color: "var(--accent)" },
                    { label: "COMPLETENESS", value: s.completeness, color: "var(--accent2)" },
                    { label: "CLARITY",      value: s.clarity,      color: "var(--gold)" },
                  ].map(dim => (
                    <div key={dim.label}>
                      <div style={{ fontFamily: "var(--mono)", fontSize: "0.58rem", color: "var(--text3)", marginBottom: "0.3rem" }}>
                        {dim.label}
                      </div>
                      <ScoreBar value={dim.value} color={dim.color} />
                    </div>
                  ))}
                </div>
              )}

              {/* Reasoning */}
              {s.reasoning && (
                <div style={{
                  marginTop: "0.6rem",
                  padding: "0.45rem 0.65rem",
                  background: "var(--bg3)",
                  borderLeft: `2px solid ${col}`,
                  borderRadius: "3px",
                  fontSize: "0.76rem",
                  color: "var(--text3)",
                  fontStyle: "italic",
                }}>
                  {s.reasoning}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Stage3View({ data, streamingText, isStreaming, stage1Data, sessionKey = "" }) {
  const [qualityScores, setQualityScores] = useState(null);
  const [scoringLoading, setScoringLoading] = useState(false);

  const judgeLabel = data?.judge_model
    ? `${String(data.judge_model).toUpperCase()} — JUDGE` 
    : "AUTO — JUDGE";

  const liveSummary = isStreaming ? extractSection(streamingText, "## Summary", "## Verdict") : null;
  const liveVerdict = isStreaming ? extractSection(streamingText, "## Verdict", null) : null;

  const summary = isStreaming ? liveSummary : data?.summary;
  const verdict = isStreaming ? liveVerdict : data?.verdict;

  const summaryDone = isStreaming && streamingText?.includes("## Verdict");
  const inSummary   = isStreaming && !summaryDone;
  const inVerdict   = isStreaming && summaryDone;

  async function requestScores() {
    if (!data?.verdict || !stage1Data?.length) return;
    setScoringLoading(true);
    try {
      const res = await fetch(`${BASE}/quality-scores`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question:  data.question || "",
          verdict:   data.verdict,
          responses: stage1Data,
          judge_model: data.judge_model || undefined,
        }),
      });
      const json = await res.json();
      setQualityScores(json.scores || []);
    } catch (e) {
      console.error(e);
    } finally {
      setScoringLoading(false);
    }
  }

  return (
    <div className="verdict-container">
      <div className="verdict-judge-tag">
        <span className="judge-dot" />
        {isStreaming ? "STREAMING VERDICT..." : judgeLabel}
      </div>

      <div className="verdict-card">
        <div className="verdict-section">
          <div className="verdict-section-label">SUMMARY</div>
          <div className="verdict-summary">
            <ReactMarkdown>{summary || ""}</ReactMarkdown>
            {inSummary && <TypingCursor />}
          </div>
          {!isStreaming && sessionKey && (
            <CommentThread commentKey={`${sessionKey}:s3:summary`} label="summary" />
          )}
        </div>

        <div className="verdict-divider" />

        <div className="verdict-section">
          <div className="verdict-section-label">FINAL VERDICT</div>
          <div className="verdict-body">
            <ReactMarkdown>{verdict || ""}</ReactMarkdown>
            {inVerdict && <TypingCursor />}
          </div>
          {!isStreaming && sessionKey && (
            <CommentThread commentKey={`${sessionKey}:s3:verdict`} label="verdict" />
          )}
        </div>
      </div>

      {/* Quality scoring — shown after streaming completes */}
      {!isStreaming && data && stage1Data?.length > 0 && (
        <QualityScorePanel
          scores={qualityScores}
          loading={scoringLoading}
          onRequest={requestScores}
        />
      )}
    </div>
  );
}
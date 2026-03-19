import { useState, useEffect } from "react";

const BASE = "http://localhost:8000";

// ── Colour scale: 0=agreement(green) → 1=disagreement(red) ──
function divergenceColor(score) {
  if (score == null) return "var(--border)";
  // green → gold → red
  if (score < 0.4)  return `hsl(${140 - score * 100}, 70%, 45%)`;
  if (score < 0.65) return `hsl(${45},  80%, 50%)`;
  return               `hsl(${360 - score * 60}, 70%, 50%)`;
}

function controversyColor(label) {
  return label === "HIGH"   ? "var(--red)"
       : label === "MEDIUM" ? "var(--gold)"
       : "var(--green)";
}

// ── Heatmap cell ─────────────────────────────────────────────
function HeatCell({ value, label, size = 48 }) {
  const bg    = divergenceColor(value);
  const alpha = value != null ? 0.15 + value * 0.65 : 0.08;
  return (
    <div title={label} style={{
      width: size, height: size,
      background: value != null
        ? bg.replace("hsl", "hsla").replace(")", `, ${alpha})`)
        : "var(--bg3)",
      border: `1px solid ${value != null ? bg : "var(--border)"}`,
      borderRadius: "4px",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "var(--mono)", fontSize: "0.65rem", fontWeight: "700",
      color: value != null ? bg : "var(--text3)",
      cursor: "default",
      transition: "transform 0.15s",
    }}
      onMouseEnter={e => e.currentTarget.style.transform = "scale(1.15)"}
      onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
    >
      {value != null ? value.toFixed(2) : "—"}
    </div>
  );
}

// ── Mini sparkline for a row of scores ──────────────────────
function Sparkline({ scores, width = 80, height = 24 }) {
  if (!scores || scores.length === 0) return null;
  const max  = Math.max(...scores, 1);
  const pts  = scores.map((v, i) => {
    const x = (i / Math.max(scores.length - 1, 1)) * width;
    const y = height - (v / max) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <polyline
        points={pts}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {scores.map((v, i) => {
        const x = (i / Math.max(scores.length - 1, 1)) * width;
        const y = height - (v / max) * (height - 4) - 2;
        return <circle key={i} cx={x} cy={y} r="2" fill={divergenceColor(v)} />;
      })}
    </svg>
  );
}

// ── Main component ───────────────────────────────────────────
export default function DisagreementHeatmap({ onClose }) {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState("heatmap");   // heatmap | sessions | pairs
  const [selected, setSelected] = useState(null);        // selected session for detail

  useEffect(() => {
    fetch(`${BASE}/disagreement`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ padding: "4rem", textAlign: "center", fontFamily: "var(--mono)", color: "var(--text3)" }}>
      Computing divergence scores...
    </div>
  );

  if (!data || data.total === 0) return (
    <div style={{ maxWidth: "640px", margin: "2rem auto" }}>
      <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "2rem" }}>
        <div className="question-label" style={{ marginBottom: "0.75rem" }}>🔀 MODEL DISAGREEMENT HEATMAP</div>
        <p style={{ color: "var(--text3)", fontSize: "0.88rem", marginBottom: "1.5rem" }}>
          Need at least one session with 2+ models to compute disagreement.
        </p>
        <button className="btn-primary" onClick={onClose}>Back</button>
      </div>
    </div>
  );

  // Collect all unique model ids across sessions
  const allModels = [...new Set(
    data.sessions.flatMap(s => s.pairs.flatMap(p => [p.model_a, p.model_b]))
  )];
  const allModelNames = {};
  data.sessions.forEach(s =>
    s.pairs.forEach(p => {
      allModelNames[p.model_a] = p.name_a;
      allModelNames[p.model_b] = p.name_b;
    })
  );

  // Build matrix: rows=questions, cols=model-pairs
  const pairs = [...new Set(
    data.sessions.flatMap(s => s.pairs.map(p =>
      [p.model_a, p.model_b].sort().join("__vs__")
    ))
  )];

  // Overall stats
  const avgAll = data.sessions.reduce((sum, s) => sum + s.avg_divergence, 0) / data.sessions.length;
  const highCount   = data.sessions.filter(s => s.controversy === "HIGH").length;
  const medCount    = data.sessions.filter(s => s.controversy === "MEDIUM").length;

  const TABS = ["heatmap", "sessions", "pairs"];

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
      <div style={{
        background: "var(--bg2)", border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)", padding: "2rem",
      }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
          <div>
            <div className="question-label">🔀 MODEL DISAGREEMENT HEATMAP</div>
            <p style={{ fontSize: "0.8rem", color: "var(--text3)", marginTop: "0.3rem" }}>
              Semantic divergence between model answers · {data.total} session{data.total !== 1 ? "s" : ""} analysed
            </p>
          </div>
          <button className="btn-ghost" onClick={onClose}>Close</button>
        </div>

        {/* Summary stat pills */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
          gap: "0.75rem", marginBottom: "1.75rem",
        }}>
          {[
            { label: "AVG DIVERGENCE",   value: avgAll.toFixed(2),  color: divergenceColor(avgAll) },
            { label: "HIGH CONTROVERSY", value: highCount,            color: "var(--red)" },
            { label: "MEDIUM",           value: medCount,             color: "var(--gold)" },
            { label: "LOW AGREEMENT",    value: data.total - highCount - medCount, color: "var(--green)" },
          ].map(s => (
            <div key={s.label} style={{
              background: "var(--bg3)", border: "1px solid var(--border)",
              borderRadius: "var(--radius)", padding: "0.85rem 1rem",
            }}>
              <div style={{ fontFamily: "var(--mono)", fontSize: "1.4rem", fontWeight: "700", color: s.color }}>
                {s.value}
              </div>
              <div style={{ fontFamily: "var(--mono)", fontSize: "0.6rem", color: "var(--text3)", letterSpacing: "0.1em", marginTop: "0.2rem" }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* Colour legend */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.25rem" }}>
          <span style={{ fontFamily: "var(--mono)", fontSize: "0.65rem", color: "var(--text3)" }}>DIVERGENCE</span>
          {[0, 0.2, 0.4, 0.6, 0.8, 1.0].map(v => (
            <div key={v} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.2rem" }}>
              <div style={{
                width: 28, height: 14, borderRadius: 3,
                background: divergenceColor(v),
                opacity: 0.7,
              }} />
              <span style={{ fontFamily: "var(--mono)", fontSize: "0.55rem", color: "var(--text3)" }}>{v.toFixed(1)}</span>
            </div>
          ))}
          <span style={{ fontFamily: "var(--mono)", fontSize: "0.65rem", color: "var(--text3)", marginLeft: "0.25rem" }}>
            ← agree · disagree →
          </span>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "0.35rem", marginBottom: "1.25rem" }}>
          {TABS.map(t => (
            <button
              key={t}
              className={`tab-btn ${tab === t ? "active" : ""}`}
              onClick={() => { setTab(t); setSelected(null); }}
              style={{ textTransform: "uppercase", fontSize: "0.68rem" }}
            >
              {t === "heatmap" ? "🔥 Heatmap" : t === "sessions" ? "📋 Sessions" : "⚔ Pair Analysis"}
            </button>
          ))}
        </div>

        {/* ── HEATMAP TAB ── */}
        {tab === "heatmap" && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "separate", borderSpacing: "4px", minWidth: "600px" }}>
              <thead>
                <tr>
                  <th style={{
                    textAlign: "left", fontFamily: "var(--mono)", fontSize: "0.62rem",
                    color: "var(--text3)", padding: "0 0.5rem 0.5rem", fontWeight: "normal",
                    maxWidth: "220px",
                  }}>
                    QUESTION
                  </th>
                  <th style={{ fontFamily: "var(--mono)", fontSize: "0.62rem", color: "var(--text3)", padding: "0 0 0.5rem", fontWeight: "normal", textAlign: "center" }}>
                    AVG DIV
                  </th>
                  {data.sessions[0]?.pairs.map(p => (
                    <th key={`${p.model_a}__${p.model_b}`}
                      style={{ fontFamily: "var(--mono)", fontSize: "0.6rem", color: "var(--text3)", padding: "0 0 0.5rem", fontWeight: "normal", textAlign: "center", minWidth: "56px" }}>
                      {p.name_a.split(" ")[0]}<br />vs<br />{p.name_b.split(" ")[0]}
                    </th>
                  ))}
                  <th style={{ fontFamily: "var(--mono)", fontSize: "0.62rem", color: "var(--text3)", padding: "0 0 0.5rem", fontWeight: "normal" }}>
                    LEVEL
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.sessions.map((s, i) => (
                  <tr
                    key={s.session_id}
                    style={{ cursor: "pointer" }}
                    onClick={() => { setSelected(s); setTab("sessions"); }}
                  >
                    <td style={{
                      maxWidth: "220px", overflow: "hidden", textOverflow: "ellipsis",
                      whiteSpace: "nowrap", fontSize: "0.78rem", color: "var(--text2)",
                      padding: "2px 0.5rem 2px 0",
                    }}>
                      {s.question}
                    </td>
                    <td style={{ textAlign: "center", padding: "2px 4px" }}>
                      <HeatCell value={s.avg_divergence} label={`Avg: ${s.avg_divergence}`} size={44} />
                    </td>
                    {s.pairs.map(p => (
                      <td key={`${p.model_a}__${p.model_b}`} style={{ textAlign: "center", padding: "2px 4px" }}>
                        <HeatCell
                          value={p.divergence}
                          label={`${p.name_a} vs ${p.name_b}: ${p.divergence}`}
                          size={44}
                        />
                      </td>
                    ))}
                    <td style={{ padding: "2px 0 2px 4px" }}>
                      <span style={{
                        fontFamily: "var(--mono)", fontSize: "0.6rem", fontWeight: "700",
                        color: controversyColor(s.controversy),
                        border: `1px solid ${controversyColor(s.controversy)}`,
                        padding: "0.1rem 0.35rem", borderRadius: "3px",
                      }}>
                        {s.controversy}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ marginTop: "0.75rem", fontFamily: "var(--mono)", fontSize: "0.65rem", color: "var(--text3)" }}>
              Click any row to view session detail · Divergence = Jaccard distance on answer word sets (0=identical, 1=no overlap)
            </p>
          </div>
        )}

        {/* ── SESSIONS TAB ── */}
        {tab === "sessions" && !selected && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            {data.sessions.map(s => (
              <div
                key={s.session_id}
                onClick={() => setSelected(s)}
                style={{
                  background: "var(--bg3)", border: "1px solid var(--border)",
                  borderRadius: "var(--radius)", padding: "1rem 1.1rem",
                  cursor: "pointer", transition: "border-color 0.2s",
                  display: "grid", gridTemplateColumns: "1fr auto auto auto",
                  gap: "1rem", alignItems: "center",
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = "var(--accent)"}
                onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}
              >
                <div>
                  <div style={{ fontSize: "0.88rem", color: "var(--text2)", marginBottom: "0.2rem" }}>{s.question}</div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: "0.65rem", color: "var(--text3)" }}>
                    {new Date(s.timestamp).toLocaleDateString()} · {s.model_count} models
                  </div>
                </div>
                <Sparkline scores={s.pairs.map(p => p.divergence)} />
                <HeatCell value={s.avg_divergence} label={`Avg divergence: ${s.avg_divergence}`} size={40} />
                <span style={{
                  fontFamily: "var(--mono)", fontSize: "0.6rem", fontWeight: "700",
                  color: controversyColor(s.controversy),
                  border: `1px solid ${controversyColor(s.controversy)}`,
                  padding: "0.15rem 0.4rem", borderRadius: "3px",
                }}>
                  {s.controversy}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* ── SESSION DETAIL ── */}
        {tab === "sessions" && selected && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <button className="btn-ghost" onClick={() => setSelected(null)} style={{ alignSelf: "flex-start" }}>
              ← Back to sessions
            </button>

            <div style={{
              background: "var(--bg3)", border: "1px solid var(--border)",
              borderLeft: `3px solid ${controversyColor(selected.controversy)}`,
              borderRadius: "var(--radius)", padding: "1rem 1.25rem",
            }}>
              <div style={{ fontSize: "0.9rem", color: "var(--text)", marginBottom: "0.5rem", fontWeight: "500" }}>
                {selected.question}
              </div>
              <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
                <span style={{ fontFamily: "var(--mono)", fontSize: "0.7rem", color: "var(--text3)" }}>
                  Avg divergence: <span style={{ color: divergenceColor(selected.avg_divergence) }}>{selected.avg_divergence}</span>
                </span>
                <span style={{ fontFamily: "var(--mono)", fontSize: "0.7rem", color: "var(--text3)" }}>
                  Max: <span style={{ color: divergenceColor(selected.max_divergence) }}>{selected.max_divergence}</span>
                </span>
                <span style={{ fontFamily: "var(--mono)", fontSize: "0.7rem",
                  color: controversyColor(selected.controversy) }}>
                  {selected.controversy} CONTROVERSY
                </span>
              </div>
            </div>

            {/* Pairwise breakdown */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {selected.pairs.map(p => {
                const pct = p.divergence * 100;
                const col = divergenceColor(p.divergence);
                return (
                  <div key={`${p.model_a}__${p.model_b}`} style={{
                    background: "var(--bg3)", border: "1px solid var(--border)",
                    borderRadius: "var(--radius)", padding: "1rem 1.25rem",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.6rem" }}>
                      <span style={{ fontFamily: "var(--mono)", fontSize: "0.8rem", color: "var(--text)" }}>
                        {p.name_a} <span style={{ color: "var(--text3)" }}>vs</span> {p.name_b}
                      </span>
                      <span style={{ fontFamily: "var(--mono)", fontSize: "0.8rem", fontWeight: "700", color: col }}>
                        {p.divergence} divergence · {p.similarity} similarity
                      </span>
                    </div>
                    {/* Divergence bar */}
                    <div style={{ height: "8px", background: "var(--border)", borderRadius: "4px", overflow: "hidden" }}>
                      <div style={{
                        height: "100%", width: `${pct}%`,
                        background: col, borderRadius: "4px",
                        transition: "width 0.5s ease",
                      }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.3rem" }}>
                      <span style={{ fontFamily: "var(--mono)", fontSize: "0.6rem", color: "var(--green)" }}>← agree</span>
                      <span style={{ fontFamily: "var(--mono)", fontSize: "0.6rem", color: "var(--red)" }}>disagree →</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── PAIR ANALYSIS TAB ── */}
        {tab === "pairs" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <p style={{ fontSize: "0.82rem", color: "var(--text3)" }}>
              Aggregated divergence between model pairs across all sessions.
            </p>
            {data.pair_summary.map(p => {
              const col     = divergenceColor(p.avg_divergence);
              const minCol  = divergenceColor(p.min_divergence);
              const maxCol  = divergenceColor(p.max_divergence);
              // Get per-session scores for this pair to draw sparkline
              const key     = [p.model_a, p.model_b].sort().join("__vs__");
              const scores  = data.sessions
                .map(s => s.pairs.find(pr =>
                  [pr.model_a, pr.model_b].sort().join("__vs__") === key
                )?.divergence)
                .filter(v => v != null);

              return (
                <div key={key} style={{
                  background: "var(--bg3)", border: `1px solid ${col}`,
                  borderRadius: "var(--radius)", padding: "1.1rem 1.25rem",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
                    <div>
                      <div style={{ fontFamily: "var(--mono)", fontSize: "0.88rem", fontWeight: "700", color: "var(--text)", marginBottom: "0.2rem" }}>
                        {p.name_a} <span style={{ color: "var(--text3)" }}>⚔</span> {p.name_b}
                      </div>
                      <div style={{ fontFamily: "var(--mono)", fontSize: "0.65rem", color: "var(--text3)" }}>
                        {p.sessions} session{p.sessions !== 1 ? "s" : ""} compared
                      </div>
                    </div>
                    <Sparkline scores={scores} width={100} height={28} />
                  </div>

                  {/* Avg bar */}
                  <div style={{ marginBottom: "0.5rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                      <span style={{ fontFamily: "var(--mono)", fontSize: "0.62rem", color: "var(--text3)" }}>AVG DIVERGENCE</span>
                      <span style={{ fontFamily: "var(--mono)", fontSize: "0.72rem", color: col, fontWeight: "700" }}>
                        {p.avg_divergence}
                      </span>
                    </div>
                    <div style={{ height: "6px", background: "var(--border)", borderRadius: "3px", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${p.avg_divergence * 100}%`, background: col, borderRadius: "3px" }} />
                    </div>
                  </div>

                  {/* Min/max range */}
                  <div style={{ display: "flex", gap: "1.5rem" }}>
                    <span style={{ fontFamily: "var(--mono)", fontSize: "0.68rem" }}>
                      Min: <span style={{ color: minCol }}>{p.min_divergence}</span>
                    </span>
                    <span style={{ fontFamily: "var(--mono)", fontSize: "0.68rem" }}>
                      Max: <span style={{ color: maxCol }}>{p.max_divergence}</span>
                    </span>
                    <span style={{ fontFamily: "var(--mono)", fontSize: "0.68rem", color: "var(--text3)" }}>
                      Range: {(p.max_divergence - p.min_divergence).toFixed(3)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}

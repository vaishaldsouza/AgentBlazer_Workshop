import { useState, useEffect } from "react";

const BASE = "http://localhost:8000";

const MEDAL = ["🥇", "🥈", "🥉"];

function MetricBar({ value, max = 1, color = "var(--accent)" }) {
  if (value == null) return <span style={{ color: "var(--text3)", fontSize: "0.72rem" }}>—</span>;
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
      <div style={{
        flex: 1, height: "5px", background: "var(--border)",
        borderRadius: "3px", overflow: "hidden", minWidth: "60px",
      }}>
        <div style={{
          height: "100%", width: `${pct}%`,
          background: color, borderRadius: "3px",
          transition: "width 0.6s ease",
        }} />
      </div>
      <span style={{ fontFamily: "var(--mono)", fontSize: "0.72rem", color, minWidth: "28px", textAlign: "right" }}>
        {typeof value === "number" && value % 1 !== 0 ? value.toFixed(2) : value}
      </span>
    </div>
  );
}

function ConfidenceDot({ score }) {
  if (score == null) return <span style={{ color: "var(--text3)" }}>—</span>;
  const color = score >= 8 ? "var(--green)" : score >= 5 ? "var(--gold)" : "var(--red)";
  return (
    <span style={{ fontFamily: "var(--mono)", fontSize: "0.78rem", color, fontWeight: "700" }}>
      {score}/10
    </span>
  );
}

function StatCard({ label, value, sub, color = "var(--accent)" }) {
  return (
    <div style={{
      background: "var(--bg3)", border: "1px solid var(--border)",
      borderRadius: "var(--radius)", padding: "1rem 1.25rem",
      display: "flex", flexDirection: "column", gap: "0.25rem",
    }}>
      <span style={{ fontFamily: "var(--mono)", fontSize: "1.6rem", fontWeight: "700", color }}>
        {value ?? "—"}
      </span>
      <span style={{ fontFamily: "var(--mono)", fontSize: "0.65rem", color: "var(--text3)", letterSpacing: "0.1em" }}>
        {label}
      </span>
      {sub && <span style={{ fontSize: "0.72rem", color: "var(--text3)" }}>{sub}</span>}
    </div>
  );
}

const SORT_OPTIONS = [
  { key: "win_rate",    label: "Win Rate" },
  { key: "avg_rank",    label: "Avg Rank" },
  { key: "avg_confidence", label: "Confidence" },
  { key: "avg_latency", label: "Latency" },
  { key: "consistency", label: "Consistency" },
  { key: "sessions_played", label: "Sessions" },
];

export default function Leaderboard({ onClose }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy]   = useState("win_rate");
  const [sortDir, setSortDir] = useState("desc");
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    fetch(`${BASE}/leaderboard`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  function toggleSort(key) {
    if (sortBy === key) setSortDir((d) => d === "desc" ? "asc" : "desc");
    else { setSortBy(key); setSortDir(key === "avg_rank" || key === "avg_latency" ? "asc" : "desc"); }
  }

  if (loading) return (
    <div style={{ padding: "4rem", textAlign: "center", fontFamily: "var(--mono)", color: "var(--text3)" }}>
      Computing leaderboard...
    </div>
  );

  if (!data || data.models.length === 0) return (
    <div style={{ maxWidth: "640px", margin: "2rem auto" }}>
      <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "2rem" }}>
        <div className="question-label" style={{ marginBottom: "0.75rem" }}>🏆 MODEL LEADERBOARD</div>
        <p style={{ color: "var(--text3)", fontSize: "0.88rem", marginBottom: "1.5rem" }}>
          No sessions yet. Complete a few council runs to populate leaderboard.
        </p>
        <button className="btn-primary" onClick={onClose}>Back</button>
      </div>
    </div>
  );

  // Sort models
  const sorted = [...data.models].sort((a, b) => {
    const av = a[sortBy] ?? (sortDir === "desc" ? -Infinity : Infinity);
    const bv = b[sortBy] ?? (sortDir === "desc" ? -Infinity : Infinity);
    return sortDir === "desc" ? bv - av : av - bv;
  });

  const topModel = data.models[0];

  return (
    <div style={{ maxWidth: "960px", margin: "0 auto" }}>
      <div style={{
        background: "var(--bg2)", border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)", padding: "2rem",
      }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
          <div>
            <div className="question-label">🏆 MODEL LEADERBOARD</div>
            <p style={{ fontSize: "0.8rem", color: "var(--text3)", marginTop: "0.3rem" }}>
              Ranked across {data.total_sessions} session{data.total_sessions !== 1 ? "s" : ""} · Updated {new Date(data.last_updated).toLocaleTimeString()}
            </p>
          </div>
          <button className="btn-ghost" onClick={onClose}>Close</button>
        </div>

        {/* Top-level summary stats */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: "0.75rem", marginBottom: "2rem",
        }}>
          <StatCard label="TOTAL SESSIONS"  value={data.total_sessions} color="var(--accent)" />
          <StatCard label="MODELS TRACKED"  value={data.models.length}  color="var(--accent2)" />
          <StatCard label="CURRENT LEADER"  value={topModel?.model_name?.split(" ")[0]} color="var(--gold)"
            sub={topModel ? `${Math.round(topModel.win_rate * 100)}% win rate` : null} />
          <StatCard
            label="TOP CONFIDENCE"
            value={(() => {
              const best = [...data.models].filter(m => m.avg_confidence != null).sort((a,b) => b.avg_confidence - a.avg_confidence)[0];
              return best ? `${best.avg_confidence}/10` : "—";
            })()}
            color="var(--green)"
          />
        </div>

        {/* Sort controls */}
        <div style={{ display: "flex", gap: "0.35rem", marginBottom: "1rem", flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontFamily: "var(--mono)", fontSize: "0.65rem", color: "var(--text3)", marginRight: "0.25rem" }}>SORT BY</span>
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => toggleSort(opt.key)}
              className={`tab-btn ${sortBy === opt.key ? "active" : ""}`}
              style={{ fontSize: "0.68rem" }}
            >
              {opt.label} {sortBy === opt.key ? (sortDir === "desc" ? "↓" : "↑") : ""}
            </button>
          ))}
        </div>

        {/* Leaderboard rows */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          {sorted.map((model, i) => {
            const isExpanded = expanded === model.model_id;
            const medal = i < 3 ? MEDAL[i] : null;
            const rankColor = i === 0 ? "var(--gold)" : i === 1 ? "var(--text2)" : i === 2 ? "#cd7f32" : "var(--text3)";

            return (
              <div
                key={model.model_id}
                style={{
                  background: "var(--bg3)",
                  border: `1px solid ${i === 0 ? "var(--gold)" : "var(--border)"}`,
                  borderRadius: "var(--radius)",
                  overflow: "hidden",
                  transition: "border-color 0.2s",
                }}
              >
                {/* Main row */}
                <div
                  onClick={() => setExpanded(isExpanded ? null : model.model_id)}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2.5rem 1fr 120px 120px 120px 120px 80px",
                    alignItems: "center",
                    gap: "1rem",
                    padding: "0.9rem 1.1rem",
                    cursor: "pointer",
                  }}
                >
                  {/* Position */}
                  <div style={{ textAlign: "center" }}>
                    {medal
                      ? <span style={{ fontSize: "1.2rem" }}>{medal}</span>
                      : <span style={{ fontFamily: "var(--mono)", fontSize: "0.8rem", color: "var(--text3)" }}>#{i + 1}</span>
                    }
                  </div>

                  {/* Name */}
                  <div>
                    <div style={{ fontWeight: "600", fontSize: "0.92rem", color: rankColor }}>
                      {model.model_name}
                    </div>
                    <div style={{ fontFamily: "var(--mono)", fontSize: "0.65rem", color: "var(--text3)", marginTop: "0.15rem" }}>
                      {model.sessions_played} session{model.sessions_played !== 1 ? "s" : ""} · {model.reviews_received} reviews
                    </div>
                  </div>

                  {/* Win Rate */}
                  <div>
                    <div style={{ fontFamily: "var(--mono)", fontSize: "0.62rem", color: "var(--text3)", marginBottom: "0.3rem" }}>WIN RATE</div>
                    <MetricBar value={model.win_rate} max={1} color="var(--gold)" />
                  </div>

                  {/* Avg Rank */}
                  <div>
                    <div style={{ fontFamily: "var(--mono)", fontSize: "0.62rem", color: "var(--text3)", marginBottom: "0.3rem" }}>AVG RANK</div>
                    <MetricBar
                      value={model.avg_rank != null ? Math.max(0, 5 - model.avg_rank) : null}
                      max={4}
                      color="var(--accent)"
                    />
                  </div>

                  {/* Consistency */}
                  <div>
                    <div style={{ fontFamily: "var(--mono)", fontSize: "0.62rem", color: "var(--text3)", marginBottom: "0.3rem" }}>CONSISTENCY</div>
                    <MetricBar value={model.consistency} max={1} color="var(--accent2)" />
                  </div>

                  {/* Confidence */}
                  <div>
                    <div style={{ fontFamily: "var(--mono)", fontSize: "0.62rem", color: "var(--text3)", marginBottom: "0.3rem" }}>CONFIDENCE</div>
                    <ConfidenceDot score={model.avg_confidence} />
                  </div>

                  {/* Expand toggle */}
                  <div style={{ textAlign: "right", fontFamily: "var(--mono)", fontSize: "0.7rem", color: "var(--text3)" }}>
                    {isExpanded ? "▲" : "▼"}
                  </div>
                </div>

                {/* Expanded detail panel */}
                {isExpanded && (
                  <div style={{
                    borderTop: "1px solid var(--border)",
                    padding: "1rem 1.1rem 1.1rem",
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                    gap: "1rem",
                    background: "var(--bg2)",
                  }}>
                    <DetailStat label="Win Count"        value={model.win_count} />
                    <DetailStat label="Podium Count"     value={model.podium_count} sub="Ranked #1 or #2" />
                    <DetailStat label="Avg Rank Position" value={model.avg_rank != null ? `#${model.avg_rank}` : "—"} />
                    <DetailStat label="Avg Latency"      value={model.avg_latency != null ? `${model.avg_latency}s` : "—"} />
                    <DetailStat label="Avg Confidence"   value={model.avg_confidence != null ? `${model.avg_confidence}/10` : "—"} />
                    <DetailStat label="Consistency Score" value={model.consistency != null ? model.consistency : "—"} sub="1.0 = perfectly consistent" />
                    <DetailStat label="Reviews Received" value={model.reviews_received} />
                    <DetailStat label="Sessions Played"  value={model.sessions_played} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer note */}
        <p style={{ marginTop: "1.25rem", fontSize: "0.72rem", color: "var(--text3)", fontFamily: "var(--mono)" }}>
          Win rate = % of peer reviews where this model ranked #1 · Consistency = inverse of rank variance · Latency = avg response time
        </p>
      </div>
    </div>
  );
}

function DetailStat({ label, value, sub }) {
  return (
    <div>
      <div style={{ fontFamily: "var(--mono)", fontSize: "0.62rem", color: "var(--text3)", letterSpacing: "0.1em", marginBottom: "0.3rem" }}>
        {label.toUpperCase()}
      </div>
      <div style={{ fontFamily: "var(--mono)", fontSize: "1rem", fontWeight: "700", color: "var(--text)" }}>
        {value ?? "—"}
      </div>
      {sub && <div style={{ fontSize: "0.7rem", color: "var(--text3)", marginTop: "0.15rem" }}>{sub}</div>}
    </div>
  );
}

import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  PieChart, Pie, Cell, Legend,
} from "recharts";

const COLORS = ["#00D9FF", "#A78BFA", "#F5C842", "#4ADE80", "#F87171", "#FB923C"];

const CHART_STYLE = {
  fontSize: "0.72rem",
  fontFamily: "'Space Mono', monospace",
};

function SectionLabel({ children }) {
  return (
    <div style={{
      fontFamily: "var(--mono)",
      fontSize: "0.68rem",
      letterSpacing: "0.12em",
      color: "var(--accent)",
      marginBottom: "1rem",
    }}>
      {children}
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div style={{
      background: "var(--bg3)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius)",
      padding: "1.25rem",
    }}>
      <SectionLabel>{title}</SectionLabel>
      {children}
    </div>
  );
}

export default function AnalyticsDashboard({ onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    fetch("http://localhost:8000/analytics")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { console.error(e); setLoading(false); });
  }, []);

  if (loading) return (
    <div className="analytics-screen">
      <div className="loader-text">Loading insights...</div>
    </div>
  );

  if (!data || data.total_sessions === 0) return (
    <div className="analytics-screen">
      <div className="analytics-card">
        <h2 style={{ marginBottom: "0.5rem" }}>No analytics data yet.</h2>
        <p style={{ color: "var(--text2)", marginBottom: "1.5rem" }}>
          Complete a few council sessions to see insights here.
        </p>
        <button className="btn-primary" onClick={onClose}>Back</button>
      </div>
    </div>
  );

  // ── Prepare chart data ─────────────────────────────────
  const usageData = Object.entries(data.model_usage || {}).map(([id, count]) => ({
    name: id.replace(/-/g, " "),
    count,
  }));

  const latencyData = Object.entries(data.model_avg_latency || {}).map(([id, avg]) => ({
    name: id.replace(/-/g, " "),
    latency: avg,
  }));

  const winData = Object.entries(data.win_rate || {}).map(([id, rate]) => ({
    name: id.replace(/-/g, " "),
    winRate: Math.round(rate * 100),
  }));

  const topicData = Object.entries(data.topic_counts || {})
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }));

  const tabs = ["overview", "models", "topics", "history"];

  return (
    <div className="analytics-screen">
      <div className="analytics-card">

        {/* Header */}
        <div className="analytics-header">
          <div className="question-label">COUNCIL ANALYTICS</div>
          <button className="btn-ghost" onClick={onClose}>Close</button>
        </div>

        {/* Stat pills */}
        <div className="analytics-grid" style={{ marginBottom: "1.5rem" }}>
          <div className="stat-card">
            <span className="stat-value">{data.total_sessions}</span>
            <span className="stat-label">Total Sessions</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{data.avg_duration}s</span>
            <span className="stat-label">Avg. Duration</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{Object.keys(data.model_usage || {}).length}</span>
            <span className="stat-label">Models Used</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">
              {Object.entries(data.win_rate || {}).sort((a, b) => b[1] - a[1])[0]?.[0]?.split("-")[0] || "—"}
            </span>
            <span className="stat-label">Top Performer</span>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "0.25rem", marginBottom: "1.5rem", borderBottom: "1px solid var(--border)", paddingBottom: "0.75rem" }}>
          {tabs.map((t) => (
            <button
              key={t}
              className={`tab-btn ${activeTab === t ? "active" : ""}`}
              onClick={() => setActiveTab(t)}
              style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* ── Overview Tab ── */}
        {activeTab === "overview" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>

            <ChartCard title="MODEL USAGE FREQUENCY">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={usageData} style={CHART_STYLE}>
                  <XAxis dataKey="name" tick={{ fill: "var(--text3)", fontSize: 10 }} />
                  <YAxis tick={{ fill: "var(--text3)", fontSize: 10 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 11 }}
                    labelStyle={{ color: "var(--text)" }}
                    itemStyle={{ color: "var(--accent)" }}
                  />
                  <Bar dataKey="count" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="AVG LATENCY PER MODEL (s)">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={latencyData} style={CHART_STYLE}>
                  <XAxis dataKey="name" tick={{ fill: "var(--text3)", fontSize: 10 }} />
                  <YAxis tick={{ fill: "var(--text3)", fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 11 }}
                    labelStyle={{ color: "var(--text)" }}
                    itemStyle={{ color: "var(--accent2)" }}
                  />
                  <Bar dataKey="latency" fill="var(--accent2)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

          </div>
        )}

        {/* ── Models Tab ── */}
        {activeTab === "models" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>

            <ChartCard title="WIN RATE (% of sessions ranked #1)">
              {winData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <RadarChart data={winData}>
                    <PolarGrid stroke="var(--border)" />
                    <PolarAngleAxis dataKey="name" tick={{ fill: "var(--text2)", fontSize: 10 }} />
                    <Radar dataKey="winRate" stroke="#F5C842" fill="#F5C842" fillOpacity={0.25} />
                    <Tooltip
                      contentStyle={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 11 }}
                      formatter={(v) => [`${v}%`, "Win Rate"]}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <p style={{ color: "var(--text3)", fontSize: "0.82rem" }}>
                  Not enough Stage 2 data yet.
                </p>
              )}
            </ChartCard>

            <ChartCard title="MODEL USAGE SHARE">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={usageData}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) => `${name} ${Math.round(percent * 100)}%`}
                    labelLine={false}
                  >
                    {usageData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 11 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* Win rate bar for easier comparison */}
            <ChartCard title="WIN RATE COMPARISON">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={winData} layout="vertical" style={CHART_STYLE}>
                  <XAxis type="number" domain={[0, 100]} tick={{ fill: "var(--text3)", fontSize: 10 }} unit="%" />
                  <YAxis type="category" dataKey="name" tick={{ fill: "var(--text2)", fontSize: 10 }} width={90} />
                  <Tooltip
                    contentStyle={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 11 }}
                    formatter={(v) => [`${v}%`, "Win Rate"]}
                  />
                  <Bar dataKey="winRate" fill="var(--gold)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="AVG LATENCY COMPARISON">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={latencyData} layout="vertical" style={CHART_STYLE}>
                  <XAxis type="number" tick={{ fill: "var(--text3)", fontSize: 10 }} unit="s" />
                  <YAxis type="category" dataKey="name" tick={{ fill: "var(--text2)", fontSize: 10 }} width={90} />
                  <Tooltip
                    contentStyle={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 11 }}
                    formatter={(v) => [`${v}s`, "Avg Latency"]}
                  />
                  <Bar dataKey="latency" fill="var(--accent2)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

          </div>
        )}

        {/* ── Topics Tab ── */}
        {activeTab === "topics" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>

            <ChartCard title="QUESTION TOPIC DISTRIBUTION">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={topicData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    innerRadius={40}
                  >
                    {topicData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend
                    wrapperStyle={{ fontSize: "0.72rem", color: "var(--text2)" }}
                  />
                  <Tooltip
                    contentStyle={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 11 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="TOPIC FREQUENCY">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={topicData} layout="vertical" style={CHART_STYLE}>
                  <XAxis type="number" allowDecimals={false} tick={{ fill: "var(--text3)", fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fill: "var(--text2)", fontSize: 9 }} width={130} />
                  <Tooltip
                    contentStyle={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 11 }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {topicData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

          </div>
        )}

        {/* ── History Tab ── */}
        {activeTab === "history" && (
          <div className="history-section">
            <div className="history-list">
              {(data.history || []).map((s) => (
                <div key={s.qid} className="history-item">
                  <div className="history-main">
                    <span className="history-qid">#{s.qid}</span>
                    <span className="history-question">{s.question}</span>
                  </div>
                  <div className="history-meta">
                    <span className="history-duration">{s.duration}s</span>
                    <span className="history-time">
                      {new Date(s.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

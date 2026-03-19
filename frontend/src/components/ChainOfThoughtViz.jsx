import { useState } from "react";

// ── Parse reasoning text into discrete steps ─────────────
function parseSteps(text) {
  if (!text) return [];

  const steps = [];

  // 1. Try numbered list first: "1. ...", "2. ..."
  const numberedRe = /(?:^|\n)\s*\d+[\.\)]\s+(.+?)(?=\n\s*\d+[\.\)]|\n\n|$)/gs;
  let matches = [...text.matchAll(numberedRe)];
  if (matches.length >= 2) {
    return matches.map((m, i) => ({
      id: i,
      text: m[1].trim().replace(/\s+/g, " "),
      type: "step",
    }));
  }

  // 2. Try bullet points
  const bulletRe = /(?:^|\n)\s*[-*•]\s+(.+?)(?=\n\s*[-*•]|\n\n|$)/gs;
  matches = [...text.matchAll(bulletRe)];
  if (matches.length >= 2) {
    return matches.map((m, i) => ({
      id: i,
      text: m[1].trim().replace(/\s+/g, " "),
      type: "step",
    }));
  }

  // 3. Fall back: split by sentences, group into ~3-sentence chunks
  const sentences = text
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 20);

  const chunkSize = Math.max(2, Math.ceil(sentences.length / 5));
  for (let i = 0; i < sentences.length; i += chunkSize) {
    const chunk = sentences.slice(i, i + chunkSize).join(" ");
    if (chunk.trim()) {
      steps.push({ id: steps.length, text: chunk.trim(), type: "step" });
    }
  }

  return steps.slice(0, 8); // cap at 8 nodes for readability
}

// ── Classify each step by keywords ───────────────────────
function classifyStep(text) {
  const t = text.toLowerCase();
  if (/\b(first|start|begin|initial|understand|what is)\b/.test(t)) return "start";
  if (/\b(therefore|thus|conclude|answer|finally|result|verdict)\b/.test(t)) return "conclusion";
  if (/\b(however|but|caveat|edge case|except|pitfall|careful|warn)\b/.test(t)) return "warning";
  if (/\b(because|since|reason|why|due to)\b/.test(t)) return "reason";
  return "step";
}

const NODE_COLORS = {
  start:      { bg: "rgba(0,217,255,0.12)",  border: "#00D9FF", text: "#00D9FF"  },
  step:       { bg: "rgba(144,144,168,0.08)", border: "#5A5A72", text: "#E8E8F0" },
  reason:     { bg: "rgba(167,139,250,0.1)",  border: "#A78BFA", text: "#A78BFA" },
  warning:    { bg: "rgba(248,113,113,0.1)",  border: "#F87171", text: "#F87171" },
  conclusion: { bg: "rgba(74,222,128,0.1)",   border: "#4ADE80", text: "#4ADE80" },
};

// ── SVG Flowchart for one model ───────────────────────────
function FlowChart({ steps, modelName, accent }) {
  const NODE_W   = 260;
  const NODE_H   = 68;
  const V_GAP    = 36;
  const SVG_W    = NODE_W + 40;
  const totalH   = steps.length * (NODE_H + V_GAP) + 20;
  const cx       = SVG_W / 2;

  function wrapText(text, maxChars = 38) {
    const words = text.split(" ");
    const lines = [];
    let line = "";
    for (const word of words) {
      if ((line + word).length > maxChars) { lines.push(line.trim()); line = ""; }
      line += word + " ";
    }
    if (line.trim()) lines.push(line.trim());
    return lines.slice(0, 3); // max 3 lines per node
  }

  return (
    <svg
      width={SVG_W}
      height={totalH}
      style={{ display: "block", overflow: "visible" }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <marker id={`arrow-${modelName}`} markerWidth="8" markerHeight="8"
          refX="4" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill={accent} opacity="0.5" />
        </marker>
      </defs>

      {steps.map((step, i) => {
        const type   = classifyStep(step.text);
        const colors = NODE_COLORS[type];
        const nodeX  = cx - NODE_W / 2;
        const nodeY  = i * (NODE_H + V_GAP) + 10;
        const lines  = wrapText(step.text);
        const lineH  = 14;
        const textY  = nodeY + NODE_H / 2 - ((lines.length - 1) * lineH) / 2;

        return (
          <g key={step.id}>
            {/* Connector arrow */}
            {i > 0 && (
              <line
                x1={cx}
                y1={nodeY - V_GAP + 4}
                x2={cx}
                y2={nodeY - 2}
                stroke={accent}
                strokeWidth="1.5"
                strokeOpacity="0.4"
                markerEnd={`url(#arrow-${modelName})`}
              />
            )}

            {/* Step number badge */}
            <circle cx={nodeX - 10} cy={nodeY + NODE_H / 2} r={10}
              fill={colors.bg} stroke={colors.border} strokeWidth="1" />
            <text x={nodeX - 10} y={nodeY + NODE_H / 2 + 4}
              textAnchor="middle" fontSize="9" fontFamily="Space Mono, monospace"
              fill={colors.text} fontWeight="700">
              {i + 1}
            </text>

            {/* Node box */}
            <rect
              x={nodeX} y={nodeY}
              width={NODE_W} height={NODE_H}
              rx={6} ry={6}
              fill={colors.bg}
              stroke={i === 0 || i === steps.length - 1 ? colors.border : "#2A2A35"}
              strokeWidth={i === 0 || i === steps.length - 1 ? "1.5" : "1"}
            />

            {/* Node text */}
            {lines.map((line, li) => (
              <text
                key={li}
                x={cx}
                y={textY + li * lineH}
                textAnchor="middle"
                fontSize="10.5"
                fontFamily="DM Sans, sans-serif"
                fill={colors.text}
                opacity="0.9"
              >
                {line}
              </text>
            ))}

            {/* Type label top-right */}
            {type !== "step" && (
              <text
                x={nodeX + NODE_W - 6}
                y={nodeY + 11}
                textAnchor="end"
                fontSize="7.5"
                fontFamily="Space Mono, monospace"
                fill={colors.border}
                opacity="0.7"
              >
                {type.toUpperCase()}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ── Main component ────────────────────────────────────────
export default function ChainOfThoughtViz({ responses }) {
  const [selected, setSelected] = useState(responses?.[0]?.model_id || null);

  if (!responses?.length) return null;

  const PROVIDER_COLORS = {
    groq: "#00D9FF", mistral: "#FF7B54", openai: "#74AA9C",
    anthropic: "#C96442", gemini: "#4285F4", ollama: "#4ADE80",
  };

  const activeModel = responses.find(r => r.model_id === selected);
  const steps       = activeModel ? parseSteps(activeModel.reasoning) : [];

  return (
    <div style={{
      background: "var(--bg2)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius-lg)",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding: "0.85rem 1.1rem",
        borderBottom: "1px solid var(--border)",
        background: "var(--bg3)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: "0.68rem", color: "var(--accent2)", letterSpacing: "0.1em" }}>
          🧩 CHAIN-OF-THOUGHT VISUALISER
        </span>
        <span style={{ fontFamily: "var(--mono)", fontSize: "0.62rem", color: "var(--text3)" }}>
          {steps.length} reasoning steps detected
        </span>
      </div>

      {/* Model selector tabs */}
      <div style={{
        display: "flex",
        gap: "0.25rem",
        padding: "0.75rem 1rem 0",
        borderBottom: "1px solid var(--border)",
        background: "var(--bg2)",
      }}>
        {responses.map(r => {
          const accent = PROVIDER_COLORS[r.provider] || "var(--accent)";
          const isActive = r.model_id === selected;
          return (
            <button
              key={r.model_id}
              onClick={() => setSelected(r.model_id)}
              style={{
                background: isActive ? `${accent}18` : "none",
                border: `1px solid ${isActive ? accent : "transparent"}`,
                borderBottom: "none",
                borderRadius: "6px 6px 0 0",
                color: isActive ? accent : "var(--text3)",
                fontFamily: "var(--mono)",
                fontSize: "0.72rem",
                padding: "0.4rem 0.85rem",
                cursor: "pointer",
                transition: "all 0.15s",
                marginBottom: "-1px",
              }}
            >
              {r.model_name}
            </button>
          );
        })}
      </div>

      {/* Chart area */}
      <div style={{
        padding: "1.5rem",
        display: "flex",
        gap: "2rem",
        alignItems: "flex-start",
        overflowX: "auto",
      }}>
        {/* Flowchart */}
        {steps.length > 0 ? (
          <div style={{ flexShrink: 0 }}>
            <FlowChart
              steps={steps}
              modelName={activeModel?.model_id || "model"}
              accent={PROVIDER_COLORS[activeModel?.provider] || "var(--accent)"}
            />
          </div>
        ) : (
          <div style={{
            color: "var(--text3)", fontFamily: "var(--mono)",
            fontSize: "0.78rem", padding: "2rem",
          }}>
            No reasoning steps found for this model.
          </div>
        )}

        {/* Step legend */}
        {steps.length > 0 && (
          <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", gap: "0.5rem", paddingTop: "0.5rem" }}>
            <div style={{ fontFamily: "var(--mono)", fontSize: "0.62rem", color: "var(--text3)", marginBottom: "0.25rem", letterSpacing: "0.1em" }}>
              NODE TYPES
            </div>
            {Object.entries(NODE_COLORS).map(([type, col]) => (
              <div key={type} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <div style={{
                  width: 12, height: 12, borderRadius: 2,
                  background: col.bg, border: `1.5px solid ${col.border}`,
                }} />
                <span style={{ fontFamily: "var(--mono)", fontSize: "0.65rem", color: col.text }}>
                  {type.toUpperCase()}
                </span>
              </div>
            ))}

            {/* Step count per type */}
            <div style={{
              marginTop: "1rem",
              padding: "0.75rem",
              background: "var(--bg3)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
            }}>
              <div style={{ fontFamily: "var(--mono)", fontSize: "0.6rem", color: "var(--text3)", marginBottom: "0.5rem" }}>
                STEP BREAKDOWN
              </div>
              {Object.entries(
                steps.reduce((acc, s) => {
                  const t = classifyStep(s.text);
                  acc[t] = (acc[t] || 0) + 1;
                  return acc;
                }, {})
              ).map(([type, count]) => (
                <div key={type} style={{ display: "flex", justifyContent: "space-between", gap: "1rem", marginBottom: "0.2rem" }}>
                  <span style={{ fontFamily: "var(--mono)", fontSize: "0.65rem", color: NODE_COLORS[type]?.text || "var(--text2)" }}>
                    {type}
                  </span>
                  <span style={{ fontFamily: "var(--mono)", fontSize: "0.65rem", color: "var(--text3)" }}>
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

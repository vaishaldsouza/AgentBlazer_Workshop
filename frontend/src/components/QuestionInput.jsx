import { useState } from "react";
import { loadTemplates } from "../utils/promptTemplates";
import PromptTemplateLibrary from "./PromptTemplateLibrary";

const SAMPLE_QUESTIONS = [
  "What is recursion in programming?",
  "Explain the CAP theorem in distributed systems.",
  "What is the difference between a process and a thread?",
  "How does a neural network learn?",
  "What is Big O notation and why does it matter?",
];

const PERSONA_PRESETS = [
  { label: "Skeptic",    value: "A critical thinker who challenges assumptions and looks for flaws" },
  { label: "Optimist",   value: "An enthusiastic advocate who highlights benefits and possibilities" },
  { label: "Academic",   value: "A precise scholar who favors citations, nuance, and formal structure" },
  { label: "Pragmatist", value: "A practical engineer focused on real-world trade-offs and implementation" },
  { label: "Devil's Advocate", value: "Always argues the opposite position to stress-test reasoning" },
  { label: "ELI5",       value: "Explain everything as simply as possible, as if to a complete beginner" },
];

export default function QuestionInput({ onSubmit, catalog }) {
  const [value, setValue] = useState("");
  const [selectedCouncil, setSelectedCouncil] = useState(["llama-3.3-70b", "compound-beta"]);
  // Optional: empty string means "auto/default judge" on backend
  const [selectedJudge, setSelectedJudge] = useState("");
  const [personas, setPersonas] = useState({});
  const [showPersonaBuilder, setShowPersonaBuilder] = useState(false);
  const [modelParams, setModelParams] = useState({});
  const [showParams, setShowParams] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState(null);
  const [showTemplates, setShowTemplates] = useState(false);
  // { [model_id]: { temperature: 0.7, max_tokens: 1024, top_p: 1.0, timeout_seconds: 30 } }

  function handleParamChange(id, key, value) {
    setModelParams((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || {}), [key]: value },
    }));
  }

  function getParam(id, key, defaultVal) {
    return modelParams[id]?.[key] ?? defaultVal;
  }

  function toggleCouncilModel(id) {
    setSelectedCouncil((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  }

  function handlePersonaChange(id, persona) {
    setPersonas((prev) => ({ ...prev, [id]: persona }));
  }

  function handleSubmit() {
    if (value.trim() && selectedCouncil.length > 0) {
      // Split model_params and model_timeouts for backend
      const model_params   = {};
      const model_timeouts = {};
      selectedCouncil.forEach((id) => {
        const p = modelParams[id] || {};
        const { timeout_seconds, ...rest } = p;
        if (Object.keys(rest).length) model_params[id]   = rest;
        if (timeout_seconds)          model_timeouts[id] = timeout_seconds;
      });

      onSubmit(value.trim(), {
        council_models: selectedCouncil,
        judge_model: selectedJudge,
        personas: personas,
        model_params,
        model_timeouts,
        custom_prompts: activeTemplate
          ? {
              ...(activeTemplate.stage1 ? { stage1: activeTemplate.stage1 } : {}),
              ...(activeTemplate.stage2 ? { stage2: activeTemplate.stage2 } : {}),
              ...(activeTemplate.stage3 ? { stage3: activeTemplate.stage3 } : {}),
            }
          : {},
      });
    }
  }

  function handleKey(e) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSubmit();
  }

  const modelOptions = Object.values(catalog);

  return (
    <div className="question-screen">
      <div className="question-card">
        <div className="question-header">
          <div className="question-label">1. SUBMIT YOUR QUESTION</div>
          <p className="question-hint">The council will reason independently, critique each other, then deliver a final verdict.</p>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginTop: "0.6rem" }}>
            <button
              className="btn-ghost"
              style={{ fontSize: "0.72rem" }}
              onClick={() => setShowTemplates(true)}
            >
              📋 {activeTemplate ? activeTemplate.name : "Default Prompts"}
            </button>
            {activeTemplate && activeTemplate.id !== "default" && (
              <button
                style={{
                  background: "none", border: "none",
                  fontFamily: "var(--mono)", fontSize: "0.65rem",
                  color: "var(--text3)", cursor: "pointer",
                }}
                onClick={() => setActiveTemplate(null)}
              >
                ✕ reset
              </button>
            )}
          </div>
        </div>

        <textarea
          className="question-textarea"
          placeholder="Ask something challenging..."
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKey}
          rows={3}
          autoFocus
        />

        <div className="config-section">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div className="question-label">2. CONFIGURE THE COUNCIL</div>
            <button
              className="btn-ghost"
              style={{ fontSize: "0.72rem", padding: "0.3rem 0.75rem" }}
              onClick={() => setShowPersonaBuilder((p) => !p)}
            >
              {showPersonaBuilder ? "Hide Personas ↑" : "Assign Personas ↓"}
            </button>
          </div>

          {/* Model selection grid */}
          <div className="model-grid">
            {modelOptions.map((m) => {
              const isSelected = selectedCouncil.includes(m.id);
              const hasPersona = !!personas[m.id];
              return (
                <div key={m.id} className={`model-card ${isSelected ? "selected" : ""}`}>
                  <div className="model-card-header" onClick={() => toggleCouncilModel(m.id)}>
                    <span className="model-name">{m.name}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <span className="model-provider">{m.provider}</span>
                      {isSelected && hasPersona && (
                        <span style={{
                          fontFamily: "var(--mono)",
                          fontSize: "0.58rem",
                          color: "var(--accent2)",
                          border: "1px solid var(--accent2)",
                          padding: "0.1rem 0.3rem",
                          borderRadius: "3px",
                        }}>
                          PERSONA
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Persona preview pill when builder is collapsed */}
                  {isSelected && hasPersona && !showPersonaBuilder && (
                    <div style={{
                      marginTop: "0.5rem",
                      fontSize: "0.75rem",
                      color: "var(--text3)",
                      fontStyle: "italic",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}>
                      "{personas[m.id]}"
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Persona Builder — shown when expanded */}
          {showPersonaBuilder && (
            <div style={{
              marginTop: "1.25rem",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
              borderTop: "1px solid var(--border)",
              paddingTop: "1.25rem",
            }}>
              <p style={{ fontSize: "0.8rem", color: "var(--text3)", marginBottom: "0.25rem" }}>
                Assign a personality or role to each selected model. This shapes how it reasons and responds.
              </p>

              {selectedCouncil.length === 0 && (
                <p style={{ fontSize: "0.8rem", color: "var(--text3)", fontStyle: "italic" }}>
                  Select at least one model above first.
                </p>
              )}

              {selectedCouncil.map((id) => {
                const model = modelOptions.find((m) => m.id === id);
                if (!model) return null;
                return (
                  <div key={id} style={{
                    background: "var(--bg3)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius)",
                    padding: "1rem",
                  }}>
                    {/* Model label */}
                    <div style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "0.75rem",
                    }}>
                      <span style={{ fontFamily: "var(--mono)", fontSize: "0.78rem", color: "var(--accent)" }}>
                        {model.name}
                      </span>
                      {personas[id] && (
                        <button
                          style={{
                            background: "none",
                            border: "none",
                            color: "var(--text3)",
                            fontSize: "0.72rem",
                            cursor: "pointer",
                            fontFamily: "var(--mono)",
                          }}
                          onClick={() => handlePersonaChange(id, "")}
                        >
                          CLEAR
                        </button>
                      )}
                    </div>

                    {/* Preset chips */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "0.75rem" }}>
                      {PERSONA_PRESETS.map((preset) => {
                        const isActive = personas[id] === preset.value;
                        return (
                          <button
                            key={preset.label}
                            onClick={() => handlePersonaChange(id, isActive ? "" : preset.value)}
                            style={{
                              background: isActive ? "rgba(0,217,255,0.1)" : "var(--bg2)",
                              border: `1px solid ${isActive ? "var(--accent)" : "var(--border)"}`,
                              borderRadius: "20px",
                              color: isActive ? "var(--accent)" : "var(--text2)",
                              fontFamily: "var(--mono)",
                              fontSize: "0.68rem",
                              padding: "0.25rem 0.65rem",
                              cursor: "pointer",
                              transition: "all 0.15s",
                            }}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Free-text input */}
                    <input
                      type="text"
                      className="persona-input"
                      placeholder="Or type a custom persona..."
                      value={personas[id] || ""}
                      onChange={(e) => handlePersonaChange(id, e.target.value)}
                      style={{ width: "100%" }}
                    />

                    {/* Parameter tuning */}
                    <div style={{ marginTop: "0.75rem", borderTop: "1px solid var(--border)", paddingTop: "0.75rem" }}>
                      <button
                        onClick={() => setShowParams((p) => !p)}
                        style={{
                          background: "none", border: "none",
                          fontFamily: "var(--mono)", fontSize: "0.65rem",
                          color: "var(--text3)", cursor: "pointer",
                          letterSpacing: "0.08em",
                        }}
                      >
                        {showParams ? "▲ HIDE PARAMS" : "▼ TUNE PARAMETERS"}
                      </button>

                      {showParams && (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem", marginTop: "0.6rem" }}>
                          {[
                            { key: "temperature",    label: "Temperature",   min: 0,   max: 2,    step: 0.1,  default: 0.7,  tip: "0=deterministic, 2=creative" },
                            { key: "max_tokens",     label: "Max Tokens",    min: 64,  max: 4096, step: 64,   default: 1024, tip: "Max response length" },
                            { key: "top_p",          label: "Top P",         min: 0,   max: 1,    step: 0.05, default: 1.0,  tip: "Nucleus sampling" },
                            { key: "timeout_seconds",label: "Timeout (s)",   min: 5,   max: 120,  step: 5,    default: 30,   tip: "Give up after N seconds" },
                          ].map(({ key, label, min, max, step, default: def, tip }) => {
                            const val = getParam(id, key, def);
                            return (
                              <div key={key}>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.2rem" }}>
                                  <span style={{ fontFamily: "var(--mono)", fontSize: "0.62rem", color: "var(--text3)" }}>{label}</span>
                                  <span style={{ fontFamily: "var(--mono)", fontSize: "0.62rem", color: "var(--accent)" }}>{val}</span>
                                </div>
                                <input
                                  type="range"
                                  min={min} max={max} step={step}
                                  value={val}
                                  onChange={(e) => handleParamChange(id, key, key === "max_tokens" || key === "timeout_seconds"
                                    ? parseInt(e.target.value) : parseFloat(e.target.value))}
                                  style={{ width: "100%", accentColor: "var(--accent)" }}
                                  title={tip}
                                />
                                <div style={{ fontFamily: "var(--mono)", fontSize: "0.58rem", color: "var(--text3)", marginTop: "0.1rem" }}>{tip}</div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Live preview */}
                    {personas[id] && (
                      <div style={{
                        marginTop: "0.6rem",
                        padding: "0.5rem 0.75rem",
                        background: "var(--bg)",
                        border: "1px solid var(--border)",
                        borderLeft: "3px solid var(--accent2)",
                        borderRadius: "var(--radius)",
                        fontSize: "0.78rem",
                        color: "var(--text2)",
                        fontStyle: "italic",
                      }}>
                        "{personas[id]}"
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="config-section">
          <div className="question-label">3. SELECT THE JUDGE (OPTIONAL)</div>
          <select 
            className="judge-select"
            value={selectedJudge}
            onChange={(e) => setSelectedJudge(e.target.value)}
          >
            <option value="">Auto (use backend default)</option>
            {modelOptions.map(m => (
              <option key={m.id} value={m.id}>{m.name} ({m.provider})</option>
            ))}
          </select>
        </div>

        <div className="question-actions">
          <span className="question-shortcut">Ctrl + Enter to submit</span>
          <button
            className="btn-primary"
            onClick={handleSubmit}
            disabled={!value.trim() || selectedCouncil.length === 0}
          >
            Convene the Council
          </button>
        </div>

        <div className="sample-questions">
          <div className="sample-label">SAMPLE QUESTIONS</div>
          <div className="sample-list">
            {SAMPLE_QUESTIONS.map((q) => (
              <button
                key={q}
                className="sample-btn"
                onClick={() => setValue(q)}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>

      {showTemplates && (
        <PromptTemplateLibrary
          activeTemplateId={activeTemplate?.id}
          onSelect={(tpl) => setActiveTemplate(tpl?.id === "default" ? null : tpl)}
          onClose={() => setShowTemplates(false)}
        />
      )}
    </div>
  );
}

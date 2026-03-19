import { useState, useEffect } from "react";
import QuestionInput from "./components/QuestionInput";
import StageView from "./components/StageView";
import AnalyticsDashboard from "./components/AnalyticsDashboard";
import SessionBrowser from "./components/SessionBrowser";
import SettingsPanel from "./components/SettingsPanel";
import Leaderboard from "./components/Leaderboard";
import DisagreementHeatmap from "./components/DisagreementHeatmap";
import { buildKeysHeader, hasAnyKey } from "./utils/apiKeys";
import "./index.css";

export default function App() {
  const [stage, setStage] = useState(0);
  const [viewAnalytics, setViewAnalytics] = useState(false);
  const [viewSessions, setViewSessions] = useState(false);
  const [viewSettings, setViewSettings] = useState(false);
  const [viewLeaderboard, setViewLeaderboard] = useState(false);
  const [viewDisagreement, setViewDisagreement] = useState(false);
  const [catalog, setCatalog] = useState({});
  const [question, setQuestion] = useState("");
  const [humanVote, setHumanVote] = useState({ ranked: [], reason: "" });
  const [config, setConfig] = useState({
    council_models: ["llama-3.3-70b", "compound-beta"],
    // Optional: empty string means "auto/default judge" on backend
    judge_model: "",
    personas: {},
  });
  
  const [stage1Data, setStage1Data] = useState(null);
  const [stage2Data, setStage2Data] = useState(null);
  const [stage3Data, setStage3Data] = useState(null);
  const [stage4Data, setStage4Data] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [language, setLanguage] = useState("English");
  const [darkMode, setDarkMode] = useState(() => {
    // Check for saved theme preference or default to light mode
    const saved = localStorage.getItem('llm_council_theme');
    return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  const BASE = "http://localhost:8000";

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('llm_council_theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const toggleTheme = () => {
    setDarkMode(prev => !prev);
  };

  useEffect(() => {
    fetch(`${BASE}/models`)
      .then((r) => r.json())
      .then(setCatalog)
      .catch(console.error);
  }, []);

  async function handleSubmit(q, customConfig) {
    setQuestion(q);
    if (customConfig) setConfig(customConfig);
    setError(null);
    setLoading(true);
    setStage(1);
    
    // Auto-detect language from question
    let detectedLanguage = "English";
    try {
      const keysHeader = buildKeysHeader();
      const langRes = await fetch(`${BASE}/detect-language`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(keysHeader ? { "X-Api-Keys": keysHeader } : {}),
        },
        body: JSON.stringify({ question: q }),
      });
      const langData = await langRes.json();
      detectedLanguage = langData.language || "English";
    } catch (_) {}
    setLanguage(detectedLanguage);
    
    try {
      const keysHeader = buildKeysHeader();
      const headers = { "Content-Type": "application/json" };
      if (keysHeader) headers["X-Api-Keys"] = keysHeader;
      
      const r = await fetch(`${BASE}/stage1`, {
        method: "POST",
        headers,
        body: JSON.stringify({ 
          question: q, 
          council_models: customConfig?.council_models || config.council_models,
          personas: customConfig?.personas || config.personas,
          language: detectedLanguage,
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      setStage1Data(data.responses);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleStage2() {
    setError(null);
    setLoading(true);
    setStage(2);
    try {
      const keysHeader = buildKeysHeader();
      const headers = { "Content-Type": "application/json" };
      if (keysHeader) headers["X-Api-Keys"] = keysHeader;
      
      const r = await fetch(`${BASE}/stage2`, {
        method: "POST",
        headers,
        body: JSON.stringify({ 
          question, 
          responses: stage1Data,
          council_models: config.council_models,
          language,
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      setStage2Data(data.reviews);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleStage3() {
    setError(null);
    setLoading(true);
    setStage(3);
    try {
      const keysHeader = buildKeysHeader();
      const headers = { "Content-Type": "application/json" };
      if (keysHeader) headers["X-Api-Keys"] = keysHeader;
      
      const r = await fetch(`${BASE}/stage3`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          question,
          responses: stage1Data,
          reviews: stage2Data,
          human_vote: humanVote,
          language,
          ...(config.judge_model ? { judge_model: config.judge_model } : {}),
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      setStage3Data({ 
        summary:     data.summary,
        verdict:     data.verdict,
        judge_model: data.judge_model || null,
        question,
        session_id:  data.session_id,
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleStage4(selectedModels) {
    setError(null);
    setStage4Data(null);
    setLoading(true);
    setStage(4);
    try {
      const keysHeader = buildKeysHeader();
      const headers = { "Content-Type": "application/json" };
      if (keysHeader) headers["X-Api-Keys"] = keysHeader;
      
      const r = await fetch(`${BASE}/stage4`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          question,
          verdict: stage3Data?.verdict || "",
          council_models: selectedModels,
          language,
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      setStage4Data(data.refinements);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setStage(0);
    setQuestion("");
    setStage1Data(null);
    setStage2Data(null);
    setStage3Data(null);
    setStage4Data(null);
    setError(null);
    setHumanVote({ ranked: [], reason: "" });
    setLanguage("English");
    setViewLeaderboard(false);
    setViewDisagreement(false);
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div
            className="logo"
            onClick={() => {
              setViewAnalytics(false);
              setViewSessions(false);
              setViewSettings(false);
              setViewLeaderboard(false);
              setViewDisagreement(false);
            }}
            style={{ cursor: "pointer" }}
          >
            <span className="logo-bracket">[</span>
            <span className="logo-text">LLM COUNCIL</span>
            <span className="logo-bracket">]</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <button
              className="btn-ghost"
              onClick={toggleTheme}
              style={{ fontSize: "0.8rem", padding: "0.3rem 0.6rem" }}
              title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            >
              {darkMode ? "☀️" : "🌙"}
            </button>
            <p className="tagline">Multi-model reasoning — step by step</p>
          </div>
        </div>
        {stage > 0 ? (
          <div className="stage-indicator">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className={`stage-pip ${stage >= s ? "active" : ""} ${stage === s && loading ? "pulsing" : ""}`}>
                <span className="pip-num">{s}</span>
                <span className="pip-label">{["Opinions", "Review", "Verdict", "Refine"][s - 1]}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button className="btn-ghost" onClick={() => { setViewAnalytics(false); setViewSessions(!viewSessions); setViewSettings(false); setViewLeaderboard(false); setViewDisagreement(false); }}>
              {viewSessions ? "Back to Input" : "Sessions"}
            </button>
            <button className="btn-ghost" onClick={() => { setViewSessions(false); setViewAnalytics(!viewAnalytics); setViewSettings(false); setViewLeaderboard(false); setViewDisagreement(false); }}>
              {viewAnalytics ? "Back to Input" : "Analytics"}
            </button>
            <button
              className="btn-ghost"
              onClick={() => { setViewSessions(false); setViewAnalytics(false); setViewSettings((p) => !p); setViewLeaderboard(false); setViewDisagreement(false); }}
              style={{ position: "relative" }}
            >
              {viewSettings ? "Close Settings" : "⚙ Settings"}
              {!viewSettings && hasAnyKey() && (
                <span style={{
                  position: "absolute",
                  top: "4px",
                  right: "4px",
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: "var(--green)",
                }} />
              )}
            </button>
            <button
              className="btn-ghost"
              onClick={() => { setViewSessions(false); setViewAnalytics(false); setViewSettings(false); setViewLeaderboard((p) => !p); setViewDisagreement(false); }}
            >
              {viewLeaderboard ? "Back to Input" : "🏆 Leaderboard"}
            </button>
            <button
              className="btn-ghost"
              onClick={() => { setViewSessions(false); setViewAnalytics(false); setViewSettings(false); setViewLeaderboard(false); setViewDisagreement((p) => !p); }}
            >
              {viewDisagreement ? "Back to Input" : "🔀 Heatmap"}
            </button>
          </div>
        )}
      </header>

      <main className="main">
        {error && (
          <div className="error-banner">
            <span className="error-tag">ERROR</span> {error}
          </div>
        )}
        
        {viewAnalytics ? (
          <AnalyticsDashboard onClose={() => setViewAnalytics(false)} />
        ) : viewSessions ? (
          <SessionBrowser onClose={() => setViewSessions(false)} />
        ) : viewSettings ? (
          <SettingsPanel onClose={() => setViewSettings(false)} />
        ) : viewLeaderboard ? (
          <Leaderboard onClose={() => setViewLeaderboard(false)} />
        ) : viewDisagreement ? (
          <DisagreementHeatmap onClose={() => setViewDisagreement(false)} />
        ) : (
          <>
            {stage === 0 && <QuestionInput onSubmit={handleSubmit} catalog={catalog} />}
            {stage >= 1 && (
              <StageView
                stage={stage}
                loading={loading}
                question={question}
                stage1Data={stage1Data}
                stage2Data={stage2Data}
                stage3Data={stage3Data}
                stage4Data={stage4Data}
                catalog={catalog}
                humanVote={humanVote}
                onVoteChange={setHumanVote}
                onStage4={handleStage4}
                detectedLanguage={language}
                onNext={stage === 1 && !loading && stage1Data ? handleStage2
                      : stage === 2 && !loading && stage2Data ? handleStage3
                      : null}
                onReset={handleReset}
              />
            )}
          </>
        )}
      </main>

      <footer className="footer">
        <span>AgentBlazer Workshop</span>
        <span className="footer-sep">·</span>
        <span>Open Model Abstraction Layer</span>
      </footer>
    </div>
  );
}

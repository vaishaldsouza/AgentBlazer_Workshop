import { useState, useEffect } from "react";
import { PROVIDERS, loadKeys, saveKeys, clearKeys } from "../utils/apiKeys";

const BASE = "http://localhost:8000";

export default function SettingsPanel({ onClose }) {
  const [keys, setKeys]         = useState({});
  const [saved, setSaved]       = useState(false);
  const [visible, setVisible]   = useState({});
  const [status, setStatus]     = useState(null);  // key health from backend
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    setKeys(loadKeys());
  }, []);

  function handleChange(provider, value) {
    setKeys((prev) => ({ ...prev, [provider]: value }));
    setSaved(false);
  }

  function handleSave() {
    saveKeys(keys);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleClear() {
    clearKeys();
    setKeys({});
    setStatus(null);
    setSaved(false);
  }

  function toggleVisible(provider) {
    setVisible((prev) => ({ ...prev, [provider]: !prev[provider] }));
  }

  async function checkKeys() {
    setChecking(true);
    setStatus(null);
    try {
      const filtered = Object.fromEntries(
        Object.entries(keys).filter(([, v]) => v && v.trim())
      );
      const header = Object.keys(filtered).length > 0 ? JSON.stringify(filtered) : null;
      const res = await fetch(`${BASE}/health/keys`, {
        headers: header ? { "X-Api-Keys": header } : {},
      });
      const data = await res.json();
      setStatus(data);
    } catch (e) {
      setStatus({ error: e.message });
    } finally {
      setChecking(false);
    }
  }

  const anyKey = Object.values(keys).some((v) => v && v.trim());

  return (
    <div style={{ maxWidth: "640px", margin: "0 auto" }}>
      <div style={{
        background: "var(--bg2)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: "2rem",
      }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
          <div className="question-label">🔐 API KEY SETTINGS</div>
          <button className="btn-ghost" onClick={onClose}>Close</button>
        </div>
        <p style={{ fontSize: "0.82rem", color: "var(--text3)", marginBottom: "1.75rem", lineHeight: "1.6" }}>
          Keys are stored only in your browser's localStorage — never sent to any server except the provider's own API.
          If a key is set here it overrides the server's <code style={{ color: "var(--accent)", fontSize: "0.78rem" }}>.env</code>.
        </p>

        {/* Key inputs */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.5rem" }}>
          {PROVIDERS.map((p) => {
            const val        = keys[p.id] || "";
            const isVisible  = visible[p.id];
            const provStatus = status?.[p.id];
            const sourceColor = provStatus?.source === "user" ? "var(--green)"
                              : provStatus?.source === "env"  ? "var(--accent2)"
                              : "var(--red)";
            const sourceLabel = provStatus?.source === "user" ? "YOUR KEY"
                              : provStatus?.source === "env"  ? "SERVER .ENV"
                              : "NO KEY";

            return (
              <div key={p.id} style={{
                background: "var(--bg3)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                padding: "0.9rem 1rem",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                    <span style={{ fontFamily: "var(--mono)", fontSize: "0.78rem", color: "var(--text)", fontWeight: "700" }}>
                      {p.label}
                    </span>
                    {provStatus && (
                      <span style={{
                        fontFamily: "var(--mono)",
                        fontSize: "0.6rem",
                        color: sourceColor,
                        border: `1px solid ${sourceColor}`,
                        padding: "0.1rem 0.35rem",
                        borderRadius: "3px",
                      }}>
                        {sourceLabel}
                      </span>
                    )}
                  </div>
                  <a
                    href={p.docsUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontFamily: "var(--mono)", fontSize: "0.65rem", color: "var(--text3)", textDecoration: "none" }}
                  >
                    Get key ↗
                  </a>
                </div>

                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <input
                    type={isVisible ? "text" : "password"}
                    value={val}
                    onChange={(e) => handleChange(p.id, e.target.value)}
                    placeholder={val ? "••••••••••••" : p.placeholder}
                    autoComplete="off"
                    spellCheck={false}
                    style={{
                      flex: 1,
                      background: "var(--bg)",
                      border: `1px solid ${val ? "var(--accent)" : "var(--border)"}`,
                      borderRadius: "var(--radius)",
                      color: "var(--text)",
                      fontFamily: "var(--mono)",
                      fontSize: "0.78rem",
                      padding: "0.5rem 0.75rem",
                      outline: "none",
                    }}
                  />
                  <button
                    onClick={() => toggleVisible(p.id)}
                    style={{
                      background: "none",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius)",
                      color: "var(--text3)",
                      fontFamily: "var(--mono)",
                      fontSize: "0.7rem",
                      padding: "0.45rem 0.6rem",
                      cursor: "pointer",
                    }}
                    title={isVisible ? "Hide" : "Show"}
                  >
                    {isVisible ? "HIDE" : "SHOW"}
                  </button>
                  {val && (
                    <button
                      onClick={() => handleChange(p.id, "")}
                      style={{
                        background: "none",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius)",
                        color: "var(--red)",
                        fontFamily: "var(--mono)",
                        fontSize: "0.7rem",
                        padding: "0.45rem 0.6rem",
                        cursor: "pointer",
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
          <button className="btn-primary" onClick={handleSave}>
            {saved ? "✓ Saved" : "Save Keys"}
          </button>
          <button
            className="btn-ghost"
            onClick={checkKeys}
            disabled={checking}
          >
            {checking ? "Checking..." : "Test Keys"}
          </button>
          {anyKey && (
            <button
              className="btn-ghost"
              onClick={handleClear}
              style={{ color: "var(--red)", borderColor: "var(--red)" }}
            >
              Clear All
            </button>
          )}
          {saved && (
            <span style={{ fontFamily: "var(--mono)", fontSize: "0.72rem", color: "var(--green)" }}>
              Keys saved to localStorage ✓
            </span>
          )}
        </div>

        {/* Status error */}
        {status?.error && (
          <div className="error-banner" style={{ marginTop: "1rem" }}>
            <span className="error-tag">ERROR</span> {status.error}
          </div>
        )}

        {/* Info note */}
        <div style={{
          marginTop: "1.5rem",
          padding: "0.75rem 1rem",
          background: "var(--bg3)",
          border: "1px solid var(--border)",
          borderLeft: "3px solid var(--accent)",
          borderRadius: "var(--radius)",
          fontSize: "0.78rem",
          color: "var(--text3)",
          lineHeight: "1.6",
        }}>
          <strong style={{ color: "var(--accent)" }}>How it works:</strong> Your keys are sent as a request header to the local backend only.
          The backend uses them for that request and never stores them. Server <code>.env</code> keys are used as fallback if no browser key is set for a provider.
        </div>
      </div>
    </div>
  );
}

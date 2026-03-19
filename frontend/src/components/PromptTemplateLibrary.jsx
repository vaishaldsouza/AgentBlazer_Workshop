import { useState } from "react";
import { loadTemplates, saveTemplate, deleteTemplate, generateId } from "../utils/promptTemplates";

const STAGES = ["stage1", "stage2", "stage3"];
const STAGE_LABELS = { stage1: "Stage 1 — Opinions", stage2: "Stage 2 — Review", stage3: "Stage 3 — Verdict" };

export default function PromptTemplateLibrary({ activeTemplateId, onSelect, onClose }) {
  const [templates, setTemplates]     = useState(loadTemplates);
  const [editing, setEditing]         = useState(null);   // template being edited
  const [creating, setCreating]       = useState(false);
  const [previewStage, setPreviewStage] = useState("stage1");

  function refresh() { setTemplates(loadTemplates()); }

  function handleSelect(tpl) {
    onSelect(tpl);
    onClose();
  }

  function handleDelete(id) {
    deleteTemplate(id);
    refresh();
    if (activeTemplateId === id) onSelect(null);
  }

  function handleSave(tpl) {
    saveTemplate(tpl);
    setEditing(null);
    setCreating(false);
    refresh();
  }

  const selected = templates.find(t => t.id === activeTemplateId);

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(0,0,0,0.7)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1000,
      padding: "1rem",
    }}>
      <div style={{
        background: "var(--bg2)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        width: "100%", maxWidth: "820px",
        maxHeight: "85vh",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          padding: "1.1rem 1.5rem",
          borderBottom: "1px solid var(--border)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          background: "var(--bg3)", flexShrink: 0,
        }}>
          <div className="question-label">📋 PROMPT TEMPLATE LIBRARY</div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              className="btn-ghost"
              style={{ fontSize: "0.72rem" }}
              onClick={() => { setCreating(true); setEditing(null); }}
            >
              + New Template
            </button>
            <button className="btn-ghost" onClick={onClose}>Close</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

          {/* Template list */}
          <div style={{
            width: "240px", flexShrink: 0,
            borderRight: "1px solid var(--border)",
            overflowY: "auto",
            padding: "0.75rem",
            display: "flex", flexDirection: "column", gap: "0.4rem",
          }}>
            {templates.map(tpl => {
              const isActive = tpl.id === activeTemplateId;
              return (
                <div
                  key={tpl.id}
                  onClick={() => setEditing(tpl)}
                  style={{
                    padding: "0.7rem 0.85rem",
                    borderRadius: "var(--radius)",
                    border: `1px solid ${isActive ? "var(--accent)" : "var(--border)"}`,
                    background: isActive ? "rgba(0,217,255,0.06)" : "var(--bg3)",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontFamily: "var(--mono)", fontSize: "0.78rem", color: isActive ? "var(--accent)" : "var(--text)", fontWeight: isActive ? "700" : "400" }}>
                      {tpl.name}
                    </span>
                    {tpl.builtin && (
                      <span style={{ fontFamily: "var(--mono)", fontSize: "0.55rem", color: "var(--text3)", border: "1px solid var(--border)", padding: "0.1rem 0.3rem", borderRadius: "2px" }}>
                        BUILT-IN
                      </span>
                    )}
                  </div>
                  {tpl.description && (
                    <div style={{ fontSize: "0.72rem", color: "var(--text3)", marginTop: "0.2rem" }}>
                      {tpl.description}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Detail / edit panel */}
          <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem" }}>
            {creating && (
              <TemplateEditor
                template={{ id: generateId(), name: "", description: "", stage1: "", stage2: "", stage3: "", builtin: false }}
                onSave={handleSave}
                onCancel={() => setCreating(false)}
              />
            )}

            {!creating && editing && !editing.builtin && (
              <TemplateEditor
                template={editing}
                onSave={handleSave}
                onCancel={() => setEditing(null)}
                onDelete={() => { handleDelete(editing.id); setEditing(null); }}
              />
            )}

            {!creating && editing && editing.builtin && (
              <TemplatePreview
                template={editing}
                previewStage={previewStage}
                setPreviewStage={setPreviewStage}
                isActive={editing.id === activeTemplateId}
                onSelect={() => handleSelect(editing)}
                onClone={() => {
                  const cloned = {
                    ...editing,
                    id:      generateId(),
                    name:    `${editing.name} (copy)`,
                    builtin: false,
                  };
                  setCreating(false);
                  setEditing(cloned);
                }}
              />
            )}

            {!creating && !editing && (
              <div style={{ color: "var(--text3)", fontFamily: "var(--mono)", fontSize: "0.78rem", padding: "2rem", textAlign: "center" }}>
                Select a template to preview or edit
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TemplatePreview({ template, previewStage, setPreviewStage, isActive, onSelect, onClone }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontWeight: "600", fontSize: "1rem", color: "var(--text)", marginBottom: "0.2rem" }}>{template.name}</div>
          <div style={{ fontSize: "0.78rem", color: "var(--text3)" }}>{template.description}</div>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className="btn-ghost" style={{ fontSize: "0.72rem" }} onClick={onClone}>Clone & Edit</button>
          <button
            className="btn-primary"
            style={{ fontSize: "0.72rem", background: isActive ? "var(--green)" : undefined }}
            onClick={onSelect}
          >
            {isActive ? "✓ Active" : "Use This"}
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: "0.25rem" }}>
        {STAGES.map(s => (
          <button
            key={s}
            className={`tab-btn ${previewStage === s ? "active" : ""}`}
            onClick={() => setPreviewStage(s)}
            style={{ fontSize: "0.68rem" }}
          >
            {STAGE_LABELS[s]}
          </button>
        ))}
      </div>

      <div style={{
        background: "var(--bg3)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: "1rem",
        fontFamily: "var(--mono)",
        fontSize: "0.75rem",
        color: "var(--text2)",
        whiteSpace: "pre-wrap",
        lineHeight: "1.7",
        maxHeight: "380px",
        overflowY: "auto",
      }}>
        {template[previewStage] || <span style={{ color: "var(--text3)", fontStyle: "italic" }}>Uses server default prompt</span>}
      </div>
    </div>
  );
}

function TemplateEditor({ template, onSave, onCancel, onDelete }) {
  const [form, setForm] = useState({ ...template });
  const [tab,  setTab]  = useState("stage1");

  function update(key, val) { setForm(p => ({ ...p, [key]: val })); }

  function handleSave() {
    if (!form.name.trim()) return;
    onSave({ ...form, builtin: false });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ display: "flex", gap: "0.75rem" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "var(--mono)", fontSize: "0.62rem", color: "var(--text3)", marginBottom: "0.3rem" }}>TEMPLATE NAME</div>
          <input
            value={form.name}
            onChange={e => update("name", e.target.value)}
            placeholder="e.g. Medical Expert Panel"
            style={{
              width: "100%", background: "var(--bg3)", border: "1px solid var(--border)",
              borderRadius: "var(--radius)", color: "var(--text)", fontFamily: "var(--sans)",
              fontSize: "0.88rem", padding: "0.5rem 0.75rem", outline: "none",
            }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "var(--mono)", fontSize: "0.62rem", color: "var(--text3)", marginBottom: "0.3rem" }}>DESCRIPTION</div>
          <input
            value={form.description || ""}
            onChange={e => update("description", e.target.value)}
            placeholder="Short description"
            style={{
              width: "100%", background: "var(--bg3)", border: "1px solid var(--border)",
              borderRadius: "var(--radius)", color: "var(--text)", fontFamily: "var(--sans)",
              fontSize: "0.88rem", padding: "0.5rem 0.75rem", outline: "none",
            }}
          />
        </div>
      </div>

      <div style={{ display: "flex", gap: "0.25rem" }}>
        {STAGES.map(s => (
          <button key={s} className={`tab-btn ${tab === s ? "active" : ""}`}
            onClick={() => setTab(s)} style={{ fontSize: "0.68rem" }}>
            {STAGE_LABELS[s]}
          </button>
        ))}
      </div>

      <div>
        <div style={{ fontFamily: "var(--mono)", fontSize: "0.62rem", color: "var(--text3)", marginBottom: "0.3rem" }}>
          PROMPT (leave blank to use server default · use {"{persona}"} in Stage 1)
        </div>
        <textarea
          value={form[tab] || ""}
          onChange={e => update(tab, e.target.value)}
          rows={14}
          placeholder={`Custom ${STAGE_LABELS[tab]} prompt...`}
          style={{
            width: "100%", background: "var(--bg3)", border: "1px solid var(--border)",
            borderRadius: "var(--radius)", color: "var(--text)", fontFamily: "var(--mono)",
            fontSize: "0.75rem", padding: "0.75rem", outline: "none",
            resize: "vertical", lineHeight: "1.6",
          }}
        />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className="btn-primary" onClick={handleSave} disabled={!form.name.trim()}>Save Template</button>
          <button className="btn-ghost" onClick={onCancel}>Cancel</button>
        </div>
        {onDelete && (
          <button
            onClick={onDelete}
            style={{
              background: "none", border: "1px solid var(--red)",
              borderRadius: "var(--radius)", color: "var(--red)",
              fontFamily: "var(--mono)", fontSize: "0.72rem",
              padding: "0.5rem 0.85rem", cursor: "pointer",
            }}
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

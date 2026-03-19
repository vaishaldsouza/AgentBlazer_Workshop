import { useState, useEffect } from "react";
import { getComments, addComment, deleteComment, countComments } from "../utils/comments";

export function CommentBadge({ commentKey }) {
  const count = countComments(commentKey);
  if (!count) return null;
  return (
    <span style={{
      fontFamily: "var(--mono)", fontSize: "0.58rem",
      background: "rgba(245,200,66,0.15)",
      color: "var(--gold)",
      border: "1px solid var(--gold)",
      borderRadius: "10px",
      padding: "0.05rem 0.4rem",
      marginLeft: "0.35rem",
    }}>
      {count} 💬
    </span>
  );
}

export default function CommentThread({ commentKey, label = "section" }) {
  const [open,     setOpen]     = useState(false);
  const [comments, setComments] = useState([]);
  const [draft,    setDraft]    = useState("");
  const [count,    setCount]    = useState(0);

  useEffect(() => {
    const c = getComments(commentKey);
    setComments(c);
    setCount(c.length);
  }, [commentKey, open]);

  function handleAdd() {
    if (!draft.trim()) return;
    const updated = addComment(commentKey, draft);
    setComments(updated);
    setCount(updated.length);
    setDraft("");
  }

  function handleDelete(id) {
    const updated = deleteComment(commentKey, id);
    setComments(updated);
    setCount(updated.length);
  }

  return (
    <div style={{ marginTop: "0.6rem" }}>
      {/* Toggle button */}
      <button
        onClick={() => setOpen(p => !p)}
        style={{
          background: "none",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          color: count > 0 ? "var(--gold)" : "var(--text3)",
          fontFamily: "var(--mono)",
          fontSize: "0.62rem",
          padding: "0.2rem 0.6rem",
          cursor: "pointer",
          letterSpacing: "0.06em",
          transition: "all 0.15s",
        }}
      >
        💬 {count > 0 ? `${count} comment${count > 1 ? "s" : ""}` : `Add comment`}
      </button>

      {open && (
        <div style={{
          marginTop: "0.5rem",
          background: "var(--bg)",
          border: "1px solid var(--border)",
          borderLeft: "3px solid var(--gold)",
          borderRadius: "var(--radius)",
          padding: "0.75rem",
        }}>
          {/* Existing comments */}
          {comments.length > 0 && (
            <div style={{
              display: "flex", flexDirection: "column", gap: "0.5rem",
              marginBottom: "0.75rem",
            }}>
              {comments.map(c => (
                <div key={c.id} style={{
                  display: "flex", justifyContent: "space-between",
                  alignItems: "flex-start", gap: "0.5rem",
                }}>
                  <div>
                    <div style={{ fontSize: "0.82rem", color: "var(--text2)", lineHeight: "1.5" }}>
                      {c.text}
                    </div>
                    <div style={{ fontFamily: "var(--mono)", fontSize: "0.6rem", color: "var(--text3)", marginTop: "0.2rem" }}>
                      {new Date(c.ts).toLocaleString()}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(c.id)}
                    style={{
                      background: "none", border: "none",
                      color: "var(--text3)", cursor: "pointer",
                      fontSize: "0.72rem", flexShrink: 0,
                      padding: "0.1rem 0.3rem",
                    }}
                    title="Delete"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* New comment input */}
          <div style={{ display: "flex", gap: "0.4rem" }}>
            <input
              type="text"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAdd()}
              placeholder={`Annotate this ${label}...`}
              style={{
                flex: 1,
                background: "var(--bg2)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                color: "var(--text)",
                fontFamily: "var(--sans)",
                fontSize: "0.78rem",
                padding: "0.35rem 0.6rem",
                outline: "none",
              }}
            />
            <button
              className="btn-primary"
              onClick={handleAdd}
              disabled={!draft.trim()}
              style={{ fontSize: "0.72rem", padding: "0.35rem 0.75rem" }}
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

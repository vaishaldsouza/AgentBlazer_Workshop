import ReactMarkdown from "react-markdown";
import CommentThread, { CommentBadge } from "./CommentThread";

const PROVIDER_COLORS = {
  groq:      "#00D9FF",
  mistral:   "#FF7B54",
  openai:    "#74AA9C",
  anthropic: "#C96442",
  gemini:    "#4285F4",
  ollama:    "#4ADE80",
};

function getAccent(modelId, catalog) {
  const provider = catalog?.[modelId]?.provider || "groq";
  return PROVIDER_COLORS[provider] || "#4ADE80";
}

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

export default function Stage2View({ reviews, streamingTexts, streamingActive, catalog, sessionKey = "" }) {
  const displayModels = reviews
    ? reviews
    : Object.keys(streamingTexts || {}).map((id) => ({
        reviewer_id:   id,
        reviewer_name: catalog?.[id]?.name || id,
        raw:           streamingTexts[id] || "",
        _streaming:    true,
      }));

  return (
    <div className="response-grid">
      {displayModels.map((review) => {
        const accent = getAccent(review.reviewer_id, catalog);
        const isLive = streamingActive?.has(review.reviewer_id);
        const rawText = review._streaming ? (streamingTexts?.[review.reviewer_id] || "") : null;

        const critique = review._streaming
          ? extractSection(rawText, "## Critique", "## Ranking")
          : review.critique;
        const ranking = review._streaming
          ? extractSection(rawText, "## Ranking", null)
          : review.ranking;

        return (
          <div key={review.reviewer_id} className="response-card" style={{ "--accent": accent }}>
            <div className="card-header">
              <div className="model-identity">
                <span className="model-provider-tag" style={{ color: accent }}>REVIEWER</span>
                <span className="model-name">{review.reviewer_name}</span>
                {isLive && <span className="streaming-badge">LIVE</span>}
              </div>
            </div>
            <div className="card-body">
              <div className="review-section">
                <div className="review-section-label">CRITIQUE</div>
                <div className="review-content">
                  <ReactMarkdown>{critique}</ReactMarkdown>
                  {isLive && !ranking && <TypingCursor />}
                </div>
                {!isLive && sessionKey && (
                  <CommentThread
                    commentKey={`${sessionKey}:s2:${review.reviewer_id}:critique`}
                    label="critique"
                  />
                )}
              </div>
              <div className="review-section">
                <div className="review-section-label">RANKING</div>
                <div className="review-content ranking-content">
                  <ReactMarkdown>{ranking}</ReactMarkdown>
                  {isLive && ranking && <TypingCursor />}
                </div>
                {!isLive && sessionKey && (
                  <CommentThread
                    commentKey={`${sessionKey}:s2:${review.reviewer_id}:ranking`}
                    label="ranking"
                  />
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
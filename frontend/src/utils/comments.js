const KEY = "llm_council_comments";

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}"); }
  catch { return {}; }
}

function save(data) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

/**
 * commentKey: e.g. "sessionId:stage1:modelId:reasoning"
 */
export function getComments(commentKey) {
  return load()[commentKey] || [];
}

export function addComment(commentKey, text) {
  const all = load();
  if (!all[commentKey]) all[commentKey] = [];
  all[commentKey].push({
    id:   `c_${Date.now()}`,
    text: text.trim(),
    ts:   new Date().toISOString(),
  });
  save(all);
  return all[commentKey];
}

export function deleteComment(commentKey, commentId) {
  const all = load();
  if (all[commentKey]) {
    all[commentKey] = all[commentKey].filter(c => c.id !== commentId);
    if (!all[commentKey].length) delete all[commentKey];
    save(all);
  }
  return all[commentKey] || [];
}

export function countComments(commentKey) {
  return (load()[commentKey] || []).length;
}

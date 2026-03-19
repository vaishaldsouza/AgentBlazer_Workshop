const STORAGE_KEY = "llm_council_api_keys";

const PROVIDERS = [
  { id: "groq",      label: "Groq",      placeholder: "gsk_...",   docsUrl: "https://console.groq.com/keys" },
  { id: "mistral",   label: "Mistral",   placeholder: "...",        docsUrl: "https://console.mistral.ai/api-keys" },
  { id: "openai",    label: "OpenAI",    placeholder: "sk-...",     docsUrl: "https://platform.openai.com/api-keys" },
  { id: "gemini",    label: "Gemini",    placeholder: "AIza...",    docsUrl: "https://aistudio.google.com/app/apikey" },
];

export { PROVIDERS };

export function loadKeys() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveKeys(keys) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
}

export function clearKeys() {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Build the X-Api-Keys header value from stored keys.
 * Only includes non-empty keys.
 */
export function buildKeysHeader() {
  const keys = loadKeys();
  const filtered = Object.fromEntries(
    Object.entries(keys).filter(([, v]) => v && v.trim())
  );
  return Object.keys(filtered).length > 0 ? JSON.stringify(filtered) : null;
}

/**
 * Returns true if at least one key is stored.
 */
export function hasAnyKey() {
  const keys = loadKeys();
  return Object.values(keys).some((v) => v && v.trim());
}

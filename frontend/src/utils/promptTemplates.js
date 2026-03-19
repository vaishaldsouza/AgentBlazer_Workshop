const STORAGE_KEY = "llm_council_prompt_templates";

export const BUILTIN_TEMPLATES = [
  {
    id:      "default",
    name:    "Default",
    builtin: true,
    stage1:  null,   // null = use server default
    stage2:  null,
    stage3:  null,
    description: "Standard council prompts",
  },
  {
    id:      "legal",
    name:    "Legal Analysis",
    builtin: true,
    description: "Structured legal reasoning with citations",
    stage1: `You are a legal expert council member.
Persona: {persona}

Analyse the question with legal rigour.

## Reasoning
Identify the legal domain, relevant principles, statutes, or precedents. Consider jurisdiction, exceptions, and edge cases. Minimum 150 words.

## Answer
Your legal analysis with clear conclusions and any important caveats.

## Confidence
SCORE: <n>/10 — <one sentence>`,
    stage2: `You are a senior legal reviewer assessing your peers' analyses.

## Critique
Evaluate accuracy of legal reasoning, citation quality, and identification of edge cases.

## Ranking
Rank from strongest to weakest legal argument and explain why.`,
    stage3: null,
  },
  {
    id:      "medical",
    name:    "Medical Reasoning",
    builtin: true,
    description: "Clinical reasoning with evidence grading",
    stage1: `You are a clinical expert council member.
Persona: {persona}

Approach the question with evidence-based medical reasoning.

## Reasoning
Identify the clinical question, relevant pathophysiology, evidence base (RCTs, guidelines), and differential considerations. Minimum 150 words.

## Answer
Your clinical recommendation with evidence grade (Level A/B/C) and contraindications.

## Confidence
SCORE: <n>/10 — <one sentence>`,
    stage2: null,
    stage3: null,
  },
  {
    id:      "code_review",
    name:    "Code Review",
    builtin: true,
    description: "Structured code analysis with security and performance focus",
    stage1: `You are a senior software engineer council member.
Persona: {persona}

Review the code or engineering question thoroughly.

## Reasoning
Analyse correctness, performance, security implications, edge cases, and maintainability. Consider language idioms and best practices. Minimum 150 words.

## Answer
Your recommendation with concrete code examples where relevant. Flag any bugs, vulnerabilities, or anti-patterns explicitly.

## Confidence
SCORE: <n>/10 — <one sentence>`,
    stage2: null,
    stage3: null,
  },
  {
    id:      "debate",
    name:    "Devil's Debate",
    builtin: true,
    description: "Each model takes an opposing stance",
    stage1: `You are a debate council member assigned a position.
Persona: {persona}

Argue your assigned position forcefully, even if you personally disagree.

## Reasoning
Steelman your position. Find the strongest possible arguments. Anticipate counter-arguments and pre-empt them. Minimum 150 words.

## Answer
Your most persuasive argument for the position.

## Confidence
SCORE: <n>/10 — <one sentence>`,
    stage2: null,
    stage3: null,
  },
];

export function loadTemplates() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const user = raw ? JSON.parse(raw) : [];
    return [...BUILTIN_TEMPLATES, ...user];
  } catch {
    return BUILTIN_TEMPLATES;
  }
}

export function saveTemplate(template) {
  try {
    const raw  = localStorage.getItem(STORAGE_KEY);
    const user = raw ? JSON.parse(raw) : [];
    const existing = user.findIndex(t => t.id === template.id);
    if (existing >= 0) user[existing] = template;
    else user.push(template);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  } catch {}
}

export function deleteTemplate(id) {
  try {
    const raw  = localStorage.getItem(STORAGE_KEY);
    const user = raw ? JSON.parse(raw) : [];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user.filter(t => t.id !== id)));
  } catch {}
}

export function generateId() {
  return `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

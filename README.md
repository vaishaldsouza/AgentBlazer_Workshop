# LLM Council — AgentBlazer Workshop

A multi-model AI deliberation platform where multiple large language models collaborate to answer questions. Each model reasons independently, critiques its peers, and a neutral judge synthesises a final verdict — with 21 additional features including real-time streaming, analytics, export, leaderboard, A/B testing, trends, and more.

---

## How It Works

| Stage | What Happens |
|-------|-------------|
| **1 — Opinions** | Selected council models each receive your question independently and show step-by-step reasoning before answering |
| **2 — Peer Review** | Each model reads the others' responses (anonymised) and critiques reasoning quality with a ranking |
| **3 — Verdict** | A judge model synthesises the best reasoning and delivers a final authoritative answer |
| **4 — Refinement** *(optional)* | Selected models reflect on the verdict and push the thinking further |

---

## Features

###  Real-time Streaming
Tokens appear live with a blinking `▋` cursor and a `LIVE` badge as each model generates. All council models stream in parallel via Server-Sent Events — no waiting for one to finish before another starts. Stages 1, 2, 3, and 4 all stream simultaneously.

###  Richer Analytics Dashboard
4-tab analytics dashboard with recharts visualisations:
- **Overview** — Model usage frequency bar chart + avg latency per model
- **Models** — Win rate radar chart, usage share pie chart, win rate comparison bars, latency comparison bars
- **Topics** — Question topic clustering pie chart + topic frequency bars (algorithms, systems, ML/AI, web/network, programming)
- **History** — Searchable session history table with timestamps and durations

###  Session History & Replay
Full session browser with search by question text. Click any past session to re-read all 3 stages in read-only tabs — Opinions, Review, Verdict — without re-running the council.

###  Persona Builder UI
Collapsible persona panel per selected model with:
- 6 preset chips: Skeptic, Optimist, Academic, Pragmatist, Devil's Advocate, ELI5
- Free-text custom persona input
- Live preview of the persona that will be sent
- `PERSONA` badge on model cards when a persona is active

###  Export Results
Download completed sessions after Stage 3:
- **Markdown** — Full `.md` file with all 3 stages, reasoning, answers, critiques, and verdict
- **PDF** — Styled multi-page document with dark cover header, colour-coded section headings (cyan for Stage 1, purple for Stage 3), and automatic page breaks

###  Human Vote on Stage 2
After Stage 1 completes, rank the model responses yourself in order of preference before Stage 3 runs. Optionally explain your reasoning. Your ranking is injected into the judge prompt as a `--- Human Preference ---` block, influencing the final verdict.

###  Model Confidence Score
Stage 1 prompt extended to include a `## Confidence` section. Each model rates its own confidence 1–10 with a one-sentence reason. Displayed as:
- A colour-coded badge in the card header (🟢 green ≥8, 🟡 amber ≥5, 🔴 red <5)
- A full panel with animated score bar, dimension breakdown, and the model's explanation in the Confidence tab

###  Iterative Refinement (Stage 4)
After Stage 3, a launcher panel lets you select which models to send the verdict back to. Each model reflects on and refines the verdict with a `## Reflection` and `## Refinement` section. Streams in parallel with live cards and confidence badges.

###  Multi-language Support
Auto-detects the language of your question using a fast LLM call to the judge model. Prepends `"Respond entirely in [language]"` to all stage prompts. Non-English sessions show a language badge in the question bar. Works for all 4 stages.

###  API Key Management UI
Settings panel (⚙ Settings button in nav) where users enter API keys per provider:
- Keys stored only in browser `localStorage` — never sent to any server except the provider's own API
- Show/hide toggle per key
- **Test Keys** button calls `/health/keys` to verify which providers are active
- Per-provider source badge: `YOUR KEY` / `SERVER .ENV` / `NO KEY`
- Green dot on the Settings button when keys are saved
- Keys override the server `.env` per-request

###  Model Disagreement Heatmap
Computes Jaccard distance between all model answer pairs per session. 3-tab view:
- **Heatmap** — Colour grid (green=agree → red=disagree) per question × model pair, click any row for detail
- **Sessions** — Session list ranked by controversy with sparklines showing divergence across pairs
- **Pair Analysis** — Per model-pair avg/min/max divergence with range bars and trend sparklines

###  Answer Quality Scoring
After Stage 3 completes, a **Score Answers** button triggers the judge model to score each Stage 1 response against the final verdict on 4 dimensions:
- **Overall** (0–10), **Accuracy**, **Completeness**, **Clarity**
- Shown as medal-ranked cards (🥇🥈🥉) with animated score bars and a one-sentence reasoning from the judge

###  Chain-of-Thought Visualiser
Parses each model's `## Reasoning` section into discrete steps (numbered lists → bullets → sentence chunks). Renders an SVG flowchart per model with:
- Arrows between steps
- Colour-coded node types: `START` (cyan), `REASON` (purple), `WARNING` (red), `CONCLUSION` (green), `STEP` (grey)
- Step type legend and breakdown count panel
- Model selector tabs to switch between council members

###  Per-Model Timeout Control
Per-model timeout slider (5–120s) in the parameter panel. The backend wraps each streaming call in `asyncio.wait_for`. Timed-out models emit a `timeout` SSE event — marked as skipped with a notification, and the council proceeds without them.

###  Temperature & Parameter Tuning
Per-model sliders in the collapsible params panel inside the Persona Builder:
- **Temperature** (0–2) — 0 = deterministic, 2 = creative
- **Max Tokens** (64–4096) — Maximum response length
- **Top P** (0–1) — Nucleus sampling threshold
- **Timeout** (5–120s) — Per-model timeout
Parameters passed through to all provider APIs. Gemini uses its own key names (`maxOutputTokens`, `topP`, `generationConfig`).

###  Prompt Template Library
Modal library accessible from a button in the question header:
- **5 built-in templates**: Default, Legal Analysis, Medical Reasoning, Code Review, Devil's Debate
- **User CRUD**: Create, preview, clone, edit, and delete custom templates
- Per-stage prompt editing (Stage 1, 2, 3 independently)
- Active template shown as a button; reset to default with one click
- Custom prompts sent as `custom_prompts` dict to backend, overriding server defaults per stage

###  Model Leaderboard
Live ranked table across all sessions ( Leaderboard button in nav):
- **Metrics**: win rate, avg rank position, consistency score, avg confidence, avg latency, podium count, sessions played
- **Medal positions** 🥇🥈🥉 for top 3
- **Sortable** by any metric column with direction toggle
- **Expandable rows** — click any model for full detail breakdown
- Top-level summary stat cards: total sessions, models tracked, current leader, top confidence

###  Shareable Session Links
Every completed session generates a self-contained read-only HTML page at:
```
http://localhost:8000/sessions/{session_id}/share
```
- Pure HTML + inline CSS — no framework, no login required
- **View Share Page** button + **Copy Link** button appear in the nav after Stage 3
- Dark-themed, mobile-responsive, includes all 3 stages with full reasoning and verdict

###  Inline Comments
Annotate any section of any response with sticky notes — stored in browser `localStorage` per session:
- **Stage 1**: Comment on reasoning or answer per model
- **Stage 2**: Comment on critique or ranking per reviewer
- **Stage 3**: Comment on summary or verdict
- Comment count badge shown on tabs
- Add, view, and delete comments; timestamped entries

###  A/B Prompt Testing
Run the same question with two different prompts on the same model — side by side, streaming simultaneously:
- **4 preset prompts**: Standard, Concise, Detailed, Socratic
- **Custom prompt** text area for fully bespoke prompts
- Results stream live in two parallel cards with Reasoning/Answer tabs
- Useful for measuring the effect of prompt changes on response quality

###  Session Trends Over Time
Weekly trend charts across all sessions (📈 Trends button in nav) — 4 tabs:
- **Activity** — Sessions per week bar chart, avg duration sparkline, cumulative sessions curve
- **Model Usage** — Per-model usage and win rate sparklines across weeks
- **Quality** — Avg confidence score trend line, per-model win rate trend lines
- **Topics** — Topic distribution heatmap grid per week + topic trend sparklines

---

## Supported Models

| Provider | Models | Get Key |
|----------|--------|---------|
| **Groq** | LLaMA 3.3 70B, Compound Beta | https://console.groq.com |
| **Mistral** | Mistral Small | https://console.mistral.ai |
| **OpenAI** | GPT-4o, GPT-4.1 Mini | https://platform.openai.com/api-keys |
| **Anthropic** | Claude 3.5 Sonnet, Claude 3.5 Haiku | https://console.anthropic.com/settings/keys |
| **Gemini** | Gemini 1.5 Pro, Gemini 1.5 Flash | https://aistudio.google.com/app/apikey |
| **Ollama** | Local LLaMA 3 (any local model) | https://ollama.ai |

> You only need keys for the providers you intend to use. Groq + Mistral are free and sufficient to run the full 3-stage council.

---

## Prerequisites

- Python 3.10+
- Node.js 18+
- At least one API key (Groq is free and recommended to start)

---

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/vaishaldsouza/AgentBlazer_Workshop.git
cd AgentBlazer_Workshop
```

---

### 2. Create a virtual environment

**Windows (Command Prompt / PowerShell)**
```cmd
python -m venv venv
venv\Scripts\activate
```

**Linux / macOS**
```bash
python3 -m venv venv
source venv/bin/activate
```

> You should see `(venv)` at the start of your prompt. Run `deactivate` to exit.

---

### 3. Install backend dependencies

```bash
pip install -r requirements.txt
```

---

### 4. Configure API keys

**Windows (PowerShell)**
```powershell
Copy-Item backend\.env.example backend\.env
notepad backend\.env
```

**Linux / macOS**
```bash
cp backend/.env.example backend/.env
nano backend/.env
```

Fill in the keys for the providers you want to use:

```env
GROQ_API_KEY=your_groq_key_here
MISTRAL_API_KEY=your_mistral_key_here
OPENAI_API_KEY=your_openai_key_here
ANTHROPIC_API_KEY=your_anthropic_key_here
GEMINI_API_KEY=your_gemini_key_here
```

> **Tip:** You can also enter API keys directly in the browser via **⚙ Settings** — no `.env` edit required.

---

### 5. Install frontend dependencies

```bash
cd frontend
npm install
cd ..
```

> If you are using the PDF export or analytics charts, also run:
> ```bash
> npm install jspdf recharts
> ```

---

## Running the App

Open two terminals from the project root with the virtual environment activated in each.

**Terminal 1 — Backend**
```bash
uvicorn backend.main:app --reload
```

**Terminal 2 — Frontend**
```bash
cd frontend
npm run dev
```

Open **http://localhost:5173** in your browser.

---

## Testing the Backend

```bash
python test.py
```

All tests should pass before using the frontend.

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check + which API keys are configured |
| `GET` | `/health/keys` | Per-provider key availability (user header vs server .env) |
| `GET` | `/models` | Full model catalog |
| `POST` | `/stage1` | Stage 1 — council opinions (non-streaming) |
| `POST` | `/stage2` | Stage 2 — peer reviews (non-streaming) |
| `POST` | `/stage3` | Stage 3 — judge verdict (non-streaming) |
| `POST` | `/stream/stage1` | Stage 1 SSE stream — parallel council opinions |
| `POST` | `/stream/stage2` | Stage 2 SSE stream — parallel peer reviews |
| `POST` | `/stream/stage3` | Stage 3 SSE stream — judge verdict |
| `POST` | `/stream/stage4` | Stage 4 SSE stream — iterative refinement |
| `POST` | `/detect-language` | Auto-detect question language |
| `POST` | `/quality-scores` | Score Stage 1 answers against the Stage 3 verdict |
| `GET` | `/analytics` | Aggregated analytics across all sessions |
| `GET` | `/leaderboard` | Per-model win rates, latency, confidence, consistency |
| `GET` | `/disagreement` | Pairwise answer divergence heatmap data |
| `GET` | `/trends` | Weekly session metrics for trend charts |
| `GET` | `/sessions` | List all saved sessions |
| `GET` | `/sessions/{id}` | Get full session JSON |
| `GET` | `/sessions/{id}/share` | Self-contained read-only HTML share page |

---

## SSE Event Protocol

All `/stream/*` endpoints emit Server-Sent Events in this format:

```
data: {"type": "token",    "model_id": "...", "model_name": "...", "chunk": "..."}
data: {"type": "done",     "model_id": "...", "model_name": "...", "full": "..."}
data: {"type": "error",    "model_id": "...", "model_name": "...", "message": "..."}
data: {"type": "timeout",  "model_id": "...", "model_name": "...", "message": "..."}
data: {"type": "complete", ...stage-specific fields...}
```

---

## Project Structure

```
AgentBlazer_Workshop/
├── test.py                              # Backend test suite
├── requirements.txt                     # Python dependencies
│
├── backend/
│   ├── .env                             # API keys (never commit)
│   ├── .env.example                     # Template for .env
│   ├── main.py                          # FastAPI app + all endpoints
│   ├── council.py                       # 3-stage orchestration logic
│   ├── config.py                        # Models, prompts, API URLs, helpers
│   └── providers/
│       ├── __init__.py                  # Provider router + stream_provider
│       ├── groq.py                      # Groq API
│       ├── mistral.py                   # Mistral API
│       ├── openai.py                    # OpenAI API
│       ├── anthropic.py                 # Anthropic API
│       ├── gemini.py                    # Google Gemini API
│       └── ollama.py                    # Local Ollama
│
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx                      # Root — state, SSE streaming, routing
│       ├── index.css                    # Global styles + CSS variables
│       ├── components/
│       │   ├── QuestionInput.jsx        # Question entry, persona builder, params, templates
│       │   ├── StageView.jsx            # Stage orchestrator + nav + share button
│       │   ├── Stage1View.jsx           # Opinions + confidence + CoT visualiser + comments
│       │   ├── Stage2View.jsx           # Peer reviews + inline comments
│       │   ├── Stage3View.jsx           # Verdict + quality scoring + comments
│       │   ├── Stage4View.jsx           # Iterative refinement cards
│       │   ├── Loader.jsx               # Loading states
│       │   ├── AnalyticsDashboard.jsx   # 4-tab analytics with recharts
│       │   ├── SessionBrowser.jsx       # Session history + replay
│       │   ├── Leaderboard.jsx          # Model leaderboard table
│       │   ├── DisagreementHeatmap.jsx  # Answer divergence heatmap
│       │   ├── ChainOfThoughtViz.jsx    # SVG reasoning flowchart
│       │   ├── CommentThread.jsx        # Inline annotation threads
│       │   ├── SettingsPanel.jsx        # API key management UI
│       │   ├── PromptTemplateLibrary.jsx# Template CRUD modal
│       │   ├── ABTestView.jsx           # A/B prompt comparison
│       │   └── TrendsView.jsx           # Weekly trend charts
│       └── utils/
│           ├── exportReport.js          # Markdown + PDF export
│           ├── apiKeys.js               # localStorage key management
│           ├── comments.js              # localStorage comment CRUD
│           └── promptTemplates.js       # Template storage + 5 built-ins
│
└── data/
    └── sessions/                        # Auto-saved session JSON logs
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | FastAPI, httpx, python-dotenv, uvicorn |
| **Frontend** | React 18, Vite, react-markdown |
| **Charts** | Recharts |
| **PDF Export** | jsPDF |
| **Streaming** | Server-Sent Events (SSE) |
| **Storage** | JSON files (sessions) + localStorage (keys, comments, templates) |

---

## Environment Variables

| Variable | Provider | Required For |
|----------|----------|-------------|
| `GROQ_API_KEY` | Groq | LLaMA 3.3 70B, Compound Beta |
| `MISTRAL_API_KEY` | Mistral | Mistral Small (default judge) |
| `OPENAI_API_KEY` | OpenAI | GPT-4o, GPT-4.1 Mini |
| `ANTHROPIC_API_KEY` | Anthropic | Claude 3.5 Sonnet/Haiku |
| `GEMINI_API_KEY` | Google | Gemini 1.5 Pro/Flash |

> All optional — only needed for the providers you select. Keys can also be entered in the browser Settings panel without editing `.env`.

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

*AgentBlazer Workshop · Open Model Abstraction Layer*

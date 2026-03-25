<div align="center">

<br/>

<img src="https://img.shields.io/badge/Qrox-AI-7c3aed?style=for-the-badge&labelColor=0c1220" alt="Qrox AI"/>

# Qrox AI

**A professional multi-model AI workspace — built entirely in the browser.**  
Connect GPT-4o, Claude, Gemini, Mistral, DeepSeek, Groq and more from a single interface.  
No backend. No account. No install. Just open and build.

<br/>

![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)
![Vanilla JS](https://img.shields.io/badge/stack-Vanilla%20JS-f59e0b?style=flat-square)
![No Dependencies](https://img.shields.io/badge/dependencies-none-10b981?style=flat-square)
![Models](https://img.shields.io/badge/models-50%2B-6366f1?style=flat-square)

<br/>

</div>

---

## Overview

Qrox AI is a fully client-side AI workspace that lets you talk to 50+ AI models — choosing the best one automatically per task type. It supports code generation, image analysis, autonomous multi-step pipelines, voice I/O, live collaboration, and much more — all from a single HTML file served locally or from any static host.

There is no server, no database, and no account required. API keys are stored locally in your browser.

---

## Features

### Core Chat
| Feature | Description |
|---|---|
| **Multi-Model Routing** | Automatically selects the best model per task — coding, reasoning, chat, math, writing |
| **Streaming Responses** | Token-by-token live streaming with real-time syntax highlighting |
| **Markdown + Code** | Full markdown rendering with Prism.js syntax highlighting for 20+ languages |
| **Context Window Meter** | Live token usage estimate with per-model context limit awareness |
| **Session History** | Persistent chat sessions saved to localStorage with smart AI-generated titles |

### AI Capabilities
| Feature | Description |
|---|---|
| **🖼 Image → Code** | Upload any screenshot or design mockup — AI generates pixel-accurate matching code |
| **🧠 Extended Thinking** | Deep reasoning mode for complex problems — enables chain-of-thought across providers |
| **🔍 Self-Critique Loop** | After responding, AI silently reviews and improves its own answer |
| **✨ Prompt AI** | ChatGPT-style prompt refinement — turns rough ideas into structured, effective prompts |
| **🎯 Autonomous Goal Mode** | Set a goal, choose cycles — AI iterates autonomously with developer/tester/devops agents |
| **🤖 Multi-Agent Pipelines** | Visual drag-and-drop pipeline editor to chain multiple specialized AI agents |

### Build Mode
| Feature | Description |
|---|---|
| **⚡ Framework Support** | HTML/CSS/JS · React (Babel CDN) · Vue 3 · TypeScript · React+Vite · Next.js · Node/Express · Svelte · Fullstack |
| **🗂 File Tree** | Live explorer for all AI-generated files — open, edit, copy, preview |
| **👁 Live Preview** | Instant in-browser preview — HTML renders directly, React/Vue transpiled on the fly |
| **📐 Diff View** | Myers algorithm line-level diff with hunk-level Accept/Reject for AI file edits |
| **🎯 Pixel-Perfect Vision** | Upload a reference image, generate code, then run a pixel diff score comparison |

### Input & Interaction
| Feature | Description |
|---|---|
| **📎 File Attachments** | Attach images, PDFs, code files — indexed into RAG knowledge base automatically |
| **📚 Knowledge Base (RAG)** | BM25 retrieval over uploaded documents — AI answers using your own content |
| **🔊 Voice I/O** | Speech-to-text input (Web Speech API) + text-to-speech output with configurable voice/speed/pitch |
| **⌨️ Command Palette** | `Ctrl+K` to search commands, sessions, and files instantly |
| **👻 Ghost Autocomplete** | Greyed-out completions based on your chat history as you type |

### Collaboration & Sharing
| Feature | Description |
|---|---|
| **🤝 Live Collaboration** | Real-time multi-tab session sharing via localStorage broadcast — no server needed |
| **🔗 Share Chat** | Encode any conversation to a base64 URL — shareable with anyone, no account required |
| **🌿 Session Branching** | Fork any conversation at any message to explore alternate paths |

### Productivity
| Feature | Description |
|---|---|
| **📊 Chat Analytics** | Message counts, token usage, model distribution, session timeline |
| **🎭 Custom Personas** | Built-in persona library (Senior Dev, Security Auditor, etc.) + fully custom system prompts |
| **🎵 Ambient Audio** | Focus sounds — Rain, Lo-fi, Deep Focus, White Noise |
| **⚡ Task Auto-Detection** | Detects coding / math / writing / reasoning intent as you type and adjusts the model accordingly |
| **🏥 Circuit Breaker** | Per-provider failure tracking with automatic fallback to next best available model |

---

## Quick Start

### Option 1 — Local Server (Recommended)

```bash
# Navigate into the project folder
cd qrox-ai

# Using Node.js
npx serve .

# Using Python
python3 -m http.server 8080

# Using PHP
php -S localhost:8080
```

Then open **http://localhost:8080** in your browser.

### Option 2 — Direct File

Open `index.html` directly in your browser. Most features work without a server. File import features may require a local server due to browser security restrictions.

### Option 3 — Static Hosting

Deploy the entire folder to any static host:

```bash
# Vercel
npx vercel

# Netlify
npx netlify deploy --dir .

# GitHub Pages — push to repo, enable Pages in Settings
```

---

## API Keys

Qrox AI connects directly to provider APIs from your browser. Keys are stored **only in your browser's localStorage** — never sent anywhere except the respective AI provider.

Click **🔑 Add API Keys** on the welcome screen or open the Vault from the header.

| Provider | Free Tier | Key Required |
|---|---|---|
| OpenAI (GPT-4o, o1, o3) | ❌ | ✅ |
| Anthropic (Claude 3.5 / 4) | ❌ | ✅ |
| Google (Gemini 2.5 Pro / Flash) | ✅ | Optional |
| Groq (Llama, DeepSeek, Mixtral) | ✅ | Optional |
| OpenRouter | ✅ | Optional |
| Mistral | ✅ | Optional |
| DeepSeek | ✅ | Optional |
| Cohere | ✅ | Optional |
| Together AI | ✅ | Optional |

---

## Keyboard Shortcuts

Press **`?`** anywhere in the app to open the full shortcut map.

| Shortcut | Action |
|---|---|
| `Enter` | Send message |
| `Shift + Enter` | New line in message |
| `Ctrl + K` | Open command palette |
| `Ctrl + /` | Toggle build mode |
| `Ctrl + Enter` | Run code preview |
| `Escape` | Stop generation / close modal |
| `?` | Open keyboard shortcut map |

---

## Project Structure

```
qrox-ai/
│
├── index.html                    ← Entry point — open this in your browser
│
├── css/
│   └── main.css                  ← All styles (~4100 lines, CSS variables, responsive)
│
└── js/
    │
    ├── ── Core ──────────────────────────────────────────────────────
    ├── providers.js              ← 50+ model definitions, tiers, capabilities, CORS flags
    ├── state.js                  ← Global app state object (S)
    ├── init.js                   ← App bootstrap and localStorage hydration
    ├── boot.js                   ← Startup sequence — calls init(), voice, personas, etc.
    │
    ├── ── Data & Storage ────────────────────────────────────────────
    ├── sessions.js               ← Chat session CRUD, history sidebar, smart AI titles
    ├── rag.js                    ← BM25 knowledge base — chunk, index, retrieve
    ├── vault.js                  ← API key storage and management UI
    │
    ├── ── AI & Routing ──────────────────────────────────────────────
    ├── model-selection.js        ← Capability scoring, smart provider ranking
    ├── model-picker.js           ← Model picker modal UI
    ├── api-callers.js            ← Fetch wrappers for every provider's API format
    ├── system-prompt.js          ← Dynamic system prompt builder + task routing tables
    ├── task-detection.js         ← Multi-signal intent classifier (coding/math/chat/etc.)
    ├── dsp-blocks.js             ← Composable system prompt block pipeline
    ├── circuit-breaker.js        ← Per-provider failure tracking, health checks, fallback
    │
    ├── ── Messaging ─────────────────────────────────────────────────
    ├── send.js                   ← Main send() pipeline — build payload, call API, handle response
    ├── streaming.js              ← Token streaming, live code diff detection, buffer management
    ├── render.js                 ← Message bubble renderer, markdown parser, code highlighting
    ├── performance.js            ← Virtual scroll, lazy render batching, DOM pruning
    │
    ├── ── Build Tools ───────────────────────────────────────────────
    ├── filetree.js               ← File explorer, editor, copy, diff trigger
    ├── preview.js                ← Multi-framework preview runner (HTML/React/Vue/TS/StackBlitz)
    ├── diff.js                   ← Myers diff algorithm, hunk grouping, word-level highlights
    ├── pixel-vision.js           ← Image-to-code mode + canvas pixel diff scoring
    ├── code-execution.js         ← Inline sandboxed JS/HTML code block execution
    │
    ├── ── AI Features ───────────────────────────────────────────────
    ├── agents.js                 ← Multi-agent system (Developer / Tester / DevOps roles)
    ├── autonomous.js             ← Autonomous goal mode — multi-cycle iterative pipeline
    ├── pipeline-editor.js        ← Drag-and-drop visual agent pipeline canvas
    ├── prompt-agent.js           ← Prompt AI refinement panel + suggestion chips
    ├── self-critique.js          ← Post-response AI self-review loop
    ├── personas.js               ← Persona library + custom persona editor
    │
    ├── ── Input & UI ────────────────────────────────────────────────
    ├── input-mode.js             ← Chat / Agent mode toggle
    ├── file-handling.js          ← File upload, drag & drop, image-to-code trigger
    ├── voice.js                  ← STT (SpeechRecognition) + TTS (SpeechSynthesis)
    ├── audio.js                  ← Ambient sound player + ghost autocomplete
    ├── command-palette.js        ← Ctrl+K palette — commands, sessions, file search
    ├── keyboard-shortcuts.js     ← Global keybindings + shortcut map modal
    ├── context-meter.js          ← Token usage estimator + context window warning
    ├── welcome.js                ← Welcome screen renderer (shown on new/empty chat)
    ├── settings.js               ← Settings panel — temperature, tokens, theme, etc.
    ├── utils.js                  ← Toast notifications, clipboard, global search, helpers
    │
    ├── ── Collaboration ─────────────────────────────────────────────
    ├── collaboration.js          ← localStorage-based real-time multi-tab sync
    ├── share.js                  ← Base64 URL chat encoding + shared read-only viewer
    ├── branching.js              ← Session fork at any message point
    │
    └── ── Analytics ─────────────────────────────────────────────────
        └── analytics.js          ← Usage stats, model distribution, session timeline
```

---

## Architecture Notes

**No build step.** Qrox AI is intentionally zero-toolchain. Every JS file is plain ES5-compatible JavaScript loaded via `<script>` tags in dependency order. This makes it trivially deployable to any static host and fully inspectable without a bundler.

**Global state.** All app state lives in a single `S` object defined in `state.js`. Modules read and mutate this object directly. This is a deliberate tradeoff — it keeps the codebase simple and avoids framework complexity for a single-page tool.

**Direct API calls.** Every provider is called directly from the browser. This works for providers that enable CORS (Groq, OpenRouter, Mistral, etc.). For providers that block browser requests (OpenAI, Anthropic), a CORS proxy or server-side relay is needed.

**localStorage only.** Sessions, keys, settings, and RAG documents all persist in `localStorage`. Nothing is ever sent to any server other than the AI provider API you've configured.

---

## Browser Support

| Browser | Status | Notes |
|---|---|---|
| Chrome 90+ | ✅ Full support | All features including voice |
| Edge 90+ | ✅ Full support | All features including voice |
| Firefox 90+ | ✅ Full support | Voice input limited |
| Safari 16+ | ✅ Supported | Some voice features limited |

---

## License

MIT License — free to use, modify, and distribute.

---

<div align="center">

Built with vanilla JavaScript &nbsp;·&nbsp; Zero dependencies &nbsp;·&nbsp; Fully open source

</div>

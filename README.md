# Qrox AI — Project Structure

A multi-model AI workspace supporting GPT-4o, Claude, Gemini, Mistral, and more.

## File Structure

```
qrox-ai/
├── index.html          ← Main entry point (open this in a browser)
├── css/
│   └── main.css        ← All styles (4100+ lines)
├── js/
│   ├── providers.js        ← AI provider definitions & model registry
│   ├── state.js            ← Global app state (S object)
│   ├── rag.js              ← Retrieval Augmented Generation / knowledge base
│   ├── init.js             ← App initialization
│   ├── sessions.js         ← Chat sessions, history, localStorage
│   ├── performance.js      ← Virtual DOM rendering, lazy loading
│   ├── filetree.js         ← File explorer & editor
│   ├── model-selection.js  ← Smart model ranking & selection
│   ├── api-callers.js      ← API fetch wrappers for all providers
│   ├── system-prompt.js    ← System prompt builder + task routing
│   ├── input-mode.js       ← Chat / Agent mode toggle
│   ├── model-picker.js     ← Model picker modal
│   ├── prompt-agent.js     ← Prompt AI refinement panel
│   ├── streaming.js        ← Live streaming token renderer
│   ├── send.js             ← Main send() pipeline
│   ├── render.js           ← Message rendering & markdown parser
│   ├── preview.js          ← Code preview runner (HTML/React/Vue/TS)
│   ├── vault.js            ← API key vault UI
│   ├── agents.js           ← Multi-agent pipeline system
│   ├── autonomous.js       ← Autonomous goal mode
│   ├── settings.js         ← Settings panel
│   ├── file-handling.js    ← File upload, attach, image-to-code
│   ├── utils.js            ← Utilities, toast, copy, search
│   ├── command-palette.js  ← Ctrl+K command palette
│   ├── code-execution.js   ← Inline code execution
│   ├── pipeline-editor.js  ← Visual agent pipeline editor
│   ├── collaboration.js    ← Live collaboration (multi-tab)
│   ├── pixel-vision.js     ← Pixel-perfect vision mode
│   ├── self-critique.js    ← AI self-critique loop
│   ├── dsp-blocks.js       ← Dynamic system prompt blocks
│   ├── audio.js            ← Ambient audio + ghost autocomplete
│   ├── keyboard-shortcuts.js ← Keyboard shortcut map (press ?)
│   ├── context-meter.js    ← Context window token meter
│   ├── personas.js         ← Custom AI personas
│   ├── branching.js        ← Session branching
│   ├── analytics.js        ← Chat analytics dashboard
│   ├── voice.js            ← Voice input/output (STT + TTS)
│   ├── diff.js             ← Live diff view (Myers algorithm)
│   ├── welcome.js          ← Welcome screen renderer
│   ├── circuit-breaker.js  ← Provider health & circuit breaker
│   ├── task-detection.js   ← Auto task type detection
│   ├── tools.js            ← Tool system (web search, file read, etc.)
│   ├── share.js            ← Share chat (base64 URL encoding)
│   └── boot.js             ← App boot sequence
└── README.md
```

## Usage

**Option A — Direct browser:**
Open `index.html` directly. Some features (file imports) need a local server.

**Option B — Local server (recommended):**
```bash
npx serve .
# or
python3 -m http.server 8080
```
Then open http://localhost:8080

## Features
- 🖼 Image → Code (upload screenshot, get matching code)
- 🧠 Extended Thinking mode
- ⚡ Build Mode (HTML/React/Vue/Next.js/Node)
- 🎯 Autonomous Goal Mode
- 📚 Knowledge Base (RAG)
- 🔊 Voice I/O (STT + TTS)
- 🤝 Live Collaboration
- 🎨 Pixel-Perfect Vision Mode
- 🔧 Visual Pipeline Editor

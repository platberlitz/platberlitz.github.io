# Synapse

A privacy-first, fully client-side AI chat interface. No backend, no account — just static files that talk directly to any OpenAI-compatible or Anthropic API endpoint.

## Features

### Core
- **Multi-provider support** — works with OpenAI, Anthropic, and any OpenAI-compatible proxy (e.g. local LLMs via LM Studio, Ollama, text-generation-webui)
- **Streaming responses** with abort support
- **Conversation management** — create, rename, tag, search, fork, import/export (JSON and Markdown)
- **Multiple API profiles** — save and switch between different provider/model configurations
- **Model override** — type `@model-name` in the input to override the model for a single message
- **Cost tracking** — set per-token pricing and track spend across conversations

### Chat
- **Message editing** — edit any user message and regenerate from that point
- **Swipes** — regenerate assistant responses and navigate between alternatives
- **Fork conversations** — branch off at any message to explore different directions
- **Conversation summary** — AI-generated summaries of the current chat
- **Global search** — full-text search across all conversations
- **Message screenshots** — select and screenshot message ranges

### Roleplay and Characters
- **SillyTavern character card import** — drag and drop `.png` or `.json` character cards
- **Persona system** — define who you are for the AI to reference
- **Prompt entries** — ordered, togglable prompt segments (system, user, assistant) with drag-and-drop reordering
- **Preset system** — save/load/import prompt configurations, including SillyTavern presets
- **SillyTavern macro conversion** — `{{user}}`, `{{char}}`, `{{random}}`, etc.

### Tools
- **Web search** — native Anthropic tool use, or SearXNG/Brave/custom search APIs for OpenAI-format models
- **Memory** — persistent cross-conversation memory the AI can read and write to
- **File attachments** — images (with vision), PDFs, text, CSV, HTML, Markdown

### Appearance
- **35+ built-in themes** — Nord, Catppuccin, Dracula, Gruvbox, Tokyo Night, Rose Pine, and many more
- **Custom themes** — full color picker with live preview
- **Customizable font**, message width, font size, and border radius
- **Light/dark/system** mode toggle
- **Syntax highlighting** (highlight.js), **LaTeX** (KaTeX), and **Mermaid diagrams**

### Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Enter` | Send message (configurable) |
| `Shift+Enter` | New line |
| `Ctrl+Enter` | Always sends |
| `Ctrl+N` | New conversation |
| `Ctrl+/` | Focus input |
| `Ctrl+K` | Search conversations |
| `Ctrl+F` | Search in current chat |
| `Ctrl+Shift+E` | Export all conversations |
| `Ctrl+Shift+R` | Regenerate last response |
| `Escape` | Close modal / Stop streaming |
| `@model` | Override model for one message |

## Running Locally

Synapse is entirely static — no build step, no dependencies, no Node.js required.

### Option 1: Single-file download (easiest)

Download **`synapse.html`** — a single self-contained file with all CSS and JS inlined. Just open it in your browser:

```bash
open synapse.html          # macOS
xdg-open synapse.html     # Linux
start synapse.html         # Windows
```

> **Note:** Some browsers restrict `fetch()` from `file://` URLs. If you see CORS errors, use a local server instead (see Option 3).

### Option 2: Open from source

If you've cloned the repo, open `index.html` directly:

```bash
open assistant/index.html          # macOS
xdg-open assistant/index.html     # Linux
start assistant/index.html         # Windows
```

### Option 3: Local HTTP server

Any static file server works. Pick whichever you have installed:

```bash
# Python (built-in)
cd assistant
python3 -m http.server 8000
# → http://localhost:8000

# Node (npx, no install needed)
npx serve assistant
# → http://localhost:3000

# PHP (built-in)
cd assistant
php -S localhost:8000
```

Then open the URL shown in the terminal.

### Option 4: VS Code Live Server

If you use VS Code, install the **Live Server** extension and right-click `assistant/index.html` → "Open with Live Server".

## Setup

On first launch you'll see the setup modal:

1. **Base URL** — your API endpoint (e.g. `https://api.openai.com/v1`, `http://localhost:1234/v1` for local models)
2. **API Key** — your provider's API key
3. **Model** — fetch the model list or type a model name manually

All settings are stored in `localStorage` — nothing leaves your browser except API requests to your configured endpoint.

## Project Structure

```
assistant/
  synapse.html        # Standalone single-file build (download this!)
  index.html          # Single-page app shell and all modals
  styles.css          # All styles, themes, responsive design
  favicon.ico
  js/
    main.js           # Application logic (~6400 lines)
    lib/
      dom-utils.js    # Focus trapping, focusable element helpers
      text-utils.js   # HTML escaping, color utilities
```

## Data Storage

Everything is stored in the browser's `localStorage`:

| Key | Contents |
|---|---|
| `llmProxyUrl` | API base URL |
| `llmApiKey` | API key (stored locally only) |
| `llmModel` | Active model name |
| `assistantConversations` | All conversations and messages |
| `assistantTheme` | Current theme name |
| `assistantCustomTheme` | Custom theme colors (JSON) |
| `assistantMemories` | Persistent memory entries |
| `llmModelList` | Cached model list from API |

**Back up your data** by exporting conversations regularly (toolbar menu → "Export all chats").

## Browser Support

Works in any modern browser (Chrome, Firefox, Safari, Edge). Optimized for mobile with touch-friendly controls and responsive layout. Includes iOS Safari-specific fixes for code block rendering and safe area insets.

## License

Made by [purachina](https://platberlitz.github.io/) and 100% Claude.

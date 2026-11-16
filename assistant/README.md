# Synapse

Synapse is my browser-only chat app for API-backed assistants. It runs from static files, stores your chats locally, and sends requests only to the endpoint you configure.

Use it from GitHub Pages, run it from a local server, or download the standalone `synapse.html` file.

## What It Does

### Providers and Models

- Setup and API settings include OpenAI, Anthropic, OpenRouter, Ollama, LM Studio, and Custom presets.
- Test a connection and discover models without saving settings. Model metadata is used for context estimates when the provider supplies a context length.
- Supports local model servers such as LM Studio, Ollama, and text-generation-webui.
- Lets you save connection profiles for different base URLs, models, and request settings; API keys stay in the selected device/tab credential store and are scrubbed from profiles, exports, and sync payloads.
- Supports streaming responses, stop generation, and one-message model overrides with `@model-name`.
- The toolbar chip opens a searchable profile and model picker. Each assistant swipe records lifecycle, timing, HTTP, and sanitised error metadata.
- Compare two models before sending, or the same model with two prompt presets. Both replies stream side by side in the chat, then a results window shows them formatted with their timing and token use so you can pick which one stays in the conversation. 'Compare responses' in the message's More menu reopens it later. A cross-provider key stays in memory only for that comparison, and comparison replies don't use tools.

API keys can be saved as **Remember on this device** (`localStorage`) or **This tab only** (`sessionStorage`). Each key is bound to its provider, base URL and API format, so changing the connection in another tab can't send it somewhere else. Older saved keys need one confirmation: review the prefilled connection and save it. Browser storage is not an encrypted vault.

### Chats

- Create, rename, tag, search, import, and export conversations. Active and Archived views, collapsible project groups, duplicate/archive/restore, bulk selection, and Updated/Created/Title/Manual sorting are available in the sidebar.
- Export one chat as JSON or Markdown, or make a full backup from Data settings.
- Temporary chats stay only in the current loaded tab, ignore saved memories and project context, and can't be exported, shared, or saved as screenshots by Synapse. Your selected provider still receives the messages.
- Four editable starter prompts fill the composer locally. They make no API request and can be hidden in Prompts settings.
- 'Complete draft' and 'Suggest follow-ups' call the selected provider only when you ask. Suggestions fill the composer and never send themselves.
- Edit a user message and resend from that point.
- Regenerate assistant messages and switch between swipes.
- Failed or interrupted responses keep the text already received. Retry and Continue create another version instead of replacing the old one. A failed response or Stop pauses the follow-up queue.
- Fork a chat from any message. Branches in the Context panel shows the whole family of forks as a tree, so you can hop between attempts without hunting through the sidebar.
- Bookmark a message from its More menu to name a moment you want to come back to. Bookmarks in the Context panel jumps to it or branches from it.
- Set a per-chat goal and generate or save a conversation summary for context.
- Choose Edit on a code block to open it in the outputs workspace in the Context panel. Outputs keep their last 30 saved versions, show what changed between a version and the editor, preview HTML and SVG in a sandboxed frame, and download as a file. Select part of an output and describe a change to have the model rewrite only that part; you see the change before applying it.
- Use the right Context panel for goals, lorebooks, outputs, request previews, per-chat tools, summaries, sources, branches and bookmarks. It starts closed until you open it, remembers that choice, and both side panels can be resized by dragging their edge or with the arrow keys. Chips under the composer show what the next message will carry, such as the project, files, memories, lore entries, goal and tools; select one to jump to it. Individual messages can be included or excluded; compaction summarises older turns without deleting them. Summaries track which turns they cover, and edits or forks discard summaries that cross the changed history.
- Unfinished Context edits survive redraws and chat switches until you save or discard them. They're session-only, unlike the saved composer draft.
- Queue follow-up messages, attachments, and one-message model overrides while a response is streaming. Queues persist across reloads but remain paused until you choose Resume.
- Draft text and pending attachments are saved per conversation and restored after switching chats or reloading.
- Select message ranges for screenshots.

### Files

- Attach images, PDFs, DOCX/DOC, JSON, RTF, CSV, HTML, Markdown, code, and plain text files.
- Images are sent for vision-capable models.
- Text is extracted from supported document formats before sending.
- Large text attachments are capped so one file does not flood the request.
- Project files can each be set to Always include, Search when needed or Exclude. Search when needed sends only the passages that match the latest message and asks the model to cite them by file name and part, which keeps big reference files from eating the whole context. Matching is plain local keyword ranking, so it won't catch a passage that says the same thing in different words.
- A project's overview lists its chats, starts a new chat in it and opens its memories.

### Roleplay and Prompting

- Import SillyTavern character cards from `.png` or `.json`. A card's embedded lorebook comes along with it.
- Each chat can have a lorebook: entries with keywords that are sent only when a keyword turns up in the last few messages, plus always-on entries. Priority and a character allowance decide what fits, and the Context panel shows which entries go with the next message and why. Import and export use the character card lorebook format, and SillyTavern world info files import too.
- Set a persona for the user.
- Manage ordered prompt entries with enable/disable controls and drag reordering.
- Save, load, and import prompt presets, including SillyTavern presets. Update preset saves your current prompts into the selected preset and keeps the previous 10 versions.
- Test prompts sends the same example messages with two setups, such as your current prompts against a preset or an earlier version of it, and shows the replies side by side. Examples run on their own, without chat history, project files or memories. Each example costs two requests, so keep the list short.
- Supports common SillyTavern macros such as `{{user}}` and `{{char}}`.

### Tools and Diagnostics

- Web search through Anthropic tools, SearXNG, Brave, or a custom search endpoint.
- Composer commands include `/search`, `/files`, `/goal`, `/context`, `/summary`, `/tools`, `/settings`, and `/projects`. Per-chat web-search, URL-fetch, and confirmation policies override global defaults.
- Tool calls show their state, require one confirmation per response when enabled, and persist deduplicated numbered sources for citations and the Sources drawer.
- Optional memory across conversations. Each memory applies everywhere, to one project, or to one character, and can be pinned, edited, added by hand, or traced back to the chat it came from. Pinned memories go first; when the allowance fills up, the rest are left out and the request preview says which.
- Settings has a search box, and the setup window points at the field that needs fixing when something is missing.
- Status and diagnostics panel for connection/search checks.
- Debug tab with redacted request logging, optional full text logging, and a snapshot copy button.
- Local update indicator when a local build can be compared against `version.json` or a `/version` endpoint.

### Appearance

- A muted forest-green workbench theme by default, plus built-in themes, a custom colour picker, and light/dark/system toggle.
- Custom font, message width, font size, and border radius settings.
- Syntax highlighting, LaTeX, Mermaid diagrams, tables, code blocks, spoilers, and generated image display.
- Optional local emotion sprites for Claude, GPT and Gemini, plus Cat, Butler, Maid, Calico Plushie and Zom with 24 expressions each. Choose a character in Appearance to use it with any model; Auto still follows the model.
- Mobile layout with touch-friendly controls.

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Enter` | Send, or queue a follow-up while streaming, if enabled |
| `Shift+Enter` | New line |
| `Ctrl/Cmd+Enter` | Send message |
| `Ctrl/Cmd+N` | New conversation |
| `Ctrl/Cmd+/` | Focus input |
| `Ctrl/Cmd+K` | Search conversations |
| `Ctrl/Cmd+F` | Search current chat |
| `Ctrl/Cmd+Shift+E` | Export backup |
| `Ctrl/Cmd+Shift+R` | Regenerate last response |
| `Escape` | Close modal or stop generation |
| `@model` | Override the model for one message |

Typing `/` in the composer opens the command menu with usage and aliases. Focus a message with Tab to reveal its actions, including Include/Exclude, Retry, and request Details.

## Run It

### Standalone File

Download `synapse.html` and open it in your browser:

```bash
open synapse.html       # macOS
xdg-open synapse.html   # Linux
start synapse.html      # Windows
```

Some browsers block requests from `file://` pages. If API calls fail from the standalone file, use a local HTTP server.

### Source Files

If you cloned the repo, serve the `assistant` directory over HTTP using the instructions below. Opening the source `index.html` directly from disk can block its JavaScript modules; direct file opening is for the standalone build.

### Local Server

Any static server works:

```bash
cd assistant
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

Other options:

```bash
npx serve assistant
php -S localhost:8000 -t assistant
```

## Setup

On first launch, choose a provider preset, test the connection if desired, then enter:

1. Base URL (presets fill the common values).
2. API key when the provider requires one.
3. Model name, either fetched from the provider or typed manually. Synapse does not assume a model name.

Keys and settings stay in your browser. Synapse does not run a server and does not proxy your traffic.

## Storage

Synapse uses browser storage:

| Storage | Contents |
|---|---|
| IndexedDB | Persistent conversations, messages, drafts, queued follow-ups, goals, outputs, lorebooks, bookmarks, projects, and memories |
| `localStorage` | API settings, themes, profiles, prompt entries, presets and their earlier versions, prompt test examples, cached model list, panel widths, and UI preferences |
| `sessionStorage` | A key selected as “This tab only” |

Important keys include:

| Key | Contents |
|---|---|
| `llmProxyUrl` | API base URL |
| `llmApiKey` | API key and its approved connection, in the selected device or tab store |
| `llmModel` | Active model |
| `assistantProfiles` | Saved connection profiles |
| `assistantTheme` | Current theme |
| `assistantCustomTheme` | Custom theme colours |
| `llmPromptEntries` | Prompt entries |
| `assistantPresets` | Prompt presets and their earlier versions |
| `assistantPromptTests` | Example messages for Test prompts |
| `assistantStarterPrompts` | Local starter prompts |
| `assistantDebug` | Debug logging toggle |

Temporary chats never enter browser storage and disappear on reload or close. Use 'Export backup' in Data settings when you want a copy of everything persistent.

When two tabs or devices change the same chat independently, Synapse keeps conflicting histories as separate, labelled copies. Choose which one to continue. I don't want a later draft timestamp deciding which conversation you lose.

Optional GitHub Gist sync encrypts conversations, memories, projects, prompts, presets and appearance settings. Each push adds a separately named encrypted snapshot rather than replacing another device's files. Pull now is always manual, including applying remote deletions. After the first push, you can opt into automatic pushes from the Sync tab; they're off by default and never run on shared read-only pages.

Older encrypted Gists remain readable. Update Synapse on every device before using the new sync format; older builds don't understand the separate update files. Sync stops adding snapshots at 250 files or a 32 MiB archive, with an 8 MiB limit per snapshot and a 64 MiB read limit. To rotate, pull on all devices, export a backup, then clear the Gist ID and push to create a new archive. Keep the old Gist and its passphrase until you've checked the new one. Generating a replacement passphrase requires explicit consent to start a new Gist.

The Data tab reports approximate storage usage, provides confirmed clear actions and previews imports. Merge preserves divergent chat versions; Copy assigns new IDs; Replace needs another confirmation. Full backups include saved presets. Export schema is `synapse-export` version 2; legacy single-chat files still import. Credentials and unsupported profile settings are excluded.

Import and encrypted sync require a working browser database. Local fallback storage supports editing and exporting, but not the same cross-tab protections. Failed imports leave the database unchanged and restore settings still owned by that attempt. A browser or device crash between database and settings writes isn't an all-or-nothing operation across both stores, so keep backups. If another tab reports a storage upgrade, reload it before editing.

## Checks

With Node, Playwright Core and its matching Chromium already available, run from the repository root:

```bash
node assistant/tests/run.cjs
node assistant/tests/run.cjs --standalone
node assistant/tests/run.cjs release
```

Set `PLAYWRIGHT_MODULE` to an installed Playwright Core module path if Node can't resolve it. The checks use disposable browser storage and mocked providers, with nonlocal requests blocked. They don't exercise real accounts, microphones or physical touch devices. Rebuild `synapse.html` using the root project notes after changing source files, and update the cache URLs and build date together.

## Project Files

```text
assistant/
  index.html          App shell and modals
  styles.css          Styles, themes, and responsive layout
  synapse.html        Standalone build with CSS and JS inlined
  version.json        Build metadata for local update checks
  favicon.ico
  assets/
    emotion-sprites/  Provider sprites and original character artwork
  js/
    main.js           App logic
    lib/
      dom-utils.js    Focus helpers
      text-utils.js   HTML escaping and colour helpers
  tests/              Isolated browser regression checks
```

## Browser Support

Synapse targets current Chrome, Firefox, Safari, and Edge. Some features depend on browser APIs:

- Voice input needs `SpeechRecognition`.
- DOCX extraction needs `DecompressionStream`.
- PDF extraction loads PDF.js from a CDN.
- API calls may need a CORS-friendly endpoint or proxy.

## Credit

Made by [purachina](https://platberlitz.github.io/).

Claude, GPT and Gemini emotion sprites are from [N8python/claudesona](https://github.com/N8python/claudesona) under CC0 1.0 Universal. Cat, Butler, Maid and Calico Plushie are original artwork for Synapse. Zom's expression set is based on a supplied character reference and is separate from that CC0 collection.

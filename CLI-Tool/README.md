<div align="center">

<img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=700&size=40&pause=1000&color=CB32EA&center=true&vCenter=true&width=700&height=80&lines=Inspectra+%F0%9F%A4%96;Your+AI+Coding+Agent;CLI+%2B+Telegram+Powered" alt="Inspectra Typing SVG" />

<br/>

<p align="center">
  <strong>An agentic AI assistant that works directly in your codebase — from the terminal or your Telegram chat.</strong><br/>
  Powered by <a href="https://bun.sh">Bun</a> · <a href="https://openrouter.ai">OpenRouter</a> · <a href="https://vercel.com/blog/introducing-the-vercel-ai-sdk">Vercel AI SDK</a>
</p>

<br/>

<p align="center">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white"/>
  <img alt="Bun" src="https://img.shields.io/badge/Bun-000000?style=for-the-badge&logo=bun&logoColor=white"/>
  <img alt="OpenRouter" src="https://img.shields.io/badge/OpenRouter-6C47FF?style=for-the-badge&logo=openai&logoColor=white"/>
  <img alt="Telegram" src="https://img.shields.io/badge/Telegram-26A5E4?style=for-the-badge&logo=telegram&logoColor=white"/>
  <img alt="License" src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge"/>
</p>

<p align="center">
  <img src="https://img.shields.io/github/stars/Sarthak-Jadhav-Dev/Inspectra?style=social" alt="GitHub Stars"/>
  &nbsp;
  <img src="https://img.shields.io/github/forks/Sarthak-Jadhav-Dev/Inspectra?style=social" alt="GitHub Forks"/>
</p>

</div>

---

## 📋 Table of Contents

- [✨ What is Inspectra?](#-what-is-inspectra)
- [🚀 Features](#-features)
- [🏗️ Architecture](#️-architecture)
- [⚙️ Prerequisites](#️-prerequisites)
- [📦 Installation](#-installation)
- [🔧 Configuration](#-configuration)
- [▶️ Usage](#️-usage)
  - [CLI Mode](#cli-mode)
  - [Telegram Mode](#telegram-mode)
- [🤖 Agent Tools](#-agent-tools)
- [📁 Project Structure](#-project-structure)
- [🛠️ Tech Stack](#️-tech-stack)
- [🤝 Contributing](#-contributing)

---

## ✨ What is Inspectra?

**Inspectra** is an AI-powered agentic coding assistant that runs directly in your terminal or via Telegram. Point it at any codebase, give it a goal, and it will reason, read files, search the codebase, write code, and apply changes — all with your approval before anything is committed to disk.

Think of it as an autonomous developer that lives inside your project, accessible 24/7 from your phone via Telegram.

---

## 🚀 Features

<table>
<tr>
<td width="50%">

### 🧠 Agent Mode
Give Inspectra a task and it autonomously:
- Reads and understands your codebase
- Creates, modifies, and deletes files
- Executes shell commands
- Searches glob patterns across the project
- **Requires your approval** before applying any change

</td>
<td width="50%">

### 🗺️ Plan Mode
Not sure where to start? Inspectra will:
- Research your codebase & the web (if Firecrawl is configured)
- Generate a step-by-step plan (1–15 steps)
- Let you toggle which steps to include
- Execute the selected steps sequentially

</td>
</tr>
<tr>
<td width="50%">

### 🔍 Ask Mode
Ask any question about your codebase:
- Read-only — never mutates files
- Web search support (optional)
- Optionally saves answers as `.md` files
- Great for onboarding and code exploration

</td>
<td width="50%">

### 📱 Telegram Mode
Control everything remotely via Telegram:
- `/agent <task>` — run an agent task
- `/ask <question>` — ask about your codebase
- `/plan <goal>` — generate and execute a plan
- Interactive approval buttons for file changes

</td>
</tr>
</table>

---

## 🏗️ Architecture

```
inspectra wakeup
       │
       ▼
  ┌─────────────────────────┐
  │       wakeup.ts         │  ← Mode selector (CLI / Telegram)
  └────────────┬────────────┘
               │
       ┌───────┴────────┐
       ▼                ▼
  ┌─────────┐     ┌───────────────┐
  │  CLI    │     │   Telegram    │
  │  Mode   │     │     Mode      │
  └────┬────┘     └──────┬────────┘
       │                 │
  ┌────┴──────────────────┴────┐
  │        Core Modes          │
  ├────────────────────────────┤
  │  🧠 Agent  │  🗺️ Plan      │
  │  🔍 Ask    │               │
  └────────────────────────────┘
               │
  ┌────────────▼───────────────┐
  │        ToolExecutor        │  ← Staged file mutations
  │   + ActionTracker          │  ← Approval tracking
  └────────────────────────────┘
               │
  ┌────────────▼───────────────┐
  │     OpenRouter / AI SDK    │  ← Any LLM via OpenRouter
  └────────────────────────────┘
```

---

## ⚙️ Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| [Bun](https://bun.sh) | `>= 1.3` | Runtime & package manager |
| [OpenRouter API Key](https://openrouter.ai/keys) | — | Free tier available |
| Telegram Bot Token | — | Optional — for Telegram mode |
| [Firecrawl API Key](https://firecrawl.dev) | — | Optional — enables web search in Plan/Ask modes |

---

## 📦 Installation

### 1. Clone the repository

```bash
git clone https://github.com/Sarthak-Jadhav-Dev/Inspectra.git
cd Inspectra
```

### 2. Install dependencies

```bash
bun install
```

### 3. Register as a global CLI command

```bash
bun link
```

> This registers the `inspectra` command globally on your system. You only need to do this once.

---

## 🔧 Configuration

Create a `.env` file in the project root:

```env
# ─── Required ───────────────────────────────────────────
# Your OpenRouter API key (https://openrouter.ai/keys)
api_Key=your_openrouter_api_key_here

# The model to use (defaults to free tier if not set)
# Examples: "anthropic/claude-3.5-sonnet", "google/gemini-pro", "openrouter/free"
default_mode=openrouter/auto

# ─── Telegram Mode (Optional) ────────────────────────────
# Get a bot token from @BotFather on Telegram
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here

# Your Telegram numeric user/chat ID (only this ID can use the bot)
TELEGRAM_OWNER_ID=your_telegram_chat_id_here

# ─── Web Search (Optional) ───────────────────────────────
# Enables web_search / web_crawl tools in Plan and Ask modes
# Get a key from https://firecrawl.dev
FIRECRAWL_API_KEY=your_firecrawl_api_key_here
```

> **How to get your Telegram Chat ID:** Message [@userinfobot](https://t.me/userinfobot) on Telegram and it will reply with your numeric ID.

---

## ▶️ Usage

### Start Inspectra

```bash
inspectra wakeup
```

You'll see the interactive startup screen and can choose between **CLI Mode** and **Telegram Mode**.

---

### CLI Mode

After selecting **CLI**, you get an interactive menu:

```
? What do you want to do?
  ❯ Agent
    Plan
    Ask
    Exit
```

#### 🧠 Agent
```
? What would you like the agent to do?
> Add error handling to all async functions in src/
```
The agent will autonomously work through the task, show you every action it takes (✓ read_file, ✓ modify_tool…), then present a **diff for your approval** before writing anything to disk.

#### 🗺️ Plan
```
? What is your goal?
> Refactor the authentication system to use JWT
```
Inspectra researches your codebase, generates a plan, lets you **toggle steps on/off**, then executes the selected ones.

#### 🔍 Ask
```
? What would you like to know about the codebase?
> How does the approval flow work?
```
Get a detailed answer. Optionally save it as a `.md` file.

---

### Telegram Mode

Start `inspectra wakeup`, select **Telegram**, and the bot comes online.

| Command | Description |
|---------|-------------|
| `/start` | Shows the welcome message |
| `/agent <task>` | Runs the AI agent on a task |
| `/ask <question>` | Asks a question about the codebase |
| `/plan <goal>` | Generates an interactive execution plan |

#### Approval Flow (Telegram)

When the agent proposes file changes, you receive an interactive message with buttons:

```
📝 1 pending change(s) require your approval.

[📄 View Diff]   [✅ Accept All]   [❌ Reject All]
```

> **Security:** Only messages from `TELEGRAM_OWNER_ID` are processed. All other users are silently ignored.

---

## 🤖 Agent Tools

The agent has access to these tools (with configurable permissions per mode):

| Tool | Description | Mutates? |
|------|-------------|----------|
| `read_file` | Read any file in the workspace | ❌ |
| `list_files` | List files & directories | ❌ |
| `search_files` | Glob pattern search with optional content filter | ❌ |
| `analyze_codebase` | Get file counts, sizes, extensions summary | ❌ |
| `list_skills` | List SKILL.md files (Cursor/Claude rules) | ❌ |
| `read_skill` | Read a specific SKILL.md | ❌ |
| `create_file` | Create a new file (staged, needs approval) | ✅ |
| `modify_tool` | Modify an existing file (staged, needs approval) | ✅ |
| `delete_file` | Delete a file (staged, needs approval) | ✅ |
| `create_folder` | Create a directory tree (staged, needs approval) | ✅ |
| `execute_shell` | Queue a shell command (staged, needs approval) | ✅ |
| `web_search` | Search the web via Firecrawl *(optional)* | ❌ |

> **Staged mutations:** All ✅ tools write to a staging area first. Nothing touches your disk until you explicitly approve.

---

## 📁 Project Structure

```
Inspectra/
├── index.ts                    # CLI entry point (Commander)
├── .env                        # Your secrets (never committed)
│
├── ai/
│   ├── ai.config.ts            # OpenRouter model setup
│   └── index.ts
│
├── terminal_ui/
│   ├── wakeup.ts               # Mode selector & ASCII banner
│   └── terminal_md.ts          # Markdown renderer for terminal
│
└── modes/
    ├── cli.ts                  # CLI mode menu loop
    │
    ├── agents/                 # Core agent engine
    │   ├── agent-tools.ts      # Tool definitions
    │   ├── tool-executor.ts    # Staged file I/O
    │   ├── action_tracker.ts   # Approval state machine
    │   ├── approval.ts         # CLI approval flow
    │   ├── orcharstrator.ts    # Agent mode entry
    │   └── types.ts            # Types & default config
    │
    ├── ask/
    │   └── orcharstrator.ts    # Ask mode (read-only agent)
    │
    ├── plan/
    │   ├── planner.ts          # Plan generation (JSON schema output)
    │   ├── web-tools.ts        # Firecrawl tools
    │   └── types.ts
    │
    └── telegram/
        ├── index.ts            # Bot setup & launch
        ├── handlers.ts         # Command & action handlers
        ├── agent-run.ts        # Telegram agent/ask/plan runners
        ├── approval-session.ts # Per-chat approval state
        ├── plan-session.ts     # Per-chat plan state & keyboard
        ├── auth.ts             # Owner ID guard
        ├── constants.ts        # WELCOME message
        └── text.ts             # Markdown helpers
```

---

## 🛠️ Tech Stack

| Technology | Purpose |
|------------|---------|
| **[Bun](https://bun.sh)** | Runtime, package manager, TypeScript execution |
| **[Vercel AI SDK](https://sdk.vercel.ai)** | `ToolLoopAgent`, `generateText`, tool primitives |
| **[OpenRouter](https://openrouter.ai)** | LLM gateway — supports 100+ models |
| **[Telegraf](https://telegraf.js.org)** | Telegram bot framework |
| **[Commander.js](https://github.com/tj/commander.js)** | CLI argument/subcommand parsing |
| **[@clack/prompts](https://github.com/bombshell-dev/clack)** | Beautiful interactive terminal UI |
| **[Firecrawl](https://firecrawl.dev)** | Web scraping & search for Plan/Ask modes |
| **[Figlet](https://github.com/patorjk/figlet.js)** | ASCII art banner |
| **[Chalk](https://github.com/chalk/chalk)** | Terminal colors |
| **[Zod](https://zod.dev)** | Schema validation for tool inputs & plan output |

---

## 🤝 Contributing

Contributions are welcome! Here's how to get started:

```bash
# Fork the repo, then:
git clone https://github.com/<your-username>/Inspectra.git
cd Inspectra
bun install
bun link

# Create a feature branch
git checkout -b feat/your-feature-name

# Make changes, then
git commit -m "feat: describe your change"
git push origin feat/your-feature-name
# Open a Pull Request 🎉
```

---

<div align="center">

<br/>

**Built with ❤️ by [Sarthak Jadhav](https://github.com/Sarthak-Jadhav-Dev)**

<img src="https://readme-typing-svg.demolab.com?font=Fira+Code&size=14&pause=2000&color=2E97F3&center=true&vCenter=true&width=400&lines=Star+⭐+if+this+helped+you!;Feedback+welcome+via+Issues." alt="Footer Typing SVG" />

</div>
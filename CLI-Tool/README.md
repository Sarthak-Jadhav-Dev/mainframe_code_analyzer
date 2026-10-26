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

### 🖥️ Mainframe Codebase Audit
Deep enterprise authenticity verification:
- AST & regex scanner across 40+ technologies
- AI heuristic pass (genuine vs. pseudo framework usage)
- Fixed-width 80-byte card serialization (RECFM=FB)
- Real Hercules TK5 MVS batch pipeline (JCL SORT, COBOL match-merge, REXX deduplication, integrity check)
- Generates normal & AI-enhanced executive audit reports

</td>
<td width="50%">

### 📋 Student Assignment Audit
Automated grading & document evaluation:
- Ingests **PDF** and **Word (DOCX)** submissions
- High-res page rendering via `@napi-rs/canvas` (144 DPI)
- AI Vision OCR to extract code from screenshots
- Multi-page student `Z_ID` consistency checks
- Code optimization grading & pedagogical suggestions
- TK5 verification & 5-section boxed report export

</td>
</tr>
<tr>
<td width="50%">

### 🔍 Ask Mode
Interactive codebase question answering:
- Read-only — never mutates files
- Deep semantic understanding of project architecture
- Great for onboarding and code exploration

</td>
<td width="50%">

### 📊 Stats & 📱 Telegram Modes
- **Stats**: Live OpenRouter token usage, credit consumption, and cost tracking
- **Telegram**: Remote control and notifications via Telegram bot (`/audit`, `/ask`, `/start`)

</td>
</tr>
</table>

---

## 🏗️ Architecture

```
bun run index.ts wakeup
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
  ┌────┴──────────────────┴───────────────────────────────────────┐
  │                          Core Modes                           │
  ├───────────────────────────────────────────────────────────────┤
  │  🖥️ Mainframe Mode                                            │
  │     ├── 📁 Codebase Audit   (AST + AI + TK5 MVS Batch)        │
  │     └── 📋 Assignment Audit (PDF/DOCX/OCR + AI + TK5 MVS)     │
  │  🔍 Ask Mode                 (Read-only Code Q&A)             │
  │  📊 Stats Mode               (OpenRouter Usage & Analytics)   │
  └───────────────────────────────────────────────────────────────┘
               │
  ┌────────────▼───────────────┐
  │  OpenRouter / AI SDK       │  ← LLMs & AI Vision OCR
  ├────────────────────────────┤
  │  Hercules TK5 (Port 3505)  │  ← MVS 3.8j Batch Pipeline
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
  ❯ 🔍 Ask       - read-only Q&A about codebase
    📊 Stats     - OpenRouter API key usage
    🖥️ Mainframe - codebase & assignment audit via Hercules TK5
    ❌ Exit
```

#### 🖥️ Mainframe Mode (Sub-Modes)
When selecting **Mainframe**, choose between:
1. **`🖥️ Codebase Audit`**: Audits a repository folder. Scans 40+ technologies, runs an AI authenticity pass (genuine vs. pseudo usage), serializes into 80-byte FB card records, and streams through the Hercules TK5 MVS batch pipeline (JCL SORT, COBOL match-merge, REXX deduplication, Step 4 Integrity).
2. **`📋 Assignment Audit`**: Evaluates a student assignment submission (`.pdf` or `.docx`). Renders pages via `@napi-rs/canvas`, extracts code from terminal/IDE screenshots using AI Vision OCR, runs student `Z_ID` consistency checks across all pages, evaluates code against the problem statement, and generates a 5-section boxed report.

#### 🔍 Ask Mode
```
? What would you like to know about the codebase?
> How does the 80-byte FB card serialization work?
```
Get a detailed answer with architecture and code references.

#### 📊 Stats Mode
Inspect real-time OpenRouter token usage, credit balance, and API expenditures.

---

### Telegram Mode

Start `bun run index.ts wakeup`, select **Telegram**, and the bot comes online for remote auditing and notifications:

| Command | Description |
|---------|-------------|
| `/start` | Shows the welcome message & instructions |
| `/audit` | Triggers a mainframe audit on the workspace |
| `/ask <question>` | Asks a question about the codebase |

> **Security:** Only messages from `TELEGRAM_OWNER_ID` are processed. All other users are silently ignored.

---

## 📁 Project Structure

```
CLI-Tool/
├── index.ts                    # CLI entry point (Commander)
├── .env                        # OpenRouter & Telegram secrets
│
├── ai/
│   ├── ai.config.ts            # OpenRouter model config
│   └── index.ts
│
├── terminal_ui/
│   ├── wakeup.ts               # Startup banner & mode selector
│   ├── icons.ts                # Terminal icons & unicode fallbacks
│   └── terminal_md.ts          # Markdown renderer for terminal
│
└── modes/
    ├── cli.ts                  # CLI mode menu loop
    │
    ├── mainframe/              # Mainframe batch auditor engine
    │   ├── assignment/         # 📋 Student Assignment Audit Engine
    │   │   ├── assignment-analyzer.ts # Completion, Z_ID, optimization AI
    │   │   ├── code-extractor.ts # AI Vision OCR from screenshots
    │   │   ├── document-parser.ts # PDF page rendering & DOCX unpacker
    │   │   ├── orchestrator.ts    # Assignment mode pipeline orchestrator
    │   │   ├── report-builder.ts  # 5-section boxed report generator & export
    │   │   └── types.ts           # Types & schemas
    │   ├── flat-file-writer.ts # 80-byte card serializer (RECFM=FB)
    │   ├── hercules-client.ts  # Hercules TCP 3505 & HTTP 8038 driver
    │   ├── jcl-templates.ts    # JCL generator (SORT, COBOL, REXX, Integrity)
    │   ├── orcharstrator.ts    # Mainframe audit orchestrator & sub-mode router
    │   ├── partitioner.ts      # AI-powered audit scope partitioner
    │   ├── scanner.ts          # Fast AST & regex tech detector (40+ libs)
    │   └── types.ts            # Mainframe interfaces
    │
    ├── ask/
    │   └── orcharstrator.ts    # Read-only code Q&A
    │
    ├── stats/
    │   └── orcharstrator.ts    # OpenRouter token usage & analytics
    │
    └── telegram/
        └── index.ts            # Telegram bot integration
```

---

## 🛠️ Tech Stack

| Technology | Purpose |
|------------|---------|
| **[Bun](https://bun.sh)** | High-speed JavaScript/TypeScript runtime & package manager |
| **[Vercel AI SDK](https://sdk.vercel.ai)** | `generateText`, model primitives, and structured AI calls |
| **[OpenRouter](https://openrouter.ai)** | Unified gateway for LLMs and AI Vision models |
| **[@napi-rs/canvas](https://github.com/Brooooooklyn/canvas)** | High-performance prebuilt canvas for rendering PDF pages to PNG (no C++ build tools needed) |
| **[pdfjs-dist](https://mozilla.github.io/pdf.js/)** | Mozilla PDF parsing and page-to-canvas rendering engine |
| **[pdf-parse](https://www.npmjs.com/package/pdf-parse)** | High-speed PDF text extraction |
| **[mammoth](https://www.npmjs.com/package/mammoth)** | DOCX document and HTML converter |
| **[adm-zip](https://www.npmjs.com/package/adm-zip)** | ZIP archive extraction for embedded DOCX screenshots |
| **[Telegraf](https://telegraf.js.org)** | Telegram bot framework |
| **[Commander.js](https://github.com/tj/commander.js)** | CLI argument/subcommand parsing |
| **[@clack/prompts](https://github.com/bombshell-dev/clack)** | Interactive terminal UI prompts & spinners |
| **[Chalk](https://github.com/chalk/chalk)** | Terminal colors & ANSI styling |

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
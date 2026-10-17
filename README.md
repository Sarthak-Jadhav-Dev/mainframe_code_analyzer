<div align="center">

# ⚡ MAINFRAME CODEBASE AUDITOR ⚡
### *Next-Gen Enterprise Codebase Authenticity & Dependency Verification Engine*

<p align="center">
  <img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=600&size=24&pause=1000&color=00D4FF&center=true&vCenter=true&width=750&lines=IBM+z%2FOS+%2B+MVS+3.8j+Hercules+TK5+Batch+Pipeline;COBOL+Match-Merge+%2B+REXX+Primary-Key+Deduplication;AI-Powered+Genuine+vs.+Pseudo+Framework+Detection;True+Mainframe+JCL+Conditional+Integrity+Orchestration" alt="Typing SVG" />
</p>

[![Mainframe MVS](https://img.shields.io/badge/Mainframe-IBM%20z%2FOS%20%2F%20MVS%203.8j-blue?style=for-the-badge&logo=ibm&logoColor=white)](file:///d:/Projects_Extended/Mainframe-Mega-Project/Documentation/MAINFRAME_AUDITOR_USER_MANUAL.md)
[![Hercules TK5](https://img.shields.io/badge/Emulator-Hercules%20TK5%20(Ports%203505%2C%208038)-00599C?style=for-the-badge&logo=serverfault&logoColor=white)](file:///d:/Projects_Extended/Mainframe-Mega-Project/Documentation/HERCULES_PORTS_GUIDE.md)
[![COBOL](https://img.shields.io/badge/Core-COBOL%2074%2F85-darkblue?style=for-the-badge&logo=gnubash&logoColor=white)](file:///d:/Projects_Extended/Mainframe-Mega-Project/Mainframe-Programs/AUDCOBOL.cbl)
[![REXX](https://img.shields.io/badge/Scripting-TSO%2FE%20REXX-purple?style=for-the-badge)](file:///d:/Projects_Extended/Mainframe-Mega-Project/Mainframe-Programs/AUDRXXX.rexx)
[![Bun](https://img.shields.io/badge/Runtime-Bun%20v1.1+-black?style=for-the-badge&logo=bun&logoColor=white)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)

<br/>

```text
 ╔═════════════════════════════════════════════════════════════════════════════════════╗
 ║   [01] LOCAL AST SCAN  ──>  [02] AI AUTHENTICITY  ──>  [03] 80-BYTE FLAT FILE (FB)  ║
 ║                                      │                                              ║
 ║                                      ▼                                              ║
 ║   [06] REPORT RETRIEVAL <── [05] TK5 JES2 MVS BATCH <── [04] TCP PORT 3505 SOCKET   ║
 ╚═════════════════════════════════════════════════════════════════════════════════════╝
```

---

</div>

## 🌌 Overview

The **Mainframe Codebase Auditor** is a hybrid enterprise system coupling modern agentic developer tooling with enterprise mainframe batch architecture. 

In academic and enterprise evaluations, developers often inject heavy libraries into `package.json` or write superficial `import` statements to mimic full-stack sophistication. This project inspects any target codebase, serializes AST and dependency metadata into strict **80-byte fixed-width (FB) card-image records**, streams them into an **IBM MVS 3.8j / Hercules TK5** mainframe emulator, and executes a 4-stage batch pipeline using **JCL, COBOL, and REXX** for their authentic architectural strengths.

> **Zero-Decorations Guarantee**: JCL condition codes, COBOL two-file sequential match-merge, and REXX stem hash-tables are executed for real system integrity verification—not ornamental wrappers.

---

## 🏛️ System Architecture

```mermaid
flowchart TD
    subgraph Preprocessing ["🖥️ Plotoris Preprocessing Layer (Local Bun Runtime)"]
        Repo["📂 Target Repository<br/>(JS/TS/React/Vue/Node)"] --> Scanner["⚡ High-Speed AST/Regex Scanner<br/>(40+ Tech Signatures)"]
        Scanner --> MD5["🔑 MD5 Content Hasher<br/>(Primary Key Generation)"]
        MD5 --> AI["🤖 OpenRouter AI Pass<br/>(Genuine vs. Pseudo Heuristic)"]
        AI --> FlatFile["📄 80-Byte FB Card Serializer<br/>(RECFM=FB, LRECL=80)"]
    end

    subgraph Mainframe ["🏛️ Mainframe Batch Pipeline (Hercules TK5 / MVS 3.8j)"]
        FlatFile -->|TCP Port 3505 Socket| JES2["📥 JES2 Card Reader Queue"]
        JES2 --> Step1["1️⃣ Req 1: JCL SORT (PGM=SORT)<br/>Sort by TECH_NAME & FILE_PATH"]
        Step1 -->|STUDENT.AUDIT.SORTED| Step2["2️⃣ Req 2: COBOL (PGM=AUDCOBOL)<br/>Sequential Match-Merge vs TECHREF"]
        TechRef[("📚 STUDENT.AUDIT.TECHREF<br/>Authorized Tech Reference")] --> Step2
        Step2 -->|STUDENT.AUDIT.COBOL| Step3["3️⃣ Req 3: REXX (AUDRXXX)<br/>Deduplication via CONTENT_HASH Stem"]
        Step3 -->|STUDENT.AUDIT.REXX| Step4["4️⃣ Req 4: IBM SORT Descending<br/>+ AUDCOUNT Record Integrity Check"]
        Step4 -->|RC=0000 Counts Match| Keep["✅ STEPKEEP (IEBGENER)<br/>Catalog Final Report"]
        Step4 -->|RC=0012 Mismatch| Err["❌ STEPERR (IKJEFT01)<br/>Discard Dataset & Emit Alert"]
    end

    subgraph Ingestion ["📊 Report Delivery & Consumption"]
        Keep --> Syslog["📡 Port 8038 HTTP Console<br/>JES2 Syslog Scraper"]
        Syslog --> Term["💻 Interactive Terminal UI<br/>(Markdown & Rich Tables)"]
        Syslog --> TG["📱 Telegram Bot (/audit)"]
    end

    style Preprocessing fill:#111827,stroke:#3b82f6,stroke-width:2px,color:#fff
    style Mainframe fill:#0f172a,stroke:#8b5cf6,stroke-width:2px,color:#fff
    style Ingestion fill:#1e1b4b,stroke:#06b6d4,stroke-width:2px,color:#fff
```

---

## 🎯 The Four Mandatory Course Requirements

| Requirement | Mainframe Tech | Implementation File | Architectural Role & Genuine Strength |
| :---: | :---: | :---: | :--- |
| **Requirement 1** | **JCL SORT** | [`STEP1_SORT.jcl`](file:///d:/Projects_Extended/Mainframe-Mega-Project/Mainframe-Programs/STEP1_SORT.jcl) | Sorts raw flat-file records by `TECH_NAME` (cols 41–50) and `FILE_PATH` (cols 1–40) to prepare aligned input streams for sequential matching. |
| **Requirement 2** | **COBOL Match-Merge** | [`AUDCOBOL.cbl`](file:///d:/Projects_Extended/Mainframe-Mega-Project/Mainframe-Programs/AUDCOBOL.cbl) | Reads two sequential files (`AUDREC` and reference table `TECHREF`), executes match-merge logic, maps canonical tech categories, and records audit metrics. |
| **Requirement 3** | **REXX Deduplication** | [`AUDRXXX.rexx`](file:///d:/Projects_Extended/Mainframe-Mega-Project/Mainframe-Programs/AUDRXXX.rexx) | Utilizes associative stems (`seen_hash.hash`) on the 8-character `CONTENT_HASH` primary key to isolate and prune duplicate source files, followed by primary-key sort. |
| **Requirement 4** | **IBM SORT Descending & Integrity Check** | [`STEP4_INTEGRITY_SUCCESS.jcl`](file:///d:/Projects_Extended/Mainframe-Mega-Project/Mainframe-Programs/STEP4_INTEGRITY_SUCCESS.jcl)<br/>[`STEP4_INTEGRITY_FAILURE.jcl`](file:///d:/Projects_Extended/Mainframe-Mega-Project/Mainframe-Programs/STEP4_INTEGRITY_FAILURE.jcl) | Copies and sorts records in descending order (`SORT FIELDS=(1,80,CH,D)`), verifies pre/post record counts via `AUDCOUNT.rexx`, and branches using JCL conditional execution (`COND=(0,NE)` keeps dataset, `COND=(0,EQ)` aborts and warns). **Tests both success & failure cases**. |

---

## 📜 80-Byte Fixed-Width Record Layout (RECFM=FB, LRECL=80)

Every record transmitted to MVS complies with standard 80-column punched card specifications:

```
  1                                     41        51       59        69  73      80
  ├──────────────────────────────────────┼─────────┼────────┼─────────┼───┼───────┤
  │              FILE_PATH               │TECH_NAME│  HASH  │USAGE_TYP│CNT│RESRVD │
  ├──────────────────────────────────────┼─────────┼────────┼─────────┼───┼───────┤
  │ SRC/COMPONENTS/USERPROFILE.TSX       │ REACT   │B9560F26│GENUINE  │002│       │
  │ SRC/LEGACY/FAKE-STORE.TS             │ REDUX   │E559B9A2│PSEUDO   │001│       │
  └──────────────────────────────────────┴─────────┴────────┴─────────┴───┴───────┘
```

---

## 🚀 Quick Start & Usage

### 1. Prerequisites
- **Runtime**: [Bun](https://bun.sh) (v1.1 or higher)
- **Mainframe**: Hercules TK5 (MVS 3.8j) — *Optional (Simulated fallback active when offline)*

### 2. Setup
```bash
# Clone the repository
git clone https://github.com/Sarthak-Jadhav-Dev/mainframe_code_analyzer.git
cd mainframe_code_analyzer/CLI-Tool

# Install dependencies
bun install
```

### 3. Launching the Interactive Auditor
```bash
bun run index.ts wakeup
```
1. Select **`🖥️ Mainframe`** from the interactive menu.
2. Provide the path to the target repository (e.g. `../demo-student-repo`).
3. Select your **Requirement 4 Test Mode**:
   - `Normal Verification (Success Case)`: Verifies zero records dropped and catalogs dataset.
   - `Simulate Failure Case`: Simulates dropped record, triggering Condition Code `0012` and automatic dataset discard.

---

## 🧪 Built-In Test Repository (`demo-student-repo`)

A dedicated student portfolio demo is provided at [`demo-student-repo/`](file:///d:/Projects_Extended/Mainframe-Mega-Project/demo-student-repo):

```text
demo-student-repo/
├── package.json
└── src/
    ├── components/
    │   └── UserProfile.tsx      <-- GENUINE React & Axios active usage
    ├── server.ts                <-- GENUINE Express backend API
    ├── db/
    │   └── client.ts            <-- GENUINE Prisma client
    ├── legacy/
    │   └── fake-store.ts        <-- PSEUDO / Superficial unused imports
    ├── utils/
    │   └── math-helper.ts       <-- Original file (Hash: 6691298E)
    └── helpers/
        └── calc-copy.ts         <-- EXACT DUPLICATE (Hash: 6691298E)
```

---

## 📡 Hercules Port Configuration

| Port | Service | Protocol | Function |
| :---: | :---: | :---: | :--- |
| **`3505`** | **Card Reader** | TCP Socket | Raw JCL submission directly into the JES2 reader queue |
| **`8038`** | **HTTP Console** | HTTP GET/POST | Syslog querying, condition code monitoring (`$HASP395`), and job output retrieval |
| **`3270`** | **TN3270 Terminal** | Telnet | Interactive operator console and TSO/E terminal |

---

## 📁 Repository Structure

```text
mainframe_code_analyzer/
├── CLI-Tool/                     # Plotoris agentic CLI (Bun + TypeScript)
│   ├── modes/mainframe/          # Mainframe orchestration, scanner & JCL engines
│   │   ├── flat-file-writer.ts   # 80-byte card serializer/deserializer
│   │   ├── hercules-client.ts    # TCP port 3505 & HTTP port 8038 driver
│   │   ├── jcl-templates.ts      # Multi-stage JCL template generator
│   │   ├── orcharstrator.ts      # 11-step interactive auditor pipeline
│   │   ├── scanner.ts            # Fast AST & regex tech detector (40+ libs)
│   │   └── types.ts              # Core data interfaces
│   └── modes/telegram/           # Telegram bot integration (/audit)
├── Mainframe-Programs/           # Pure MVS 3.8j assets (JCL, COBOL, REXX)
│   ├── AUDCOBOL.cbl              # COBOL 74/85 two-file match-merge program
│   ├── AUDRXXX.rexx              # TSO/E REXX deduplicator & primary key sorter
│   ├── AUDCOUNT.rexx             # REXX record count integrity comparator
│   ├── TECHREF.txt               # 80-byte reference table of authorized tech
│   ├── STEP1_SORT.jcl            # Requirement 1 JCL Sort
│   ├── STEP2_COBOL.jcl           # Requirement 2 COBOL Match-Merge JCL
│   ├── STEP3_REXX.jcl            # Requirement 3 REXX Deduplication JCL
│   ├── STEP4_INTEGRITY_SUCCESS.jcl # Requirement 4 Success Verification JCL
│   ├── STEP4_INTEGRITY_FAILURE.jcl # Requirement 4 Failure Test Case JCL
│   ├── PIPELINE_COMPLETE.jcl     # All-in-one multi-step JCL stream
│   └── INSTALL_TK5.jcl           # MVS library allocation & compilation JCL
├── Documentation/                # Verified system manuals & technical guides
│   ├── HERCULES_PORTS_GUIDE.md   # Port layout & verification notes
│   ├── HERCULES_INTEGRATION_GUIDE.md # Socket & HTTP API specifications
│   └── MAINFRAME_AUDITOR_USER_MANUAL.md # Step-by-step teacher demo manual
└── demo-student-repo/            # Evaluation test repo with genuine/pseudo code
```

---

<div align="center">

Developed with ❤️ for Advanced Enterprise Batch Systems Architecture.  
*Emulating 1970s Mainframe Power with 2026 Developer Agility.*

</div>

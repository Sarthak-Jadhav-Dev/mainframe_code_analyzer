/**
 * Terminal UI Icons & Symbol Helper
 * ---------------------------------
 * Detects terminal capabilities to avoid the infamous Windows '?' glyph bug.
 *
 * In modern terminals (Windows Terminal, VS Code, Linux/macOS):
 *   Uses full rich emojis (🖥️, 🔍, 📊, 🚪, 🌟, 📄, etc.)
 *
 * In legacy Windows console host (conhost.exe classic CMD / PowerShell):
 *   Gracefully falls back to clean, legible text badges and ASCII symbols,
 *   preventing ugly '?' replacement characters.
 */

export const isModernTerminal = Boolean(
    process.env.WT_SESSION || // Windows Terminal
    process.env.TERM_PROGRAM === "vscode" || // VS Code Integrated Terminal
    process.env.COLORTERM ||
    process.env.CI ||
    process.platform !== "win32" // macOS / Linux
);

export const ICONS = isModernTerminal
    ? {
          mainframe: "🖥️ ",
          assignment: "📋",
          search: "🔍",
          stats: "📊",
          exit: "🚪",
          star: "🌟",
          doc: "📄",
          folder: "📁",
          globe: "🌐",
          check: "✓",
          warn: "⚠",
          error: "✗",
          dash: "-",
      }
    : {
          mainframe: "[HOST] ",
          assignment: "[ASGN] ",
          search: "[ASK] ",
          stats: "[STATS]",
          exit: "[EXIT] ",
          star: "[*]",
          doc: "[#]",
          folder: "[DIR] ",
          globe: "[ALL] ",
          check: "[OK]",
          warn: "[!]",
          error: "[X]",
          dash: "-",
      };

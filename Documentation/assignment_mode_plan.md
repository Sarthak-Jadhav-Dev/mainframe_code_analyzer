# 📋 Assignment Mode — Implementation Plan

## Overview
Add an **Assignment Mode** sub-option inside the existing Mainframe mode. When selected, the system:
1. Accepts a PDF or DOCX document (student assignment submission)
2. Asks the user for the assignment's **problem statement**
3. Extracts code from screenshots/text in the document using AI (OCR via vision model)
4. Analyzes the extracted code through a **hybrid AI + Mainframe (TK5) pipeline**
5. Produces a specialized **Assignment Audit Report** with:
   - ✅ Assignment Completed or Not
   - 🆔 Z_IDs consistency check
   - ⚡ Code optimization analysis
   - 💡 Suggestions to improve the code

## Architecture: Hybrid AI + TK5 Approach

```
PDF/DOCX ──► Document Parser ──► AI Vision (OCR screenshots) ──► Code Extraction
                                                                      │
                                                                      ▼
Problem Statement ──► AI Analysis Engine ──► Assignment Report Builder
                          │                          │
                          ▼                          ▼
                   Code → 80-byte FB ──► TK5 Mainframe Pipeline
                   (SORT → COBOL → REXX → Integrity Check)
```

**Hybrid approach:**
- **AI side**: Document parsing, OCR from screenshots, code analysis, optimization checks, suggestions
- **TK5/Mainframe side**: Code structure records go through the same SORT → COBOL → REXX → Integrity pipeline for authenticity verification and structural audit

---

## Files to Create/Modify

### New Files
| File | Purpose |
|------|---------|
| `CLI-Tool/modes/mainframe/assignment/orchestrator.ts` | Main assignment mode orchestrator |
| `CLI-Tool/modes/mainframe/assignment/document-parser.ts` | PDF/DOCX text + image extraction |
| `CLI-Tool/modes/mainframe/assignment/code-extractor.ts` | AI-powered OCR + code extraction from images |
| `CLI-Tool/modes/mainframe/assignment/assignment-analyzer.ts` | AI analysis engine (completion, z_id, optimization, suggestions) |
| `CLI-Tool/modes/mainframe/assignment/report-builder.ts` | Assignment-specific report builder |
| `CLI-Tool/modes/mainframe/assignment/types.ts` | Assignment mode type definitions |

### Modified Files
| File | Change |
|------|--------|
| `CLI-Tool/modes/mainframe/orcharstrator.ts` | Add "Assignment Mode" sub-menu option inside `runMainframeMode()` |
| `CLI-Tool/terminal_ui/icons.ts` | Add `assignment` icon |
| `CLI-Tool/package.json` | Add `pdf-parse` and `mammoth` dependencies |

---

## Step-by-Step Implementation

### Phase 1: Dependencies & Types
1. Add `pdf-parse` (PDF text+image extraction) and `mammoth` (DOCX→HTML) to package.json
2. Define Assignment mode types (extracted code blocks, analysis results, report structure)

### Phase 2: Document Parser
- Parse PDF using `pdf-parse` to extract text content
- Parse DOCX using `mammoth` to extract HTML/text content
- Extract embedded images from both formats for OCR processing

### Phase 3: Code Extractor (AI Vision)
- Send extracted images to AI vision model for OCR
- Parse code blocks from extracted text
- Detect programming language of each code block
- Extract Z_IDs from assignment title/header

### Phase 4: Assignment Analyzer (AI + TK5 Hybrid)
- **AI Analysis**: Send extracted code + problem statement to AI for:
  - Completion assessment (does code solve the problem?)
  - Z_ID consistency check (are student IDs consistent across pages?)
  - Code optimization analysis
  - Improvement suggestions
- **TK5 Pipeline**: Convert code structure into 80-byte records and run through:
  - SORT (organize by code structure)
  - COBOL match-merge (validate against known patterns)
  - REXX deduplication (detect copied code blocks)
  - Integrity check (verify data consistency)

### Phase 5: Report Builder
- Build comprehensive assignment report combining AI + TK5 results
- Save as .txt with structured sections

### Phase 6: Integration
- Add sub-menu in mainframe orchestrator
- Wire up the complete flow

---

## Report Output Structure

```
════════════════════════════════════════════════════════════════════════
  MAINFRAME ASSIGNMENT AUDITOR — ASSIGNMENT EVALUATION REPORT
════════════════════════════════════════════════════════════════════════

  ┌──────────────────────────────────────────────────────────────────┐
  │ SECTION 1: ASSIGNMENT COMPLETION STATUS                          │
  ├──────────────────────────────────────────────────────────────────┤
  │ Verdict: ✓ COMPLETED / ✗ INCOMPLETE                             │
  │ Problem Statement Match: XX%                                     │
  │ Requirements Met: X / Y                                          │
  └──────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────┐
  │ SECTION 2: Z_ID CONSISTENCY CHECK                                │
  ├──────────────────────────────────────────────────────────────────┤
  │ Z_IDs Found: Z12345678, Z12345679                                │
  │ Consistency: ✓ CONSISTENT / ✗ INCONSISTENT                      │
  │ Details: All pages reference the same student ID                 │
  └──────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────┐
  │ SECTION 3: CODE OPTIMIZATION ANALYSIS                            │
  ├──────────────────────────────────────────────────────────────────┤
  │ Overall Optimization: B+ (Good)                                  │
  │ Time Complexity: O(n log n) - Acceptable                         │
  │ Space Complexity: O(n) - Efficient                               │
  │ Code Smells Detected: 3                                          │
  └──────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────┐
  │ SECTION 4: SUGGESTIONS FOR IMPROVEMENT                           │
  ├──────────────────────────────────────────────────────────────────┤
  │ 1. Use more descriptive variable names...                        │
  │ 2. Consider edge case handling for...                            │
  │ 3. Refactor duplicate logic in...                                │
  └──────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────┐
  │ SECTION 5: MAINFRAME PIPELINE VERIFICATION (TK5)                 │
  ├──────────────────────────────────────────────────────────────────┤
  │ [STAGE 1] JCL SORT: RC=0000                                      │
  │ [STAGE 2] COBOL Match-Merge: RC=0000                             │
  │ [STAGE 3] REXX Deduplication: RC=0000                            │
  │ [STAGE 4] Integrity Check: RC=0000                               │
  └──────────────────────────────────────────────────────────────────┘
════════════════════════════════════════════════════════════════════════
```

> [!IMPORTANT]
> This plan creates 6 new files and modifies 3 existing files. The assignment mode integrates as a sub-option within the existing Mainframe mode, reusing the existing TK5 pipeline infrastructure.

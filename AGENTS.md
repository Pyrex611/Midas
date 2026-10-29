# AGENTS.md — Autonomous Engineering & AI Agent Protocol

This document establishes the non-negotiable operational directives, safety constraints, and code generation standards for AI coding agents (and human engineers) contributing to the **MIDAS Autonomous Email Management System**.

---

## 1. MANDATORY CODE GENERATION LAWS

### Law 1: Full, Unabridged Code Delivery (Zero Truncation)
- **No Partial Code:** Never output partial diffs, incomplete snippets, or placeholders like `// ... rest of code unchanged`.
- **Complete File Replacement:** When modifying an existing file or introducing a new module, always deliver the **entire, unabridged file from line 1 to EOF**. This completely eliminates copy-paste merge corruptions and import dropouts.
- **Verification Before Delivery:** Every generated file must be syntax-checked against the current repository state and existing interfaces.

### Law 2: Strict Client vs. Server Boundary Isolation
- **`server/` (Backend / Node.js Runtime):**
  - Compiled by `tsconfig.server.json`.
  - Allowed dependencies: `@prisma/client`, `pg`, `crypto`, `fs`, `winston`, `multer`, `express`.
  - Must never import React, JSX, DOM globals, or browser APIs.
- **`src/` (Frontend / Vite + React Runtime):**
  - Bundled by Vite / Rollup.
  - Allowed dependencies: React, Clerk React, Axios (`services/api.ts`), Tailwind CSS.
  - **CRITICAL:** Must **never** import `prisma`, `pg`, `fs`, `crypto`, or any file from `server/lib/` or `server/services/`. All backend interactions must strictly traverse HTTP endpoints through `src/services/api.ts`.

### Law 3: Non-Destructive Evolutionary Migrations
- **Preserve Verified Code:** Never rewrite a functional, tested component from scratch when a targeted patch or surgical enhancement achieves the goal.
- **No Feature Drops:** In redesigns, all original capabilities (buttons, modals, role checks, time windows, auto-reply flags) must be verified via a feature trace matrix before presenting the output.

---

## 2. AUTOMATED REGRESSION & INTEGRITY GUARDS

To answer: *"Is it necessary to integrate checks into the codebase to ensure features are not lost or degraded?"*
**Yes, it is essential.** In an AI-assisted engineering workflow, the following automated checks must guard the repository:

### Layer A: Double TypeScript Verification Pipeline
Add this script to `package.json` to verify both server and client TypeScript boundaries simultaneously before every push:
```json
"scripts": {
  "typecheck": "tsc -p tsconfig.server.json --noEmit && tsc -p tsconfig.json --noEmit"
}
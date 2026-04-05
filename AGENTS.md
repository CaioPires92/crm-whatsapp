# AI Agent Context & Guidelines - CRM WhatsApp

This file provides essential context for AI agents working on this repository (Codex, Cloud Code, etc.).

---

## 🏗️ Project Architecture

- **Frontend**: React + Vite + TypeScript.
- **Backend/DB**: Supabase (Postgres).
- **Communication**: Evolution API v2 (Local Docker).
- **Automation**: n8n workflows located in `/n8n/workflows`.
- **Documentation**: Organized by domain inside `/docs`.

---

## ⚙️ Environment & Setup

### Docker Management
The infrastructure is located in `/infra/docker-compose.yml`.
> [!IMPORTANT]
> **Project Name**: Always use the project name **`crm`** to ensure data persistence with existing volumes.
> **Command**: `docker-compose -p crm -f infra/docker-compose.yml --env-file .env up -d`

### Essential Environment Variables (`.env`)
- `DATABASE_SAVE_DATA_LABELS=true`: Required for label filtering.
- `DATABASE_SAVE_DATA_CHATS=true`: Required for chat history persistence.
- `instância=delplata2026`: Default instance name (No spaces after `=`).

---

## 🗄️ Database & Schema (Supabase)

- **`Leads` Table**: Stores contact info, kanban stage, and labels.
- **`n8n_chat_histories`**: Stores actual message content synced from WhatsApp.
- **Label Structure**: Array of objects: `[{ "id": "X", "name": "Name", "color": "Y" }]`.

---

## 🎨 Design System Standards

- **Theme**: Dark mode (Modern/Premium).
- **Colors**: Use HSL for dynamic elements.
- **Icons**: Always use `lucide-react`.
- **Components**: Located in `src/components`, follow the established Glassmorphism style.

---

## 🤖 AI Agent (Aura)
- **Role**: Qualifies leads via WhatsApp.
- **Knowledge**: Stored in `docs/agents/aura.md`.
- **Logic**: Processed via n8n tool calling.

---

## 📘 Implementation Source of Truth

- Use `docs/setup/implementation-master-guide.md` as the primary source of truth for:
  - implementation backlog
  - status of delivered work
  - next planned steps
  - validation criteria
  - future Aura / CRM / integration updates
- Before answering questions such as what is pending, what to do today, what is next, current status, priorities, backlog, delivered work, or validation state, consult `docs/setup/implementation-master-guide.md` first.
- Before proposing or executing work that may change current priorities, confirm the latest state in `docs/setup/implementation-master-guide.md`.
- When a relevant implementation is completed, update this document.
- When a backlog item is finished, mark it there or remove it from the pending list there.
- Avoid creating parallel roadmap documents for Aura operations unless there is a strong reason.
- Keep low-level schema details in SQL files when appropriate, but keep implementation status and operational intent in `docs/setup/implementation-master-guide.md`.

---

## 🧠 Skill Triggers For This Project

When superpowers skills are available, use these trigger rules by default:

- Use `systematic-debugging` for bugs, regressions, failed executions, broken workflows, missing WhatsApp replies, inconsistent Supabase writes, or unclear root-cause investigations.
- Use `writing-plans` before implementing medium or large changes that touch more than one layer, especially combinations of `frontend + Supabase`, `n8n + Supabase`, or `frontend + n8n + Supabase`.
- Use `brainstorming` before implementation when the user is comparing approaches, asking for the best architecture, designing a new flow, or when requirements are still ambiguous.
- Use `verification-before-completion` before closing any task that changes workflows, data flow, operational rules, integrations, or user-visible CRM behavior.
- Use `subagent-driven-development` only for larger tasks that can be split into independent slices with low overlap, such as separate changes in React, n8n workflows, and scripts/migrations.
- Use `test-driven-development` mainly for changes in `src/` and `scripts/` that add or refactor critical logic. Do not force it for simple n8n-only edits.

Practical defaults:
- Small edit with low risk: work directly, then verify.
- Medium change: use `writing-plans`, then implement, then `verification-before-completion`.
- Strange bug: start with `systematic-debugging`.
- Big feature or architecture change: start with `brainstorming`, then `writing-plans`.

If the user explicitly requests a skill by name, always honor that request.

Reference:
- `docs/setup/codex-superpowers-guide.md`

---

## 🛠️ Common Operations & Gotchas

- **Label Sync**: When syncing labels, ensure the Evolution API query uses the specialized `/label/findLabelChats` endpoint for better reliability.
- **Instance 404**: If the API returns 404 for an instance, verify that the containers were started with the `-p crm` prefix to load the correct volumes.
- **Deduplication**: `LeadList.tsx` handles frontend deduplication based on `remoteJid`.

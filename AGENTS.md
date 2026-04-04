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
- When a relevant implementation is completed, update this document.
- When a backlog item is finished, mark it there or remove it from the pending list there.
- Avoid creating parallel roadmap documents for Aura operations unless there is a strong reason.
- Keep low-level schema details in SQL files when appropriate, but keep implementation status and operational intent in `docs/setup/implementation-master-guide.md`.

---

## 🛠️ Common Operations & Gotchas

- **Label Sync**: When syncing labels, ensure the Evolution API query uses the specialized `/label/findLabelChats` endpoint for better reliability.
- **Instance 404**: If the API returns 404 for an instance, verify that the containers were started with the `-p crm` prefix to load the correct volumes.
- **Deduplication**: `LeadList.tsx` handles frontend deduplication based on `remoteJid`.

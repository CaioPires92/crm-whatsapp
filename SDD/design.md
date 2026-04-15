# Technical Design - CRM WhatsApp

## Technology Stack
- **Frontend**: React + Vite + TypeScript.
- **Backend/DB**: Supabase (PostgreSQL + Auth + Realtime).
- **Communication Engine**: Evolution API v2 (Docker).
- **Automation Layer**: n8n (hosting workflows in `/n8n/workflows`).
- **Styling**: Tailwind CSS v4 + Lucide React (Icons).
- **UI Architecture**: Glassmorphism with Dark Mode (Modern/Premium).

## Database Schema Highlights
- **`Leads`**: `id`, `created_at`, `lead_nome`, `lead_id` (phone number), `remoteJid`, `labels` (jsonb).
- **`n8n_chat_histories`**: `id`, `session_id` (lead_id), `message` (jsonb), `hora_data_mensagem`.
- **`campaigns`**: `id`, `nome`, `mensagem`, `status`, `criada_em`.
- **`campaign_recipients`**: `id`, `campaign_id`, `lead_id`, `telefone`, `status`, `erro`, `enviado_em`.
- **`assistant_settings`**: Stores Aura operational modes and state.
- **`assistant_rules`** & **`room_rates`**: Rules and pricing for AI logic.
- **`hospedin_settings`**: Configuration for external PMS integration.

## Automation Workspace (n8n)
Managed as a separate workspace in the `/n8n` directory.
- **Workflows** (`/n8n/workflows/`):
  - `agente-whatsapp.json`: Main AI agent interaction.
  - `hotel-kanban.json`: Kanban board synchronization and card movement.
  - `label-sync.json`: Real-time labeling logic.
  - `selective-sync.json`: Optimized data synchronization.
- **Configs**: Node.js based management (`package.json`, `tsconfig`).

## Application Architecture
### Routes
- `/login`: User entry and authentication.
- `/kanban`: Drag-and-drop funnel management (Main View).
- `/contatos`: Contact listing, search, and label filtering.
- `/campanhas`: Marketing campaign management and history.
- `/settings`: Configuration for account and API integration.

### Core Components
- **`ProtectedRoute`**: Auth-check wrapper.
- **`SidebarNav`**: Resizable navigation (draggable border, persistence in localStorage).
- **`LeadList`**: Sidebar component for searching and selecting active conversations.
- **`ChatArea`**: Main viewport for viewing message history with optimized scrolling.

## Design Patterns
- **Tailwind v4 Integration**: Uses `@tailwindcss/vite` plugin.
- **Real-time Sync**: Subscription to `n8n_chat_histories` for instant UI updates.
- **Scrolling Policy**: Manual `scrollTop` manipulation on a dedicated viewport ref to avoid layout shifts.
- **Glassmorphic UI**: Background blurs, subtle borders, and harmonious HSL-based label colors.

# Project Tasks & Progress

## [✅] Phase 1: Core Implementation (60% Done)

### Infrastructure & Backend

- [✅] Dockerized environment setup (Evolution API, n8n).
- [✅] Supabase tables and RLS policies creation.
- [✅] n8n `hotel-kanban` workflow (message capture, lead creation, Aura responses).
- [✅] Operational seed sync script (Sync local data to DB).

### Frontend Fundamentals

- [✅] Project initialization (React + Vite + Tailwind v4).
- [✅] Authentication system (Login/ProtectedRoute).
- [✅] Kanban Dashboard implementation.
- [✅] Contact List with search and label filtering.
- [✅] Chat UI with date grouping and message type support (Text/Image/Audio).
- [✅] Sidebar resizing logic with persistence.

### AI Integration

- [✅] Aura rules logic (assistant_rules).
- [✅] Room rate pricing logic (room_rates).
- [✅] Auto/Manual mode toggle functionality.
- [✅] Handoff to human logic.

---

## [🔲] Phase 2: Completion Backlog (40% Remaining)

### 1. External Integration (Hospedin)

- [🔲] Resolve Hospedin API 403 (Maintenance).
- [🔲] Map `place_type_id` real values and confirm `account_slug`.
- [🔲] Activate `hospedin_settings.enabled`.
- [🔲] End-to-end validation (Aura quoting real availability).

### 2. Marketing & Campaign Maturity

- [🔲] Implement Marketing Opt-in field in `Leads`.
- [🔲] Add Cooldown and Blacklist logic for broadcast prevention.
- [🔲] Build historical Campaign Dashboard.
- [🔲] Refine campaign blocking inference rules.

### 3. Final QA & Polishing

- [🔲] Full QA cycle for all message types (Audio, Legendary Images).
- [🔲] Manual E2E validation of the main WhatsApp -> n8n -> Supabase -> CRM flow.
  Use [`manual-whatsapp-e2e-tests.md`](/home/caio/projetos/CRM/docs/manual-whatsapp-e2e-tests.md).
- [✅] Automated test baseline:
  unit tests for lead/campaign helpers, Hospedin config helpers, workflow smoke, seed smoke, and sync dry-run.
- [🔲] Confirm the main WhatsApp flow is stable across these blocks:
  first contact, follow-up without duplication, Aura auto reply, manual mode, handoff, media and fallback.
- [🔲] Fix security vulnerability: Obfuscate `VITE_EVOLUTION_API_KEY`.
- [🔲] Setup Linting and CI/CD basics (ESLint).
- [🔲] Optimize bundle size (currently > 500kB).
- [🔲] Visual polish: Refine animations and WhatsApp-fidelity transitions.
- [🔲] Cleanup final migration backups after stabilization:
  delete `/home/caio/projetos/CRM.pre-migration-20260413-214735`
  and `/home/caio/backups/crm-migration-20260413-214735`.

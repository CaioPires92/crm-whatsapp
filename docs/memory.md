# System Memory - CRM WhatsApp

## Context Summary
- **Project**: WhatsApp CRM for managing leads qualified by AI (Aura).
- **Status**: 60% complete. Core Kanban and Chat are functional.
- **Stack**: React/Vite/TS + Supabase + n8n + Evolution API v2.
- **Key Identity**: The lead is identified by phone number (`lead_id`).

## Essential Rules
- **Aesthetics**: Dark Mode, Glassmorphism, Premium feel.
- **## Behavior & Constraints
- **Modes**: Piloto Automático (Auto) vs Manual. Handoff triggers "Aguardando Humano" stage.
- **Strict Aura Rules**: Never hallucinate or invent policies. If data is missing in DB (rates, rules, Wi-Fi, etc.), wait for human validation.
- **Consistency**: Labels and messages are synced to Supabase (Postgres). 
- **Modularity**: Operational inbox is isolated from Batch Marketing flows.

## Backlog Focus
1. **Hospedin**: Needs real API access and mapping.
2. **Campaigns**: Needs opt-in, blacklist, and cooldown logic.
3. **QA**: Robust testing of all media types and mode transitions.
4. **Security**: Obfuscate API keys from frontend.

## Reference Documentation
- [requirements.md](file:///Ubuntu/home/caio/projetos/CRM/docs/requirements.md)
- [design.md](file:///Ubuntu/home/caio/projetos/CRM/docs/design.md)
- [tasks.md](file:///Ubuntu/home/caio/projetos/CRM/docs/tasks.md)

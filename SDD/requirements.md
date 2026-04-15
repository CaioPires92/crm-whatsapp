# Project Requirements - CRM WhatsApp

## Vision Overview
A unified dashboard to visualize and manage WhatsApp conversations between virtual assistants (Aura) and leads. The system centralizes data stored in Supabase into a premium, read-only (mostly) dashboard for monitoring and human intervention.

## Core Features
1. **Kanban Dashboard**: Visual management of leads through sales funnel stages (Novos, Qualificados, Agendados, etc.).
2. **Intelligent Contact List**:
   - Deduplication by `remoteJid`.
   - Real-time status indicators (Realtime sync from Supabase).
   - Dynamic filtering by labels/tags.
3. **Integrated Chat Area**:
   - WhatsApp-style conversation view with date grouping.
   - Message support for text, images (with/without legends), and audio.
   - Automatic scrolling to latest messages (without `scrollIntoView`).
4. **AI Agent (Aura) Logic**:
   - **Modes**: Toggle between "Piloto Automático" (Auto) and "Modo Manual".
   - **Handoff Logic**: Triggers on specific sensitive intents or manual mode activation.
   - **Strict Rules**: No hallucinations; defer to human if data is missing.
5. **Marketing Campaigns (Batch Sending)**:
   - Segmentation by labels and deduplication by valid phone number.
   - Campaign drafting, recipient persistence, and batch dispatch via Evolution API.
   - Initial metric tracking (Sent, Replies, Ignored, Blocked/Failed).
6. **Operational Sync**: Integration with local data seeds for rules and rates.

## Business Rules
- **Inbox Isolation**: Separate operational chat inbox from batch marketing campaign flows.
- **Identification**: Leads are uniquely identified by their phone number (without @s.whatsapp.net).
- **Automation Sovereignty**: The agent (n8n + Aura) handles writing to the database; the CRM primarily visualizes these interactions.
- **Priority Names**: Real names (PushNames) take precedence over generic identifiers.
- **Handoff Logic**: Triggers on specific sensitive intents or manual mode activation.
- **Campaign Eligibility**: Requires valid phone number, deduplication, and absence of blocks.

## Out of Scope
- **Direct WhatsApp Sending**: The frontend does not send messages directly to the WhatsApp API (handled by n8n/Evolution).
- **User Broadcasts**: Not intended for bulk messaging/spam without explicit lead interaction.
- **Database Editing**: No direct schema editing or raw data manipulation from the UI (except for mode toggles and labels).

# CRM - WhatsApp Lead Management System

Este documento descreve a arquitetura, recursos e tecnologias do projeto CRM, focado na gestão de leads vindos do WhatsApp com automação inteligente.

---

## 🛠️ Tecnologias Utilizadas

### Core / Frontend
- **React + Vite**: Framework moderno para alta performance e desenvolvimento rápido.
- **TypeScript**: Tipagem estática para robustez do código.
- **Tailwind CSS**: Estilização baseada em utilitários para design responsivo.
- **Lucide React**: Biblioteca de ícones premium.
- **React Router**: Gerenciamento de rotas e navegação.

### Backend & Conectividade
- **Supabase**: 
  - **PostgreSQL**: Banco de dados relacional.
  - **Auth**: Autenticação segura de usuários.
  - **Realtime**: Sincronização em tempo real de mensagens e leads.
- **Evolution API v2**: Interface de conexão com WhatsApp.
- **n8n**: Orquestração de workflows e automações de sincronização.

---

## 🚀 Principais Recursos

1.  **Kanban Dashboard**: Gestão visual de leads em diferentes estágios do funil.
2.  **Área de Contatos Inteligente**:
    - Deduplicação automática de contatos.
    - Filtro dinâmico por etiquetas (labels).
    - Status de sincronização em tempo real (Realtime/Polling).
3.  **Chat Integrado**: Comunicação direta com leads via WhatsApp sem sair do CRM.
4.  **Sincronização Seletiva**:
    - Busca inteligente de chats recentes.
    - Sincronização específica por etiquetas (ex: etiqueta "SIM").
5.  **Aura AI Integration**: Agente de IA para qualificação de leads e automação de etapas do funil.

---

## 📋 Regras de Negócio

- **Identificação de Leads**: O identificador único é o `remoteJid`, normalizado para exibir apenas o número (sem o sufixo @s.whatsapp.net).
- **Persistência de Dados**: Etiquetas e chats devem ser persistidos no banco de dados da Evolution API (`DATABASE_SAVE_DATA_LABELS=true`) para permitir filtragem avançada.
- **Hierarquia de Nomes**: O sistema prioriza nomes reais (PushNames) em relação a pontos ou "Sem nome".
- **Fluxo de Trabalho**: O n8n atua como o cérebro, processando mensagens recebidas e atualizando o Supabase através de chamadas de ferramentas da IA.

---

## 🎨 Design System

- **Estética**: Dark Mode premium com tons de Zinc e Black (estilo moderno/minimalista).
- **Cores Dinâmicas**: Sistema de cores para etiquetas baseado em HSL (`hsla(id * 40, 70%, 50%, 0.3)`) para garantir contraste e legibilidade.
- **Componentização**: Layout modular com Sidebar fixa e áreas de conteúdo dinâmico (Glassmorphism e micro-animações).
- **Tipografia**: Uso de fontes modernas (Inter/Roboto) com hierarquia clara.

---

## 📁 Estrutura de Páginas

- `/login`: Autenticação de usuários.
- `/kanban`: Visão geral do funil de vendas (Página principal).
- `/contatos`: Gestão detalhada da lista de leads e histórico de conversas.
- `/settings`: Configurações da conta e integração API.

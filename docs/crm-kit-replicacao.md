# Kit de Replicação — CRM WhatsApp Viewer

> **Como usar:** Copie este documento inteiro e cole no início de um novo chat com o Antigravity. Em seguida, envie o prompt de início abaixo. Opcionalmente, inclua imagens de referência de design que goste.

---

## ▶ Prompt de Início (único prompt necessário)

```
Quero criar um painel para visualizar as conversas de WhatsApp que um assistente virtual teve com meus leads. Os dados já ficam salvos no Supabase — só preciso de um dashboard bonito para lê-los.

Leia o kit de replicação que esta na pasta e construa o projeto completo com base nele.

Use o MCP do Supabase já integrado aqui no Antigravity para criar as tabelas, configurar as permissões e ativar o Realtime diretamente no meu projeto — sem precisar que eu faça nada manualmente no Supabase.

```

> Se quiser personalizar o visual, adicione imagens de referência de design antes de enviar o prompt.

---

## Arquitetura

O CRM é **somente leitura** — lê dados do Supabase. Não há integração direta com n8n no frontend. O n8n escreve nas tabelas externamente; o CRM apenas consome.

```
WhatsApp Lead → n8n Agent → Supabase (escrita externa)
                                  ↓
                    CRM Dashboard (lê via @supabase/supabase-js)
```

---

## Banco de Dados — Tabelas Exatas

### Tabela `Leads` ← L maiúsculo

```sql
CREATE TABLE "Leads" (
    id          bigserial PRIMARY KEY,
    created_at  timestamptz DEFAULT now() NOT NULL,
    lead_nome   text,
    lead_id     text   -- número WhatsApp do lead (ex: "5511999999999")
);
```

### Tabela `n8n_chat_histories`

```sql
CREATE TABLE "n8n_chat_histories" (
    id                  bigserial PRIMARY KEY,
    session_id          text NOT NULL,   -- igual ao lead_id de Leads
    message             jsonb NOT NULL,  -- {"type": "human"|"ai", "content": "..."}
    hora_data_mensagem  timestamptz      -- pode ser null em registros antigos
);
```

**Relação:** `Leads.lead_id` ↔ `n8n_chat_histories.session_id`

### Políticas RLS (obrigatórias)

> Sem essas políticas, as queries retornam lista vazia sem nenhum erro — causa raiz do bug mais silencioso do projeto.

```sql
ALTER TABLE "Leads" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "n8n_chat_histories" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_select_leads"
ON "Leads" FOR SELECT TO authenticated USING (true);

CREATE POLICY "allow_select_chat"
ON "n8n_chat_histories" FOR SELECT TO authenticated USING (true);
```

### Realtime

Habilitar no painel: **Database → Replication → Tables → `n8n_chat_histories`**

### Usuários

Criar manualmente: **Authentication → Users → Add user (email + senha)**

---

## Stack Técnica

| Tecnologia | Versão | Observação |
|---|---|---|
| Vite + React + TypeScript | 18+ / 5+ | `create-vite --template react-ts` |
| Tailwind CSS | **v4** | plugin `@tailwindcss/vite` — NÃO postcss |
| shadcn/ui | latest | Avatar, Button, Input, ScrollArea |
| react-router-dom | v6 | |
| lucide-react | latest | |
| date-fns | latest | + locale `ptBR` |
| @supabase/supabase-js | v2 | |

---

## Estrutura de Arquivos

```
src/
├── lib/supabase.ts              # createClient com variáveis de ambiente Vite
├── contexts/
│   ├── AuthContext.tsx          # user + session + loading via onAuthStateChange
│   └── ThemeContext.tsx         # toggle claro/escuro, classe "dark" no <html>
├── components/
│   ├── ProtectedRoute.tsx       # spinner → redirect /login → <Outlet />
│   ├── layout/SidebarNav.tsx    # sidebar redimensionável por drag
│   └── chat/
│       ├── LeadList.tsx         # lista de leads com busca expansível
│       └── ChatArea.tsx         # chat com agrupamento de datas
└── pages/
    ├── Login.tsx                # form email + senha
    ├── Dashboard.tsx            # layout raiz com h-screen
    ├── Contatos.tsx             # grid de cards
    └── Settings.tsx             # toggle de tema
```

**App.tsx:** `ThemeProvider > AuthProvider > BrowserRouter > Routes`

---

## Regras Técnicas — o AI deve seguir obrigatoriamente

### Layout (crítico)
- `Dashboard.tsx` é o **único** componente com `h-screen`
- Filhos usam apenas `h-full` ou `min-h-0`
- Estrutura obrigatória:
```
Dashboard → flex h-screen w-screen overflow-hidden
  ├── SidebarNav  → h-full, largura dinâmica (180–320px)
  ├── LeadList    → h-full w-[300px] shrink-0
  └── ChatArea    → flex-1 flex flex-col min-h-0
        ├── Header        → shrink-0
        ├── Status bar    → shrink-0
        ├── Mensagens     → flex-1 overflow-y-auto min-h-0
        └── Input area    → shrink-0
```

### Scroll do chat (crítico)
- **Nunca** usar `scrollIntoView()` — desloca o documento inteiro
- **Sempre** usar `scrollTop` em `div` com `overflow-y-auto` referenciado diretamente:
```typescript
const viewportRef = useRef<HTMLDivElement>(null);
// rolar para o final:
setTimeout(() => {
    if (viewportRef.current)
        viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
}, 120);
```

### Sidebar redimensionável
- Drag na borda direita, min 180px / max 320px / padrão 240px
- Persistir largura em `localStorage` chave `"sidebar-width"`

### Agrupamento de mensagens (estilo WhatsApp)
- Separador de data: `"Hoje"` / `"Ontem"` / `"05 de março de 2025"` (date-fns + ptBR)
- Mensagens com `hora_data_mensagem = null` → grupo `"Sem data"`
- Horário `HH:mm` abaixo de cada balão

### Idioma
- 100% em português: `"Todas as Conversas"`, `"Carregando contatos..."`, `"Selecione uma conversa"`, `"Digite uma mensagem..."`, `"O painel é apenas para visualização. As respostas são geradas pelo n8n."`

---

## Erros a Tratar

| Situação | Comportamento esperado |
|---|---|
| RLS não configurado | Retorna `[]` sem erro — causa lista vazia silenciosa |
| Credenciais inválidas no login | "E-mail ou senha incorretos." |
| Falha de rede | "Não foi possível conectar. Verifique sua internet." |
| `hora_data_mensagem` nulo | Grupo "Sem data", horário em branco |
| `message.content` ausente | Exibir "Mensagem sem conteúdo" como fallback |

---

## Validação Final

Antes de concluir, o AI deve:
- [ ] Rodar `npm run build` sem erros TypeScript
- [ ] Confirmar que nenhum filho usa `h-screen`
- [ ] Confirmar que não há `scrollIntoView` no código
- [ ] Testar: login → selecionar conversa → layout não se desloca

---
*v3.0 — contexto técnico completo para replicação autônoma*

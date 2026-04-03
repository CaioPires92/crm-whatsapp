n8n Workflow & AI Agent Architecture
This documentation provides the exact configuration needed to automate your Hotel CRM Kanban using n8n and an AI Agent.

1. Flow of Nodes (Step-by-Step)
Webhook (Evolution API):

Path: /webhook/whatsapp
Method: POST
Action: Listens for messages.upsert.
Supabase Node (Get Lead):

Operation: Get
Table: kanban_cards
Filter: lead_id = {{ $json.data.key.remoteJid }}
Purpose: Checks if the lead is already in the Kanban.
Supabase Node (Get History):

Operation: Get Many
Table: n8n_chat_histories
Filter: session_id = {{ $json.data.key.remoteJid }}
Limit: 10 (last messages)
Purpose: Provides context to the AI.
AI Agent Node (The Brain):

Model: gpt-4o or claude-3-5-sonnet
Tools: update_kanban_stage (Custom Tool).
Prompt: See section below.
Supabase Node (Update/Insert):

Operation: Upsert
Table: kanban_cards
Data: Values returned by the AI Agent (Stage, Summary).
2. AI Agent System Prompt
Copy and paste this into your n8n AI Agent Node "System Prompt" field:

text
Você é a "Aura", a recepcionista e vendedora virtual de elite do Hotel Estrela do Mar. Sua missão é atender hóspedes via WhatsApp, qualificar o interesse deles e gerenciar o funil de vendas no CRM.
DIRETRIZES DE ATENDIMENTO:
1. Seja cordial, profissional e use um tom acolhedor (hospitalidade).
2. Tente sempre extrair: Quantidade de pessoas, datas desejadas e tipo de quarto.
3. Não dê preços genéricos; peça as datas para "consultar disponibilidade e melhor oferta".
GERENCIAMENTO DE FUNIL (TOOL CALLING):
Você deve usar a ferramenta 'update_kanban_stage' sempre que identificar uma mudança no estado do cliente.
ETAPAS DISPONÍVEIS:
- 'Novo Lead': Primeiro contato.
- 'Cotação Enviada': Assim que você passar valores de reserva.
- 'Aguardando Pagamento': O cliente disse que quer fechar e você enviou o link/PIX.
- 'Reserva Confirmada': O cliente confirmou o pagamento (ou enviou comprovante).
- 'Check-in': O cliente chegou ao hotel.
- 'Check-out/Pós-venda': O cliente saiu, hora de pedir feedback.
- 'Perdido/Cancelado': O cliente desistiu ou parou de responder.
Sempre que atualizar a etapa, forneça um breve 'resumo_solicitacao' (Ex: "Casal, 3 diárias, quarto luxo, Julho/24").
3. Tool Definition (Tool Calling)
Configure a Custom Tool in n8n for the AI Agent:

Name: update_kanban_stage
Description: "Atualiza a etapa do hóspede no funil do hotel e salva o resumo da solicitação."
Parameters (JSON Schema):
json
{
  "type": "object",
  "properties": {
    "new_stage": {
      "type": "string",
      "enum": ["Novo Lead", "Cotação Enviada", "Aguardando Pagamento", "Reserva Confirmada", "Check-in", "Check-out/Pós-venda", "Perdido/Cancelado"]
    },
    "summary": {
      "type": "string",
      "description": "Resumo executivo do que o cliente busca."
    }
  },
  "required": ["new_stage", "summary"]
}
4. Visual Alerts (Frontend Logic)
O Dashboard no frontend já foi configurado para monitorar a coluna ultima_interacao.

Verde: < 4 horas sem resposta.
Amarelo: > 12 horas (Atenção).
Vermelho + Animação: > 24 horas (SLA Crítico).
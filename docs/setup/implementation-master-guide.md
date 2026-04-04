# Implementation Master Guide

Este documento consolida o que ainda falta implementar no projeto, o estado atual do que ja foi entregue e o guia operacional para terminar cada frente sem depender de memoria espalhada entre varios arquivos.

Objetivo:
- manter uma unica fonte de verdade para pendencias reais
- separar o que ja esta pronto do que ainda depende de validacao
- documentar como finalizar cada item sem reabrir varios arquivos

## Fonte de Verdade

Este documento passa a ser a base oficial para:
- backlog de implementacao
- status do que ja foi entregue
- proximos passos
- criterios de validacao
- atualizacoes futuras da Aura, CRM e integracoes relacionadas

Regra operacional:
- qualquer nova implementacao relevante deve atualizar este documento
- qualquer item concluido deve ser removido do backlog daqui ou marcado como concluido aqui
- novos planos para a Aura nao devem ser criados em documentos paralelos sem necessidade
- detalhes tecnicos de schema podem continuar nos SQLs, mas o status e a intencao ficam aqui

## Estado Atual Consolidado

### Ja implementado no fluxo principal

O workflow oficial [`hotel-kanban.json`](/home/caio/projetos/CRM/n8n/workflows/hotel-kanban.json) ja faz:
- receber mensagens do WhatsApp via Evolution
- filtrar eventos invalidos
- normalizar lead e mensagem
- lidar com texto, imagem e audio
- criar ou atualizar lead no CRM
- salvar historico no Supabase
- responder com a Aura
- enviar resposta ao WhatsApp
- operar em `auto` ou `manual`
- fazer handoff para humano
- ler regras operacionais em `assistant_rules`
- ler tarifas em `room_rates`
- consultar a Hospedin com fallback seguro

### Ja implementado no frontend

O dashboard ja faz:
- exibir o modo da Aura de forma unificada
- alternar entre `Piloto Automatico` e `Modo Manual`
- refletir esse estado no Kanban e na area de conversas
- mostrar a etapa `Aguardando Humano` no Kanban

### Ja implementado no banco

Ja existem ou foram preparados:
- `assistant_settings`
- `assistant_rules`
- `room_rates`
- `hospedin_settings`
- `hospedin_room_mappings`

## O Que Ainda Falta Implementar

Estas sao as pendencias reais encontradas hoje.

### 1. Validacao real da Hospedin

Status:
- implementado com fallback
- ainda nao validado ponta a ponta

Bloqueio atual:
- em `04/04/2026`, a autenticacao da Hospedin retornou `403`
- mensagem recebida: `Acesso desativado para manutencao.`

O que falta:
- descobrir `account_id` real
- consultar `/api/v2/{account_id}/place_types`
- preencher `hospedin_room_mappings.place_type_id`
- ativar `hospedin_settings.enabled = true`
- validar periodo com disponibilidade
- validar periodo sem disponibilidade
- validar resposta comercial da Aura usando disponibilidade real

Como implementar:
1. Esperar a API da Hospedin sair de manutencao.
2. Autenticar em `/api/v2/authentication/sessions`.
3. Descobrir o `account_id` real da pousada.
4. Chamar `/api/v2/{account_id}/place_types`.
5. Atualizar `public.hospedin_room_mappings` com os `place_type_id` reais.
6. Confirmar que o n8n tem:
   - `HOSPEDIN_API_EMAIL`
   - `HOSPEDIN_API_PASSWORD`
7. Atualizar `public.hospedin_settings.account_id`.
8. Mudar `public.hospedin_settings.enabled` para `true`.
9. Testar pelo WhatsApp com datas reais.

Critério de pronto:
- a Aura nao inventa disponibilidade
- a consulta retorna resposta real quando a Hospedin responde
- o fallback continua funcionando se a API cair

### 2. Preenchimento de dados reais da operacao

Status:
- estrutura pronta
- seeds iniciais e placeholders ainda presentes

O que falta:
- substituir placeholders em `assistant_rules`
- substituir seeds iniciais em `room_rates` pelos valores oficiais
- preencher `account_id` e `place_type_id` reais na trilha da Hospedin

Onde editar:
- `public.assistant_rules`
- `public.room_rates`
- `public.hospedin_settings`
- `public.hospedin_room_mappings`

Como implementar:
1. Preencher `assistant_rules` com:
   - Wi-Fi
   - check-in e check-out
   - politica de pets
   - cafe da manha
   - regras internas
2. Revisar nomes de acomodacao em `room_rates`.
3. Cadastrar:
   - tarifa regular
   - tarifa de sabado
   - feriados
   - temporadas especiais
   - minimos de diarias
4. Preencher a parte da Hospedin quando a API voltar.

Critério de pronto:
- mudar um valor no Supabase muda a resposta da Aura sem editar o workflow

### 3. QA operacional final da Aura

Status:
- varios cenarios ja foram testados isoladamente
- ainda falta a rodada final consolidada

O que falta testar:
- primeiro contato
- segunda mensagem no mesmo numero
- modo manual
- handoff humano
- texto simples
- imagem com legenda
- imagem sem legenda
- audio
- cotacao com tarifa
- cotacao com minimo de diarias
- disponibilidade real via Hospedin quando a API voltar
- criacao ou reaproveitamento de lead
- historico salvo no Supabase
- resposta entregue no WhatsApp

Como implementar:
1. Limpar um numero de teste no banco.
2. Rodar a sequencia completa de mensagens.
3. Conferir:
   - `kanban_cards`
   - `Leads`
   - `n8n_chat_histories`
   - resposta no WhatsApp
4. Repetir com `mode=manual`.
5. Repetir com caso de handoff.
6. Repetir com Hospedin ativa.

Critério de pronto:
- nenhum branch principal fica sem validacao

### 4. Maturidade operacional de campanhas

Fonte:
- [`campaigns.md`](/home/caio/projetos/CRM/docs/architecture/campaigns.md)

Status:
- campanhas em lote implementadas em nivel inicial
- maturidade operacional ainda incompleta

O que falta:
- campo de opt-in para marketing
- campo de bloqueio de campanha
- cooldown para evitar reenvio frequente
- blacklist
- dashboard historico com multiplas campanhas
- regras mais robustas para inferencia de bloqueio

Como implementar:
1. Expandir schema com os campos faltantes em `Leads` ou tabela dedicada.
2. Aplicar filtro de elegibilidade antes do disparo.
3. Persistir historico de campanha com estado por destinatario.
4. Criar dashboard historico.
5. Adicionar regras de bloqueio e cooldown.

Critério de pronto:
- campanha nao dispara para contato sem permissao
- campanha nao repete envio de forma acidental

## O Que Nao Apareceu Como Pendencia de Codigo

No sweep por `src/`, `infra/` e `n8n/` nao apareceram TODOs/FIXMEs relevantes fora:
- da Fase 5 da Hospedin
- da maturidade de campanhas

Ou seja, hoje o backlog real esta concentrado em operacao e validacao, nao em buracos escondidos no codigo.

## Guia Rapido de Implementacao por Ordem

Use esta ordem. Ela evita retrabalho.

1. Preencher dados reais em `assistant_rules` e `room_rates`
2. Fazer a rodada final de QA sem a Hospedin
3. Esperar a API da Hospedin voltar
4. Descobrir `account_id` e `place_type_id`
5. Ativar `hospedin_settings.enabled`
6. Rodar QA final com disponibilidade real
7. Se fizer sentido comercial, evoluir campanhas

## Checklist Final

### Aura e CRM
- [ ] `assistant_rules` com dados reais
- [ ] `room_rates` com dados reais
- [ ] `hospedin_settings.account_id` preenchido
- [ ] `hospedin_room_mappings.place_type_id` preenchidos
- [ ] `hospedin_settings.enabled = true`
- [ ] Hospedin validada ponta a ponta
- [ ] modo manual validado
- [ ] handoff humano validado
- [ ] imagem validada
- [ ] audio validado
- [ ] historico validado
- [ ] Kanban validado

### Campanhas
- [ ] opt-in
- [ ] bloqueio de campanha
- [ ] cooldown
- [ ] blacklist
- [ ] historico de campanhas
- [ ] regras robustas de bloqueio

## Arquivos de Referencia Que Continuam Uteis

Manter:
- [`hotel-kanban.json`](/home/caio/projetos/CRM/n8n/workflows/hotel-kanban.json)
- [`aura.md`](/home/caio/projetos/CRM/docs/agents/aura.md)
- [`campaigns.md`](/home/caio/projetos/CRM/docs/architecture/campaigns.md)
- migrations SQL em [`docs/setup`](/home/caio/projetos/CRM/docs/setup)

## Regra de Manutencao

Daqui para frente:
- atualizar este documento quando um item sair do backlog
- evitar criar novos roadmaps paralelos para a Aura
- manter detalhes de schema nos SQLs e detalhes de operacao aqui

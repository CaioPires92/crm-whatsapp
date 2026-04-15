# Manual WhatsApp E2E Tests

Este roteiro cobre a validacao manual do fluxo principal:

`WhatsApp -> Evolution API -> n8n -> Supabase -> CRM -> resposta de volta no WhatsApp`

## Como usar

- Execute os testes em ordem.
- Envie uma mensagem por vez e espere o workflow terminar antes da proxima.
- Para cada caso, valide no minimo:
  - execucao do workflow `hotel-kanban` no n8n
  - persistencia no Supabase
  - reflexo visual no CRM
  - resposta correta no WhatsApp quando aplicavel

## Validacao minima por caso

- `n8n`: execucao `success` no workflow e nodes esperados processados.
- `Supabase`: lead, card e historico coerentes sem duplicacao indevida.
- `CRM`: conversa renderizada, card correto e dados atualizados.
- `WhatsApp`: resposta entregue quando o modo automatico estiver ativo.

## Caso 1: Primeiro contato

**Mensagem para enviar**

`Oi, tudo bem?`

**Objetivo**

Validar criacao inicial do lead e entrada da conversa no fluxo.

**Resultado esperado**

- novo lead criado
- novo card criado
- mensagem salva no historico
- conversa aparece no CRM
- Aura responde no WhatsApp se o modo automatico estiver ativo

## Caso 2: Consulta comercial simples

**Mensagem para enviar**

`Quanto esta a diaria para 2 pessoas no fim de semana?`

**Objetivo**

Validar resposta comercial basica usando regras da Aura.

**Resultado esperado**

- mesma conversa continua ativa
- sem criacao de lead duplicado
- historico salvo no Supabase
- resposta comercial coerente no WhatsApp

## Caso 3: Consulta com datas

**Mensagem para enviar**

`Quero saber valor para entrar dia 20 e sair dia 22.`

**Objetivo**

Validar interpretacao de datas no fluxo e resposta contextual.

**Resultado esperado**

- dados da mensagem persistidos corretamente
- mesma conversa reaproveitada
- resposta coerente com consulta de periodo

## Caso 4: Consulta com composicao de hospedes

**Mensagem para enviar**

`Somos 2 adultos e 1 crianca. Voces tem quarto disponivel de 20 a 22?`

**Objetivo**

Validar consulta mais rica e eventual uso de disponibilidade/fallback.

**Resultado esperado**

- contexto salvo no historico
- sem duplicacao de lead/card
- se a Hospedin estiver indisponivel, fallback seguro
- a Aura nao deve inventar disponibilidade

## Caso 5: Regra operacional

**Mensagem para enviar**

`O cafe da manha esta incluso?`

**Objetivo**

Validar leitura das regras operacionais sincronizadas.

**Resultado esperado**

- resposta consistente com `assistant_rules`
- historico salvo normalmente

## Caso 6: Politica de pet

**Mensagem para enviar**

`Pode levar pet?`

**Objetivo**

Validar pergunta de politica/regras.

**Resultado esperado**

- resposta coerente com a configuracao operacional atual
- sem erro no fluxo

## Caso 7: Horarios

**Mensagem para enviar**

`Qual e o horario de check-in e check-out?`

**Objetivo**

Validar regras operacionais de hospedagem.

**Resultado esperado**

- resposta correta da Aura
- historico salvo

## Caso 8: Infraestrutura

**Mensagem para enviar**

`Tem wifi nos quartos?`

**Objetivo**

Validar perguntas frequentes operacionais.

**Resultado esperado**

- resposta correta com base nos dados operacionais

## Caso 9: Reserva

**Mensagem para enviar**

`Quero reservar um quarto para esse fim de semana.`

**Objetivo**

Validar intencao comercial forte e possiveis regras de handoff/processo.

**Resultado esperado**

- conversa registrada integralmente
- resposta adequada ao fluxo comercial atual
- se houver regra de escalonamento, card vai para etapa correta

## Caso 10: Pagamento

**Mensagem para enviar**

`Quais formas de pagamento voces aceitam?`

**Objetivo**

Validar resposta operacional/comercial de pagamento.

**Resultado esperado**

- resposta coerente com as regras configuradas

## Caso 11: Handoff humano

**Mensagem para enviar**

`Tive um problema com minha reserva e preciso falar com um atendente.`

**Objetivo**

Validar handoff para humano.

**Resultado esperado**

- fluxo identifica intencao sensivel
- card vai para a etapa de humano esperada
- historico permanece intacto
- CRM reflete o novo estado

## Caso 12: Mensagem apos handoff

**Mensagem para enviar**

`Tem alguem ai para me atender agora?`

**Objetivo**

Validar continuidade da conversa apos handoff.

**Resultado esperado**

- mesma conversa mantida
- sem resposta automatica indevida se a conversa estiver com humano

## Caso 13: Reuso sem duplicacao

**Mensagem para enviar**

`E para 3 pessoas, muda o valor?`

**Objetivo**

Validar reaproveitamento do mesmo lead e do mesmo card.

**Pre-condicao**

Enviar depois de um dos testes anteriores na mesma conversa.

**Resultado esperado**

- nenhum novo lead duplicado
- nenhum novo card indevido
- historico acumulado corretamente

## Caso 14: Modo manual

**Preparacao**

- ativar modo manual no CRM antes do envio

**Mensagem para enviar**

`Ola, gostaria de saber o valor da diaria.`

**Objetivo**

Validar bloqueio da resposta automatica quando o modo manual estiver ativo.

**Resultado esperado**

- mensagem entra no CRM
- historico salvo
- sem resposta automatica da Aura
- conversa disponivel para atendimento humano

## Caso 15: Midia em audio

**Acao**

- enviar um audio perguntando valor da diaria

**Objetivo**

Validar entrada e renderizacao de audio.

**Resultado esperado**

- evento processado no n8n
- historico salvo
- audio aparece no CRM

## Caso 16: Midia em imagem

**Acao**

- enviar uma imagem com a legenda `segue imagem`

**Objetivo**

Validar entrada e renderizacao de imagem.

**Resultado esperado**

- imagem processada no fluxo
- imagem/legenda visiveis no CRM

## Caso 17: Confirmacao apos midia

**Mensagem para enviar**

`Voce recebeu minha imagem?`

**Objetivo**

Validar continuidade normal da conversa apos eventos de midia.

**Resultado esperado**

- mesma conversa continua ativa
- sem perda de historico

## Caso 18: Fallback controlado

**Mensagem para enviar**

`Voces tem disponibilidade de 20 a 22?`

**Objetivo**

Validar comportamento seguro quando integracao externa nao responde.

**Resultado esperado**

- workflow nao quebra
- CRM continua consistente
- resposta usa fallback seguro quando necessario

## Checklist de fechamento

- todos os casos relevantes executados
- nenhuma duplicacao indevida de lead/card
- historico consistente no Supabase
- UI do CRM coerente com o estado do workflow
- respostas automaticas corretas no modo automatico
- ausencia de respostas automaticas no modo manual
- handoff humano funcionando
- fluxos de texto, imagem e audio validados

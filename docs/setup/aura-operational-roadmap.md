# Aura Operational Roadmap

Este documento define como evoluir a assistente Aura de forma controlada, sem misturar implementacoes, regras de negocio e testes no mesmo passo.

Objetivo:
- manter a Aura util para atendimento e qualificacao
- permitir mudancas rapidas nas regras do hotel
- garantir controle humano quando o caso nao deve ser automatizado
- permitir ligar e desligar o piloto automatico sem alterar o workflow

## Estado Atual

Hoje o workflow principal `Hotel CRM - Kanban Automation` ja faz:
- receber mensagens do WhatsApp via Evolution
- filtrar entradas invalidas
- normalizar lead e mensagem
- criar ou atualizar lead no CRM
- salvar historico no Supabase
- responder com a Aura
- enviar resposta ao WhatsApp
- lidar com texto, imagem e audio

Hoje ainda nao faz de forma estruturada:
- consultar disponibilidade em sistema externo
- consultar tabela de precos anual editavel
- consultar base editavel de regras da casa
- bloquear automaticamente casos que precisam de humano
- alternar entre modo manual e piloto automatico por configuracao central

## Principios

- nao colocar regra operacional critica dentro do prompt
- nao hardcode de precos no workflow
- nao misturar modo manual e automatico por edicao manual de nodes
- tudo que muda com frequencia deve ficar fora do JSON do workflow
- cada etapa so avanca depois de implementada e testada

## Arquitetura Recomendada

### 1. Configuracao Operacional

Criar uma tabela `assistant_settings` para controlar o comportamento da Aura.

Campos recomendados:
- `id`
- `assistant_enabled` boolean
- `mode` text
- `human_handoff_enabled` boolean
- `default_handoff_message` text
- `updated_at`

Valores esperados para `mode`:
- `auto`: Aura responde normalmente
- `manual`: Aura nao responde, apenas registra e deixa para humano
- `hybrid`: Aura responde apenas casos seguros, casos sensiveis vao para humano

### 2. Base Editavel de Regras

Criar uma tabela `assistant_rules`.

Campos recomendados:
- `id`
- `category`
- `rule_key`
- `value`
- `active`
- `notes`
- `updated_at`

Exemplos de categorias:
- `wifi`
- `checkin_checkout`
- `pets`
- `internal_policies`
- `menu`
- `rooms`
- `pool`
- `cleaning`

Exemplos de `rule_key`:
- `wifi_password`
- `wifi_name`
- `checkin_time`
- `checkout_time`
- `pet_policy`
- `breakfast_hours`

### 3. Tabela de Tarifas

Criar uma tabela `room_rates`.

Campos recomendados:
- `id`
- `room_type`
- `date_from`
- `date_to`
- `season_name`
- `price`
- `min_nights`
- `active`
- `notes`
- `updated_at`

Observacao:
- isso resolve valores do ano todo sem depender de prompt
- se no futuro houver regra mais complexa, a tabela pode virar fonte para uma API propria

### 4. Disponibilidade

Criar uma integracao separada com o Hospedin quando a API estiver disponivel.

Padrao recomendado:
- um node dedicado de consulta
- opcionalmente exposto como tool para a Aura
- chamar apenas quando a mensagem exigir disponibilidade real

### 5. Handoff Para Humano

Criar um passo de classificacao antes da resposta da Aura.

Casos que devem ir para humano:
- manutencao
- reclamacao
- cobranca indevida
- cancelamento sensivel
- acidente ou urgencia
- pedido explicito para falar com humano
- qualquer problema operacional em quarto, banheiro, chuveiro, energia, limpeza critica

Saida esperada desse passo:
- `needs_human = true|false`
- `handoff_reason`
- `customer_message_safe`

### 6. Modo Manual

O modo manual deve:
- continuar registrando historico
- continuar atualizando lead
- nao enviar resposta da Aura
- opcionalmente mover o lead para uma etapa de atendimento humano

## Ordem Obrigatoria de Implementacao

Nao pular etapas.

### Fase 1. Controle de modo operacional

Objetivo:
- criar o interruptor central `manual` x `auto`

Implementar:
- tabela `assistant_settings`
- leitura dessa tabela no inicio do workflow
- branch `manual` que interrompe a resposta automatica

Concluido:
- [x] schema criado
- [x] dados iniciais inseridos
- [x] workflow lendo configuracao
- [x] modo manual bloqueando resposta
- [x] modo auto permitindo resposta

Teste minimo:
- [x] `mode=auto` responde no WhatsApp
- [x] `mode=manual` nao responde no WhatsApp
- [x] nos dois modos o historico continua sendo salvo

Gate para seguir:
- so seguir quando os 3 testes acima passarem

### Fase 2. Filtro de handoff humano

Objetivo:
- impedir resposta automatica em casos sensiveis

Implementar:
- node de classificacao por regras
- lista inicial de palavras-chave e intencoes
- etapa do Kanban para humano
- mensagem padrao opcional de encaminhamento

Concluido:
- [x] branch de handoff criada
- [x] lista inicial de gatilhos definida
- [x] atualizacao de etapa no Kanban funcionando
- [x] mensagem de encaminhamento definida

Teste minimo:
- [x] "meu chuveiro queimou" vai para humano
- [x] "quero reclamar" vai para humano
- [x] "quero reservar para casal" continua com Aura

Gate para seguir:
- so seguir quando os cenarios sensiveis nao responderem automaticamente

### Fase 3. Base editavel de regras da casa

Objetivo:
- tirar conhecimento operacional do prompt

Implementar:
- tabela `assistant_rules`
- carga inicial de regras
- node de leitura dessas regras antes da Aura
- consolidacao dessas regras em contexto simples para o agente

Concluido:
- [x] schema criado
- [x] regras iniciais cadastradas
- [x] workflow lendo regras
- [x] Aura respondendo com base nas regras lidas

Teste minimo:
- [x] pergunta sobre senha do wifi
- [x] pergunta sobre check-in e check-out
- [x] pergunta sobre politica de pets
- [x] alteracao no banco reflete na proxima resposta sem editar workflow

Gate para seguir:
- so seguir quando alterar o banco mudar a resposta da Aura

### Fase 4. Tabela de tarifas anuais

Objetivo:
- permitir cotacao com fonte editavel

Implementar:
- tabela `room_rates`
- estrutura por periodo e tipo de quarto
- node de busca por data e tipo
- resumo de tarifas para a Aura ou para um passo de cotacao

Concluido:
- [x] schema criado
- [x] tarifas cadastradas
- [x] workflow buscando faixa correta
- [x] resposta usando tarifa certa

Teste minimo:
- [x] consulta fora de feriado
- [x] consulta em feriado
- [x] consulta com minimo de diarias
- [x] alteracao de tarifa no banco reflete sem editar prompt

Gate para seguir:
- so seguir quando a fonte oficial de valores deixar de ser texto fixo

### Fase 5. Disponibilidade em tempo real

Objetivo:
- consultar disponibilidade real no Hospedin

Implementar:
- integracao com API do Hospedin
- node ou tool de consulta
- tratamento de erro e timeout
- resposta segura quando a API estiver indisponivel

Concluido:
- [ ] integracao autenticada
- [ ] busca por periodo funcionando
- [ ] tratamento de erro definido
- [ ] resposta da Aura usando disponibilidade real

Teste minimo:
- [ ] periodo com disponibilidade
- [ ] periodo sem disponibilidade
- [ ] API fora do ar
- [ ] API lenta

Gate para seguir:
- so seguir quando a resposta nao inventar disponibilidade

## Checklist Operacional de Teste

Executar a cada fase:
- [ ] mensagem de primeiro contato
- [ ] segunda mensagem no mesmo numero
- [ ] validacao de lead no Kanban
- [ ] validacao de historico no Supabase
- [ ] validacao do branch manual
- [ ] validacao do branch humano
- [ ] validacao de resposta no WhatsApp

## Conteudo Inicial Para Cadastrar

Antes da Fase 3, levantar e cadastrar:
- senha do wifi
- nome da rede wifi
- horario de check-in
- horario de check-out
- politica de pets
- politica de cancelamento
- regras internas importantes
- horarios de cafe da manha
- cardapio, se aplicavel
- descricao resumida dos quartos
- regras de limpeza
- informacoes de piscina
- contatos de equipe humana

Antes da Fase 4, levantar e cadastrar:
- tipos de quarto
- tarifas por periodo
- minimos de diarias
- feriados e temporadas especiais
- observacoes comerciais

## Regra de Execucao

Trabalhar sempre assim:
1. Implementar uma fase
2. Testar a fase
3. Registrar resultado
4. So depois seguir para a proxima

## Registro de Progresso

Status atual:
- [x] Fase 1
- [x] Fase 2
- [ ] Fase 3
- [ ] Fase 4
- [ ] Fase 5

Proxima fase recomendada:
- `Fase 3 - Base editavel de regras da casa`

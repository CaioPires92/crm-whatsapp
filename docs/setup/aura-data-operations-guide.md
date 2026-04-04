# Aura Data Operations Guide

Este guia documenta como manter os dados operacionais da Aura sem editar o workflow do n8n.

Objetivo:
- centralizar regras e tarifas no Supabase
- facilitar manutencao futura
- servir como referencia viva para as proximas fases

## Visao Geral

Hoje a Aura consulta duas tabelas operacionais:
- `assistant_rules`: regras e informacoes textuais
- `room_rates`: tarifas e minimos de diarias

Quando os dados reais estiverem disponiveis, a atualizacao deve ser feita nessas tabelas, nao no prompt e nao no JSON do workflow.

## Onde Editar

Editar pelo `Table Editor` do Supabase:
- `public.assistant_rules`
- `public.room_rates`

Depois de salvar, a proxima execucao do workflow ja usa os novos valores.

Voce nao precisa:
- editar o prompt da Aura
- editar nodes do n8n
- redeployar o frontend

## Tabela assistant_rules

Use para informacoes operacionais em texto.

Campos:
- `category`: grupo da regra
- `rule_key`: chave unica da informacao
- `value`: valor que a Aura vai usar
- `active`: se a regra esta valendo
- `notes`: observacao interna

Exemplos:
- `wifi | wifi_name | DELPLATA-GUEST`
- `wifi | wifi_password | senha12345`
- `checkin_checkout | checkin_time | Check-in a partir das 14h.`
- `checkin_checkout | checkout_time | Check-out ate 12h.`
- `pets | pet_policy | Aceitamos pets de ate 12kg apenas em Chales/Anexos.`
- `menu | breakfast_hours | Cafe da manha das 08:30 as 10:30.`

Regras praticas:
- nao duplicar `category + rule_key`
- usar `active=true` para regras validas
- usar `Nao cadastrado` ou `Nao cadastrada` quando a informacao ainda nao puder ser respondida automaticamente
- usar `notes` para contexto interno, nao para resposta ao hospede

## Tabela room_rates

Use para tarifas comerciais.

Campos principais:
- `room_type`: nome da acomodacao
- `season_name`: nome da temporada
- `date_from`: inicio da vigencia
- `date_to`: fim da vigencia
- `days_of_week`: dias validos
- `base_price`: valor da diaria
- `min_nights`: minimo de diarias
- `priority`: prioridade da regra
- `extra_adult_price`: adicional por adulto
- `child_price_6_11`: adicional crianca 6-11
- `child_price_0_5`: adicional crianca 0-5
- `active`: se a tarifa esta valendo
- `notes`: observacao interna

### Como preencher days_of_week

Use numeros de `0` a `6`:
- `0,1,2,3,4,5,6`: todos os dias
- `0,1,2,3,4,5`: domingo a sexta
- `6`: sabado

### Como usar priority

Menor numero ganha prioridade:
- tarifa especial / feriado: `10`
- tarifa regular de sabado: `90`
- tarifa base comum: `100`

Exemplos:
- `Chale/Anexo | Tarifa regular - Domingo a Sexta | 2026-01-01 | 2026-12-31 | {0,1,2,3,4,5} | 349 | 1 | 100`
- `Apto Terreo | Corpus Christi 2026 | 2026-06-04 | 2026-06-07 | {0,1,2,3,4,5,6} | 699 | 3 | 10`

## Ordem Recomendada Para Colocar Dados Reais

1. Preencher `assistant_rules`
2. Revisar nomes exatos dos quartos em `room_rates`
3. Cadastrar tarifa regular
4. Cadastrar tarifa de sabado
5. Cadastrar feriados e temporadas especiais
6. Testar no WhatsApp com datas reais

## Boas Praticas

- manter nomes de quarto sempre iguais
- escolher um padrao unico, por exemplo `Apto Terreo` em vez de alternar com `Apto Térreo`
- criar uma linha por regra de preco
- nao misturar varias temporadas na mesma linha
- usar `active=false` em vez de apagar imediatamente uma regra que ainda pode servir de referencia

## Diagnostico Rapido

Se a Aura responder errado, conferir nesta ordem:

1. `assistant_rules.value`
2. `room_rates.room_type`
3. `room_rates.date_from` e `room_rates.date_to`
4. `room_rates.days_of_week`
5. `room_rates.priority`
6. `room_rates.active`

## Regra Mental Simples

- texto operacional: `assistant_rules`
- preco: `room_rates`
- disponibilidade real: integracao futura com Hospedin

## Evolucao Deste Guia

Este documento deve crescer nas proximas fases.

Adicionar aqui, quando necessario:
- preenchimento real das tabelas
- exemplos de SQL util
- regras de temporadas
- padroes de nomes de acomodacao
- integracao com disponibilidade real

# Codex Superpowers Guide

Este guia resume quais skills do `superpowers` valem mais a pena para este projeto de CRM com React, Supabase, Evolution API e n8n.

Importante:
- essas skills ajudam o Codex a trabalhar melhor
- elas nao mudam o produto diretamente
- o uso faz mais diferenca em tarefas grandes, bugs estranhos e mudancas com risco de regressao

## As 4 Mais Uteis

### 1. `systematic-debugging`

Use quando:
- o workflow do n8n falha e a causa nao esta obvia
- o WhatsApp para de responder
- o Supabase grava parcialmente
- o frontend mostra comportamento inconsistente
- a integracao da Hospedin falha sem mensagem clara

Melhor para:
- separar sintoma de causa raiz
- evitar chute
- validar hipoteses uma por vez

Exemplos bons:
- `Use systematic-debugging para descobrir por que a Aura nao respondeu no WhatsApp`
- `Use systematic-debugging para rastrear por que o card nao mudou de etapa`

### 2. `verification-before-completion`

Use quando:
- uma feature ja parece pronta
- mexemos em workflow, banco ou UI
- queremos evitar regressao antes de encerrar

Melhor para:
- checklist de validacao
- garantir que o comportamento real foi conferido
- reduzir o risco de “parece certo, mas quebrou outra parte”

Exemplos bons:
- `Use verification-before-completion antes de fechar esta tarefa da Aura`
- `Use verification-before-completion para revisar o fluxo do Kanban apos a mudanca`

### 3. `writing-plans`

Use quando:
- a tarefa tem varias fases
- a mudanca envolve frontend + banco + n8n
- queremos organizar a execucao antes de codar

Melhor para:
- fases claras
- checkpoints
- reduzir retrabalho

Exemplos bons:
- `Use writing-plans para implementar a proxima fase da Aura`
- `Use writing-plans para organizar a integracao real com a Hospedin`

### 4. `brainstorming`

Use quando:
- existem varias formas de implementar algo
- ainda nao esta claro o melhor caminho
- queremos avaliar tradeoffs antes de mexer

Melhor para:
- arquitetura
- produto
- regras de negocio novas

Exemplos bons:
- `Use brainstorming para pensar a melhor forma de expor disponibilidade da Hospedin`
- `Use brainstorming para desenhar a melhor UX do modo manual vs automatico`

## Uteis Em Momentos Especificos

### `subagent-driven-development`

Use quando:
- a tarefa pode ser dividida em partes independentes
- vale trabalhar frontend e backend em paralelo
- queremos delegar sem sobrepor arquivos

Bom para:
- uma frente no React
- outra no workflow n8n
- outra em scripts/migracoes

### `test-driven-development`

Use quando:
- estamos mexendo em TypeScript com regra critica
- vamos criar ou refatorar script com logica delicada
- queremos proteger comportamento com testes automatizados

Observacao:
- menos util para workflow visual do n8n
- mais util para `src/` e `scripts/`

### `using-git-worktrees`

Use quando:
- queremos experimentar uma ideia grande sem baguncar a branch atual
- precisamos comparar abordagens em paralelo

### `finishing-a-development-branch`

Use quando:
- estamos prestes a encerrar uma feature
- queremos limpar pendencias, revisar estado do Git e preparar entrega

## Mapa Rapido Por Tipo De Problema

- Bug estranho: `systematic-debugging`
- Feature grande por fases: `writing-plans`
- Decisao de arquitetura ou produto: `brainstorming`
- Antes de encerrar: `verification-before-completion`
- Trabalho paralelo: `subagent-driven-development`
- Regra critica em codigo: `test-driven-development`

## Recomendacao Para Este Projeto

Se for usar poucas skills no dia a dia, priorize nesta ordem:

1. `systematic-debugging`
2. `verification-before-completion`
3. `writing-plans`
4. `brainstorming`

Essa ordem combina melhor com o tipo de risco deste projeto:
- multiplas integracoes
- workflow visual no n8n
- regras operacionais da Aura
- CRM e banco com dados reais

## Exemplos De Pedidos Que Funcionam Bem

- `Use systematic-debugging para descobrir por que a Evolution recebeu a mensagem mas a Aura nao respondeu`
- `Use writing-plans para implementar a sincronizacao final da Hospedin`
- `Use brainstorming para definir a melhor estrutura de tarifas e disponibilidade`
- `Use verification-before-completion antes de fechar esta fase da Aura`

## Regra Pratica

Se a tarefa parece simples, mas envolve:
- WhatsApp
- n8n
- Supabase
- regras da Aura
- ou risco de regressao

vale a pena usar uma dessas skills antes de sair mexendo.

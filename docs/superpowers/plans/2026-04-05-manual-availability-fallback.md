# Manual Availability Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar um fallback manual de disponibilidade para a Aura usando JSON local por periodos + excecoes, integrado com `room_rates` e pronto para coexistir com a Hospedin quando ela voltar.

**Architecture:** O fallback sera um arquivo JSON operacional local em `seeds/`, com um script de leitura/validacao em `scripts/`, consumido pelo workflow principal do n8n. O fluxo continuara usando `room_rates` para valores, feriados e minimo de diarias, e passara a compor a resposta comercial com a disponibilidade manual quando a Hospedin estiver indisponivel ou desativada.

**Tech Stack:** n8n workflow JSON, Node.js scripts, JSON local em `seeds/`, Supabase para dados existentes de regras e tarifas.

---

## File Structure

- Create: `seeds/manual-availability-fallback.template.json`
- Create: `seeds/manual-availability-fallback.local.json`
- Create: `scripts/resolve-manual-availability.mjs`
- Modify: `n8n/workflows/hotel-kanban.json`
- Modify: `docs/setup/implementation-master-guide.md`

### Responsibility map

- `seeds/manual-availability-fallback.template.json`
  - modelo versionado do fallback manual
- `seeds/manual-availability-fallback.local.json`
  - arquivo operacional real, editavel pela equipe
- `scripts/resolve-manual-availability.mjs`
  - leitura, validacao, resolucao por periodo e resumo textual para a Aura
- `n8n/workflows/hotel-kanban.json`
  - integrar leitura do fallback e usar como fonte primaria temporaria / backup
- `docs/setup/implementation-master-guide.md`
  - refletir nova fonte de disponibilidade e checklist operacional

### Task 1: Criar o modelo de dados do fallback manual

**Files:**
- Create: `seeds/manual-availability-fallback.template.json`
- Create: `seeds/manual-availability-fallback.local.json`
- Reference: `seeds/aura-operational-data.template.json`

- [ ] **Step 1: Criar o template versionado**

Conteudo para `seeds/manual-availability-fallback.template.json`:

```json
{
  "metadata": {
    "source": "manual",
    "updated_at": "2026-04-05",
    "notes": "Fallback operacional enquanto Hospedin estiver indisponivel."
  },
  "room_types": [
    "Apto Terreo",
    "Apto Superior",
    "Chale/Anexo"
  ],
  "default_ranges": [
    {
      "from": "2026-04-05",
      "to": "2026-12-31",
      "availability": {
        "Apto Terreo": 2,
        "Apto Superior": 2,
        "Chale/Anexo": 2
      }
    }
  ],
  "overrides": []
}
```

- [ ] **Step 2: Criar o arquivo local operacional**

Copiar o template para `seeds/manual-availability-fallback.local.json` com o mesmo conteudo inicial.

Verificacao:
- o arquivo local deve existir
- os nomes dos tipos devem bater com `room_rates`

- [ ] **Step 3: Conferir JSON valido**

Run:
```bash
python3 -m json.tool seeds/manual-availability-fallback.template.json >/dev/null
python3 -m json.tool seeds/manual-availability-fallback.local.json >/dev/null
```

Expected:
- ambos os comandos terminam sem erro

### Task 2: Implementar o resolvedor de disponibilidade manual

**Files:**
- Create: `scripts/resolve-manual-availability.mjs`
- Reference: `scripts/sync-aura-operational-data.mjs`

- [ ] **Step 1: Criar um teste de smoke manual do resolvedor**

Criar um comando de verificacao usando o proprio script:

```bash
node scripts/resolve-manual-availability.mjs \
  --file=seeds/manual-availability-fallback.local.json \
  --checkin=2026-08-10 \
  --checkout=2026-08-12 \
  --room-type="Apto Terreo"
```

Expected initially:
- falha porque o arquivo do script ainda nao existe

- [ ] **Step 2: Implementar o script com leitura e validacao**

Conteudo para `scripts/resolve-manual-availability.mjs`:

```js
import fs from 'node:fs';
import path from 'node:path';

function parseArgs(argv) {
  const get = (prefix, fallback = '') =>
    argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) || fallback;

  return {
    file: get('--file=', 'seeds/manual-availability-fallback.local.json'),
    checkin: get('--checkin='),
    checkout: get('--checkout='),
    roomType: get('--room-type='),
  };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function eachNight(checkin, checkout) {
  const days = [];
  const current = new Date(`${checkin}T00:00:00Z`);
  const end = new Date(`${checkout}T00:00:00Z`);
  while (current < end) {
    days.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return days;
}

function findDefaultAvailability(data, date, roomType) {
  for (const range of data.default_ranges || []) {
    if (date >= range.from && date <= range.to) {
      return Number(range.availability?.[roomType] ?? 0);
    }
  }
  return 0;
}

function findOverrideAvailability(data, date, roomType) {
  for (const item of data.overrides || []) {
    if (item.date === date) {
      return Number(item.availability?.[roomType] ?? 0);
    }
  }
  return null;
}

function resolveAvailability(data, checkin, checkout, roomType) {
  const nights = eachNight(checkin, checkout);
  const perDay = nights.map((date) => {
    const overrideValue = findOverrideAvailability(data, date, roomType);
    const availability = overrideValue ?? findDefaultAvailability(data, date, roomType);
    return { date, availability };
  });

  const minAvailability = perDay.length ? Math.min(...perDay.map((item) => item.availability)) : 0;
  const isAvailable = perDay.length > 0 && perDay.every((item) => item.availability > 0);

  return {
    roomType,
    checkin,
    checkout,
    nights: perDay.length,
    perDay,
    minAvailability,
    isAvailable,
    source: data.metadata?.source || 'manual',
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const filePath = path.resolve(process.cwd(), args.file);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Manual availability file not found: ${filePath}`);
  }

  if (!args.checkin || !args.checkout || !args.roomType) {
    throw new Error('Usage: --checkin=YYYY-MM-DD --checkout=YYYY-MM-DD --room-type="Apto Terreo"');
  }

  const data = readJson(filePath);
  const result = resolveAvailability(data, args.checkin, args.checkout, args.roomType);
  console.log(JSON.stringify(result, null, 2));
}

main();
```

- [ ] **Step 3: Rodar o smoke test**

Run:
```bash
node scripts/resolve-manual-availability.mjs \
  --file=seeds/manual-availability-fallback.local.json \
  --checkin=2026-08-10 \
  --checkout=2026-08-12 \
  --room-type="Apto Terreo"
```

Expected:
- JSON com `isAvailable: true`
- `minAvailability: 2`
- `nights: 2`

### Task 3: Integrar o fallback manual no workflow do n8n

**Files:**
- Modify: `n8n/workflows/hotel-kanban.json`

- [ ] **Step 1: Identificar o ponto de encaixe**

Confirmar no workflow os pontos atuais:
- `Consolidar Tarifas Aura`
- `Resolver Consulta Hospedin`
- `Consultar Disponibilidade Hospedin`
- `AI Agent`

Expected:
- o fallback manual entra depois da consolidacao de tarifas e antes da composicao final usada pela Aura

- [ ] **Step 2: Adicionar leitura do arquivo manual**

Adicionar nodes para:
- resolver caminho do arquivo local
- ler `seeds/manual-availability-fallback.local.json`
- calcular disponibilidade para:
  - periodo solicitado
  - tipo solicitado, quando houver

Saida esperada do node de resolucao:

```json
{
  "availabilityContext": "DISPONIBILIDADE MANUAL PARA 10/08/2026 a 12/08/2026:\n- Apto Terreo: disponivel em todo o periodo. Menor disponibilidade diaria encontrada: 2 unidade(s).",
  "availabilityLive": false,
  "availabilityStatus": "manual_fallback",
  "availabilitySource": "manual",
  "consultedRoomType": "Apto Terreo"
}
```

- [ ] **Step 3: Definir prioridade de fontes**

No workflow, aplicar esta ordem:
1. Se Hospedin responder com sucesso, usar Hospedin
2. Se Hospedin estiver desativada, indisponivel, em manutencao, timeout, sem credenciais ou sem resposta valida, usar o fallback manual
3. Se o fallback manual falhar, cair para mensagem segura sem inventar disponibilidade

- [ ] **Step 4: Ajustar o texto enviado para a Aura**

Atualizar a montagem do contexto no `AI Agent` para algo neutro o bastante para aceitar as duas fontes, por exemplo:

```text
DISPONIBILIDADE CONSULTADA:
${contexto_resultante}
```

Expected:
- a Aura nao fica semanticamente presa apenas a Hospedin
- a logica comercial continua dependente de `room_rates`

### Task 4: Validar coerencia com tarifas e minimo de diarias

**Files:**
- Modify: `n8n/workflows/hotel-kanban.json`
- Reference: `room_rates` no fluxo atual

- [ ] **Step 1: Garantir que a confirmacao final dependa de tarifa + minimo + disponibilidade**

Implementar no fluxo a verificacao combinada:
- sem tarifa valida: nao confirmar disponibilidade
- sem minimo de diarias atendido: nao confirmar disponibilidade
- com disponibilidade zero em qualquer noite: nao confirmar disponibilidade

- [ ] **Step 2: Validar cenarios de negocio**

Run/Manual checks:
```bash
node scripts/resolve-manual-availability.mjs \
  --file=seeds/manual-availability-fallback.local.json \
  --checkin=2026-12-29 \
  --checkout=2027-01-02 \
  --room-type="Apto Superior"
```

Expected:
- o resolvedor respeita overrides
- o fluxo comercial continua aplicando minimo de diarias vindo de `room_rates`

### Task 5: Atualizar documentacao operacional

**Files:**
- Modify: `docs/setup/implementation-master-guide.md`

- [ ] **Step 1: Registrar o fallback manual**

Adicionar no guia mestre:
- existencia do arquivo de fallback manual
- responsabilidade do arquivo
- ordem de prioridade entre Hospedin e fallback manual

- [ ] **Step 2: Registrar como editar**

Adicionar instrucoes curtas:
- onde editar
- como validar o JSON
- como usar overrides

### Task 6: Verificacao final

**Files:**
- Test: `seeds/manual-availability-fallback.local.json`
- Test: `scripts/resolve-manual-availability.mjs`
- Test: `n8n/workflows/hotel-kanban.json`

- [ ] **Step 1: Validar JSONs**

Run:
```bash
python3 -m json.tool seeds/manual-availability-fallback.template.json >/dev/null
python3 -m json.tool seeds/manual-availability-fallback.local.json >/dev/null
```

Expected:
- arquivos validos

- [ ] **Step 2: Validar script de resolucao**

Run:
```bash
node scripts/resolve-manual-availability.mjs \
  --file=seeds/manual-availability-fallback.local.json \
  --checkin=2026-08-10 \
  --checkout=2026-08-12 \
  --room-type="Chale/Anexo"
```

Expected:
- `isAvailable: true`
- `minAvailability: 2`

- [ ] **Step 3: Validar fluxo do n8n em modo controlado**

Verificacao manual:
- colocar workflow em `Execute workflow`
- usar `/webhook-test/evolution-webhook`
- mandar uma consulta com datas e tipo

Expected:
- a Aura responde usando tarifa correta
- a disponibilidade vem do fallback manual se a Hospedin falhar
- nao ha promessa de vaga fora das regras de `room_rates`

## Self-review

- Cobertura da spec: coberto formato do JSON, uso pela Aura, fallback da Hospedin, integracao futura e compatibilidade com `room_rates`
- Placeholder scan: sem `TODO`, `TBD` ou passos vagos
- Consistencia: nomes de tipos e responsabilidades mantidos entre spec e plano

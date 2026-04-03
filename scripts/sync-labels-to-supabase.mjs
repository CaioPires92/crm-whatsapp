import fs from 'node:fs';
import path from 'node:path';

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function normalizeLeadId(value) {
  return String(value || '').split('@')[0].trim();
}

function isIgnorableChat(remoteJid) {
  return !remoteJid || remoteJid.endsWith('@g.us') || remoteJid.includes('@newsletter') || remoteJid === 'status@broadcast';
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Request failed ${response.status} ${response.statusText}: ${text.slice(0, 500)}`);
  }

  if (!text) {
    return null;
  }

  return JSON.parse(text);
}

async function fetchAllSupabaseRows(supabaseUrl, table, select, headers) {
  const allRows = [];
  const pageSize = 1000;
  let offset = 0;

  while (true) {
    const rows = await fetchJson(
      `${supabaseUrl}/rest/v1/${table}?select=${encodeURIComponent(select)}&limit=${pageSize}&offset=${offset}`,
      { headers }
    );

    allRows.push(...(rows || []));

    if (!rows || rows.length < pageSize) {
      break;
    }

    offset += pageSize;
  }

  return allRows;
}

function mergeLabels(existingLabels, incomingLabels) {
  const merged = new Map();

  for (const label of [...(existingLabels || []), ...(incomingLabels || [])]) {
    if (!label?.id) {
      continue;
    }

    merged.set(String(label.id), {
      id: String(label.id),
      name: String(label.name || ''),
      color: String(label.color || '0'),
    });
  }

  return Array.from(merged.values()).sort((a, b) => a.name.localeCompare(b.name));
}

async function main() {
  const rootDir = process.cwd();
  loadEnvFile(path.join(rootDir, '.env.local'));

  const evolutionUrl = process.env.VITE_EVOLUTION_URL?.replace(/\/$/, '');
  const evolutionInstance = process.env.VITE_EVOLUTION_INSTANCE;
  const evolutionApiKey = process.env.VITE_EVOLUTION_API_KEY;
  const supabaseUrl = process.env.VITE_SUPABASE_URL?.replace(/\/$/, '');
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const supabaseWriteKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;

  if (!evolutionUrl || !evolutionInstance || !evolutionApiKey || !supabaseUrl || !supabaseAnonKey || !supabaseWriteKey) {
    throw new Error('Missing Evolution or Supabase configuration in .env.local');
  }

  const evolutionHeaders = {
    apikey: evolutionApiKey,
    'Content-Type': 'application/json',
  };

  const supabaseHeaders = {
    apikey: supabaseWriteKey,
    Authorization: `Bearer ${supabaseWriteKey}`,
    'Content-Type': 'application/json',
  };

  const labels = await fetchJson(`${evolutionUrl}/label/findLabels/${evolutionInstance}`, {
    headers: {
      apikey: evolutionApiKey,
    },
  });

  const chats = await fetchJson(`${evolutionUrl}/chat/findChats/${evolutionInstance}`, {
    method: 'POST',
    headers: evolutionHeaders,
    body: JSON.stringify({
      take: 500,
      include: { labels: true },
    }),
  });

  const leadMap = new Map();

  for (const chat of chats || []) {
    const leadId = normalizeLeadId(chat.remoteJid);

    if (!leadId || isIgnorableChat(chat.remoteJid) || !Array.isArray(chat.labels) || chat.labels.length === 0) {
      continue;
    }

    leadMap.set(leadId, {
      lead_id: leadId,
      lead_nome: (chat.pushName || '').trim() || 'Sem nome',
      labels: mergeLabels([], chat.labels),
    });
  }

  const existingLeads = await fetchAllSupabaseRows(
    supabaseUrl,
    'Leads',
    'id,lead_id,lead_nome,labels,chatbot_ativo',
    supabaseHeaders
  );

  const existingLeadMap = new Map(
    (existingLeads || []).map((lead) => [normalizeLeadId(lead.lead_id), lead])
  );

  let syncedLeads = 0;

  for (const [leadId, incomingLead] of leadMap.entries()) {
    const existingLead = existingLeadMap.get(leadId);
    const mergedLabels = mergeLabels(existingLead?.labels, incomingLead.labels);
    const payload = {
      lead_id: leadId,
      lead_nome:
        existingLead?.lead_nome && existingLead.lead_nome !== 'Sem nome'
          ? existingLead.lead_nome
          : incomingLead.lead_nome,
      labels: mergedLabels,
      chatbot_ativo: existingLead?.chatbot_ativo ?? true,
    };

    if (existingLead?.id) {
      await fetchJson(`${supabaseUrl}/rest/v1/Leads?id=eq.${existingLead.id}`, {
        method: 'PATCH',
        headers: {
          ...supabaseHeaders,
          Prefer: 'return=minimal',
        },
        body: JSON.stringify(payload),
      });
    } else {
      await fetchJson(`${supabaseUrl}/rest/v1/Leads`, {
        method: 'POST',
        headers: {
          ...supabaseHeaders,
          Prefer: 'return=minimal',
        },
        body: JSON.stringify(payload),
      });
    }

    syncedLeads += 1;
  }

  console.log(
    JSON.stringify(
      {
        labelsFound: (labels || []).length,
        chatsScanned: (chats || []).length,
        leadsWithLabels: leadMap.size,
        syncedLeads,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

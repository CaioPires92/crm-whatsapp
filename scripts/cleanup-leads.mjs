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

function isUsefulName(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return Boolean(normalized && normalized !== '.' && normalized !== 'sem nome');
}

function isLikelyPhone(value) {
  const digits = normalizeLeadId(value).replace(/\D/g, '');
  if (!digits) return false;
  return digits.length >= 10 && digits.length <= 13;
}

function mergeLabels(...labelSets) {
  const merged = new Map();

  for (const labels of labelSets) {
    for (const label of labels || []) {
      if (!label?.id) {
        continue;
      }

      merged.set(String(label.id), {
        id: String(label.id),
        name: String(label.name || ''),
        color: String(label.color || '0'),
      });
    }
  }

  return Array.from(merged.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function chooseKeeper(rows) {
  return [...rows].sort((a, b) => {
    const aPhone = isLikelyPhone(a.lead_id) ? 1 : 0;
    const bPhone = isLikelyPhone(b.lead_id) ? 1 : 0;
    if (bPhone !== aPhone) return bPhone - aPhone;

    const aUseful = isUsefulName(a.lead_nome) ? 1 : 0;
    const bUseful = isUsefulName(b.lead_nome) ? 1 : 0;
    if (bUseful !== aUseful) return bUseful - aUseful;

    const aLabels = Array.isArray(a.labels) ? a.labels.length : 0;
    const bLabels = Array.isArray(b.labels) ? b.labels.length : 0;
    if (bLabels !== aLabels) return bLabels - aLabels;

    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  })[0];
}

function getPreferredName(rows) {
  const useful = rows
    .map((row) => String(row.lead_nome || '').trim())
    .filter((name) => isUsefulName(name))
    .sort((a, b) => b.length - a.length);

  return useful[0] || 'Sem nome';
}

function parseArgs(argv) {
  return {
    apply: argv.includes('--apply'),
  };
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Request failed ${response.status} ${response.statusText}: ${text.slice(0, 500)}`);
  }

  return text ? JSON.parse(text) : null;
}

async function fetchAllSupabaseRows(supabaseUrl, table, select, headers) {
  const allRows = [];
  const pageSize = 1000;
  let offset = 0;

  while (true) {
    const rows = await fetchJson(
      `${supabaseUrl}/rest/v1/${table}?select=${encodeURIComponent(select)}&limit=${pageSize}&offset=${offset}`,
      {
        headers,
      }
    );

    allRows.push(...(rows || []));

    if (!rows || rows.length < pageSize) {
      break;
    }

    offset += pageSize;
  }

  return allRows;
}

async function patchHistorySessionIds(supabaseUrl, headers, oldLeadId, newLeadId, apply) {
  const variants = [
    normalizeLeadId(oldLeadId),
    `${normalizeLeadId(oldLeadId)}@lid`,
    `${normalizeLeadId(oldLeadId)}@s.whatsapp.net`,
    `${normalizeLeadId(oldLeadId)}@c.us`,
  ];

  const targetSessionId = `${normalizeLeadId(newLeadId)}@s.whatsapp.net`;

  for (const variant of variants) {
    const query = `${supabaseUrl}/rest/v1/n8n_chat_histories?session_id=eq.${encodeURIComponent(variant)}`;

    if (!apply) {
      continue;
    }

    await fetchJson(query, {
      method: 'PATCH',
      headers: {
        ...headers,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        session_id: targetSessionId,
      }),
    });
  }
}

async function deleteLeadRows(supabaseUrl, headers, ids) {
  if (!ids.length) {
    return;
  }

  const chunks = [];
  for (let index = 0; index < ids.length; index += 50) {
    chunks.push(ids.slice(index, index + 50));
  }

  for (const chunk of chunks) {
    await fetchJson(`${supabaseUrl}/rest/v1/Leads?id=in.(${chunk.join(',')})`, {
      method: 'DELETE',
      headers: {
        ...headers,
        Prefer: 'return=minimal',
      },
    });
  }
}

async function main() {
  const rootDir = process.cwd();
  loadEnvFile(path.join(rootDir, '.env.local'));
  loadEnvFile(path.join(rootDir, '.env'));

  const supabaseUrl = process.env.VITE_SUPABASE_URL?.replace(/\/$/, '');
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const supabaseWriteKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;
  const evolutionUrl = process.env.VITE_EVOLUTION_URL?.replace(/\/$/, '');
  const evolutionInstance = process.env.VITE_EVOLUTION_INSTANCE;
  const evolutionApiKey = process.env.VITE_EVOLUTION_API_KEY;

  if (!supabaseUrl || !supabaseWriteKey || !evolutionUrl || !evolutionInstance || !evolutionApiKey) {
    throw new Error('Missing Supabase or Evolution configuration.');
  }

  const args = parseArgs(process.argv.slice(2));

  const supabaseHeaders = {
    apikey: supabaseWriteKey,
    Authorization: `Bearer ${supabaseWriteKey}`,
    'Content-Type': 'application/json',
  };

  const leads = await fetchAllSupabaseRows(
    supabaseUrl,
    'Leads',
    'id,lead_id,lead_nome,labels,chatbot_ativo,created_at',
    supabaseHeaders
  );

  const chats = await fetchJson(`${evolutionUrl}/chat/findChats/${evolutionInstance}`, {
    method: 'POST',
    headers: {
      apikey: evolutionApiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      take: 500,
      include: { labels: true },
    }),
  });

  const exactGroups = new Map();
  for (const lead of leads || []) {
    const key = normalizeLeadId(lead.lead_id);
    if (!exactGroups.has(key)) {
      exactGroups.set(key, []);
    }
    exactGroups.get(key).push(lead);
  }

  const duplicateLeadGroups = [...exactGroups.entries()]
    .filter(([, rows]) => rows.length > 1)
    .map(([leadId, rows]) => ({ leadId, rows }));

  const avatarPairs = new Map();
  for (const chat of chats || []) {
    const avatar = chat.profilePicUrl || null;
    if (!avatar) {
      continue;
    }

    const normalizedLeadId = normalizeLeadId(chat.remoteJid);
    const type = isLikelyPhone(normalizedLeadId) ? 'phone' : 'other';
    if (!avatarPairs.has(avatar)) {
      avatarPairs.set(avatar, { phone: null, other: [] });
    }

    if (type === 'phone') {
      avatarPairs.get(avatar).phone = normalizedLeadId;
    } else {
      avatarPairs.get(avatar).other.push(normalizedLeadId);
    }
  }

  const mergePlans = [];
  for (const { phone, other } of avatarPairs.values()) {
    if (!phone || other.length === 0) {
      continue;
    }

    for (const legacyId of other) {
      const legacyRows = (leads || []).filter((lead) => normalizeLeadId(lead.lead_id) === legacyId);
      const phoneRows = (leads || []).filter((lead) => normalizeLeadId(lead.lead_id) === phone);
      if (legacyRows.length === 0 || phoneRows.length === 0) {
        continue;
      }

      mergePlans.push({
        legacyId,
        phoneId: phone,
        legacyRows,
        phoneRows,
      });
    }
  }

  const summary = {
    apply: args.apply,
    duplicateGroups: duplicateLeadGroups.length,
    duplicateRowsToDelete: duplicateLeadGroups.reduce((acc, item) => acc + item.rows.length - 1, 0),
    avatarBasedMergeGroups: mergePlans.length,
    avatarBasedRowsToDelete: mergePlans.reduce((acc, item) => acc + item.legacyRows.length, 0),
  };

  if (!args.apply) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  for (const group of duplicateLeadGroups) {
    const keeper = chooseKeeper(group.rows);
    const duplicates = group.rows.filter((row) => row.id !== keeper.id);

    await fetchJson(`${supabaseUrl}/rest/v1/Leads?id=eq.${keeper.id}`, {
      method: 'PATCH',
      headers: {
        ...supabaseHeaders,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        lead_nome: getPreferredName(group.rows),
        labels: mergeLabels(...group.rows.map((row) => row.labels)),
        chatbot_ativo: group.rows.some((row) => row.chatbot_ativo !== false),
      }),
    });

    await deleteLeadRows(supabaseUrl, supabaseHeaders, duplicates.map((duplicate) => duplicate.id));
  }

  for (const plan of mergePlans) {
    const keeper = chooseKeeper(plan.phoneRows);
    const allRows = [...plan.phoneRows, ...plan.legacyRows];

    await fetchJson(`${supabaseUrl}/rest/v1/Leads?id=eq.${keeper.id}`, {
      method: 'PATCH',
      headers: {
        ...supabaseHeaders,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        lead_id: normalizeLeadId(plan.phoneId),
        lead_nome: getPreferredName(allRows),
        labels: mergeLabels(...allRows.map((row) => row.labels)),
        chatbot_ativo: allRows.some((row) => row.chatbot_ativo !== false),
      }),
    });

    for (const legacyRow of plan.legacyRows) {
      await patchHistorySessionIds(supabaseUrl, supabaseHeaders, legacyRow.lead_id, plan.phoneId, true);
    }

    await deleteLeadRows(supabaseUrl, supabaseHeaders, plan.legacyRows.map((legacyRow) => legacyRow.id));
  }

  console.log(JSON.stringify({ ...summary, cleaned: true }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

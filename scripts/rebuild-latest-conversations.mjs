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

function parseArgs(argv) {
  const args = {
    apply: false,
    takeConversations: 50,
    rawTake: 250,
    messagesPerRemote: 25,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--apply') {
      args.apply = true;
    } else if (arg === '--take-conversations') {
      args.takeConversations = Number(argv[index + 1] || args.takeConversations);
      index += 1;
    } else if (arg === '--raw-take') {
      args.rawTake = Number(argv[index + 1] || args.rawTake);
      index += 1;
    } else if (arg === '--messages-per-remote') {
      args.messagesPerRemote = Number(argv[index + 1] || args.messagesPerRemote);
      index += 1;
    }
  }

  return args;
}

function normalizeLeadId(value) {
  return String(value || '').split('@')[0].trim();
}

function isIgnorableChat(remoteJid) {
  return !remoteJid || remoteJid.endsWith('@g.us') || remoteJid.includes('@newsletter') || remoteJid === 'status@broadcast';
}

function isLikelyPhone(value) {
  const digits = normalizeLeadId(value).replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 13;
}

function isUsefulName(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return Boolean(normalized && normalized !== '.' && normalized !== 'sem nome');
}

function normalizeName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizeAvatarKey(value) {
  if (!value) {
    return '';
  }

  try {
    const parsed = new URL(value);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return String(value).split('?')[0];
  }
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

function toTimestamp(value) {
  const parsed = value ? new Date(value).getTime() : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function getMessageContent(message) {
  if (!message) {
    return 'Mensagem sem conteudo';
  }

  return (
    message.conversation ||
    message.extendedTextMessage?.text ||
    message.imageMessage?.caption ||
    message.videoMessage?.caption ||
    message.buttonsResponseMessage?.selectedDisplayText ||
    message.listResponseMessage?.title ||
    'Mensagem sem conteudo'
  );
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

function getPreferredName(chats) {
  const usefulNames = chats
    .map((chat) => String(chat.pushName || '').trim())
    .filter((name) => isUsefulName(name))
    .sort((a, b) => b.length - a.length);

  return usefulNames[0] || 'Sem nome';
}

function buildPhoneByAvatar(rawChats) {
  const avatarMap = new Map();

  for (const chat of rawChats) {
    const avatarKey = normalizeAvatarKey(chat.profilePicUrl);
    if (!avatarKey) {
      continue;
    }

    const entry = avatarMap.get(avatarKey) || { phones: new Set(), others: new Set() };
    const normalizedLeadId = normalizeLeadId(chat.remoteJid);
    if (isLikelyPhone(normalizedLeadId)) {
      entry.phones.add(normalizedLeadId);
    } else {
      entry.others.add(normalizedLeadId);
    }
    avatarMap.set(avatarKey, entry);
  }

  const phoneByAvatar = new Map();
  for (const [avatar, entry] of avatarMap.entries()) {
    if (entry.phones.size === 1) {
      phoneByAvatar.set(avatar, [...entry.phones][0]);
    }
  }

  return phoneByAvatar;
}

function buildPhoneByName(rawChats) {
  const nameMap = new Map();

  for (const chat of rawChats) {
    const normalizedName = normalizeName(chat.pushName);
    if (!normalizedName) {
      continue;
    }

    const entry = nameMap.get(normalizedName) || { phones: new Set(), others: new Set() };
    const normalizedLeadId = normalizeLeadId(chat.remoteJid);
    if (isLikelyPhone(normalizedLeadId)) {
      entry.phones.add(normalizedLeadId);
    } else {
      entry.others.add(normalizedLeadId);
    }
    nameMap.set(normalizedName, entry);
  }

  const phoneByName = new Map();
  for (const [name, entry] of nameMap.entries()) {
    if (entry.phones.size === 1) {
      phoneByName.set(name, [...entry.phones][0]);
    }
  }

  return phoneByName;
}

function getCanonicalLeadId(chat, phoneByAvatar, phoneByName) {
  const normalizedLeadId = normalizeLeadId(chat.remoteJid);
  if (isLikelyPhone(normalizedLeadId)) {
    return normalizedLeadId;
  }

  const avatarPhone = phoneByAvatar.get(normalizeAvatarKey(chat.profilePicUrl));
  if (avatarPhone) {
    return avatarPhone;
  }

  const normalizedName = normalizeName(chat.pushName);
  const namePhone = normalizedName ? phoneByName.get(normalizedName) : null;
  if (namePhone && isUsefulName(chat.pushName)) {
    return namePhone;
  }

  return normalizedLeadId;
}

function choosePrimaryChat(chats) {
  return [...chats].sort((a, b) => {
    const aPhone = isLikelyPhone(normalizeLeadId(a.remoteJid)) ? 1 : 0;
    const bPhone = isLikelyPhone(normalizeLeadId(b.remoteJid)) ? 1 : 0;
    if (bPhone !== aPhone) {
      return bPhone - aPhone;
    }

    const aUseful = isUsefulName(a.pushName) ? 1 : 0;
    const bUseful = isUsefulName(b.pushName) ? 1 : 0;
    if (bUseful !== aUseful) {
      return bUseful - aUseful;
    }

    return toTimestamp(b.updatedAt) - toTimestamp(a.updatedAt);
  })[0];
}

function buildCanonicalConversations(rawChats, takeConversations) {
  const phoneByAvatar = buildPhoneByAvatar(rawChats);
  const phoneByName = buildPhoneByName(rawChats);
  const groups = new Map();
  const order = [];

  for (const chat of rawChats) {
    const canonicalLeadId = getCanonicalLeadId(chat, phoneByAvatar, phoneByName);
    if (!canonicalLeadId) {
      continue;
    }

    if (!groups.has(canonicalLeadId)) {
      groups.set(canonicalLeadId, []);
      order.push(canonicalLeadId);
    }

    groups.get(canonicalLeadId).push(chat);
  }

  return order.slice(0, takeConversations).map((canonicalLeadId) => {
    const chats = groups.get(canonicalLeadId) || [];
    const primaryChat = choosePrimaryChat(chats);
    const sourceRemoteJids = Array.from(new Set(chats.map((chat) => chat.remoteJid).filter(Boolean)));
    const updatedAt = chats
      .map((chat) => chat.updatedAt || null)
      .sort((a, b) => toTimestamp(b) - toTimestamp(a))[0] || null;

    return {
      canonicalLeadId,
      lead_nome: getPreferredName(chats),
      labels: mergeLabels(...chats.map((chat) => chat.labels || [])),
      remote_jid: primaryChat?.remoteJid || null,
      avatar_url: primaryChat?.profilePicUrl || null,
      sourceRemoteJids,
      updatedAt,
      sourceChats: chats.map((chat) => ({
        remoteJid: chat.remoteJid,
        pushName: chat.pushName || '',
        updatedAt: chat.updatedAt || null,
        profilePicUrl: chat.profilePicUrl || null,
      })),
    };
  });
}

async function fetchMessagesForConversation(evolutionUrl, evolutionInstance, evolutionApiKey, conversation, messagesPerRemote) {
  const signatures = new Set();
  const collected = [];

  for (const remoteJid of conversation.sourceRemoteJids) {
    const response = await fetchJson(`${evolutionUrl}/chat/findMessages/${evolutionInstance}`, {
      method: 'POST',
      headers: {
        apikey: evolutionApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        where: {
          key: {
            remoteJid,
          },
        },
      }),
    });

    const records = (response?.messages?.records || [])
      .slice(0, messagesPerRemote)
      .reverse();

    for (const record of records) {
      const timestamp = record.messageTimestamp
        ? new Date(record.messageTimestamp * 1000).toISOString()
        : null;
      const type = record?.key?.fromMe ? 'ai' : 'human';
      const content = getMessageContent(record.message);
      const signature = `${timestamp || ''}|${type}|${content}`;

      if (signatures.has(signature)) {
        continue;
      }

      signatures.add(signature);
      collected.push({
        session_id: conversation.canonicalLeadId,
        message: { type, content },
        hora_data_mensagem: timestamp,
      });
    }
  }

  return collected.sort((a, b) => toTimestamp(a.hora_data_mensagem) - toTimestamp(b.hora_data_mensagem));
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function getTimestampSlug() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

async function writeBackup(rootDir, backupName, tables) {
  const backupDir = path.join(rootDir, 'docs', 'internal', 'backups', backupName);
  ensureDir(backupDir);

  for (const [fileName, payload] of Object.entries(tables)) {
    fs.writeFileSync(path.join(backupDir, `${fileName}.json`), JSON.stringify(payload, null, 2));
  }

  return backupDir;
}

async function replaceTable(supabaseUrl, headers, table, rows, wipeFilter) {
  await fetchJson(`${supabaseUrl}/rest/v1/${table}?${wipeFilter}`, {
    method: 'DELETE',
    headers: {
      ...headers,
      Prefer: 'return=minimal',
    },
  });

  if (!rows.length) {
    return;
  }

  const chunkSize = 100;
  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    await fetchJson(`${supabaseUrl}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        ...headers,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(chunk),
    });
  }
}

function isRowLevelSecurityError(error) {
  return /row-level security policy/i.test(String(error?.message || ''));
}

async function main() {
  const rootDir = process.cwd();
  loadEnvFile(path.join(rootDir, '.env.local'));
  loadEnvFile(path.join(rootDir, '.env'));

  const args = parseArgs(process.argv.slice(2));
  const supabaseUrl = process.env.VITE_SUPABASE_URL?.replace(/\/$/, '');
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const supabaseWriteKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;
  const evolutionUrl = process.env.VITE_EVOLUTION_URL?.replace(/\/$/, '');
  const evolutionInstance = process.env.VITE_EVOLUTION_INSTANCE;
  const evolutionApiKey = process.env.VITE_EVOLUTION_API_KEY;

  if (!supabaseUrl || !supabaseWriteKey || !evolutionUrl || !evolutionInstance || !evolutionApiKey) {
    throw new Error('Missing Supabase or Evolution configuration.');
  }

  const supabaseHeaders = {
    apikey: supabaseWriteKey,
    Authorization: `Bearer ${supabaseWriteKey}`,
    'Content-Type': 'application/json',
  };

  const [existingLeads, existingHistories, rawChats] = await Promise.all([
    fetchAllSupabaseRows(supabaseUrl, 'Leads', '*', supabaseHeaders),
    fetchAllSupabaseRows(supabaseUrl, 'n8n_chat_histories', '*', supabaseHeaders),
    fetchJson(`${evolutionUrl}/chat/findChats/${evolutionInstance}`, {
      method: 'POST',
      headers: {
        apikey: evolutionApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        take: args.rawTake,
        include: { labels: true },
      }),
    }),
  ]);

  const filteredChats = (rawChats || []).filter((chat) => !isIgnorableChat(chat.remoteJid));
  const canonicalConversations = buildCanonicalConversations(filteredChats, args.takeConversations);

  const leadRows = canonicalConversations.map((conversation) => ({
    lead_id: conversation.canonicalLeadId,
    lead_nome: conversation.lead_nome,
    labels: conversation.labels,
    chatbot_ativo: true,
  }));

  const historyRowsNested = [];
  for (const conversation of canonicalConversations) {
    historyRowsNested.push(
      await fetchMessagesForConversation(
        evolutionUrl,
        evolutionInstance,
        evolutionApiKey,
        conversation,
        args.messagesPerRemote
      )
    );
  }

  const historyRows = historyRowsNested.flat();
  const duplicateLeadIds = leadRows.reduce((acc, row) => {
    acc.set(row.lead_id, (acc.get(row.lead_id) || 0) + 1);
    return acc;
  }, new Map());

  const duplicateGroups = [...duplicateLeadIds.entries()].filter(([, count]) => count > 1);
  const backupName = `latest-50-rebuild-${getTimestampSlug()}`;

  const summary = {
    mode: args.apply ? 'apply' : 'dry-run',
    existingLeads: existingLeads.length,
    existingHistories: existingHistories.length,
    rawChatsConsidered: filteredChats.length,
    canonicalConversations: canonicalConversations.length,
    importedMessages: historyRows.length,
    duplicateLeadGroups: duplicateGroups,
    historySyncWarning: null,
    sample: canonicalConversations.slice(0, 10).map((conversation) => ({
      lead_id: conversation.canonicalLeadId,
      lead_nome: conversation.lead_nome,
      sourceRemoteJids: conversation.sourceRemoteJids,
      updatedAt: conversation.updatedAt,
    })),
  };

  if (!args.apply) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  const backupDir = await writeBackup(rootDir, backupName, {
    Leads: existingLeads,
    n8n_chat_histories: existingHistories,
    rebuild_summary: summary,
  });

  await replaceTable(supabaseUrl, supabaseHeaders, 'Leads', leadRows, 'id=gt.0');

  try {
    await replaceTable(supabaseUrl, supabaseHeaders, 'n8n_chat_histories', historyRows, 'session_id=not.is.null');
  } catch (error) {
    if (!isRowLevelSecurityError(error)) {
      throw error;
    }

    summary.historySyncWarning = 'Historico nao foi regravado por causa do RLS do Supabase. A lista de contatos foi reconstruida mesmo assim.';
  }

  const finalLeads = await fetchAllSupabaseRows(supabaseUrl, 'Leads', 'id,lead_id,lead_nome', supabaseHeaders);
  const finalDuplicateGroups = finalLeads.reduce((acc, row) => {
    const key = normalizeLeadId(row.lead_id);
    acc.set(key, (acc.get(key) || 0) + 1);
    return acc;
  }, new Map());

  const validation = {
    backupDir,
    finalLeads: finalLeads.length,
    finalDuplicateGroups: [...finalDuplicateGroups.entries()].filter(([, count]) => count > 1),
  };

  console.log(JSON.stringify({ ...summary, ...validation }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

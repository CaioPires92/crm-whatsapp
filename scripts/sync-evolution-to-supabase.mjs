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

function parseArgs(argv) {
  const result = {
    takeChats: 30,
    messagesPerChat: 40,
    match: '',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--take-chats') {
      result.takeChats = Number(argv[i + 1] || result.takeChats);
      i += 1;
    } else if (arg === '--messages-per-chat') {
      result.messagesPerChat = Number(argv[i + 1] || result.messagesPerChat);
      i += 1;
    } else if (arg === '--match') {
      result.match = String(argv[i + 1] || '');
      i += 1;
    }
  }

  return result;
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

  const args = parseArgs(process.argv.slice(2));
  const supabaseHeaders = {
    apikey: supabaseWriteKey,
    Authorization: `Bearer ${supabaseWriteKey}`,
    'Content-Type': 'application/json',
  };

  const chats = await fetchJson(`${evolutionUrl}/chat/findChats/${evolutionInstance}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: evolutionApiKey,
    },
    body: JSON.stringify({
      take: args.takeChats,
      include: { labels: true },
    }),
  });

  const filteredChats = chats.filter((chat) => {
    if (isIgnorableChat(chat.remoteJid)) {
      return false;
    }

    if (!args.match) {
      return true;
    }

    const haystack = `${chat.pushName || ''} ${chat.remoteJid || ''}`.toLowerCase();
    return haystack.includes(args.match.toLowerCase());
  });

  const existingLeads = await fetchAllSupabaseRows(
    supabaseUrl,
    'Leads',
    'id,lead_id,lead_nome,labels,chatbot_ativo',
    supabaseHeaders
  );
  const existingLeadIds = new Set(existingLeads.map((lead) => normalizeLeadId(lead.lead_id)));

  const existingHistory = await fetchAllSupabaseRows(
    supabaseUrl,
    'n8n_chat_histories',
    'session_id,message,hora_data_mensagem',
    supabaseHeaders
  );
  const historySignatures = new Set(
    existingHistory.map((item) => {
      const type = item?.message?.type || '';
      const content = item?.message?.content || '';
      const timestamp = item?.hora_data_mensagem || '';
      return `${normalizeLeadId(item.session_id)}|${type}|${timestamp}|${content}`;
    })
  );

  let insertedLeads = 0;
  let insertedMessages = 0;

  for (const chat of filteredChats) {
    const leadId = normalizeLeadId(chat.remoteJid);
    if (!leadId) {
      continue;
    }

    if (!existingLeadIds.has(leadId)) {
      await fetchJson(`${supabaseUrl}/rest/v1/Leads`, {
        method: 'POST',
        headers: {
          ...supabaseHeaders,
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          lead_id: leadId,
          lead_nome: (chat.pushName || '').trim() || 'Sem nome',
          labels: Array.isArray(chat.labels) ? chat.labels : [],
          chatbot_ativo: true,
        }),
      });
      existingLeadIds.add(leadId);
      insertedLeads += 1;
    }

    const messageResponse = await fetchJson(`${evolutionUrl}/chat/findMessages/${evolutionInstance}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: evolutionApiKey,
      },
      body: JSON.stringify({
        where: {
          key: {
            remoteJid: chat.remoteJid,
          },
        },
      }),
    });

    const records = (messageResponse?.messages?.records || [])
      .slice(0, args.messagesPerChat)
      .reverse();

    for (const record of records) {
      const timestamp = record.messageTimestamp
        ? new Date(record.messageTimestamp * 1000).toISOString()
        : null;
      const type = record?.key?.fromMe ? 'ai' : 'human';
      const content = getMessageContent(record.message);
      const signature = `${leadId}|${type}|${timestamp || ''}|${content}`;

      if (historySignatures.has(signature)) {
        continue;
      }

      await fetchJson(`${supabaseUrl}/rest/v1/n8n_chat_histories`, {
        method: 'POST',
        headers: {
          ...supabaseHeaders,
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          session_id: leadId,
          message: {
            type,
            content,
          },
          hora_data_mensagem: timestamp,
        }),
      });

      historySignatures.add(signature);
      insertedMessages += 1;
    }
  }

  console.log(
    JSON.stringify(
      {
        chatsScanned: filteredChats.length,
        insertedLeads,
        insertedMessages,
        match: args.match || null,
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

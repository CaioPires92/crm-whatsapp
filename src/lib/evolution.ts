const evolutionBaseUrl = import.meta.env.VITE_EVOLUTION_URL?.replace(/\/$/, '');
const evolutionInstance = import.meta.env.VITE_EVOLUTION_INSTANCE;
const evolutionApiKey = import.meta.env.VITE_EVOLUTION_API_KEY;

export interface EvolutionChat {
  remoteJid: string;
  pushName?: string;
  updatedAt?: string;
  profilePicUrl?: string | null;
  labels?: Array<{ id: string; name: string; color: string }>;
}

export interface EvolutionLabel {
  id: string;
  name: string;
  color: string;
  predefinedId?: string | null;
}

interface EvolutionMessageRecord {
  id: string;
  key?: {
    fromMe?: boolean;
    remoteJid?: string;
  };
  message?: Record<string, any>;
  messageTimestamp?: number;
}

export interface EvolutionMessage {
  id: string;
  session_id: string;
  message: {
    type: 'human' | 'ai';
    content: string;
  };
  hora_data_mensagem: string | null;
}

export function isEvolutionConfigured() {
  return Boolean(evolutionBaseUrl && evolutionInstance && evolutionApiKey);
}

export function normalizeLeadId(value: string | null | undefined) {
  return (value || '').split('@')[0];
}

export function isLikelyPhoneNumber(value: string | null | undefined) {
  const digits = normalizeLeadId(value).replace(/\D/g, '');

  if (!digits) {
    return false;
  }

  if (digits.length >= 10 && digits.length <= 13) {
    return true;
  }

  if (digits.startsWith('55') && digits.length <= 15) {
    return true;
  }

  return false;
}

export function isLikelyContactPhoneNumber(value: string | null | undefined) {
  const digits = normalizeLeadId(value).replace(/\D/g, '');

  if (!digits) {
    return false;
  }

  return digits.startsWith('55') && (digits.length === 12 || digits.length === 13);
}

export function isLikelyInternalWhatsAppId(value: string | null | undefined) {
  const digits = normalizeLeadId(value).replace(/\D/g, '');
  return Boolean(digits) && !isLikelyPhoneNumber(digits) && digits.length >= 14;
}

export function getLeadContactPhone(
  leadId: string | null | undefined,
  remoteJid?: string | null | undefined
) {
  const candidates = [leadId, remoteJid];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    const normalized = normalizeLeadId(candidate);
    if (!normalized) {
      continue;
    }

    const hasWhatsAppPhoneSuffix = candidate.includes('@s.whatsapp.net') || candidate.includes('@c.us');
    if (hasWhatsAppPhoneSuffix) {
      return normalized;
    }

    if (isLikelyContactPhoneNumber(normalized)) {
      return normalized;
    }
  }

  return null;
}

export function getLeadDisplayName(
  leadNome: string | null | undefined,
  leadId: string | null | undefined,
  remoteJid?: string | null | undefined
) {
  const normalizedName = (leadNome || '').trim();

  if (!normalizedName || normalizedName === '.' || normalizedName.toLowerCase() === 'sem nome') {
    return getLeadContactPhone(leadId, remoteJid) || 'Sem telefone identificado';
  }

  return normalizedName;
}

async function evolutionRequest<T>(path: string, options?: { method?: 'GET' | 'POST'; body?: Record<string, any> }) {
  if (!isEvolutionConfigured()) {
    throw new Error('Evolution API is not configured.');
  }

  const method = options?.method || 'POST';
  const response = await fetch(`${evolutionBaseUrl}${path}`, {
    method,
    headers: {
      apikey: evolutionApiKey!,
      ...(method !== 'GET' ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(method !== 'GET' ? { body: JSON.stringify(options?.body || {}) } : {}),
  });

  if (!response.ok) {
    throw new Error(`Evolution API request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function extractMessageContent(message?: Record<string, any>) {
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

export async function fetchEvolutionChats(take = 100) {
  const response = await evolutionRequest<EvolutionChat[]>(
    `/chat/findChats/${evolutionInstance}`,
    {
      method: 'POST',
      body: {
        take,
        include: { labels: true },
      },
    },
  );

  return response.filter((chat) => {
    const remoteJid = chat.remoteJid || '';
    return remoteJid && !remoteJid.endsWith('@g.us') && !remoteJid.includes('@newsletter') && remoteJid !== 'status@broadcast';
  });
}

export async function fetchEvolutionLabels(): Promise<EvolutionLabel[]> {
  const response = await evolutionRequest<EvolutionLabel[]>(
    `/label/findLabels/${evolutionInstance}`,
    { method: 'GET' }
  );

  return (response || []).map((label) => ({
    id: String(label.id || ''),
    name: String(label.name || ''),
    color: String(label.color || '0'),
    predefinedId: label.predefinedId ?? null,
  }));
}

export async function fetchEvolutionMessages(remoteJid: string): Promise<EvolutionMessage[]> {
  const response = await evolutionRequest<{ messages?: { records?: EvolutionMessageRecord[] } }>(
    `/chat/findMessages/${evolutionInstance}`,
    {
      method: 'POST',
      body: {
        where: {
          key: {
            remoteJid,
          },
        },
      },
    }
  );

  const records = response.messages?.records || [];

  return records
    .map((record, index): EvolutionMessage => ({
      id: `${record.id || remoteJid}-${index}`,
      session_id: record.key?.remoteJid || remoteJid,
      message: {
        type: record.key?.fromMe ? 'ai' : 'human',
        content: extractMessageContent(record.message),
      },
      hora_data_mensagem: record.messageTimestamp ? new Date(record.messageTimestamp * 1000).toISOString() : null,
    }))
    .sort((a, b) => {
      const aTime = a.hora_data_mensagem ? new Date(a.hora_data_mensagem).getTime() : 0;
      const bTime = b.hora_data_mensagem ? new Date(b.hora_data_mensagem).getTime() : 0;
      return aTime - bTime;
    });
}

import { getEvolutionConfig, normalizeLeadId } from './evolution';

export type CampaignStatus = 'draft' | 'sending' | 'completed' | 'completed_with_failures';
export type CampaignRecipientStatus = 'pending' | 'sent' | 'replied' | 'ignored' | 'failed' | 'blocked';

export interface Campaign {
  id: string;
  name: string;
  message_template: string;
  selected_label_ids: string[] | null;
  selected_label_names: string[] | null;
  base_count: number;
  duplicate_count: number;
  invalid_count: number;
  audience_count: number;
  sent_count: number;
  replied_count: number;
  ignored_count: number;
  blocked_count: number;
  failed_count: number;
  status: CampaignStatus;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  created_by: string | null;
}

export interface CampaignRecipient {
  id: number;
  campaign_id: string;
  lead_record_id: number | null;
  lead_name: string | null;
  phone_number: string;
  personalized_message: string | null;
  delivery_status: CampaignRecipientStatus;
  error_message: string | null;
  sent_at: string | null;
  replied_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampaignHistoryRow {
  session_id: string;
  hora_data_mensagem: string | null;
  message: {
    type?: string;
    content?: string;
  } | null;
}

export function personalizeCampaignMessage(template: string, leadName: string | null | undefined) {
  const firstName = (leadName || '').trim().split(/\s+/)[0] || 'cliente';
  return template.replace(/\{\{\s*nome\s*\}\}/gi, firstName);
}

export async function sendCampaignText(phoneNumber: string, text: string) {
  const { url, instance, apiKey } = getEvolutionConfig();

  if (!url || !instance || !apiKey) {
    throw new Error('Evolution is not configured');
  }

  const response = await fetch(
    `${url}/message/sendText/${instance}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: apiKey,
      },
      body: JSON.stringify({
        number: `${normalizeLeadId(phoneNumber)}@s.whatsapp.net`,
        text,
        delay: 1200,
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(errorText || `Falha no envio (${response.status})`);
  }

  return response.json().catch(() => null);
}

export function inferFailureStatus(errorMessage: string | null | undefined): CampaignRecipientStatus {
  const normalized = (errorMessage || '').toLowerCase();

  if (
    normalized.includes('blocked') ||
    normalized.includes('bloque') ||
    normalized.includes('forbidden') ||
    normalized.includes('not-authorized') ||
    normalized.includes('unauthorized')
  ) {
    return 'blocked';
  }

  return 'failed';
}

function getRecipientSessionIds(phoneNumber: string) {
  const normalized = normalizeLeadId(phoneNumber);
  return new Set([
    normalized,
    `${normalized}@s.whatsapp.net`,
    `${normalized}@c.us`,
    `${normalized}@lid`,
  ]);
}

export function computeCampaignRecipientMetrics(
  recipients: CampaignRecipient[],
  historyRows: CampaignHistoryRow[],
  ignoredAfterHours = 24
) {
  const now = Date.now();
  const historyBySession = historyRows.reduce((acc, row) => {
    const key = normalizeLeadId(row.session_id);

    if (!acc.has(key)) {
      acc.set(key, []);
    }

    acc.get(key)!.push(row);
    return acc;
  }, new Map<string, CampaignHistoryRow[]>());

  const metrics = {
    sent: 0,
    replied: 0,
    ignored: 0,
    blocked: 0,
    failed: 0,
  };

  const nextRecipients = recipients.map((recipient) => {
    if (recipient.delivery_status === 'blocked') {
      metrics.blocked += 1;
      return recipient;
    }

    if (recipient.delivery_status === 'failed') {
      metrics.failed += 1;
      return recipient;
    }

    if (!recipient.sent_at) {
      return recipient;
    }

    metrics.sent += 1;
    const sentAtMs = new Date(recipient.sent_at).getTime();
    const possibleSessions = Array.from(getRecipientSessionIds(recipient.phone_number));
    const possibleReplies = possibleSessions.flatMap((sessionId) => historyBySession.get(normalizeLeadId(sessionId)) || []);

    const reply = possibleReplies
      .filter((row) => {
        if (!row.hora_data_mensagem) {
          return false;
        }

        const rowTime = new Date(row.hora_data_mensagem).getTime();
        const type = row.message?.type;
        return rowTime > sentAtMs && type === 'human';
      })
      .sort((a, b) => {
        const aTime = a.hora_data_mensagem ? new Date(a.hora_data_mensagem).getTime() : 0;
        const bTime = b.hora_data_mensagem ? new Date(b.hora_data_mensagem).getTime() : 0;
        return aTime - bTime;
      })[0];

    if (reply?.hora_data_mensagem) {
      metrics.replied += 1;

      return {
        ...recipient,
        delivery_status: 'replied' as const,
        replied_at: recipient.replied_at || reply.hora_data_mensagem,
      };
    }

    if (now - sentAtMs >= ignoredAfterHours * 60 * 60 * 1000) {
      metrics.ignored += 1;
      return {
        ...recipient,
        delivery_status: 'ignored' as const,
      };
    }

    return recipient;
  });

  return {
    metrics,
    recipients: nextRecipients,
  };
}

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  computeCampaignRecipientMetrics,
  inferFailureStatus,
  personalizeCampaignMessage,
} from '../src/lib/campaigns';

afterEach(() => {
  vi.useRealTimers();
});

describe('campaign helpers', () => {
  it('personalizes the first name placeholder', () => {
    expect(personalizeCampaignMessage('Oi {{ nome }}!', 'Maria Silva')).toBe('Oi Maria!');
    expect(personalizeCampaignMessage('Oi {{NOME}}!', '')).toBe('Oi cliente!');
  });

  it('infers blocked recipients from error text', () => {
    expect(inferFailureStatus('Request forbidden by provider')).toBe('blocked');
    expect(inferFailureStatus('Timeout while sending')).toBe('failed');
  });

  it('reconciles recipient metrics from history', () => {
    vi.setSystemTime(new Date('2026-04-14T12:00:00.000Z'));

    const recipients = [
      {
        id: 1,
        campaign_id: 'cmp-1',
        lead_record_id: null,
        lead_name: 'Maria',
        phone_number: '5511999998888',
        personalized_message: null,
        delivery_status: 'sent' as const,
        error_message: null,
        sent_at: '2026-04-14T09:00:00.000Z',
        replied_at: null,
        created_at: '2026-04-14T09:00:00.000Z',
        updated_at: '2026-04-14T09:00:00.000Z',
      },
      {
        id: 2,
        campaign_id: 'cmp-1',
        lead_record_id: null,
        lead_name: 'Joao',
        phone_number: '5511988887777',
        personalized_message: null,
        delivery_status: 'sent' as const,
        error_message: null,
        sent_at: '2026-04-13T10:00:00.000Z',
        replied_at: null,
        created_at: '2026-04-13T10:00:00.000Z',
        updated_at: '2026-04-13T10:00:00.000Z',
      },
      {
        id: 3,
        campaign_id: 'cmp-1',
        lead_record_id: null,
        lead_name: 'Blocked',
        phone_number: '5511977776666',
        personalized_message: null,
        delivery_status: 'blocked' as const,
        error_message: 'forbidden',
        sent_at: null,
        replied_at: null,
        created_at: '2026-04-13T10:00:00.000Z',
        updated_at: '2026-04-13T10:00:00.000Z',
      },
    ];

    const historyRows = [
      {
        session_id: '5511999998888@s.whatsapp.net',
        hora_data_mensagem: '2026-04-14T10:00:00.000Z',
        message: { type: 'human', content: 'Quero saber mais' },
      },
      {
        session_id: '5511988887777@s.whatsapp.net',
        hora_data_mensagem: '2026-04-13T08:00:00.000Z',
        message: { type: 'human', content: 'Antes do disparo' },
      },
    ];

    const result = computeCampaignRecipientMetrics(recipients, historyRows, 24);

    expect(result.metrics).toEqual({
      sent: 2,
      replied: 1,
      ignored: 1,
      blocked: 1,
      failed: 0,
    });
    expect(result.recipients[0].delivery_status).toBe('replied');
    expect(result.recipients[1].delivery_status).toBe('ignored');
  });
});

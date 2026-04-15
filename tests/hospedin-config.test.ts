import { describe, expect, it } from 'vitest';

import { flattenHospedinRoomMappings, flattenHospedinSettings } from '../scripts/hospedin-config.mjs';

describe('hospedin config flattening', () => {
  it('returns null for untouched defaults', () => {
    expect(flattenHospedinSettings({})).toBeNull();
  });

  it('flattens hospedin settings using account slug', () => {
    expect(
      flattenHospedinSettings({
        enabled: true,
        account_slug: 'delplata2026',
        timeout_ms: 12000,
      })
    ).toEqual({
      id: 1,
      enabled: true,
      api_base_url: 'https://pms.hospedin.com/api/v2',
      account_id: 'delplata2026',
      timeout_ms: 12000,
      availability_threshold: 3,
      cache_ttl_seconds: 900,
      fallback_message: 'No momento nao consegui confirmar a disponibilidade em tempo real. Posso seguir com a cotacao e a equipe confirma manualmente.',
    });
  });

  it('flattens room mappings and skips incomplete entries', () => {
    expect(
      flattenHospedinRoomMappings({
        'Chale/Anexo': {
          place_type_id: '123',
          place_type_title: 'Chale Anexo',
          notes: 'ok',
        },
        'Apto Terreo': '',
        ' ': {
          place_type_id: '999',
        },
      })
    ).toEqual([
      {
        room_type: 'Chale/Anexo',
        place_type_id: '123',
        place_type_title: 'Chale Anexo',
        active: true,
        notes: 'ok',
      },
    ]);
  });
});

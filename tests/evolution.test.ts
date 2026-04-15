import { describe, expect, it } from 'vitest';

import {
  getCanonicalKey,
  getLeadContactPhone,
  getLeadDisplayName,
  isLikelyContactPhoneNumber,
  isLikelyInternalWhatsAppId,
  isLikelyPhoneNumber,
  normalizeLeadId,
} from '../src/lib/evolution';

describe('evolution helpers', () => {
  it('normalizes common WhatsApp ids', () => {
    expect(normalizeLeadId('11999998888')).toBe('5511999998888');
    expect(normalizeLeadId('5511999998888@s.whatsapp.net')).toBe('5511999998888');
    expect(getCanonicalKey('5511999998888@lid')).toBe('5511999998888');
  });

  it('detects phone-like ids', () => {
    expect(isLikelyPhoneNumber('11999998888')).toBe(true);
    expect(isLikelyContactPhoneNumber('5511999998888')).toBe(true);
    expect(isLikelyInternalWhatsAppId('12345678901234')).toBe(true);
    expect(isLikelyPhoneNumber('room-101')).toBe(false);
  });

  it('extracts the best phone candidate and display name', () => {
    expect(getLeadContactPhone('lead', '5511999998888@s.whatsapp.net')).toBe('5511999998888');
    expect(
      getLeadDisplayName({
        whatsapp_name: '   ',
        contact_name: 'Maria da Silva',
        telefone: '5511999998888',
      })
    ).toBe('Maria da Silva');
  });
});

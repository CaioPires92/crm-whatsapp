import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

describe('operational seed smoke', () => {
  it('keeps the local operational seed shape intact', () => {
    const seedPath = path.resolve(process.cwd(), 'seeds/aura-operational-data.local.json');
    const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));

    expect(seed).toHaveProperty('assistant_rules');
    expect(seed).toHaveProperty('room_rates');
    expect(seed).toHaveProperty('hospedin');
    expect(seed.hospedin).toHaveProperty('account_slug');
    expect(seed.hospedin).toHaveProperty('room_mappings');
    expect(Object.keys(seed.hospedin.room_mappings || {}).length).toBeGreaterThan(0);
  });
});

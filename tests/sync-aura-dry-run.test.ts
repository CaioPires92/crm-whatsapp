import fs from 'node:fs';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

describe('sync aura dry run', () => {
  it('prints a summary without applying changes', () => {
    const scriptPath = path.resolve(process.cwd(), 'scripts/sync-aura-operational-data.mjs');
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-sync-aura-'));
    const seedPath = path.join(tempDir, 'aura-operational-data.test.json');

    fs.writeFileSync(
      seedPath,
      JSON.stringify(
        {
          assistant_rules: {
            checkin_checkout: {
              checkin_time: '14:00',
            },
          },
          room_rates: {
            Chale: {
              regular: {
                season_name: 'Regular',
                date_from: '2026-01-01',
                date_to: '2026-12-31',
                days_of_week: [0, 1, 2, 3, 4, 5, 6],
                base_price: 100,
                min_nights: 1,
                priority: 100,
                extra_adult_price: 0,
                child_price_6_11: 0,
                child_price_0_5: 0,
                notes: '',
              },
            },
            'Apto Anexo': {
              regular: {
                season_name: 'Regular',
                date_from: '2026-01-01',
                date_to: '2026-12-31',
                days_of_week: [0, 1, 2, 3, 4, 5, 6],
                base_price: 100,
                min_nights: 1,
                priority: 100,
                extra_adult_price: 0,
                child_price_6_11: 0,
                child_price_0_5: 0,
                notes: '',
              },
            },
          },
        },
        null,
        2
      )
    );

    const output = execFileSync(
      process.execPath,
      [scriptPath, `--file=${seedPath}`],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          VITE_SUPABASE_URL: 'https://example.supabase.co',
          VITE_SUPABASE_ANON_KEY: 'test-anon-key',
          SUPABASE_SERVICE_ROLE_KEY: '',
        },
        encoding: 'utf8',
      }
    );

    const summary = JSON.parse(output);
    expect(summary.mode).toBe('dry-run');
    expect(summary.seedPath).toBe(seedPath);
    expect(summary.assistantRules).toBeGreaterThan(0);
    expect(summary.roomRates).toBeGreaterThan(0);
  });
});

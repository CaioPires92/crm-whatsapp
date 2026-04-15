import fs from 'node:fs';
import path from 'node:path';
import { flattenHospedinRoomMappings, flattenHospedinSettings } from './hospedin-config.mjs';
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
  return {
    apply: argv.includes('--apply'),
    file: argv.find((arg) => arg.startsWith('--file='))?.split('=')[1] || 'seeds/aura-operational-data.local.json',
  };
}

function loadSeed(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function mergePlainObjects(base = {}, overlay = {}) {
  const result = { ...base };

  for (const [key, value] of Object.entries(overlay || {})) {
    const baseValue = result[key];
    const bothPlainObjects =
      baseValue &&
      value &&
      typeof baseValue === 'object' &&
      typeof value === 'object' &&
      !Array.isArray(baseValue) &&
      !Array.isArray(value);

    if (bothPlainObjects) {
      result[key] = { ...baseValue, ...value };
      continue;
    }

    result[key] = value;
  }

  return result;
}

function loadSeedWithFallback(rootDir, localSeedPath) {
  const templatePath = path.resolve(rootDir, 'seeds/aura-operational-data.template.json');
  const fallbackPath = fs.existsSync(localSeedPath) ? localSeedPath : templatePath;
  const baseSeed = loadSeed(templatePath);

  if (fallbackPath === templatePath) {
    return { seed: baseSeed, sourcePath: templatePath, usedFallback: true };
  }

  const localSeed = loadSeed(localSeedPath);
  return {
    seed: {
      ...baseSeed,
      ...localSeed,
      assistant_rules: mergePlainObjects(baseSeed.assistant_rules || {}, localSeed.assistant_rules || {}),
      room_rates: mergePlainObjects(baseSeed.room_rates || {}, localSeed.room_rates || {}),
      hospedin: {
        ...(baseSeed.hospedin || {}),
        ...(localSeed.hospedin || {}),
        room_mappings: {
          ...((baseSeed.hospedin || {}).room_mappings || {}),
          ...((localSeed.hospedin || {}).room_mappings || {}),
        },
      },
    },
    sourcePath: localSeedPath,
    usedFallback: false,
  };
}

function flattenAssistantRules(rules) {
  const rows = [];

  for (const [category, values] of Object.entries(rules || {})) {
    for (const [ruleKey, value] of Object.entries(values || {})) {
      rows.push({
        category,
        rule_key: ruleKey,
        value: String(value ?? '').trim(),
        active: true,
        notes: `Sincronizado do seed operacional local (${category}.${ruleKey}).`,
      });
    }
  }

  return rows;
}

function flattenRoomRates(roomRates) {
  const rows = [];

  for (const [roomType, periods] of Object.entries(roomRates || {})) {
    for (const [, rate] of Object.entries(periods || {})) {
      rows.push({
        room_type: roomType,
        season_name: String(rate.season_name || '').trim(),
        date_from: String(rate.date_from || '').trim(),
        date_to: String(rate.date_to || '').trim(),
        days_of_week: Array.isArray(rate.days_of_week) ? rate.days_of_week.map((v) => Number(v)) : [0, 1, 2, 3, 4, 5, 6],
        base_price: Number(rate.base_price || 0),
        min_nights: Number(rate.min_nights || 1),
        priority: Number(rate.priority || 100),
        extra_adult_price: Number(rate.extra_adult_price || 0),
        child_price_6_11: Number(rate.child_price_6_11 || 0),
        child_price_0_5: Number(rate.child_price_0_5 || 0),
        active: true,
        notes: String(rate.notes || '').trim(),
      });
    }
  }

  return rows;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Request failed ${response.status} ${response.statusText}: ${text.slice(0, 500)}`);
  }

  return text ? JSON.parse(text) : null;
}

async function main() {
  const rootDir = process.cwd();
  loadEnvFile(path.join(rootDir, '.env.local'));
  loadEnvFile(path.join(rootDir, '.env'));

  const args = parseArgs(process.argv.slice(2));
  const seedPath = path.resolve(rootDir, args.file);

  const { seed, sourcePath, usedFallback } = loadSeedWithFallback(rootDir, seedPath);
  const assistantRules = flattenAssistantRules(seed.assistant_rules);
  const roomRates = flattenRoomRates(seed.room_rates);
  const roomTypes = [...new Set(roomRates.map((row) => row.room_type))];
  const hospedinSettings = flattenHospedinSettings(seed.hospedin);
  const hospedinRoomMappings = flattenHospedinRoomMappings(seed.hospedin?.room_mappings);
  const supabaseUrl = process.env.VITE_SUPABASE_URL?.replace(/\/$/, '');
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const supabaseWriteKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;

  if (!supabaseUrl || !supabaseWriteKey) {
    throw new Error('Missing Supabase configuration in .env.local');
  }

  const summary = {
    seedPath,
    assistantRules: assistantRules.length,
    roomRates: roomRates.length,
    roomTypes,
    hospedinSettings: hospedinSettings ? 1 : 0,
    hospedinRoomMappings: hospedinRoomMappings.length,
    mode: args.apply ? 'apply' : 'dry-run',
    seedSource: sourcePath,
    usedTemplateFallback: usedFallback,
  };

  if (!args.apply) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  const headers = {
    apikey: supabaseWriteKey,
    Authorization: `Bearer ${supabaseWriteKey}`,
    'Content-Type': 'application/json',
  };

  try {
    await fetchJson(`${supabaseUrl}/rest/v1/assistant_rules?on_conflict=category,rule_key`, {
      method: 'POST',
      headers: {
        ...headers,
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(assistantRules),
    });

    for (const roomType of roomTypes) {
      await fetchJson(`${supabaseUrl}/rest/v1/room_rates?room_type=eq.${encodeURIComponent(roomType)}`, {
        method: 'DELETE',
        headers: {
          ...headers,
          Prefer: 'return=minimal',
        },
      });
    }

    await fetchJson(`${supabaseUrl}/rest/v1/room_rates`, {
      method: 'POST',
      headers: {
        ...headers,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(roomRates),
    });

    if (hospedinSettings) {
      await fetchJson(`${supabaseUrl}/rest/v1/hospedin_settings?on_conflict=id`, {
        method: 'POST',
        headers: {
          ...headers,
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify([hospedinSettings]),
      });
    }

    if (hospedinRoomMappings.length > 0) {
      await fetchJson(`${supabaseUrl}/rest/v1/hospedin_room_mappings?on_conflict=room_type`, {
        method: 'POST',
        headers: {
          ...headers,
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify(hospedinRoomMappings),
      });
    }

    console.log(JSON.stringify({ ...summary, applied: true }, null, 2));
  } catch (error) {
    throw error;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

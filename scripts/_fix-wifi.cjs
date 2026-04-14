const fs = require('node:fs');
const path = require('node:path');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

(async () => {
  loadEnvFile(path.join(process.cwd(), '.env.local'));
  const supabaseUrl = process.env.VITE_SUPABASE_URL.replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  const updates = [
    {
      rule_key: 'wifi_name',
      value: 'Ala principal: Delplata Aptos, Areas Comuns e Recepcao. Ala de chales/anexos: Delplata Chales.'
    },
    {
      rule_key: 'wifi_password',
      value: 'pousada151'
    }
  ];

  for (const item of updates) {
    const res = await fetch(`${supabaseUrl}/rest/v1/assistant_rules?category=eq.wifi&rule_key=eq.${item.rule_key}`, {
      method: 'PATCH',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify({ value: item.value, active: true })
    });

    if (!res.ok) {
      throw new Error(`${item.rule_key}: ${res.status} ${await res.text()}`);
    }
  }

  const verify = await fetch(`${supabaseUrl}/rest/v1/assistant_rules?select=category,rule_key,value&category=eq.wifi&order=rule_key.asc`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });

  console.log(JSON.stringify(await verify.json(), null, 2));
})();

const fs = require('fs');
const lid_json = JSON.parse(fs.readFileSync('/tmp/messages_lid.json', 'utf8'));
const phone_json = JSON.parse(fs.readFileSync('/tmp/messages_phone.json', 'utf8'));

// findMessages returns { messages: [] } or just []?
const lid = Array.isArray(lid_json) ? lid_json : lid_json.records || [];
const phone = Array.isArray(phone_json) ? phone_json : phone_json.records || [];

function formatMsg(m) {
  if (!m) return 'NULL';
  const ts = m.messageTimestamp || 0;
  const d = new Date(ts * 1000);
  const content = m.message?.conversation || m.message?.extendedTextMessage?.text || 'NON_TEXT';
  return `[${d.toLocaleString('pt-BR')}] ${m.key?.fromMe ? 'ME' : 'YOU'}: ${content}`;
}

console.log("--- LID LAST 2 ---");
console.log(lid.slice(-2).map(formatMsg).join('\n'));
console.log("--- PHONE LAST 2 ---");
console.log(phone.slice(-2).map(formatMsg).join('\n'));

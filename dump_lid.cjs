const fs = require('fs');
const chats = JSON.parse(fs.readFileSync('/tmp/chats.json', 'utf8'));
const res = chats.filter(c => 
  c.remoteJid === "62358646968397@lid" || 
  c.remoteJid === "554888243717@s.whatsapp.net" || 
  c.remoteJid === "95825116029130@lid"
);
console.log(JSON.stringify(res, null, 2));

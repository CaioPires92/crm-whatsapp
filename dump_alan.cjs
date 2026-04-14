const fs = require('fs');
const chats = JSON.parse(fs.readFileSync('/tmp/chats.json', 'utf8'));
const res = chats.filter(c => 
  c.remoteJid === "95825116029130@lid" || 
  c.remoteJid === "5519998816069@s.whatsapp.net" || 
  c.remoteJid === "5519997963112@s.whatsapp.net"
);
console.log(JSON.stringify(res, null, 2));

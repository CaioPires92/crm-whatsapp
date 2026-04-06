const fs = require('fs');
const chats = JSON.parse(fs.readFileSync('/tmp/chats.json', 'utf8'));
const res = chats.filter(c => 
  (c.pushName && c.pushName.match(/alan|christiny/i)) || 
  c.remoteJid.includes('88243717') || 
  c.remoteJid.includes('7963112') ||
  c.remoteJid.includes('8816069')
);
console.log(JSON.stringify(res.map(c => ({jid: c.remoteJid, name: c.pushName, pic: c.profilePicUrl !== null})), null, 2));

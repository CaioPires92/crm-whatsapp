function getCanonicalKey(leadId) {
  if (!leadId) return '';
  const digits = leadId.replace(/\D/g, '');
  let canonicalKey = digits.replace(/^0+/, '');
  if (canonicalKey.startsWith('55')) {
    canonicalKey = canonicalKey.slice(2).replace(/^0+/, '');
  }
  if (canonicalKey.length === 11) {
    canonicalKey = canonicalKey.slice(0, 2) + canonicalKey.slice(3);
  }
  return canonicalKey;
}
console.log(getCanonicalKey('554888243717'));
console.log(getCanonicalKey('5548988243717'));
console.log(getCanonicalKey('554888243717@s.whatsapp.net'));
console.log(getCanonicalKey('5548988243717@s.whatsapp.net'));
console.log("Alan Silva nums:");
console.log(getCanonicalKey('5519998816069'));
console.log(getCanonicalKey('5519997963112'));

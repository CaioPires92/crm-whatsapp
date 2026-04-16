
function getLocalToday() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return new Date(Date.UTC(Number(lookup.year), Number(lookup.month) - 1, Number(lookup.day)));
}

function parseMessageDates(value) {
  const found = [];
  const seen = new Set();
  const now = new Date();
  const defaultYear = now.getUTCFullYear();
  const defaultMonth = now.getUTCMonth() + 1;

  const pushDate = (year, month, day) => {
    const date = new Date(Date.UTC(year, month - 1, day));
    if (Number.isNaN(date.getTime())) return;
    const key = date.toISOString().slice(0, 10);
    if (seen.has(key)) return;
    seen.add(key);
    found.push(date);
  };

  const pushOffsetDate = (offsetDays) => {
    const date = getLocalToday();
    date.setUTCDate(date.getUTCDate() + offsetDays);
    pushDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  };

  // Range matches
  const rangeMatches = [...String(value).matchAll(/\b(\d{1,2})(?:\/(\d{1,2})(?:\/(\d{2,4}))?)?\s*(?:a|-|até|ate)\s*(\d{1,2})(?:\/(\d{1,2})(?:\/(\d{2,4}))?)?\b/gi)];
  for (const match of rangeMatches) {
    const startDay = Number(match[1]);
    const startMonth = match[2] ? Number(match[2]) : (match[5] ? Number(match[5]) : defaultMonth);
    let startYear = match[3] ? Number(match[3]) : (match[6] ? Number(match[6]) : defaultYear);
    const endDay = Number(match[4]);
    const endMonth = match[5] ? Number(match[5]) : startMonth;
    let endYear = match[6] ? Number(match[6]) : startYear;
    if (startYear < 100) startYear += 2000;
    if (endYear < 100) endYear += 2000;
    pushDate(startYear, startMonth, startDay);
    pushDate(endYear, endMonth, endDay);
  }

  // Slash matches
  const slashMatches = [...String(value).matchAll(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/g)];
  for (const match of slashMatches) {
    let year = match[3] ? Number(match[3]) : defaultYear;
    if (year < 100) year += 2000;
    pushDate(year, Number(match[2]), Number(match[1]));
  }

  // ISO matches
  const isoMatches = [...String(value).matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)];
  for (const match of isoMatches) {
    pushDate(Number(match[1]), Number(match[2]), Number(match[3]));
  }

  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  
  const hasToday = /\b(hoje|hj)\b/.test(normalized);
  const hasTomorrow = /\b(amanha)\b/.test(normalized);
  const hasDayAfterTomorrow = /\b(depois de amanha)\b/.test(normalized);

  if (hasToday) {
    pushOffsetDate(0);
  }
  if (hasTomorrow) {
    pushOffsetDate(1);
  }
  if (hasDayAfterTomorrow) {
    pushOffsetDate(2);
  }

  return found.sort((a, b) => a.getTime() - b.getTime());
}

const test1 = "tem vaga de hoje para amanha casal?";
const dates1 = parseMessageDates(test1);
console.log(`Test 1: "${test1}"`);
console.log(dates1.map(d => d.toISOString().slice(0, 10)));

const test2 = "vaga hoje";
const dates2 = parseMessageDates(test2);
console.log(`Test 2: "${test2}"`);
console.log(dates2.map(d => d.toISOString().slice(0, 10)));

import fs from "fs/promises";

const DATA_PATH = "src/data/manual-availability-fallback.local.json";

export async function getManualAvailability(dateStr, roomType) {
  try {
    const data = JSON.parse(await fs.readFile(DATA_PATH, "utf-8"));
    const override = data.overrides.find(o => o.date === dateStr);
    if (override && override.availability[roomType] !== undefined) return override.availability[roomType];
    const range = data.default_ranges.find(r => dateStr >= r.from && dateStr <= r.to);
    return (range && range.availability[roomType] !== undefined) ? range.availability[roomType] : 0;
  } catch (error) {
    process.stderr.write("Error: " + error.message + "\n");
    return 0;
  }
}

const args = process.argv.slice(2);
const dateIdx = args.indexOf("--date");
const typeIdx = args.indexOf("--type");
if (dateIdx !== -1 && typeIdx !== -1) {
  getManualAvailability(args[dateIdx + 1], args[typeIdx + 1]).then(console.log);
}


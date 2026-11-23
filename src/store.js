const fs = require('node:fs');
const path = require('node:path');

const dataPath = process.env.DATA_FILE || path.join(__dirname, '..', 'cheaters.json');

function readRecords() {
  if (!fs.existsSync(dataPath)) return [];
  const parsed = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  return Array.isArray(parsed) ? parsed : [];
}

function writeRecords(records) {
  fs.mkdirSync(path.dirname(dataPath), { recursive: true });
  fs.writeFileSync(dataPath, JSON.stringify(records, null, 2));
}

module.exports = { readRecords, writeRecords };

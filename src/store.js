const fs = require('node:fs');
const path = require('node:path');

const dataPath = path.join(__dirname, '..', 'cheaters.json');

function readRecords() {
  if (!fs.existsSync(dataPath)) return [];
  const parsed = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  return Array.isArray(parsed) ? parsed : [];
}

function writeRecords(records) {
  fs.writeFileSync(dataPath, JSON.stringify(records, null, 2));
}

module.exports = { readRecords, writeRecords };

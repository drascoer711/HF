const fs = require('node:fs');
const path = require('node:path');

// Keep bot conversation memory beside the cheater report file. On Render, set
// DATA_FILE to a path on the attached persistent disk to preserve both files.
const dataFile = process.env.DATA_FILE || path.join(__dirname, '..', '..', 'cheaters.json');
const memoryFile = path.join(path.dirname(dataFile), 'conversations.json');
const MAX_CONTEXT_MESSAGES = 40;

function readAll() {
  try {
    const parsed = JSON.parse(fs.readFileSync(memoryFile, 'utf8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    if (error.code !== 'ENOENT') console.error('Could not read conversation memory:', error);
    return {};
  }
}

function writeAll(data) {
  fs.mkdirSync(path.dirname(memoryFile), { recursive: true });
  const tempFile = `${memoryFile}.${process.pid}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(data), { mode: 0o600 });
  fs.renameSync(tempFile, memoryFile);
}

function getMessages(key) {
  const data = readAll();
  return Array.isArray(data[key]) ? data[key] : [];
}

function appendExchange(key, userText, assistantText) {
  const data = readAll();
  const messages = Array.isArray(data[key]) ? data[key] : [];
  messages.push(
    { role: 'user', content: userText, at: new Date().toISOString() },
    { role: 'assistant', content: assistantText, at: new Date().toISOString() },
  );
  // Bound the file and model context while retaining recent conversation across restarts.
  data[key] = messages.slice(-MAX_CONTEXT_MESSAGES);
  writeAll(data);
}

module.exports = { getMessages, appendExchange };

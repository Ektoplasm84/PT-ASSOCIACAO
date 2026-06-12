const MAX_LINES = 300;
const _lines    = [];
const _clients  = new Set();

const _orig = {
  log:   console.log.bind(console),
  warn:  console.warn.bind(console),
  error: console.error.bind(console),
};

function _fmt(level, args) {
  const ts  = new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm
  const msg = args.map(a => {
    if (a instanceof Error) return a.stack || a.message;
    if (typeof a === 'object' && a !== null) {
      try { return JSON.stringify(a); } catch { return String(a); }
    }
    return String(a);
  }).join(' ');
  return { ts, level, msg };
}

function _push(entry) {
  _lines.push(entry);
  if (_lines.length > MAX_LINES) _lines.shift();
  const payload = `data: ${JSON.stringify(entry)}\n\n`;
  for (const res of _clients) {
    try { res.write(payload); } catch { _clients.delete(res); }
  }
}

['log', 'warn', 'error'].forEach(level => {
  console[level] = (...args) => {
    _orig[level](...args);
    _push(_fmt(level, args));
  };
});

function getLogs()     { return [..._lines]; }
function subscribe(res) {
  _clients.add(res);
  res.on('close', () => _clients.delete(res));
}

module.exports = { getLogs, subscribe };

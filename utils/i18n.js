const fs   = require('fs');
const path = require('path');

const SUPPORTED = ['en', 'pt', 'zh-TW'];
const DEFAULT   = 'en';

const _cache = {};

function load(lang) {
  if (!_cache[lang]) {
    const file = path.join(process.cwd(), 'locales', `${lang}.json`);
    _cache[lang] = JSON.parse(fs.readFileSync(file, 'utf8'));
  }
  return _cache[lang];
}

function getLang(req) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const [k, v] = part.trim().split('=');
    if (k === 'lang') {
      const val = decodeURIComponent(v || '');
      return SUPPORTED.includes(val) ? val : DEFAULT;
    }
  }
  return DEFAULT;
}

function i18nMiddleware(req, res, next) {
  const lang  = getLang(req);
  const dict  = load(lang);
  res.locals.lang = lang;
  res.locals.t = function t(key) {
    const parts = key.split('.');
    let node = dict;
    for (const p of parts) { node = node && node[p]; }
    return (node !== undefined && node !== null) ? node : key;
  };
  next();
}

module.exports = i18nMiddleware;

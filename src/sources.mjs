/**
 * Free proxy list sources.
 * Each source returns a list of candidate proxy URLs: http://host:port
 */

export async function fetchAllSources() {
  const results = [];
  for (const source of SOURCES) {
    try {
      const list = await source.fetch();
      results.push(...list);
    } catch (err) {
      console.warn(`[sources] ${source.name} failed: ${err.message}`);
    }
  }
  return dedupe(results);
}

const SOURCES = [
  {
    name: 'proxyscrape-http',
    fetch: async () => {
      const url = 'https://api.proxyscrape.com/v2/?request=display&protocol=http&timeout=10000&country=all&ssl=all&anonymity=all';
      const text = await fetchText(url);
      return parsePlainList(text);
    },
  },
  {
    name: 'proxyscrape-https',
    fetch: async () => {
      const url = 'https://api.proxyscrape.com/v2/?request=display&protocol=https&timeout=10000&country=all&ssl=all&anonymity=all';
      const text = await fetchText(url);
      return parsePlainList(text).map(p => p.replace(/^http:/, 'https:'));
    },
  },
  {
    name: 'geonode',
    fetch: async () => {
      const url = 'https://proxylist.geonode.com/api/proxy-list?limit=500&page=1&sort_by=lastChecked&sort_type=desc&protocols=http%2Chttps';
      const json = await fetchJson(url);
      const list = [];
      for (const item of json?.data || []) {
        const protocols = Array.isArray(item.protocols) ? item.protocols : ['http'];
        for (const proto of protocols) {
          list.push(`${proto}://${item.ip}:${item.port}`);
        }
      }
      return list;
    },
  },
  {
    name: 'proxy-list-download-http',
    fetch: async () => {
      const url = 'https://www.proxy-list.download/api/v1/get?type=http';
      const text = await fetchText(url);
      return parsePlainList(text);
    },
  },
];

function parsePlainList(text) {
  return text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => /^\d+\.\d+\.\d+\.\d+:\d+$/.test(line))
    .map(line => `http://${line}`);
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'proxy-rotator/1.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'proxy-rotator/1.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function dedupe(list) {
  const seen = new Set();
  return list.filter(p => {
    const key = normalizeUrl(p);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function normalizeUrl(url) {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.hostname}:${u.port || (u.protocol === 'https:' ? 443 : 80)}`.toLowerCase();
  } catch {
    return String(url).toLowerCase().trim();
  }
}

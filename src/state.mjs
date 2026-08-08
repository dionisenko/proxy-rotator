import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const DATA_DIR = process.env.DATA_DIR || './data';
const PROXIES_FILE = join(DATA_DIR, 'proxies.json');
const STATE_FILE = join(DATA_DIR, 'state.json');

export async function ensureDataDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

export async function loadPublicList() {
  try {
    const text = await readFile(PROXIES_FILE, 'utf8');
    return JSON.parse(text);
  } catch {
    return { updatedAt: null, proxies: [] };
  }
}

export async function savePublicList(list) {
  await ensureDataDir();
  await writeFile(PROXIES_FILE, JSON.stringify(list, null, 2) + '\n', 'utf8');
}

export async function loadState() {
  try {
    const text = await readFile(STATE_FILE, 'utf8');
    return JSON.parse(text);
  } catch {
    return { known: {} };
  }
}

export async function saveState(state) {
  await ensureDataDir();
  await writeFile(STATE_FILE, JSON.stringify(state, null, 2) + '\n', 'utf8');
}

export function mergeResults(state, results, maxAgeDays = 2) {
  const now = new Date().toISOString();
  for (const r of results) {
    const key = r.url;
    const entry = state.known[key] || {
      url: r.url,
      firstSeen: now,
      successes: 0,
      failures: 0,
      workingTargets: [],
      lastTested: null,
      latencyTotalMs: 0,
      latencyCount: 0,
    };
    entry.lastTested = now;
    if (r.ok) {
      entry.successes += 1;
      entry.latencyTotalMs += r.latencyMs;
      entry.latencyCount += 1;
      for (const t of r.workingTargets || []) {
        if (!entry.workingTargets.includes(t)) entry.workingTargets.push(t);
      }
    } else {
      entry.failures += 1;
      // Drop target marks if failing too many times in a row
      if (entry.failures >= 5) entry.workingTargets = [];
    }
    state.known[key] = entry;
  }

  // Clean old/unhealthy entries
  const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000).toISOString();
  for (const [key, entry] of Object.entries(state.known)) {
    if (entry.lastTested < cutoff && entry.successes === 0) {
      delete state.known[key];
    }
  }
  return state;
}

export function buildPublicList(state, minSuccessRate = 0.3, maxFailures = 4) {
  const now = new Date().toISOString();
  const proxies = Object.values(state.known)
    .filter(e => {
      const total = e.successes + e.failures;
      if (total === 0) return false;
      if (e.failures >= maxFailures && e.successes === 0) return false;
      const rate = e.successes / total;
      return rate >= minSuccessRate && e.workingTargets.length > 0;
    })
    .map(e => ({
      url: e.url,
      lastTested: e.lastTested,
      successes: e.successes,
      failures: e.failures,
      workingTargets: e.workingTargets.slice(),
      averageLatencyMs: e.latencyCount ? Math.round(e.latencyTotalMs / e.latencyCount) : null,
    }))
    .sort((a, b) => (b.successes / (b.successes + b.failures + 1)) - (a.successes / (a.successes + a.failures + 1)));
  return { updatedAt: now, proxies };
}

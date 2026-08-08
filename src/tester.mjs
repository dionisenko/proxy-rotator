import { spawn } from 'node:child_process';

export const TARGETS = [
  {
    name: 'autodoc.pl',
    url: 'https://www.autodoc.pl/valeo/c1416',
    expected: ['Valeo', 'Producent', 'Sklep'],
    blocked: ['Attention Required', 'Cloudflare', 'Ray ID', 'ARE YOU HUMAN', 'captcha'],
  },
  {
    name: 'intercars.pl',
    url: 'https://intercars.pl',
    expected: ['Inter Cars', 'Katalog', 'części'],
    blocked: ['Attention Required', 'Cloudflare', 'Ray ID', 'captcha'],
  },
  {
    name: 'hartphp.com.pl',
    url: 'https://store.hartphp.com.pl/Account/Login',
    expected: ['Hart', 'Logowanie', 'Zaloguj', 'Hasło', 'form'],
    blocked: ['Attention Required', 'Cloudflare', 'Ray ID', 'captcha', ' blok'],
  },
];

/**
 * Test one proxy against one target.
 * Returns { ok: boolean, latencyMs: number, reason: string }
 */
export function testProxy(proxyUrl, target, timeoutSec = 15) {
  return new Promise((resolve) => {
    const start = Date.now();
    let stdout = '';
    let stderr = '';
    const args = [
      '-x', proxyUrl,
      '-L',
      '-A', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      '-s', '-S',
      '-D', '-',
      '-o', '-',
      '--max-time', String(timeoutSec),
      '--connect-timeout', String(Math.min(timeoutSec, 10)),
      target.url,
    ];
    const child = spawn('curl', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });

    let done = false;
    const finish = (ok, reason) => {
      if (done) return;
      done = true;
      try { child.kill('SIGKILL'); } catch {}
      resolve({ ok, latencyMs: Date.now() - start, reason });
    };

    child.on('error', err => finish(false, `spawn error: ${err.message}`));
    child.on('close', (code) => {
      if (done) return;
      const latencyMs = Date.now() - start;
      if (code !== 0) {
        return finish(false, stderr ? stderr.trim().slice(0, 200) : `curl exit ${code}`);
      }
      const body = extractBody(stdout).toLowerCase();
      const headers = stdout.slice(0, stdout.indexOf('\r\n\r\n') + 1).toLowerCase();
      for (const phrase of target.blocked) {
        if (body.includes(phrase.toLowerCase()) || headers.includes(phrase.toLowerCase())) {
          return finish(false, `blocked: ${phrase}`);
        }
      }
      const missing = target.expected.filter(exp => !body.includes(exp.toLowerCase()));
      if (missing.length > 0) {
        return finish(false, `missing expected: ${missing.join(', ')}`);
      }
      finish(true, 'ok', latencyMs);
    });

    setTimeout(() => finish(false, 'timeout'), timeoutSec * 1000 + 500);
  });
}

function extractBody(full) {
  const sep = '\r\n\r\n';
  const idx = full.indexOf(sep);
  return idx >= 0 ? full.slice(idx + sep.length) : full;
}

/**
 * Run a pool of async tasks with limited concurrency.
 */
export async function runPool(items, concurrency, handler) {
  const results = [];
  const queue = items.map((item, i) => ({ item, i }));
  let index = 0;

  async function worker() {
    while (index < queue.length) {
      const { item, i } = queue[index++];
      try {
        results[i] = await handler(item);
      } catch (err) {
        results[i] = { ok: false, reason: err.message };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

export function testProxyAllTargets(proxyUrl) {
  return Promise.all(TARGETS.map(t => testProxy(proxyUrl, t).then(r => ({ target: t.name, ...r }))));
}

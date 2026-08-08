import { fetchAllSources, normalizeUrl } from './sources.mjs';
import { testProxyAllTargets, runPool, TARGETS } from './tester.mjs';
import { loadState, saveState, mergeResults, buildPublicList, loadPublicList, savePublicList } from './state.mjs';
import { updateRepoProxies, commitProxies } from './github.mjs';
import cron from 'node-cron';

const CONCURRENCY = Number(process.env.TEST_CONCURRENCY || 30);
const TEST_TIMEOUT = Number(process.env.TEST_TIMEOUT_SEC || 15);
const DAILY_RECHECK_AT = process.env.DAILY_RECHECK_AT || '03:00';
const HOURLY_DISCOVERY_AT = process.env.HOURLY_DISCOVERY_AT || '0'; // every hour at minute 0
const PROXY_BATCH_LIMIT = Number(process.env.PROXY_BATCH_LIMIT || 500);
const GITHUB_PUSH = process.env.GITHUB_PUSH !== '0';

async function main() {
  console.log('[proxy-rotator] Starting service');

  // Run an initial discovery+test immediately
  await runDiscoveryJob();

  // Hourly discovery of new proxies
  cron.schedule(`0 ${HOURLY_DISCOVERY_AT} * * * *`, async () => {
    console.log('[cron] Hourly discovery');
    await runDiscoveryJob();
  });

  // Daily recheck of all known proxies
  const [hour, minute] = DAILY_RECHECK_AT.split(':');
  cron.schedule(`${minute} ${hour} * * *`, async () => {
    console.log('[cron] Daily recheck');
    await runRecheckJob();
  });
}

async function runDiscoveryJob() {
  const start = Date.now();
  console.log('[job] Discovering proxies...');
  let candidates = await fetchAllSources();
  console.log(`[job] ${candidates.length} raw candidates`);
  candidates = candidates.slice(0, PROXY_BATCH_LIMIT);
  await testAndStore(candidates);
  console.log(`[job] Discovery finished in ${Date.now() - start}ms`);
}

async function runRecheckJob() {
  const start = Date.now();
  const state = await loadState();
  const knownUrls = Object.keys(state.known || {});
  console.log(`[job] Rechecking ${knownUrls.length} known proxies`);
  if (knownUrls.length === 0) {
    console.log('[job] No known proxies, running discovery instead');
    return runDiscoveryJob();
  }
  await testAndStore(knownUrls, { recheck: true });
  console.log(`[job] Recheck finished in ${Date.now() - start}ms`);
}

async function testAndStore(urls, { recheck = false } = {}) {
  const state = await loadState();
  const items = urls.map(url => ({ url: normalizeUrl(url) }));

  const results = await runPool(items, CONCURRENCY, async ({ url }) => {
    const targetResults = await testProxyAllTargets(url);
    const workingTargets = targetResults.filter(r => r.ok).map(r => r.target);
    const ok = workingTargets.length > 0;
    const best = targetResults.find(r => r.ok);
    const worst = targetResults.find(r => !r.ok);
    console.log(`[test] ${url} ${ok ? 'OK' : 'FAIL'} ${workingTargets.length}/${TARGETS.length} ${ok ? best.latencyMs + 'ms' : worst.reason}`);
    return {
      url,
      ok,
      latencyMs: ok ? best.latencyMs : (worst?.latencyMs || 0),
      workingTargets,
      targetResults,
    };
  });

  mergeResults(state, results);
  await saveState(state);

  const publicList = buildPublicList(state);
  await savePublicList(publicList);
  if (GITHUB_PUSH) {
    await updateRepoProxies(publicList);
    await commitProxies();
  }

  console.log(`[job] Public list: ${publicList.proxies.length} working proxies`);
  return publicList;
}

main().catch(err => {
  console.error('[proxy-rotator] fatal:', err);
  process.exit(1);
});

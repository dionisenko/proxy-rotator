import { testProxyAllTargets } from './src/tester.mjs';
import { fetchAllSources } from './src/sources.mjs';

(async () => {
  const proxies = await fetchAllSources();
  console.log('Testing first 3 proxies...');
  for (let i = 0; i < Math.min(3, proxies.length); i++) {
    const proxy = proxies[i];
    console.log(`Testing ${proxy}...`);
    try {
      const results = await testProxyAllTargets(proxy);
      const working = results.filter(r => r.ok);
      console.log(`  Result: ${working.length}/${results.length} targets working`);
      for (const r of results) {
        console.log(`    ${r.target}: ${r.ok ? 'OK' + (r.latencyMs ? ' (' + r.latencyMs + 'ms)' : '') : 'FAIL' + (r.reason ? ' - ' + r.reason : '')}`);
      }
    } catch (err) {
      console.log(`  Error: ${err.message}`);
    }
  }
})();
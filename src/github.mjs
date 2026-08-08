import { simpleGit } from 'simple-git';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const REPO_DIR = process.env.REPO_DIR || '/app/repo';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
const REPO_OWNER = process.env.REPO_OWNER || 'dionisenko';
const REPO_NAME = process.env.REPO_NAME || 'proxy-rotator';
const BRANCH = process.env.REPO_BRANCH || 'main';

export async function commitProxies() {
  if (!GITHUB_TOKEN) {
    console.warn('[github] GITHUB_TOKEN missing; skipping commit');
    return false;
  }
  await ensureRepo();
  const git = simpleGit(REPO_DIR);
  await git.pull('origin', BRANCH, { '--rebase': 'true' });

  const status = await git.status();
  if (status.modified.includes('data/proxies.json') || status.not_added.includes('data/proxies.json')) {
    await git.add('data/proxies.json');
    await git.commit(`Update proxy pool: ${new Date().toISOString()}`);
    await git.push('origin', BRANCH);
    console.log('[github] Pushed updated proxies.json');
    return true;
  }
  console.log('[github] No changes to commit');
  return false;
}

async function ensureRepo() {
  await mkdir(REPO_DIR, { recursive: true });
  if (!existsSync(join(REPO_DIR, '.git'))) {
    const git = simpleGit(REPO_DIR);
    const url = `https://202813344:${GITHUB_TOKEN}@github.com/${REPO_OWNER}/${REPO_NAME}.git`;
    await git.clone(url, REPO_DIR, ['--depth', '1', '--branch', BRANCH]);
  }
}

export async function updateRepoProxies(publicList) {
  const file = join(REPO_DIR, 'data', 'proxies.json');
  await mkdir(join(REPO_DIR, 'data'), { recursive: true });
  await writeFile(file, JSON.stringify(publicList, null, 2) + '\n', 'utf8');
}

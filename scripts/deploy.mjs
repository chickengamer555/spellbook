// Publishes dist/ as a new commit on the gh-pages branch, which GitHub Pages serves.
// Run with `npm run deploy`. Uses a throwaway index, so the working tree and main stay untouched.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const tmp = mkdtempSync(join(tmpdir(), 'spellbook-deploy-'));
const env = { ...process.env, GIT_INDEX_FILE: join(tmp, 'index'), GIT_WORK_TREE: resolve('dist') };
const git = (...args) => execFileSync('git', args, { env, encoding: 'utf8' }).trim();
const parent = () => { try { return ['-p', git('rev-parse', '--verify', '-q', 'origin/gh-pages')]; } catch { return []; } };

try {
  git('fetch', 'origin', 'gh-pages');
} catch { /* first deploy: the branch does not exist yet */ }
try {
  git('add', '-Af', '.');
  const commit = git('commit-tree', git('write-tree'), ...parent(), '-m', `Deploy ${git('rev-parse', '--short', 'HEAD')}`);
  git('push', 'origin', `${commit}:refs/heads/gh-pages`);
  console.log(`Deployed ${commit.slice(0, 7)} to gh-pages`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

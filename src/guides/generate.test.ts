import fs from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { createFixtureRepo, type FixtureRepo } from '../test-utils/fixture-repo.js';
import { buildRepoContext } from '../core/plans.js';
import { generateForFolder } from './generate.js';
import type { GuideProvider, ProviderResult } from '../llm/provider.js';

let repo: FixtureRepo | undefined;

class FakeProvider implements GuideProvider {
  constructor(private readonly result: ProviderResult) {}

  async generateGuide(): Promise<ProviderResult> {
    return this.result;
  }
}

afterEach(() => {
  repo?.cleanup();
  repo = undefined;
});

function validGuide(folderPath: string): string {
  return `${folderPath === '.' ? '# .' : `# ${folderPath}`}\n\n## Responsibility\n\n## Important Files\n\n## Child Modules\n\n## Notes\n`;
}

describe('guide generation', () => {
  it('writes valid guides and supports dry-run', async () => {
    repo = createFixtureRepo();
    repo.write('src/a.ts', 'a\n');
    repo.commitAll('source');
    const context = buildRepoContext(repo.root, repo.root);
    const folder = context.tree.nodes.get('src')!;

    const dryRun = await generateForFolder(context, folder, new FakeProvider({ type: 'guide', markdown: validGuide('src') }), 50000, { dryRun: true });
    expect(dryRun.status).toBe('dry-run');
    expect(fs.existsSync(`${repo.root}/src/guide.md`)).toBe(false);

    const created = await generateForFolder(context, folder, new FakeProvider({ type: 'guide', markdown: validGuide('src') }), 50000);
    expect(created.status).toBe('created');
    expect(fs.readFileSync(`${repo.root}/src/guide.md`, 'utf8')).toContain('# src');
  });

  it('returns no-guide and validation/provider failures without writing', async () => {
    repo = createFixtureRepo();
    repo.write('src/a.ts', 'a\n');
    repo.commitAll('source');
    const context = buildRepoContext(repo.root, repo.root);
    const folder = context.tree.nodes.get('src')!;

    await expect(generateForFolder(context, folder, new FakeProvider({ type: 'no-guide' }), 50000)).resolves.toMatchObject({ status: 'no-guide' });
    await expect(generateForFolder(context, folder, new FakeProvider({ type: 'error', message: 'boom' }), 50000)).resolves.toMatchObject({ status: 'failed', message: 'boom' });
    await expect(generateForFolder(context, folder, new FakeProvider({ type: 'guide', markdown: '# wrong\n' }), 50000)).resolves.toMatchObject({ status: 'failed' });
  });

  it('refuses to write through guide symlinks', async () => {
    repo = createFixtureRepo();
    repo.write('src/a.ts', 'a\n');
    repo.mkdir('src');
    fs.symlinkSync('/tmp/repoguide-outside-guide.md', `${repo.root}/src/guide.md`);
    repo.git(['add', 'src/a.ts']);
    repo.git(['commit', '-m', 'source']);
    const context = buildRepoContext(repo.root, repo.root);
    const folder = context.tree.nodes.get('src') ?? { path: 'src', directFiles: ['src/a.ts'], children: [], hasGuide: true };

    const result = await generateForFolder(context, folder, new FakeProvider({ type: 'guide', markdown: validGuide('src') }), 50000, { updateExisting: true });
    expect(result).toMatchObject({ status: 'failed' });
    expect(result.message).toContain('symlink');
  });
});

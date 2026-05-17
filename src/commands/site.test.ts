import fs from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFixtureRepo, type FixtureRepo } from '../test-utils/fixture-repo.js';
import { runSite } from './site.js';

let repo: FixtureRepo | undefined;

function captureConsole(): { stdout: string[]; restore: () => void } {
  const stdout: string[] = [];
  const log = vi.spyOn(console, 'log').mockImplementation((value?: unknown) => {
    stdout.push(String(value));
  });
  return {
    stdout,
    restore: () => log.mockRestore()
  };
}

afterEach(() => {
  repo?.cleanup();
  repo = undefined;
  vi.restoreAllMocks();
});

describe('site command', () => {
  it('generates a searchable static wiki from tracked and untracked guides', async () => {
    repo = createFixtureRepo();
    repo.write(
      'guide.md',
      '# .\n\n## How This Fits\n\nRoot guide with **important** context and a [safe link](https://example.com).\n'
    );
    repo.write('src/guide.md', '# src\n\n## Gotchas\n\nUse `git ls-files`. <script>bad()</script>\n');
    repo.write('src/core/guide.md', '# src/core\n\n## Change Guide\n\n- Update stale checks\n- Keep paths POSIX\n');
    repo.write('src/core/a.ts', 'export const a = 1;\n');
    repo.git(['add', 'guide.md', 'src/core/guide.md', 'src/core/a.ts']);

    const capture = captureConsole();
    const result = await runSite(repo.root, { outDir: 'wiki', title: 'Repo Wiki' });
    capture.restore();

    expect(result.exitCode).toBe(0);
    expect(capture.stdout).toEqual(['Wrote wiki site to wiki/index.html (3 guides).']);

    const html = fs.readFileSync(`${repo.root}/wiki/index.html`, 'utf8');
    expect(html).toContain('<title>Repo Wiki</title>');
    expect(html).toContain('Search guides');
    expect(html).toContain('Press / to search');
    expect(html).toContain('Repository Root');
    expect(html).toContain('src/core');
    expect(html).toContain('<strong>important</strong>');
    expect(html).toContain('&lt;script&gt;bad()&lt;/script&gt;');
    expect(html).not.toContain('<script>bad()</script>');

    const pageData = html.match(/<script id="page-data" type="application\/json">(?<json>[\s\S]+?)<\/script>/)?.groups?.json ?? '';
    const parsed = JSON.parse(pageData) as Array<{ folderPath: string }>;
    expect(parsed.map((page) => page.folderPath)).toEqual(['.', 'src', 'src/core']);
  });

  it('reports when there are no guides to publish', async () => {
    repo = createFixtureRepo();
    repo.write('src/a.ts', 'a\n');
    repo.commitAll('source');

    const capture = captureConsole();
    const result = await runSite(repo.root, { outDir: 'wiki' });
    capture.restore();

    expect(result.exitCode).toBe(1);
    expect(capture.stdout).toEqual(['No guide.md files found. Run repoguide init first.']);
    expect(fs.existsSync(`${repo.root}/wiki/index.html`)).toBe(false);
  });

  it('writes the default site directory at the repo root from nested folders', async () => {
    repo = createFixtureRepo();
    repo.write('guide.md', '# .\n\n## How This Fits\n\nRoot guide.\n');
    repo.mkdir('src/nested');

    const capture = captureConsole();
    const result = await runSite(`${repo.root}/src/nested`);
    capture.restore();

    expect(result.exitCode).toBe(0);
    expect(fs.existsSync(`${repo.root}/repoguide-site/index.html`)).toBe(true);
    expect(capture.stdout).toEqual(['Wrote wiki site to repoguide-site/index.html (1 guides).']);
  });
});

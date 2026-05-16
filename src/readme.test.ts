import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildProgram } from './cli.js';

describe('README examples', () => {
  it('lists commands that are registered in the CLI', () => {
    const readme = fs.readFileSync('README.md', 'utf8');
    const commands = [...readme.matchAll(/^repoguide (.+)$/gm)].map((match) => match[1]);
    const help = buildProgram().helpInformation();

    expect(commands).toEqual(['init', 'init --force', 'check', 'update', 'estimate init', 'estimate update']);
    for (const command of ['init', 'check', 'update', 'estimate']) {
      expect(help).toContain(command);
    }
    const estimateHelp = buildProgram().commands.find((command) => command.name() === 'estimate')?.helpInformation() ?? '';
    expect(estimateHelp).toContain('init');
    expect(estimateHelp).toContain('update');
  });
});

import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildProgram } from './cli.js';

describe('README examples', () => {
  it('lists commands that are registered in the CLI', () => {
    const readme = fs.readFileSync('README.md', 'utf8');
    const commandBlock = readme.match(/## Commands\n\n```sh\n(?<commands>[\s\S]+?)\n```/)?.groups?.commands ?? '';
    const commands = commandBlock.split('\n').map((line) => line.replace(/^repoguide\s+/, ''));
    const help = buildProgram().helpInformation();

    expect(commands).toEqual(['init', 'init --force', 'check', 'update', 'site', 'estimate init', 'estimate update']);
    for (const command of ['init', 'check', 'update', 'site', 'estimate']) {
      expect(help).toContain(command);
    }
    const estimateHelp = buildProgram().commands.find((command) => command.name() === 'estimate')?.helpInformation() ?? '';
    expect(estimateHelp).toContain('init');
    expect(estimateHelp).toContain('update');
  });
});

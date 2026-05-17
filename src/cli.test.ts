import { describe, expect, it, vi } from 'vitest';
import { buildProgram } from './cli.js';

function programOutput(argv: string[]): { stdout: string; stderr: string; exitCode?: number } {
  let stdout = '';
  let stderr = '';
  const program = buildProgram();
  program.configureOutput({
    writeOut: (value) => {
      stdout += value;
    },
    writeErr: (value) => {
      stderr += value;
    }
  });
  const exit = vi.spyOn(process, 'exit').mockImplementation(((code?: string | number | null) => {
    throw Object.assign(new Error('exit'), { exitCode: Number(code) });
  }) as never);
  try {
    program.parse(['node', 'repoguide', ...argv], { from: 'node' });
  } catch (error) {
    return { stdout, stderr, exitCode: Number((error as { exitCode?: number }).exitCode ?? 0) };
  } finally {
    exit.mockRestore();
  }
  return { stdout, stderr };
}

describe('cli', () => {
  it('lists top-level commands and estimate subcommands', () => {
    expect(programOutput(['--help']).stdout).toContain('init');
    expect(programOutput(['--help']).stdout).toContain('site');
    const initHelp = buildProgram().commands.find((command) => command.name() === 'init')?.helpInformation() ?? '';
    expect(initHelp).toContain('--force');
    const siteHelp = buildProgram().commands.find((command) => command.name() === 'site')?.helpInformation() ?? '';
    expect(siteHelp).toContain('--out');
    const estimate = buildProgram().commands.find((command) => command.name() === 'estimate')?.helpInformation() ?? '';
    expect(estimate).toContain('init');
    expect(estimate).toContain('update');
  });

  it('fails unknown commands', () => {
    const result = programOutput(['nope']);
    expect(result.stderr).toContain('unknown command');
  });
});

#!/usr/bin/env node
import { Command } from 'commander';
import { pathToFileURL } from 'node:url';
import { isRepoGuideError } from './core/errors.js';
import { runCheck } from './commands/check.js';
import { runEstimate } from './commands/estimate.js';
import { runInit } from './commands/init.js';
import { runSite } from './commands/site.js';
import { runUpdate } from './commands/update.js';

export function buildProgram(): Command {
  const program = new Command();
  program
    .name('repoguide')
    .description('Generate and update guide.md files for Git repositories.')
    .exitOverride();

  program
    .command('init')
    .description('Create missing guides bottom-up across the repository.')
    .option('--dry-run', 'show what would be generated without writing files')
    .option('--force', 'regenerate existing guides instead of skipping them')
    .action(async (options: { dryRun?: boolean; force?: boolean }) => runAndExit(await runInit(process.cwd(), { dryRun: options.dryRun, force: options.force })));

  program
    .command('update')
    .description('Update stale guides in the current folder scope.')
    .option('--dry-run', 'show what would be updated without writing files')
    .action(async (options: { dryRun?: boolean }) => runAndExit(await runUpdate(process.cwd(), { dryRun: options.dryRun })));

  program
    .command('check')
    .description('Report guides that are missing or stale.')
    .action(async () => runAndExit(await runCheck(process.cwd())));

  program
    .command('site')
    .description('Generate a static HTML wiki from guide.md files.')
    .option('--out <dir>', 'output directory')
    .option('--title <title>', 'site title')
    .action(async (options: { out?: string; title?: string }) => runAndExit(await runSite(process.cwd(), { outDir: options.out, title: options.title })));

  const estimate = program.command('estimate').description('Estimate token usage without calling an LLM.');
  estimate.command('init').description('Estimate token usage for init.').action(async () => runAndExit(await runEstimate('init', process.cwd())));
  estimate.command('update').description('Estimate token usage for update.').action(async () => runAndExit(await runEstimate('update', process.cwd())));

  return program;
}

function runAndExit(result: { exitCode: number }): void {
  process.exitCode = result.exitCode;
}

export async function main(argv = process.argv): Promise<void> {
  try {
    await buildProgram().parseAsync(argv);
  } catch (error) {
    if (isRepoGuideError(error)) {
      console.error(error.message);
      process.exitCode = error.exitCode;
      return;
    }
    if (error && typeof error === 'object' && 'code' in error) {
      const code = String((error as { code?: unknown }).code);
      if (code === 'commander.helpDisplayed') {
        process.exitCode = 0;
        return;
      }
      if (code.startsWith('commander.')) {
        process.exitCode = 2;
        return;
      }
    }
    if (error && typeof error === 'object' && 'exitCode' in error && Number((error as { exitCode?: unknown }).exitCode) === 0) {
      process.exitCode = 0;
      return;
    }
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}

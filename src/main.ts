import chalk from 'chalk';
import { ConfigFileOptions } from './options/ConfigOptions';
import { getOptions, ValidConfigOptions } from './options/options';
import { runSequentially, Result } from './runSequentially';
import { HandledError } from './services/HandledError';
import { getLogfilePath } from './services/env';
import { createStatusComment } from './services/github/v3/createStatusComment';
import { consoleLog, logger } from './services/logger';
import { Commit } from './services/sourceCommit/parseSourceCommit';
import { getCommits } from './ui/getCommits';
import { getTargetBranches } from './ui/getTargetBranches';

export type BackportResponse =
  | {
      status: 'success';
      commits: Commit[];
      results: Result[];
    }
  | {
      status: 'failure';
      commits: Commit[];
      errorMessage: string;
      error: Error;
    };

export async function main(
  argv: string[],
  optionsFromModule?: ConfigFileOptions
): Promise<BackportResponse> {
  let options: ValidConfigOptions | null = null;
  let commits: Commit[] = [];

  try {
    options = await getOptions(argv, optionsFromModule);
    commits = await getCommits(options);
    const targetBranches = await getTargetBranches(options, commits);
    const results = await runSequentially({ options, commits, targetBranches });
    const backportResponse: BackportResponse = {
      status: 'success',
      commits,
      results,
    };

    await createStatusComment({
      options,
      backportResponse,
    });

    return backportResponse;
  } catch (e) {
    const backportResponse: BackportResponse = {
      status: 'failure',
      commits,
      errorMessage: e.message,
      error: e,
    };

    if (options?.ci) {
      await createStatusComment({
        options,
        backportResponse,
      });
    }

    if (e instanceof HandledError) {
      consoleLog(e.message);
    } else if (e instanceof Error) {
      // output
      consoleLog('\n');
      consoleLog(chalk.bold('⚠️  Ouch! An unhandled error occured 😿'));
      consoleLog(`Error message: ${e.message}`);

      consoleLog(
        'Please open an issue in https://github.com/sqren/backport/issues or contact me directly on https://twitter.com/sorenlouv'
      );

      consoleLog(
        chalk.italic(`For additional details see the logs: ${getLogfilePath()}`)
      );

      // log file
      logger.info('Unknown error:', e);
    }

    return backportResponse;
  }
}

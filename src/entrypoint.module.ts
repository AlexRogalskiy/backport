import { main } from './main';
import { ConfigFileOptions } from './options/ConfigOptions';
import { ValidConfigOptions } from './options/options';
import { fetchCommitByPullNumber } from './services/github/v4/fetchCommits/fetchCommitByPullNumber';
import { fetchCommitBySha } from './services/github/v4/fetchCommits/fetchCommitBySha';
import { fetchCommitsByAuthor } from './services/github/v4/fetchCommits/fetchCommitsByAuthor';
import { getOptionsFromGithub } from './services/github/v4/getOptionsFromGithub/getOptionsFromGithub';
import { initLogger } from './services/logger';

initLogger();

// public API
export { BackportResponse } from './main';
export { ConfigFileOptions } from './options/ConfigOptions';
export { Commit } from './services/sourceCommit/parseSourceCommit';
export { fetchProjectConfig } from './services/github/v4/fetchProjectConfig';

export function backportRun(
  options: ConfigFileOptions,

  // cli args will not automatically be forwarded when it is consumed as a module
  // It is simple to forward args manually via `process.argv`:
  //
  // import { backportRun } from `backport
  // const args = process.argv.slice(2);
  // backportRun(options, args)
  //
  args: string[] = []
) {
  return main(args, options);
}

export async function getCommits(options: {
  // required
  accessToken: string;
  repoName: string;
  repoOwner: string;

  // optional
  author?: string;
  branchLabelMapping?: ValidConfigOptions['branchLabelMapping'];
  githubApiBaseUrlV4?: string;
  pullNumber?: number;
  sha?: string;
  skipRemoteConfig?: boolean;
  sourceBranch?: string;
}) {
  const optionsFromGithub = await getOptionsFromGithub(options);

  if (options.pullNumber) {
    return [
      await fetchCommitByPullNumber({
        ...optionsFromGithub,
        ...options,
        pullNumber: options.pullNumber,
      }),
    ];
  }

  if (options.sha) {
    return [
      await fetchCommitBySha({
        ...optionsFromGithub,
        ...options,
        sha: options.sha,
      }),
    ];
  }

  return fetchCommitsByAuthor({
    ...optionsFromGithub,
    ...options,
    author: options.author ?? null,
  });
}

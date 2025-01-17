import os from 'os';
import { ValidConfigOptions } from '../options/options';
import * as childProcess from '../services/child-process-promisified';
import { ExecError } from '../test/ExecError';
import { SpyHelper } from '../types/SpyHelper';
import {
  addRemote,
  getUnstagedFiles,
  commitChanges,
  deleteRemote,
  cherrypick,
  getConflictingFiles,
  createBackportBranch,
  pushBackportBranch,
  getLocalConfigFileCommitDate,
  isLocalConfigFileUntracked,
  isLocalConfigFileModified,
  getRepoOwnerAndNameFromGitRemote,
} from './git';
import { Commit } from './sourceCommit/parseSourceCommit';

beforeEach(() => {
  jest.spyOn(os, 'homedir').mockReturnValue('/myHomeDir');
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('getUnstagedFiles', () => {
  it('should split lines and remove empty', async () => {
    jest.spyOn(childProcess, 'exec').mockResolvedValueOnce({
      stdout: 'conflicting-file.txt\nconflicting-file2.txt\n',
      stderr: '',
    });

    const options = {
      repoOwner: 'elastic',
      repoName: 'kibana',
    } as ValidConfigOptions;

    await expect(await getUnstagedFiles(options)).toEqual([
      '/myHomeDir/.backport/repositories/elastic/kibana/conflicting-file.txt',
      '/myHomeDir/.backport/repositories/elastic/kibana/conflicting-file2.txt',
    ]);
  });

  it('should not error on empty', async () => {
    jest.spyOn(childProcess, 'exec').mockResolvedValueOnce({
      stdout: '',
      stderr: '',
    });

    const options = {
      repoOwner: 'elastic',
      repoName: 'kibana',
    } as ValidConfigOptions;

    await expect(await getUnstagedFiles(options)).toEqual([]);
  });
});

describe('getLocalConfigFileCommitDate', () => {
  it('returns a timestamp the file exists', async () => {
    const res = {
      stdout: 'Wed Dec 16 10:10:39 2020 -0800\n',
      stderr: '',
    };
    jest.spyOn(childProcess, 'exec').mockResolvedValue(res);
    expect(await getLocalConfigFileCommitDate()).toEqual(1608142239000);
  });

  it('returns empty when file does not exists', async () => {
    const res = { stdout: '', stderr: '' };
    jest.spyOn(childProcess, 'exec').mockResolvedValue(res);
    expect(await getLocalConfigFileCommitDate()).toEqual(undefined);
  });

  it('handles errors', async () => {
    const err = {
      killed: false,
      code: 128,
      signal: null,
      cmd: 'any command...',
      stdout: '',
      stderr: 'any error',
    };
    jest.spyOn(childProcess, 'exec').mockRejectedValueOnce(err);
    expect(await getLocalConfigFileCommitDate()).toEqual(undefined);
  });
});

describe('isLocalConfigFileUntracked', () => {
  it('returns "false" if file does not exist', async () => {
    const res = { stdout: '', stderr: '' };
    jest.spyOn(childProcess, 'exec').mockResolvedValue(res);
    expect(await isLocalConfigFileUntracked()).toEqual(false);
  });

  it('returns "true" if file is untracked', async () => {
    const res = { stdout: '.backportrc.json\n', stderr: '' };
    jest.spyOn(childProcess, 'exec').mockResolvedValue(res);
    expect(await isLocalConfigFileUntracked()).toEqual(true);
  });

  it('handles errors', async () => {
    const err = {
      killed: false,
      code: 128,
      signal: null,
      cmd: 'any command...',
      stdout: '',
      stderr: 'any error',
    };
    jest.spyOn(childProcess, 'exec').mockRejectedValueOnce(err);
    expect(await isLocalConfigFileUntracked()).toEqual(undefined);
  });
});

describe('isLocalConfigFileModified', () => {
  it('returns "false" if file does not exist', async () => {
    const res = { stdout: '', stderr: '' };
    jest.spyOn(childProcess, 'exec').mockResolvedValue(res);
    expect(await isLocalConfigFileModified()).toEqual(false);
  });

  it('returns "false" if file is untracked', async () => {
    const res = { stdout: '', stderr: '' };
    jest.spyOn(childProcess, 'exec').mockResolvedValue(res);
    expect(await isLocalConfigFileModified()).toEqual(false);
  });

  it('returns "true" if file is staged', async () => {
    const res = { stdout: '.backportrc.json\n', stderr: '' };
    jest.spyOn(childProcess, 'exec').mockResolvedValue(res);
    expect(await isLocalConfigFileModified()).toEqual(true);
  });

  it('handles errors', async () => {
    const err = {
      killed: false,
      code: 128,
      signal: null,
      cmd: 'any command...',
      stdout: '',
      stderr: 'any error',
    };
    jest.spyOn(childProcess, 'exec').mockRejectedValueOnce(err);
    expect(await isLocalConfigFileModified()).toEqual(undefined);
  });
});

describe('getRepoOwnerAndNameFromGitRemote', () => {
  it('returns first matching pattern', async () => {
    const res = {
      stdout:
        'origin\tgit@github.com:elastic/kibana.git (fetch)\norigin\tgit@github.com:elastic/kibana.git (push)\nsqren\tgit@github.com:sqren/kibana.git (fetch)\nsqren\tgit@github.com:sqren/kibana.git (push)\n',
      stderr: '',
    };
    jest.spyOn(childProcess, 'exec').mockResolvedValue(res);
    expect(await getRepoOwnerAndNameFromGitRemote()).toEqual({
      repoOwner: 'elastic',
      repoName: 'kibana',
    });
  });

  it('returns undefined when no remotes exist', async () => {
    const res = { stdout: '', stderr: '' };
    jest.spyOn(childProcess, 'exec').mockResolvedValue(res);
    expect(await getRepoOwnerAndNameFromGitRemote()).toEqual(undefined);
  });

  it('handles errors', async () => {
    const err = {
      killed: false,
      code: 128,
      signal: null,
      cmd: 'git ls-files .backportrc.js*  --exclude-standard --others',
      stdout: '',
      stderr:
        'fatal: not a git repository (or any of the parent directories): .git\n',
    };
    jest.spyOn(childProcess, 'exec').mockRejectedValueOnce(err);
    expect(await getRepoOwnerAndNameFromGitRemote()).toEqual(undefined);
  });
});

describe('getConflictingFiles', () => {
  it('should split by linebreak and remove empty and duplicate items', async () => {
    const err = {
      killed: false,
      code: 2,
      signal: null,
      cmd: 'git --no-pager diff --check',
      stdout:
        'conflicting-file.txt:1: leftover conflict marker\nconflicting-file.txt:3: leftover conflict marker\nconflicting-file.txt:5: leftover conflict marker\n',
      stderr: '',
    };
    jest.spyOn(childProcess, 'exec').mockRejectedValueOnce(err);

    const options = {
      repoOwner: 'elastic',
      repoName: 'kibana',
    } as ValidConfigOptions;

    expect(await getConflictingFiles(options)).toEqual([
      {
        absolute:
          '/myHomeDir/.backport/repositories/elastic/kibana/conflicting-file.txt',
        relative: 'conflicting-file.txt',
      },
    ]);
  });
});

describe('createFeatureBranch', () => {
  const options = {
    repoOwner: 'elastic',
    repoName: 'kibana',
  } as ValidConfigOptions;

  const targetBranch = '4.x';
  const backportBranch = 'backport/4.x/commit-72f94e76';

  it(`should handle "couldn't find remote ref" error`, async () => {
    expect.assertions(1);
    const err = {
      killed: false,
      code: 128,
      signal: null,
      cmd: '',
      stdout:
        'HEAD is now at 72f94e7 Create "conflicting-file.txt" in master\n',
      stderr: "fatal: couldn't find remote ref 4.x\n",
    };

    jest.spyOn(childProcess, 'exec').mockRejectedValueOnce(err);
    await expect(
      createBackportBranch({ options, targetBranch, backportBranch })
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `"The branch \\"4.x\\" is invalid or doesn't exist"`
    );
  });

  it('should throw "Invalid refspec" error', async () => {
    expect.assertions(1);
    const err = {
      killed: false,
      code: 128,
      signal: null,
      cmd: '',
      stdout: '',
      stderr:
        "fatal: Invalid refspec 'https://github.com/elastic/kibana.git'\n",
    };

    jest.spyOn(childProcess, 'exec').mockRejectedValueOnce(err);
    await expect(
      createBackportBranch({ options, targetBranch, backportBranch })
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `"The branch \\"4.x\\" is invalid or doesn't exist"`
    );
  });

  it('should rethrow normal error', async () => {
    expect.assertions(1);
    const err = new Error('just a normal error');
    jest.spyOn(childProcess, 'exec').mockRejectedValueOnce(err);
    expect.assertions(1);

    await expect(
      createBackportBranch({ options, targetBranch, backportBranch })
    ).rejects.toThrowErrorMatchingInlineSnapshot(`"just a normal error"`);
  });
});

describe('deleteRemote', () => {
  const remoteName = 'my-remote';
  const options = {
    repoOwner: 'elastic',
    repoName: 'kibana',
  } as ValidConfigOptions;

  it('should swallow exec error', async () => {
    const err = {
      killed: false,
      code: 128,
      signal: null,
      cmd: 'git remote rm origin',
      stdout: '',
      stderr: "fatal: No such remote: 'origin'\n",
    };

    jest.spyOn(childProcess, 'exec').mockRejectedValueOnce(err);
    await expect(await deleteRemote(options, remoteName)).toBe(undefined);
  });

  it('should rethrow normal error', async () => {
    const err = new Error('just a normal error');
    jest.spyOn(childProcess, 'exec').mockRejectedValueOnce(err);
    expect.assertions(1);

    await expect(
      deleteRemote(options, remoteName)
    ).rejects.toThrowErrorMatchingInlineSnapshot(`"just a normal error"`);
  });
});

describe('cherrypick', () => {
  const options = {
    repoOwner: 'elastic',
    repoName: 'kibana',
  } as ValidConfigOptions;

  it('should return `needsResolving: false` when no errors are encountered', async () => {
    jest
      .spyOn(childProcess, 'exec')

      // mock cherry pick command
      .mockResolvedValueOnce({ stderr: '', stdout: '' });

    expect(await cherrypick(options, 'abcd')).toEqual({
      conflictingFiles: [],
      unstagedFiles: [],
      needsResolving: false,
    });
  });

  it('should use mainline option when specified', async () => {
    const execSpy = jest
      .spyOn(childProcess, 'exec')

      // mock cherry pick command
      .mockResolvedValueOnce({ stderr: '', stdout: '' });

    await cherrypick({ ...options, mainline: 1 }, 'abcd');

    expect(execSpy.mock.calls[0][0]).toBe(
      'git cherry-pick -x --mainline 1 abcd'
    );
  });

  it('should return `needsResolving: true` upon cherrypick error', async () => {
    jest
      .spyOn(childProcess, 'exec')

      // mock cherry pick command
      .mockRejectedValueOnce(
        new ExecError({
          killed: false,
          code: 128,
          cmd: 'git cherry-pick -x abcd',
          stdout: '',
          stderr: '',
        })
      )

      // mock getConflictingFiles
      .mockRejectedValueOnce(
        new ExecError({
          code: 2,
          cmd: 'git --no-pager diff --check',
          stdout:
            'conflicting-file.txt:1: leftover conflict marker\nconflicting-file.txt:3: leftover conflict marker\nconflicting-file.txt:5: leftover conflict marker\n',
          stderr: '',
        })
      )

      // mock getUnstagedFiles
      .mockResolvedValueOnce({ stdout: '', stderr: '' });

    expect(await cherrypick(options, 'abcd')).toEqual({
      conflictingFiles: [
        {
          absolute:
            '/myHomeDir/.backport/repositories/elastic/kibana/conflicting-file.txt',
          relative: 'conflicting-file.txt',
        },
      ],
      needsResolving: true,
      unstagedFiles: [],
    });
  });

  it('should let the user know about the "--mainline" argument when cherry-picking a merge commit without specifying it', async () => {
    jest
      .spyOn(childProcess, 'exec')

      // mock cherry pick command
      .mockRejectedValueOnce(
        new ExecError({
          killed: false,
          code: 128,
          signal: null,
          cmd: 'git cherry-pick 381c7b604110257437a289b1f1742685eb8d79c5',
          stdout: '',
          stderr:
            'error: commit 381c7b604110257437a289b1f1742685eb8d79c5 is a merge but no -m option was given.\nfatal: cherry-pick failed\n',
        })
      );

    await expect(cherrypick(options, 'abcd')).rejects
      .toThrowError(`Cherrypick failed because the selected commit was a merge commit. Please try again by specifying the parent with the \`mainline\` argument:

> backport --mainline

or:

> backport --mainline <parent-number>

Or refer to the git documentation for more information: https://git-scm.com/docs/git-cherry-pick#Documentation/git-cherry-pick.txt---mainlineparent-number`);
  });

  it('should gracefully handle empty commits', async () => {
    jest
      .spyOn(childProcess, 'exec')

      // mock cherry pick command
      .mockRejectedValueOnce(
        new ExecError({
          killed: false,
          code: 1,
          signal: null,
          cmd: 'git cherry-pick fe6b13b83cc010f722548cd5a0a8c2d5341a20dd',
          stdout:
            'On branch backport/7.x/pr-58692\nYou are currently cherry-picking commit fe6b13b83cc.\n\nnothing to commit, working tree clean\n',
          stderr:
            "The previous cherry-pick is now empty, possibly due to conflict resolution.\nIf you wish to commit it anyway, use:\n\n    git commit --allow-empty\n\nOtherwise, please use 'git cherry-pick --skip'\n",
        })
      );

    await expect(cherrypick(options, 'abcd')).rejects.toThrowError(
      `Cherrypick failed because the selected commit (abcd) is empty. Did you already backport this commit?`
    );
  });

  it('gracefully handles missing git info', async () => {
    jest
      .spyOn(childProcess, 'exec')

      // mock cherry pick command
      .mockRejectedValueOnce(
        new ExecError({
          killed: false,
          code: 128,
          signal: null,
          cmd: 'git cherry-pick 83ad852b6ba1a64c8047f07201018eb6fb020db8',
          stdout: '',
          stderr:
            '\n*** Please tell me who you are.\n\nRun\n\n  git config --global user.email "you@example.com"\n  git config --global user.name "Your Name"\n\nto set your account\'s default identity.\nOmit --global to set the identity only in this repository.\n\nfatal: empty ident name (for <foo@bar.net>) not allowed\n',
        })
      );

    await expect(cherrypick(options, 'abcd')).rejects
      .toThrowErrorMatchingInlineSnapshot(`
            "Cherrypick failed:

            *** Please tell me who you are.

            Run

              git config --global user.email \\"you@example.com\\"
              git config --global user.name \\"Your Name\\"

            to set your account's default identity.
            Omit --global to set the identity only in this repository.

            fatal: empty ident name (for <foo@bar.net>) not allowed
            "
          `);
  });

  it('should re-throw non-cherrypick errors', async () => {
    jest
      .spyOn(childProcess, 'exec')

      // mock cherry pick command
      .mockRejectedValueOnce(new Error('non-cherrypick error'))

      // getConflictingFiles
      .mockResolvedValueOnce({ stdout: '', stderr: '' })

      // getUnstagedFiles
      .mockResolvedValueOnce({ stdout: '', stderr: '' });

    await expect(
      cherrypick(options, 'abcd')
    ).rejects.toThrowErrorMatchingInlineSnapshot(`"non-cherrypick error"`);
  });
});

describe('commitChanges', () => {
  const options = {
    repoOwner: 'elastic',
    repoName: 'kibana',
  } as ValidConfigOptions;

  const commit = {
    originalMessage: 'The original commit message',
  } as Commit;

  it('should return when changes committed successfully', async () => {
    jest
      .spyOn(childProcess, 'exec')
      .mockResolvedValueOnce({ stderr: '', stdout: '' });

    await expect(await commitChanges(commit, options)).toBe(undefined);
  });

  it('should swallow error if changes have already been committed manaully', async () => {
    const err = {
      killed: false,
      code: 1,
      signal: null,
      cmd: 'git commit --no-edit',
      stdout:
        'On branch backport/7.x/commit-913afb3b\nnothing to commit, working tree clean\n',
      stderr: '',
    };

    jest.spyOn(childProcess, 'exec').mockRejectedValueOnce(err);
    await expect(await commitChanges(commit, options)).toBe(undefined);
  });

  describe('when commit fails due to empty message', () => {
    let spy: SpyHelper<typeof childProcess.exec>;
    let res: void;
    beforeEach(async () => {
      const err = {
        killed: false,
        code: 1,
        signal: null,
        cmd: 'git commit --no-edit --no-verify',
        stdout: '',
        stderr: 'Aborting commit due to empty commit message.\n',
      };

      spy = jest
        .spyOn(childProcess, 'exec')
        .mockRejectedValueOnce(err)
        .mockResolvedValueOnce({ stderr: '', stdout: '' });

      res = await commitChanges(commit, options);
    });

    it('should manually set the commit message', () => {
      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy).toHaveBeenCalledWith(
        'git commit --no-edit',
        expect.any(Object)
      );
      expect(spy).toHaveBeenCalledWith(
        'git commit -m "The original commit message" ',
        expect.any(Object)
      );
    });

    it('should handle the error and resolve successfully', async () => {
      await expect(res).toBe(undefined);
    });
  });

  it('should re-throw other errors', async () => {
    const err = new Error('non-cherrypick error');
    jest.spyOn(childProcess, 'exec').mockRejectedValueOnce(err);
    expect.assertions(1);

    await expect(
      commitChanges(commit, options)
    ).rejects.toThrowErrorMatchingInlineSnapshot(`"non-cherrypick error"`);
  });
});

describe('addRemote', () => {
  const options = {
    accessToken: 'myAccessToken',
    repoOwner: 'elastic',
    repoName: 'kibana',
    gitHostname: 'github.com',
  } as ValidConfigOptions;

  it('add correct origin remote', async () => {
    const spy = jest
      .spyOn(childProcess, 'exec')
      .mockResolvedValueOnce({ stderr: '', stdout: '' });

    await addRemote(options, 'elastic');

    return expect(spy).toHaveBeenCalledWith(
      'git remote add elastic https://x-access-token:myAccessToken@github.com/elastic/kibana.git',
      { cwd: '/myHomeDir/.backport/repositories/elastic/kibana' }
    );
  });

  it('add correct user remote', async () => {
    const spy = jest
      .spyOn(childProcess, 'exec')
      .mockResolvedValueOnce({ stderr: '', stdout: '' });
    await addRemote(options, 'sqren');

    return expect(spy).toHaveBeenCalledWith(
      'git remote add sqren https://x-access-token:myAccessToken@github.com/sqren/kibana.git',
      { cwd: '/myHomeDir/.backport/repositories/elastic/kibana' }
    );
  });

  it('allows custom github url', async () => {
    const spy = jest
      .spyOn(childProcess, 'exec')
      .mockResolvedValueOnce({ stderr: '', stdout: '' });
    await addRemote(
      { ...options, gitHostname: 'github.my-company.com' },
      'sqren'
    );

    return expect(spy).toHaveBeenCalledWith(
      'git remote add sqren https://x-access-token:myAccessToken@github.my-company.com/sqren/kibana.git',
      { cwd: '/myHomeDir/.backport/repositories/elastic/kibana' }
    );
  });
});

describe('pushBackportBranch', () => {
  const options = {
    authenticatedUsername: 'sqren_authenticated',
    fork: true,
    repoOwner: 'elastic',
    repoName: 'kibana',
  } as ValidConfigOptions;

  const backportBranch = 'backport/7.x/pr-2';

  it('should handle missing fork error', async () => {
    jest.spyOn(childProcess, 'exec').mockRejectedValueOnce({
      killed: false,
      code: 128,
      signal: null,
      cmd: 'git push sqren backport/7.x/pr-2:backport/7.x/pr-2 --force',
      stdout: '',
      stderr:
        "remote: Repository not found.\nfatal: repository 'https://github.com/sqren/kibana.git/' not found\n",
    });

    await expect(
      pushBackportBranch({ options, backportBranch })
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `"Error pushing to https://github.com/sqren_authenticated/kibana. Repository does not exist. Either fork the source repository (https://github.com/elastic/kibana) or disable fork mode \\"--no-fork\\".  Read more about \\"fork mode\\" in the docs: https://github.com/sqren/backport/blob/3a182b17e0e7237c12915895aea9d71f49eb2886/docs/configuration.md#fork"`
    );
  });
});

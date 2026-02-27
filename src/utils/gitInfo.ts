import { execa } from 'execa';

export interface GitInfo {
  branch: string | null;
  changedFiles: number;
  additions: number;
  deletions: number;
}

export async function getGitInfo(cwd: string): Promise<GitInfo> {
  try {
    const { stdout: branch } = await execa('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd,
      reject: false,
    });

    const { stdout: diffStat } = await execa(
      'git',
      ['diff', '--shortstat', 'HEAD'],
      { cwd, reject: false }
    );

    let changedFiles = 0;
    let additions = 0;
    let deletions = 0;

    if (diffStat) {
      const filesMatch = diffStat.match(/(\d+) file/);
      const addMatch   = diffStat.match(/(\d+) insertion/);
      const delMatch   = diffStat.match(/(\d+) deletion/);
      if (filesMatch) changedFiles = parseInt(filesMatch[1], 10);
      if (addMatch)   additions    = parseInt(addMatch[1], 10);
      if (delMatch)   deletions    = parseInt(delMatch[1], 10);
    }

    return {
      branch: branch?.trim() || null,
      changedFiles,
      additions,
      deletions,
    };
  } catch {
    return { branch: null, changedFiles: 0, additions: 0, deletions: 0 };
  }
}

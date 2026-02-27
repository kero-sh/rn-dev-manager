import { useState, useEffect } from 'react';
import { getGitInfo, GitInfo } from '../utils/gitInfo.js';

const REFRESH_INTERVAL_MS = 5000;

const defaultGit: GitInfo = {
  branch: null,
  changedFiles: 0,
  additions: 0,
  deletions: 0,
};

export function useGitInfo(cwd: string): GitInfo {
  const [git, setGit] = useState<GitInfo>(defaultGit);

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      const info = await getGitInfo(cwd);
      if (!cancelled) setGit(info);
    };

    refresh();
    const timer = setInterval(refresh, REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [cwd]);

  return git;
}

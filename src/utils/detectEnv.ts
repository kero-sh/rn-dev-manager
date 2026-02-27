import { findUp } from 'find-up';
import * as fs from 'fs';
import * as path from 'path';

export type PackageManager = 'npm' | 'yarn' | 'pnpm';

export interface RNEnvironment {
  packageManager: PackageManager;
  isMonorepo: boolean;
  projectRoot: string;
  appRoot: string;
  nodeVersion: string;
}

export async function detectEnvironment(cwd: string = process.cwd()): Promise<RNEnvironment> {
  const appRoot = cwd;

  const yarnLock = await findUp('yarn.lock', { cwd });
  const pnpmLock = await findUp('pnpm-lock.yaml', { cwd });
  const npmLock = await findUp('package-lock.json', { cwd });

  let packageManager: PackageManager = 'npm';
  if (yarnLock) packageManager = 'yarn';
  else if (pnpmLock) packageManager = 'pnpm';
  else if (npmLock) packageManager = 'npm';

  const projectRoot = yarnLock
    ? path.dirname(yarnLock)
    : pnpmLock
    ? path.dirname(pnpmLock)
    : npmLock
    ? path.dirname(npmLock)
    : cwd;

  const isMonorepo = await detectMonorepo(projectRoot);

  const nodeVersion = process.version;

  return {
    packageManager,
    isMonorepo,
    projectRoot,
    appRoot,
    nodeVersion,
  };
}

async function detectMonorepo(projectRoot: string): Promise<boolean> {
  const pkgPath = path.join(projectRoot, 'package.json');
  if (!fs.existsSync(pkgPath)) return false;

  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    if (pkg.workspaces) return true;
  } catch {
    return false;
  }

  const lernaJson = path.join(projectRoot, 'lerna.json');
  const pnpmWorkspace = path.join(projectRoot, 'pnpm-workspace.yaml');
  if (fs.existsSync(lernaJson) || fs.existsSync(pnpmWorkspace)) return true;

  return false;
}

export function getInstallCommand(pm: PackageManager): string {
  switch (pm) {
    case 'yarn': return 'yarn install';
    case 'pnpm': return 'pnpm install';
    default: return 'npm install';
  }
}

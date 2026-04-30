import { findUp } from 'find-up';
import * as fs from 'fs';
import * as path from 'path';

export type PackageManager = 'npm' | 'yarn' | 'pnpm';
export type RepoType = 'app' | 'library';

export interface WorkspacePackage {
  name: string;
  version: string;
  path: string;
  private: boolean;
}

export interface RNEnvironment {
  packageManager: PackageManager;
  isMonorepo: boolean;
  projectRoot: string;
  appRoot: string;
  nodeVersion: string;
  repoType: RepoType;
  workspacePackages: WorkspacePackage[];
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
  const workspacePackages = isMonorepo ? await readWorkspacePackages(projectRoot) : [];

  const nodeVersion = process.version;
  const repoType = detectRepoType(cwd);

  return {
    packageManager,
    isMonorepo,
    projectRoot,
    appRoot,
    nodeVersion,
    repoType,
    workspacePackages,
  };
}

function detectRepoType(appRoot: string): RepoType {
  const hasAndroid = fs.existsSync(path.join(appRoot, 'android'));
  const hasIos = fs.existsSync(path.join(appRoot, 'ios'));
  if (hasAndroid || hasIos) return 'app';
  return 'library';
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

async function readWorkspacePackages(projectRoot: string): Promise<WorkspacePackage[]> {
  try {
    const pkgPath = path.join(projectRoot, 'package.json');
    const rootPkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    let patterns: string[] = [];

    if (Array.isArray(rootPkg.workspaces)) {
      patterns = rootPkg.workspaces;
    } else if (rootPkg.workspaces?.packages) {
      patterns = rootPkg.workspaces.packages;
    } else {
      const pnpmWs = path.join(projectRoot, 'pnpm-workspace.yaml');
      if (fs.existsSync(pnpmWs)) {
        const raw = fs.readFileSync(pnpmWs, 'utf-8');
        const match = raw.match(/packages:\s*([\s\S]*?)(?:\n\w|$)/);
        if (match) {
          patterns = match[1].split('\n').map((l) => l.replace(/^\s*-\s*['"]?|['"]?\s*$/, '').trim()).filter(Boolean);
        }
      }
    }

    const pkgFiles: string[] = [];
    for (const pattern of patterns) {
      const parts = pattern.replace(/\/\*$/, '');
      const dir = path.join(projectRoot, parts);
      if (pattern.endsWith('/*')) {
        try {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            const pkgFile = path.join(dir, entry.name, 'package.json');
            if (fs.existsSync(pkgFile)) pkgFiles.push(pkgFile);
          }
        } catch { /* skip */ }
      } else {
        const pkgFile = path.join(dir, 'package.json');
        if (fs.existsSync(pkgFile)) pkgFiles.push(pkgFile);
      }
    }

    const packages: WorkspacePackage[] = [];
    for (const pkgFile of pkgFiles.sort()) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf-8'));
        if (!pkg.name) continue;
        packages.push({
          name: pkg.name,
          version: pkg.version ?? '0.0.0',
          path: path.dirname(pkgFile),
          private: pkg.private === true,
        });
      } catch {
        // skip malformed package.json
      }
    }
    return packages;
  } catch {
    return [];
  }
}

export function getInstallCommand(pm: PackageManager): string {
  switch (pm) {
    case 'yarn': return 'yarn install';
    case 'pnpm': return 'pnpm install';
    default: return 'npm install';
  }
}

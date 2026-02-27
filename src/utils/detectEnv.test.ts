import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import path from 'path';

vi.mock('find-up', () => ({
  findUp: vi.fn(),
}));

vi.mock('fs');

import { findUp } from 'find-up';
import { detectEnvironment, getInstallCommand } from './detectEnv.js';

const mockFindUp = findUp as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetAllMocks();
});

describe('detectEnvironment', () => {
  it('detects yarn when yarn.lock is present', async () => {
    mockFindUp
      .mockResolvedValueOnce('/project/yarn.lock')
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);

    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.readFileSync).mockReturnValue('{}');

    const env = await detectEnvironment('/project/apps/mobile');
    expect(env.packageManager).toBe('yarn');
    expect(env.projectRoot).toBe('/project');
  });

  it('detects pnpm when pnpm-lock.yaml is present', async () => {
    mockFindUp
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce('/project/pnpm-lock.yaml')
      .mockResolvedValueOnce(undefined);

    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.readFileSync).mockReturnValue('{}');

    const env = await detectEnvironment('/project/apps/mobile');
    expect(env.packageManager).toBe('pnpm');
  });

  it('defaults to npm when no lockfile is found', async () => {
    mockFindUp.mockResolvedValue(undefined);
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const env = await detectEnvironment('/project');
    expect(env.packageManager).toBe('npm');
  });

  it('detects monorepo via workspaces field in package.json', async () => {
    mockFindUp
      .mockResolvedValueOnce('/project/yarn.lock')
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);

    vi.mocked(fs.existsSync).mockImplementation((p) =>
      (p as string).endsWith('package.json')
    );
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({ workspaces: ['apps/*', 'packages/*'] })
    );

    const env = await detectEnvironment('/project/apps/mobile');
    expect(env.isMonorepo).toBe(true);
  });

  it('reports single repo when no workspaces', async () => {
    mockFindUp
      .mockResolvedValueOnce('/project/yarn.lock')
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);

    vi.mocked(fs.existsSync).mockImplementation((p) =>
      (p as string).endsWith('package.json')
    );
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ name: 'my-app' }));

    const env = await detectEnvironment('/project');
    expect(env.isMonorepo).toBe(false);
  });
});

describe('getInstallCommand', () => {
  it('returns yarn install for yarn', () => {
    expect(getInstallCommand('yarn')).toBe('yarn install');
  });
  it('returns pnpm install for pnpm', () => {
    expect(getInstallCommand('pnpm')).toBe('pnpm install');
  });
  it('returns npm install for npm', () => {
    expect(getInstallCommand('npm')).toBe('npm install');
  });
});

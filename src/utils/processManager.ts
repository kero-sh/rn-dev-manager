import { execa, ExecaChildProcess } from 'execa';
import treeKill from 'tree-kill';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { RNEnvironment, getInstallCommand } from './detectEnv.js';
import { LogEntry, ProcessStatus } from '../types.js';
import { t } from '../i18n/index.js';

function pidFilePath(appRoot: string): string {
  const hash = crypto.createHash('md5').update(appRoot).digest('hex').slice(0, 8);
  const dir = path.join(os.homedir(), '.rn-dev-manager');
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `metro-${hash}.pid`);
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function findOrphanMetroPids(): Promise<number[]> {
  try {
    const { stdout } = await execa('ps', ['aux'], { reject: false });
    const ownPgid = process.pid;
    return stdout
      .split('\n')
      .filter((line) => line.includes('react-native') && line.includes('start') && !line.includes('grep'))
      .map((line) => {
        const parts = line.trim().split(/\s+/);
        return parseInt(parts[1], 10);
      })
      .filter((n) => !isNaN(n) && n !== process.pid && n !== ownPgid);
  } catch {
    return [];
  }
}

function getProcessCwd(pid: number): string | undefined {
  try {
    return fs.realpathSync(`/proc/${pid}/cwd`);
  } catch {
    return undefined;
  }
}

function pidBelongsToAppRoot(pid: number, appRoot: string): boolean {
  const cwd = getProcessCwd(pid);
  if (!cwd) return false;
  const normalRoot = path.resolve(appRoot);
  return cwd === normalRoot || cwd.startsWith(normalRoot + path.sep);
}

type LogCallback = (entry: Omit<LogEntry, 'id'>) => void;
type StatusCallback = (process: 'metro' | 'android' | 'ios', status: ProcessStatus, pid?: number) => void;

interface WorkspaceSlot {
  metro?: ExecaChildProcess;
  android?: ExecaChildProcess;
  ios?: ExecaChildProcess;
  deviceLogs?: ExecaChildProcess;
  metroDetachedPid?: number;
}

const workspaceSlots = new Map<string, WorkspaceSlot>();

function getSlot(appRoot: string): WorkspaceSlot {
  if (!workspaceSlots.has(appRoot)) {
    workspaceSlots.set(appRoot, {});
  }
  return workspaceSlots.get(appRoot)!;
}

function getAllActivePids(): number[] {
  const pids: number[] = [];
  for (const slot of workspaceSlots.values()) {
    if (slot.metro?.pid) pids.push(slot.metro.pid);
    if (slot.android?.pid) pids.push(slot.android.pid);
    if (slot.ios?.pid) pids.push(slot.ios.pid);
    if (slot.deviceLogs?.pid) pids.push(slot.deviceLogs.pid);
    if (slot.metroDetachedPid) pids.push(slot.metroDetachedPid);
  }
  return pids;
}

function attachOutput(
  proc: ExecaChildProcess,
  source: 'metro' | 'android' | 'ios',
  onLog: LogCallback
) {
  proc.stdout?.on('data', (data: Buffer) => {
    const lines = data.toString().split('\n').filter(Boolean);
    for (const line of lines) {
      onLog({ source, level: 'info', text: line, timestamp: new Date() });
    }
  });
  proc.stderr?.on('data', (data: Buffer) => {
    const lines = data.toString().split('\n').filter(Boolean);
    for (const line of lines) {
      onLog({ source, level: 'error', text: line, timestamp: new Date() });
    }
  });
}

export async function startMetro(
  env: RNEnvironment,
  onLog: LogCallback,
  onStatus: StatusCallback,
  resetCache = false
) {
  const slot = getSlot(env.appRoot);
  if (slot.metro) return;
  if (slot.metroDetachedPid && isProcessAlive(slot.metroDetachedPid)) {
    onLog({ source: 'system', level: 'info', text: t.processManager.metroReattached(slot.metroDetachedPid), timestamp: new Date() });
    onStatus('metro', 'running', slot.metroDetachedPid);
    return;
  }
  slot.metroDetachedPid = undefined;

  const reattached = await reattachMetro(env.appRoot, onLog, onStatus);
  if (reattached) return;

  onStatus('metro', 'building');
  const args = ['react-native', 'start'];
  if (resetCache) args.push('--reset-cache');

  const proc = execa('npx', args, { cwd: env.appRoot, reject: false, detached: true });
  slot.metro = proc;
  onLog({ source: 'system', level: 'info', text: t.processManager.startingMetro(resetCache), timestamp: new Date() });

  attachOutput(proc, 'metro', onLog);

  proc.on('spawn', () => {
    onStatus('metro', 'running', proc.pid);
  });

  proc.on('exit', (code) => {
    delete slot.metro;
    const status: ProcessStatus = code === 0 || code === null ? 'idle' : 'error';
    onStatus('metro', status);
    onLog({ source: 'metro', level: code === 0 || code === null ? 'info' : 'error', text: t.processManager.metroExited(code), timestamp: new Date() });
  });
}

export async function stopMetro(onLog: LogCallback, onStatus: StatusCallback, appRoot?: string) {
  const slot = appRoot ? getSlot(appRoot) : undefined;
  const pid = slot?.metro?.pid ?? slot?.metroDetachedPid;
  if (!pid) return;
  onLog({ source: 'system', level: 'info', text: t.processManager.stoppingMetro, timestamp: new Date() });
  treeKill(pid, 'SIGTERM');
  if (slot) {
    delete slot.metro;
    slot.metroDetachedPid = undefined;
  }
  if (appRoot) {
    const pf = pidFilePath(appRoot);
    if (fs.existsSync(pf)) fs.rmSync(pf);
  }
  onStatus('metro', 'idle');
}

export async function reloadMetro(onLog: LogCallback, port = 8081) {
  onLog({ source: 'system', level: 'info', text: t.processManager.reloadingMetro, timestamp: new Date() });
  try {
    await fetch(`http://localhost:${port}/reload`, { method: 'POST' });
  } catch (err) {
    onLog({ source: 'system', level: 'error', text: t.processManager.reloadMetroFailed(err), timestamp: new Date() });
  }
}

export function detachMetro(appRoot: string, onLog: LogCallback, onStatus: StatusCallback) {
  const slot = getSlot(appRoot);
  const proc = slot.metro;
  const pid = proc?.pid;
  if (!pid) return;
  proc?.unref();
  const pidFile = pidFilePath(appRoot);
  fs.writeFileSync(pidFile, String(pid), 'utf-8');
  delete slot.metro;
  slot.metroDetachedPid = pid;
  onStatus('metro', 'detached', pid);
  onLog({ source: 'system', level: 'info', text: t.processManager.metroDetached(pid), timestamp: new Date() });
}

export async function reattachMetro(
  appRoot: string,
  onLog: LogCallback,
  onStatus: StatusCallback
): Promise<boolean> {
  const slot = getSlot(appRoot);

  // 1. Intentar con .pid file primero
  const pidFile = pidFilePath(appRoot);
  if (fs.existsSync(pidFile)) {
    const raw = fs.readFileSync(pidFile, 'utf-8').trim();
    const pid = parseInt(raw, 10);
    if (!isNaN(pid) && isProcessAlive(pid)) {
      slot.metroDetachedPid = pid;
      onLog({ source: 'system', level: 'info', text: t.processManager.metroBackground(pid), timestamp: new Date() });
      onStatus('metro', 'running', pid);
      return true;
    }
    fs.rmSync(pidFile);
  }

  // 2. Fallback: buscar procesos huérfanos con pgrep
  // Only claim a pid not already tracked by another workspace AND belonging to this appRoot
  const activePids = getAllActivePids();
  const pids = await findOrphanMetroPids();
  const unclaimed = pids.filter((p) => !activePids.includes(p) && pidBelongsToAppRoot(p, appRoot));
  if (unclaimed.length > 0) {
    const pid = unclaimed[0];
    slot.metroDetachedPid = pid;
    onLog({ source: 'system', level: 'warn', text: t.processManager.metroOrphan(pid), timestamp: new Date() });
    onStatus('metro', 'running', pid);
    return true;
  }

  slot.metroDetachedPid = undefined;
  return false;
}

export async function killOrphanMetro(
  appRoot: string,
  onLog: LogCallback,
  onStatus: StatusCallback
): Promise<void> {
  const pids = await findOrphanMetroPids();

  // Exclude ALL pids tracked by any workspace slot
  const activePids = getAllActivePids();
  const toKill = pids.filter((p) => !activePids.includes(p));

  if (toKill.length === 0) {
    onLog({ source: 'system', level: 'info', text: t.processManager.noOrphans, timestamp: new Date() });
    return;
  }

  for (const pid of toKill) {
    onLog({ source: 'system', level: 'warn', text: t.processManager.killingOrphan(pid), timestamp: new Date() });
    treeKill(pid, 'SIGTERM');
  }

  onLog({ source: 'system', level: 'info', text: t.processManager.orphansKilled(toKill.length), timestamp: new Date() });
}

export function startDeviceLogs(
  platform: 'android' | 'ios',
  appRoot: string,
  onLog: LogCallback
): void {
  const slot = getSlot(appRoot);
  if (slot.deviceLogs) return;
  const cmd = platform === 'android' ? 'log-android' : 'log-ios';
  const proc = execa('npx', ['react-native', cmd], { reject: false });
  slot.deviceLogs = proc;
  attachOutput(proc, platform, onLog);
  proc.on('exit', () => { delete slot.deviceLogs; });
}

export function stopDeviceLogs(appRoot: string): void {
  const slot = getSlot(appRoot);
  const pid = slot.deviceLogs?.pid;
  if (pid) treeKill(pid, 'SIGTERM');
  delete slot.deviceLogs;
}

export async function runLibraryBuild(
  env: RNEnvironment,
  onLog: LogCallback,
  onStatus: StatusCallback
) {
  const slot = getSlot(env.appRoot);
  if (slot.android) return;

  onStatus('android', 'building');
  onLog({ source: 'system', level: 'info', text: t.processManager.buildingLibrary, timestamp: new Date() });

  const proc = execa('npm', ['run', 'build'], { cwd: env.appRoot, reject: false });
  slot.android = proc;

  attachOutput(proc, 'android', onLog);

  proc.on('exit', (code) => {
    delete slot.android;
    const status: ProcessStatus = code === 0 ? 'idle' : 'error';
    onStatus('android', status);
    onLog({ source: 'android', level: code === 0 ? 'info' : 'error', text: t.processManager.libraryBuildExited(code), timestamp: new Date() });
  });
}

export async function runLibraryTest(
  env: RNEnvironment,
  onLog: LogCallback,
  onStatus: StatusCallback
) {
  const slot = getSlot(env.appRoot);
  if (slot.android) return;

  onStatus('android', 'building');
  onLog({ source: 'system', level: 'info', text: t.processManager.runningTest, timestamp: new Date() });

  const proc = execa('npm', ['run', 'test', '--workspaces', '--if-present'], { cwd: env.appRoot, reject: false });
  slot.android = proc;

  attachOutput(proc, 'android', onLog);

  proc.on('exit', (code) => {
    delete slot.android;
    const status: ProcessStatus = code === 0 ? 'idle' : 'error';
    onStatus('android', status);
    onLog({ source: 'android', level: code === 0 ? 'info' : 'error', text: t.processManager.testExited(code), timestamp: new Date() });
  });
}

export async function runLibraryClean(
  env: RNEnvironment,
  onLog: LogCallback,
  onStatus: StatusCallback
) {
  const slot = getSlot(env.appRoot);
  if (slot.android) return;

  onStatus('android', 'building');
  onLog({ source: 'system', level: 'info', text: t.processManager.runningClean, timestamp: new Date() });

  const proc = execa('npm', ['run', 'clean'], { cwd: env.appRoot, reject: false });
  slot.android = proc;

  attachOutput(proc, 'android', onLog);

  proc.on('exit', (code) => {
    delete slot.android;
    const status: ProcessStatus = code === 0 ? 'idle' : 'error';
    onStatus('android', status);
    onLog({ source: 'android', level: code === 0 ? 'info' : 'error', text: t.processManager.cleanExited(code), timestamp: new Date() });
  });
}

export async function runLibraryPublish(
  env: RNEnvironment,
  onLog: LogCallback,
  onStatus: StatusCallback
) {
  const slot = getSlot(env.appRoot);
  if (slot.android) return;

  onStatus('android', 'building');
  onLog({ source: 'system', level: 'info', text: t.processManager.runningPublish, timestamp: new Date() });

  const proc = execa('npx', ['changeset', 'publish'], { cwd: env.appRoot, reject: false });
  slot.android = proc;

  attachOutput(proc, 'android', onLog);

  proc.on('exit', (code) => {
    delete slot.android;
    const status: ProcessStatus = code === 0 ? 'idle' : 'error';
    onStatus('android', status);
    onLog({ source: 'android', level: code === 0 ? 'info' : 'error', text: t.processManager.publishExited(code), timestamp: new Date() });
  });
}

export async function runAndroid(
  env: RNEnvironment,
  onLog: LogCallback,
  onStatus: StatusCallback
) {
  const slot = getSlot(env.appRoot);
  if (slot.android) return;

  onStatus('android', 'building');
  onLog({ source: 'system', level: 'info', text: t.processManager.buildingAndroid, timestamp: new Date() });

  const proc = execa('npx', ['react-native', 'run-android'], { cwd: env.appRoot, reject: false });
  slot.android = proc;

  attachOutput(proc, 'android', onLog);

  proc.on('spawn', () => {
    onStatus('android', 'building', proc.pid);
    startDeviceLogs('android', env.appRoot, onLog);
  });

  proc.on('exit', (code) => {
    delete slot.android;
    const status: ProcessStatus = code === 0 ? 'idle' : 'error';
    onStatus('android', status);
    onLog({ source: 'android', level: code === 0 ? 'info' : 'error', text: t.processManager.androidExited(code), timestamp: new Date() });
  });
}

export async function runIOS(
  env: RNEnvironment,
  onLog: LogCallback,
  onStatus: StatusCallback
) {
  const slot = getSlot(env.appRoot);
  if (slot.ios) return;

  onStatus('ios', 'building');
  onLog({ source: 'system', level: 'info', text: t.processManager.buildingIOS, timestamp: new Date() });

  const proc = execa('npx', ['react-native', 'run-ios'], { cwd: env.appRoot, reject: false });
  slot.ios = proc;

  attachOutput(proc, 'ios', onLog);

  proc.on('spawn', () => {
    onStatus('ios', 'building', proc.pid);
    startDeviceLogs('ios', env.appRoot, onLog);
  });

  proc.on('exit', (code) => {
    delete slot.ios;
    const status: ProcessStatus = code === 0 ? 'idle' : 'error';
    onStatus('ios', status);
    onLog({ source: 'ios', level: code === 0 ? 'info' : 'error', text: t.processManager.iosExited(code), timestamp: new Date() });
  });
}

export async function runInstall(
  env: RNEnvironment,
  onLog: LogCallback,
  onStatus: StatusCallback
) {
  const cmd = getInstallCommand(env.packageManager);
  onLog({ source: 'system', level: 'info', text: t.processManager.runningInstall(cmd), timestamp: new Date() });
  onStatus('metro', 'building');

  try {
    const [bin, ...args] = cmd.split(' ');
    const proc = execa(bin, args, { cwd: env.projectRoot, reject: false });
    attachOutput(proc, 'metro', onLog);
    await proc;
    onLog({ source: 'system', level: 'info', text: t.processManager.installComplete(cmd), timestamp: new Date() });
    onStatus('metro', 'idle');
  } catch (err) {
    onLog({ source: 'system', level: 'error', text: t.processManager.installFailed(err), timestamp: new Date() });
    onStatus('metro', 'error');
  }
}

export async function stopAll(onLog: LogCallback, onStatus: StatusCallback, appRoot?: string) {
  if (appRoot) {
    stopDeviceLogs(appRoot);
  }

  const pids: Array<{ name: 'metro' | 'android' | 'ios'; pid: number }> = [];
  const slot = appRoot ? getSlot(appRoot) : undefined;

  if (slot) {
    for (const key of ['metro', 'android', 'ios'] as const) {
      const proc = slot[key];
      if (proc?.pid) {
        pids.push({ name: key, pid: proc.pid });
        delete slot[key];
      }
    }

    if (slot.metroDetachedPid && !pids.find((p) => p.name === 'metro')) {
      pids.push({ name: 'metro', pid: slot.metroDetachedPid });
      slot.metroDetachedPid = undefined;
      const pf = pidFilePath(appRoot!);
      if (fs.existsSync(pf)) fs.rmSync(pf);
    }
  }

  for (const { name, pid } of pids) {
    onLog({ source: 'system', level: 'info', text: t.processManager.stoppingProcess(name), timestamp: new Date() });
    treeKill(pid, 'SIGTERM');
    onStatus(name, 'idle');
  }
}

export async function bombAtómica(
  env: RNEnvironment,
  onLog: LogCallback,
  onStatus: StatusCallback
) {
  await stopAll(onLog, onStatus, env.appRoot);

  onLog({ source: 'system', level: 'warn', text: t.processManager.bombStarted, timestamp: new Date() });

  const nodeModulesPath = path.join(env.appRoot, 'node_modules');
  if (fs.existsSync(nodeModulesPath)) {
    onLog({ source: 'system', level: 'info', text: t.processManager.deletingNodeModules, timestamp: new Date() });
    fs.rmSync(nodeModulesPath, { recursive: true, force: true });
  }

  const androidBuildPaths = [
    path.join(env.appRoot, 'android', 'build'),
    path.join(env.appRoot, 'android', 'app', 'build'),
    path.join(env.appRoot, 'android', '.gradle'),
  ];

  const rnImagePickerBuild = path.join(
    env.projectRoot, 'node_modules', 'react-native-image-picker', 'android', 'build'
  );
  if (fs.existsSync(rnImagePickerBuild)) {
    androidBuildPaths.push(rnImagePickerBuild);
  }

  for (const buildPath of androidBuildPaths) {
    if (fs.existsSync(buildPath)) {
      onLog({ source: 'system', level: 'info', text: t.processManager.cleaningPath(path.relative(env.projectRoot, buildPath)), timestamp: new Date() });
      fs.rmSync(buildPath, { recursive: true, force: true });
    }
  }

  const installCmd = getInstallCommand(env.packageManager);
  onLog({ source: 'system', level: 'info', text: t.processManager.runningInstall(installCmd), timestamp: new Date() });
  onStatus('metro', 'building');

  try {
    const [cmd, ...args] = installCmd.split(' ');
    const installProc = execa(cmd, args, { cwd: env.projectRoot });
    attachOutput(installProc, 'metro', onLog);
    await installProc;
  } catch (err) {
    onLog({ source: 'system', level: 'error', text: t.processManager.installFailed(err), timestamp: new Date() });
    onStatus('metro', 'error');
    return;
  }

  onLog({ source: 'system', level: 'info', text: t.processManager.installRestarting, timestamp: new Date() });
  await startMetro(env, onLog, onStatus, true);
}

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

type LogCallback = (entry: Omit<LogEntry, 'id'>) => void;
type StatusCallback = (process: 'metro' | 'android' | 'ios', status: ProcessStatus, pid?: number) => void;

let logId = 0;
function nextId() { return ++logId; }

const processes: {
  metro?: ExecaChildProcess;
  android?: ExecaChildProcess;
  ios?: ExecaChildProcess;
  deviceLogs?: ExecaChildProcess;
} = {};

let metroDetachedPid: number | undefined;

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
  if (processes.metro) return;
  if (metroDetachedPid && isProcessAlive(metroDetachedPid)) {
    onLog({ source: 'system', level: 'info', text: t.processManager.metroAlreadyRunning(metroDetachedPid), timestamp: new Date() });
    return;
  }
  metroDetachedPid = undefined;

  onStatus('metro', 'building');
  const args = ['react-native', 'start'];
  if (resetCache) args.push('--reset-cache');

  const proc = execa('npx', args, { cwd: env.appRoot, reject: false, detached: true });
  processes.metro = proc;
  onLog({ source: 'system', level: 'info', text: t.processManager.startingMetro(resetCache), timestamp: new Date() });

  attachOutput(proc, 'metro', onLog);

  proc.on('spawn', () => {
    onStatus('metro', 'running', proc.pid);
  });

  proc.on('exit', (code) => {
    delete processes.metro;
    const status: ProcessStatus = code === 0 || code === null ? 'idle' : 'error';
    onStatus('metro', status);
    onLog({ source: 'metro', level: code === 0 || code === null ? 'info' : 'error', text: t.processManager.metroExited(code), timestamp: new Date() });
  });
}

export async function stopMetro(onLog: LogCallback, onStatus: StatusCallback, appRoot?: string) {
  const pid = processes.metro?.pid ?? metroDetachedPid;
  if (!pid) return;
  onLog({ source: 'system', level: 'info', text: t.processManager.stoppingMetro, timestamp: new Date() });
  treeKill(pid, 'SIGTERM');
  delete processes.metro;
  metroDetachedPid = undefined;
  if (appRoot) {
    const pf = pidFilePath(appRoot);
    if (fs.existsSync(pf)) fs.rmSync(pf);
  }
  onStatus('metro', 'idle');
}

export function detachMetro(appRoot: string, onLog: LogCallback, onStatus: StatusCallback) {
  const proc = processes.metro;
  const pid = proc?.pid;
  if (!pid) return;
  proc?.unref();
  const pidFile = pidFilePath(appRoot);
  fs.writeFileSync(pidFile, String(pid), 'utf-8');
  delete processes.metro;
  metroDetachedPid = pid;
  onStatus('metro', 'detached', pid);
  onLog({ source: 'system', level: 'info', text: t.processManager.metroDetached(pid), timestamp: new Date() });
}

export async function reattachMetro(
  appRoot: string,
  onLog: LogCallback,
  onStatus: StatusCallback
): Promise<boolean> {
  // 1. Intentar con .pid file primero
  const pidFile = pidFilePath(appRoot);
  if (fs.existsSync(pidFile)) {
    const raw = fs.readFileSync(pidFile, 'utf-8').trim();
    const pid = parseInt(raw, 10);
    if (!isNaN(pid) && isProcessAlive(pid)) {
      metroDetachedPid = pid;
      onLog({ source: 'system', level: 'info', text: t.processManager.metroBackground(pid), timestamp: new Date() });
      onStatus('metro', 'running', pid);
      return true;
    }
    fs.rmSync(pidFile);
  }

  // 2. Fallback: buscar procesos huérfanos con pgrep
  const pids = await findOrphanMetroPids();
  if (pids.length > 0) {
    const pid = pids[0];
    metroDetachedPid = pid;
    onLog({ source: 'system', level: 'warn', text: t.processManager.metroOrphan(pid), timestamp: new Date() });
    onStatus('metro', 'running', pid);
    return true;
  }

  metroDetachedPid = undefined;
  return false;
}

export async function killOrphanMetro(
  appRoot: string,
  onLog: LogCallback,
  onStatus: StatusCallback
): Promise<void> {
  const pids = await findOrphanMetroPids();

  // Only exclude processes we actively own (spawned this session with a live handle).
  // metroDetachedPid is itself an orphan — it should be killed too.
  const activePid = processes.metro?.pid;
  const toKill = pids.filter((p) => p !== activePid);

  if (toKill.length === 0) {
    onLog({ source: 'system', level: 'info', text: t.processManager.noOrphans, timestamp: new Date() });
    return;
  }

  for (const pid of toKill) {
    onLog({ source: 'system', level: 'warn', text: t.processManager.killingOrphan(pid), timestamp: new Date() });
    treeKill(pid, 'SIGTERM');
  }

  const pidFile = pidFilePath(appRoot);
  if (fs.existsSync(pidFile)) fs.rmSync(pidFile);
  metroDetachedPid = undefined;
  onStatus('metro', 'idle');

  onLog({ source: 'system', level: 'info', text: t.processManager.orphansKilled(toKill.length), timestamp: new Date() });
}

export function startDeviceLogs(
  platform: 'android' | 'ios',
  onLog: LogCallback
): void {
  if (processes.deviceLogs) return;
  const cmd = platform === 'android' ? 'log-android' : 'log-ios';
  const proc = execa('npx', ['react-native', cmd], { reject: false });
  processes.deviceLogs = proc;
  attachOutput(proc, platform, onLog);
  proc.on('exit', () => { delete processes.deviceLogs; });
}

export function stopDeviceLogs(): void {
  const pid = processes.deviceLogs?.pid;
  if (pid) treeKill(pid, 'SIGTERM');
  delete processes.deviceLogs;
}

export async function runAndroid(
  env: RNEnvironment,
  onLog: LogCallback,
  onStatus: StatusCallback
) {
  if (processes.android) return;

  onStatus('android', 'building');
  onLog({ source: 'system', level: 'info', text: t.processManager.buildingAndroid, timestamp: new Date() });

  const proc = execa('npx', ['react-native', 'run-android'], { cwd: env.appRoot, reject: false });
  processes.android = proc;

  attachOutput(proc, 'android', onLog);

  proc.on('spawn', () => {
    onStatus('android', 'building', proc.pid);
    startDeviceLogs('android', onLog);
  });

  proc.on('exit', (code) => {
    delete processes.android;
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
  if (processes.ios) return;

  onStatus('ios', 'building');
  onLog({ source: 'system', level: 'info', text: t.processManager.buildingIOS, timestamp: new Date() });

  const proc = execa('npx', ['react-native', 'run-ios'], { cwd: env.appRoot, reject: false });
  processes.ios = proc;

  attachOutput(proc, 'ios', onLog);

  proc.on('spawn', () => {
    onStatus('ios', 'building', proc.pid);
    startDeviceLogs('ios', onLog);
  });

  proc.on('exit', (code) => {
    delete processes.ios;
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

export async function stopAll(onLog: LogCallback, onStatus: StatusCallback) {
  stopDeviceLogs();

  const pids: Array<{ name: 'metro' | 'android' | 'ios'; pid: number }> = [];

  for (const key of ['metro', 'android', 'ios'] as const) {
    const proc = processes[key];
    if (proc?.pid) {
      pids.push({ name: key, pid: proc.pid });
      delete processes[key];
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
  await stopAll(onLog, onStatus);

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

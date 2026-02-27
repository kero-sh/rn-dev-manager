import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { LogLayout } from '../types.js';

interface Prefs {
  logLayout?: LogLayout;
}

function prefsFilePath(): string {
  const dir = path.join(os.homedir(), '.rn-dev-manager');
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'prefs.json');
}

export function loadPrefs(): Prefs {
  try {
    const raw = fs.readFileSync(prefsFilePath(), 'utf-8');
    return JSON.parse(raw) as Prefs;
  } catch {
    return {};
  }
}

export function savePrefs(prefs: Prefs): void {
  try {
    const existing = loadPrefs();
    fs.writeFileSync(prefsFilePath(), JSON.stringify({ ...existing, ...prefs }, null, 2), 'utf-8');
  } catch {
    // non-critical
  }
}

export type ProcessStatus = 'idle' | 'running' | 'building' | 'done' | 'error' | 'detached';

export interface MonorepoPackage {
  name: string;
  version: string;
  path: string;
  private: boolean;
  buildStatus: ProcessStatus;
}

export interface ProcessState {
  status: ProcessStatus;
  pid?: number;
}

export type LogLayout = 'grid' | 'rows' | 'merged';

export interface LogEntry {
  id: number;
  source: 'metro' | 'android' | 'ios' | 'system';
  level: 'info' | 'warn' | 'error';
  text: string;
  timestamp: Date;
}

export interface WorkspaceState {
  metro: ProcessState;
  android: ProcessState;
  ios: ProcessState;
  systemLogs: LogEntry[];
  metroLogs: LogEntry[];
  buildLogs: LogEntry[];
  liveLogs: LogEntry[];
  showSystemLogs: boolean;
  showMetroLogs: boolean;
  showBuildLogs: boolean;
  showLiveLogs: boolean;
  packages: MonorepoPackage[];
}

export interface AppState {
  workspaces: WorkspaceState[];
  activeIndex: number;
  logLayout: LogLayout;
  confirmation: ConfirmationState | null;
}

export interface ConfirmationState {
  action: 'bomba' | 'quit';
  message: string;
}

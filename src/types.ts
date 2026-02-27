export type ProcessStatus = 'idle' | 'running' | 'building' | 'error' | 'detached';

export interface ProcessState {
  status: ProcessStatus;
  pid?: number;
}

export interface AppState {
  metro: ProcessState;
  android: ProcessState;
  ios: ProcessState;
  logs: LogEntry[];
  showLogs: boolean;
  confirmation: ConfirmationState | null;
}

export interface LogEntry {
  id: number;
  source: 'metro' | 'android' | 'ios' | 'system';
  level: 'info' | 'warn' | 'error';
  text: string;
  timestamp: Date;
}

export interface ConfirmationState {
  action: 'bomba' | 'quit';
  message: string;
}

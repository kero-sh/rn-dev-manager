import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Box, useApp, useInput } from 'ink';
import { useTerminalSize } from './hooks/useTerminalSize.js';
import { Header } from './components/Header.js';
import { StatusPanel } from './components/StatusPanel.js';
import { LogsPanel } from './components/LogsPanel.js';
import { KeybindingsBar } from './components/KeybindingsBar.js';
import { ConfirmModal } from './components/ConfirmModal.js';
import { RNEnvironment } from './utils/detectEnv.js';
import { t } from './i18n/index.js';
import {
  startMetro,
  stopMetro,
  runAndroid,
  runIOS,
  runInstall,
  stopAll,
  bombAtómica,
  detachMetro,
  reattachMetro,
  killOrphanMetro,
} from './utils/processManager.js';
import { AppState, LogEntry, ProcessStatus } from './types.js';
import { useNavigation, NavAction } from './hooks/useNavigation.js';

const VERSION = '0.1.0';

interface AppProps {
  env: RNEnvironment;
}

const initialState: AppState = {
  metro:    { status: 'idle' },
  android:  { status: 'idle' },
  ios:      { status: 'idle' },
  logs:     [],
  showLogs: true,
  confirmation: null,
};

let logCounter = 0;

export const App: React.FC<AppProps> = ({ env }) => {
  const { exit } = useApp();
  const [state, setState] = useState<AppState>(initialState);

  const addLog = useCallback((entry: Omit<LogEntry, 'id'>) => {
    setState((prev) => ({
      ...prev,
      logs: [...prev.logs, { ...entry, id: ++logCounter }],
    }));
  }, []);

  const setStatus = useCallback(
    (process: 'metro' | 'android' | 'ios', status: ProcessStatus, pid?: number) => {
      setState((prev) => ({
        ...prev,
        [process]: { status, pid },
      }));
    },
    []
  );

  useEffect(() => {
    reattachMetro(env.appRoot, addLog, setStatus);
  }, []);

  const navActions = useMemo<NavAction[]>(() => [
    { id: 'start',     key: 's',         label: t.keys.start },
    { id: 'reload',    key: 'r',         label: t.keys.reload },
    { id: 'android',   key: 'a',         label: t.keys.android },
    { id: 'ios',       key: 'i',         label: t.keys.ios },
    { id: 'stop',      key: 'x',         label: t.keys.stop },
    { id: 'install',   key: 'I',         label: t.keys.install },
    { id: 'kill',      key: 'K',         label: t.keys.killOrphans },
    { id: 'reset',     key: 'F5',        label: t.keys.reset },
    { id: 'fullreset', key: 'Ctrl+F5',   label: t.keys.fullReset },
    { id: 'logs',      key: 'l',         label: t.keys.logs },
    { id: 'quit',      key: 'q',         label: t.keys.quit },
  ], []);

  const nav = useNavigation(navActions);
  const { rows, columns } = useTerminalSize();
  const maxVisibleLogs = Math.max(5, rows - 14);

  useInput((input, key) => {
    // Tab always cycles panels regardless of state
    if (key.tab) {
      nav.cyclePanel();
      return;
    }

    if (state.confirmation) {
      if (state.confirmation.action === 'quit') {
        const ch = input.toLowerCase();
        if (ch === 'd') {
          detachMetro(env.appRoot, addLog, setStatus);
          setState((prev) => ({ ...prev, confirmation: null }));
          stopAll(addLog, setStatus).then(() => exit());
        } else if (ch === 'q' || key.escape) {
          setState((prev) => ({ ...prev, confirmation: null }));
          stopAll(addLog, setStatus).then(() => exit());
        }
        return;
      }

      const ch = input.toLowerCase();
      if (ch === 'y') {
        setState((prev) => ({ ...prev, confirmation: null }));
        bombAtómica(env, addLog, setStatus);
      } else if (ch === 'n' || key.escape) {
        setState((prev) => ({ ...prev, confirmation: null }));
        addLog({ source: 'system', level: 'info', text: t.app.bombaCancelled, timestamp: new Date() });
      }
      return;
    }

    if (input === 'q' || (key.ctrl && input === 'c')) {
      if (state.metro.status === 'running') {
        setState((prev) => ({
          ...prev,
          confirmation: {
            action: 'quit',
            message: t.app.quitMessage,
          },
        }));
      } else {
        stopAll(addLog, setStatus).then(() => exit());
      }
      return;
    }

    if (input === 's') {
      setState((prev) => ({ ...prev, logs: [] }));
      startMetro(env, addLog, setStatus);
      return;
    }

    if (input === 'r') {
      setState((prev) => ({ ...prev, logs: [] }));
      stopMetro(addLog, setStatus, env.appRoot).then(() =>
        startMetro(env, addLog, setStatus)
      );
      return;
    }

    if (input === 'a') {
      runAndroid(env, addLog, setStatus);
      return;
    }

    if (input === 'i') {
      runIOS(env, addLog, setStatus);
      return;
    }

    if (input === 'x') {
      stopAll(addLog, setStatus);
      return;
    }

    if (input === 'I') {
      setState((prev) => ({ ...prev, logs: [] }));
      runInstall(env, addLog, setStatus);
      return;
    }

    if (input === 'K') {
      killOrphanMetro(env.appRoot, addLog, setStatus);
      return;
    }

    // F5 = Reset Metro --reset-cache
    if (input === '\u001b[15~') {
      setState((prev) => ({ ...prev, logs: [] }));
      stopMetro(addLog, setStatus, env.appRoot).then(() =>
        startMetro(env, addLog, setStatus, true)
      );
      return;
    }

    // Ctrl+F5 = Bomba Atómica
    if (input === '\u001b[15;5~') {
      setState((prev) => ({
        ...prev,
        logs: [],
        confirmation: {
          action: 'bomba',
          message: t.app.bombaMessage,
        },
      }));
      return;
    }

    if (input === 'l') {
      setState((prev) => ({ ...prev, showLogs: !prev.showLogs }));
      return;
    }

    // Panel-specific navigation
    if (nav.focusedPanel === 'logs') {
      if (key.upArrow) { nav.scrollLog('up', state.logs.length, maxVisibleLogs); return; }
      if (key.downArrow) { nav.scrollLog('down', state.logs.length, maxVisibleLogs); return; }
    }

    if (nav.focusedPanel === 'keys') {
      if (key.leftArrow)  { nav.moveKey('left');  return; }
      if (key.rightArrow) { nav.moveKey('right'); return; }
      if (key.return) {
        const action = nav.focusedAction;
        if (action) {
          switch (action.id) {
            case 'start':     setState((prev) => ({ ...prev, logs: [] })); startMetro(env, addLog, setStatus); break;
            case 'reload':    setState((prev) => ({ ...prev, logs: [] })); stopMetro(addLog, setStatus, env.appRoot).then(() => startMetro(env, addLog, setStatus)); break;
            case 'android':   runAndroid(env, addLog, setStatus); break;
            case 'ios':       runIOS(env, addLog, setStatus); break;
            case 'stop':      stopAll(addLog, setStatus); break;
            case 'install':   setState((prev) => ({ ...prev, logs: [] })); runInstall(env, addLog, setStatus); break;
            case 'kill':      killOrphanMetro(env.appRoot, addLog, setStatus); break;
            case 'reset':     setState((prev) => ({ ...prev, logs: [] })); stopMetro(addLog, setStatus, env.appRoot).then(() => startMetro(env, addLog, setStatus, true)); break;
            case 'fullreset': setState((prev) => ({ ...prev, logs: [], confirmation: { action: 'bomba', message: t.app.bombaMessage } })); break;
            case 'logs':      setState((prev) => ({ ...prev, showLogs: !prev.showLogs })); break;
            case 'quit':
              if (state.metro.status === 'running') {
                setState((prev) => ({ ...prev, confirmation: { action: 'quit', message: t.app.quitMessage } }));
              } else {
                stopAll(addLog, setStatus).then(() => exit());
              }
              break;
          }
        }
        return;
      }
    }
  });

  return (
    <Box flexDirection="column" height={rows - 5} width={columns}>
      <Header env={env} version={VERSION} />
      <StatusPanel
        metro={state.metro}
        android={state.android}
        ios={state.ios}
        focused={nav.focusedPanel === 'status'}
      />
      <LogsPanel
        logs={state.logs}
        visible={state.showLogs}
        rows={rows}
        focused={nav.focusedPanel === 'logs'}
        logOffset={nav.logOffset}
      />
      {state.confirmation && (
        <ConfirmModal action={state.confirmation.action} message={state.confirmation.message} />
      )}
      <KeybindingsBar
        metroRunning={state.metro.status === 'running'}
        showLogs={state.showLogs}
        focused={nav.focusedPanel === 'keys'}
        focusedKeyIndex={nav.focusedKeyIndex}
        actions={navActions}
      />
    </Box>
  );
};

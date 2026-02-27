import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Box, useApp, useInput } from 'ink';
import { useTerminalSize } from './hooks/useTerminalSize.js';
import { Header } from './components/Header.js';
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
import { loadPrefs, savePrefs } from './utils/prefs.js';
import { AppState, LogEntry, LogLayout, ProcessStatus } from './types.js';
import { useNavigation, NavAction } from './hooks/useNavigation.js';
import type { LogChannel } from './components/LogsPanel.js';

const VERSION = '0.1.0';

const LAYOUT_CYCLE: LogLayout[] = ['grid', 'rows', 'merged'];

interface AppProps {
  env: RNEnvironment;
}

function buildInitialState(): AppState {
  const prefs = loadPrefs();
  return {
    metro:          { status: 'idle' },
    android:        { status: 'idle' },
    ios:            { status: 'idle' },
    systemLogs:     [],
    metroLogs:      [],
    buildLogs:      [],
    liveLogs:       [],
    showSystemLogs: true,
    showMetroLogs:  false,
    showBuildLogs:  false,
    showLiveLogs:   false,
    logLayout:      prefs.logLayout ?? 'grid',
    confirmation:   null,
  };
}

let logCounter = 0;

export const App: React.FC<AppProps> = ({ env }) => {
  const { exit } = useApp();
  const [state, setState] = useState<AppState>(buildInitialState);

  const addLog = useCallback((entry: Omit<LogEntry, 'id'>) => {
    setState((prev) => {
      const log = { ...entry, id: ++logCounter };
      if (entry.source === 'metro') {
        return { ...prev, metroLogs: [...prev.metroLogs, log] };
      } else if (entry.source === 'android' || entry.source === 'ios') {
        return { ...prev, buildLogs: [...prev.buildLogs, log] };
      }
      return { ...prev, systemLogs: [...prev.systemLogs, log] };
    });
  }, []);

  const addLiveLog = useCallback((entry: Omit<LogEntry, 'id'>) => {
    setState((prev) => ({
      ...prev,
      liveLogs: [...prev.liveLogs, { ...entry, id: ++logCounter }],
    }));
  }, []);

  const setStatus = useCallback(
    (process: 'metro' | 'android' | 'ios', status: ProcessStatus, pid?: number) => {
      setState((prev) => ({ ...prev, [process]: { status, pid } }));
    },
    []
  );

  useEffect(() => {
    reattachMetro(env.appRoot, addLog, setStatus);
  }, []);

  const navActions = useMemo<NavAction[]>(() => [
    { id: 'start',      key: 's',       label: t.keys.start },
    { id: 'reload',     key: 'r',       label: t.keys.reload },
    { id: 'android',    key: 'a',       label: t.keys.android },
    { id: 'ios',        key: 'i',       label: t.keys.ios },
    { id: 'stop',       key: 'x',       label: t.keys.stop },
    { id: 'install',    key: 'I',       label: t.keys.install },
    { id: 'kill',       key: 'K',       label: t.keys.killOrphans },
    { id: 'reset',      key: 'F5',      label: t.keys.reset },
    { id: 'fullreset',  key: 'Ctrl+F5', label: t.keys.fullReset },
    { id: 'logs',       key: 'l',       label: t.keys.logs },
    { id: 'metrologs',  key: 'm',       label: t.keys.metroLogs },
    { id: 'buildlogs',  key: 'd',       label: t.keys.buildLogs },
    { id: 'livelogs',   key: 'e',       label: t.keys.liveLogs },
    { id: 'view',       key: 'V',       label: t.keys.toggleView },
    { id: 'quit',       key: 'q',       label: t.keys.quit },
  ], []);

  const [focusedLogChannel, setFocusedLogChannel] = useState<LogChannel>('system');
  const nav = useNavigation(navActions);
  const { rows, columns } = useTerminalSize();
  const maxVisibleLogs = Math.max(3, Math.floor((rows - 10) / 4));

  const cycleLayout = useCallback(() => {
    setState((prev) => {
      const next = LAYOUT_CYCLE[(LAYOUT_CYCLE.indexOf(prev.logLayout) + 1) % LAYOUT_CYCLE.length];
      savePrefs({ logLayout: next });
      return { ...prev, logLayout: next };
    });
  }, []);

  useInput((input, key) => {
    if (key.tab) { nav.cyclePanel(); return; }

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
      setState((prev) => ({ ...prev, confirmation: { action: 'quit', message: t.app.quitMessage } }));
      return;
    }

    if (input === 's') { setState((prev) => ({ ...prev, metroLogs: [] })); startMetro(env, addLog, setStatus); return; }
    if (input === 'r') { setState((prev) => ({ ...prev, metroLogs: [] })); stopMetro(addLog, setStatus, env.appRoot).then(() => startMetro(env, addLog, setStatus)); return; }
    if (input === 'a') { runAndroid(env, addLog, setStatus); return; }
    if (input === 'i') { runIOS(env, addLog, setStatus); return; }
    if (input === 'x') { stopAll(addLog, setStatus); return; }
    if (input === 'I') { setState((prev) => ({ ...prev, metroLogs: [] })); runInstall(env, addLog, setStatus); return; }
    if (input === 'K') { killOrphanMetro(env.appRoot, addLog, setStatus); return; }

    if (input === '\u001b[15~') {
      setState((prev) => ({ ...prev, metroLogs: [] }));
      stopMetro(addLog, setStatus, env.appRoot).then(() => startMetro(env, addLog, setStatus, true));
      return;
    }
    if (input === '\u001b[15;5~') {
      setState((prev) => ({ ...prev, metroLogs: [], buildLogs: [], liveLogs: [], confirmation: { action: 'bomba', message: t.app.bombaMessage } }));
      return;
    }

    if (input === 'l') { setState((prev) => ({ ...prev, showSystemLogs: !prev.showSystemLogs })); return; }
    if (input === 'm') { setState((prev) => ({ ...prev, showMetroLogs: !prev.showMetroLogs })); return; }
    if (input === 'd') { setState((prev) => ({ ...prev, showBuildLogs: !prev.showBuildLogs })); return; }
    if (input === 'e') { setState((prev) => ({ ...prev, showLiveLogs: !prev.showLiveLogs })); return; }
    if (input === 'V') { cycleLayout(); return; }

    if (nav.focusedPanel === 'logs') {
      if (key.upArrow) {
        const len = focusedLogChannel === 'metro' ? state.metroLogs.length
          : focusedLogChannel === 'build' ? state.buildLogs.length
          : focusedLogChannel === 'live'  ? state.liveLogs.length
          : state.systemLogs.length;
        nav.scrollLog('up', len, maxVisibleLogs);
        return;
      }
      if (key.downArrow) {
        const len = focusedLogChannel === 'metro' ? state.metroLogs.length
          : focusedLogChannel === 'build' ? state.buildLogs.length
          : focusedLogChannel === 'live'  ? state.liveLogs.length
          : state.systemLogs.length;
        nav.scrollLog('down', len, maxVisibleLogs);
        return;
      }
      if (input === '1') { setFocusedLogChannel('system'); return; }
      if (input === '2') { setFocusedLogChannel('metro');  return; }
      if (input === '3') { setFocusedLogChannel('build');  return; }
      if (input === '4') { setFocusedLogChannel('live');   return; }
    }

    if (nav.focusedPanel === 'keys') {
      if (key.leftArrow)  { nav.moveKey('left');  return; }
      if (key.rightArrow) { nav.moveKey('right'); return; }
      if (key.return) {
        const action = nav.focusedAction;
        if (action) {
          switch (action.id) {
            case 'start':     setState((prev) => ({ ...prev, metroLogs: [] })); startMetro(env, addLog, setStatus); break;
            case 'reload':    setState((prev) => ({ ...prev, metroLogs: [] })); stopMetro(addLog, setStatus, env.appRoot).then(() => startMetro(env, addLog, setStatus)); break;
            case 'android':   runAndroid(env, addLog, setStatus); break;
            case 'ios':       runIOS(env, addLog, setStatus); break;
            case 'stop':      stopAll(addLog, setStatus); break;
            case 'install':   setState((prev) => ({ ...prev, metroLogs: [] })); runInstall(env, addLog, setStatus); break;
            case 'kill':      killOrphanMetro(env.appRoot, addLog, setStatus); break;
            case 'reset':     setState((prev) => ({ ...prev, metroLogs: [] })); stopMetro(addLog, setStatus, env.appRoot).then(() => startMetro(env, addLog, setStatus, true)); break;
            case 'fullreset': setState((prev) => ({ ...prev, metroLogs: [], buildLogs: [], liveLogs: [], confirmation: { action: 'bomba', message: t.app.bombaMessage } })); break;
            case 'logs':      setState((prev) => ({ ...prev, showSystemLogs: !prev.showSystemLogs })); break;
            case 'metrologs': setState((prev) => ({ ...prev, showMetroLogs: !prev.showMetroLogs })); break;
            case 'buildlogs': setState((prev) => ({ ...prev, showBuildLogs: !prev.showBuildLogs })); break;
            case 'livelogs':  setState((prev) => ({ ...prev, showLiveLogs: !prev.showLiveLogs })); break;
            case 'view':      cycleLayout(); break;
            case 'quit':      setState((prev) => ({ ...prev, confirmation: { action: 'quit', message: t.app.quitMessage } })); break;
          }
        }
        return;
      }
    }
  });

  return (
    <Box flexDirection="column" height={rows - 2} width={columns}>
      <Header
        env={env}
        version={VERSION}
        metro={state.metro}
        android={state.android}
        ios={state.ios}
        logLayout={state.logLayout}
      />
      <LogsPanel
        systemLogs={state.systemLogs}
        metroLogs={state.metroLogs}
        buildLogs={state.buildLogs}
        liveLogs={state.liveLogs}
        showSystemLogs={state.showSystemLogs}
        showMetroLogs={state.showMetroLogs}
        showBuildLogs={state.showBuildLogs}
        showLiveLogs={state.showLiveLogs}
        metroActive={state.metro.status === 'running' || state.metro.status === 'building'}
        deviceActive={state.android.status === 'building' || state.ios.status === 'building'}
        layout={state.logLayout}
        rows={rows}
        focused={nav.focusedPanel === 'logs'}
        focusedChannel={focusedLogChannel}
        logOffset={nav.logOffset}
      />
      {state.confirmation && (
        <ConfirmModal action={state.confirmation.action} message={state.confirmation.message} />
      )}
      <KeybindingsBar
        metroRunning={state.metro.status === 'running'}
        showLogs={state.showSystemLogs}
        focused={nav.focusedPanel === 'keys'}
        focusedKeyIndex={nav.focusedKeyIndex}
        actions={navActions}
      />
    </Box>
  );
};

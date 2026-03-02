import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { createRequire } from 'module';
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
  reloadMetro,
  runAndroid,
  runIOS,
  runLibraryBuild,
  runInstall,
  stopAll,
  bombAtómica,
  detachMetro,
  reattachMetro,
  killOrphanMetro,
} from './utils/processManager.js';
import { loadPrefs, savePrefs } from './utils/prefs.js';
import { AppState, WorkspaceState, LogEntry, LogLayout, ProcessStatus } from './types.js';
import { useNavigation, NavAction } from './hooks/useNavigation.js';
import type { LogChannel } from './components/LogsPanel.js';

const _require = createRequire(import.meta.url);
const VERSION: string = _require('../package.json').version;

const LAYOUT_CYCLE: LogLayout[] = ['grid', 'rows', 'merged'];

interface AppProps {
  envs: RNEnvironment[];
}

function buildWorkspaceState(): WorkspaceState {
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
  };
}

function buildInitialState(envs: RNEnvironment[]): AppState {
  const prefs = loadPrefs();
  return {
    workspaces:   envs.map(() => buildWorkspaceState()),
    activeIndex:  0,
    logLayout:    prefs.logLayout ?? 'grid',
    confirmation: null,
  };
}

let logCounter = 0;

export const App: React.FC<AppProps> = ({ envs }) => {
  const { exit } = useApp();
  const [state, setState] = useState<AppState>(() => buildInitialState(envs));

  const activeEnv = envs[state.activeIndex];
  const activeWs = state.workspaces[state.activeIndex];

  const updateActiveWs = useCallback((updater: (ws: WorkspaceState) => WorkspaceState) => {
    setState((prev) => {
      const workspaces = prev.workspaces.map((ws, i) =>
        i === prev.activeIndex ? updater(ws) : ws
      );
      return { ...prev, workspaces };
    });
  }, []);

  const makeLogForIdx = useCallback((idx: number) => (entry: Omit<LogEntry, 'id'>) => {
    const log = { ...entry, id: ++logCounter };
    setState((prev) => {
      const workspaces = prev.workspaces.map((ws, i) => {
        if (i !== idx) return ws;
        if (entry.source === 'metro') return { ...ws, metroLogs: [...ws.metroLogs, log] };
        if (entry.source === 'android' || entry.source === 'ios') return { ...ws, buildLogs: [...ws.buildLogs, log] };
        return { ...ws, systemLogs: [...ws.systemLogs, log] };
      });
      return { ...prev, workspaces };
    });
  }, []);

  const makeStatusForIdx = useCallback((idx: number) => (proc: 'metro' | 'android' | 'ios', status: ProcessStatus, pid?: number) => {
    setState((prev) => {
      const workspaces = prev.workspaces.map((ws, i) =>
        i === idx ? { ...ws, [proc]: { status, pid } } : ws
      );
      return { ...prev, workspaces };
    });
  }, []);

  const addLog = makeLogForIdx(state.activeIndex);
  const setStatus = makeStatusForIdx(state.activeIndex);

  useEffect(() => {
    envs.forEach((env, idx) => {
      reattachMetro(env.appRoot, makeLogForIdx(idx), makeStatusForIdx(idx));
    });
  }, []);

  const isLibrary = activeEnv.repoType === 'library';

  const navActions = useMemo<NavAction[]>(() => {
    if (isLibrary) {
      return [
        { id: 'build',      key: 'b',       label: t.keys.build },
        { id: 'stop',       key: 'x',       label: t.keys.stop },
        { id: 'install',    key: 'Ctrl+I',  label: t.keys.install },
        { id: 'logs',       key: 'l',       label: t.keys.logs },
        { id: 'buildlogs',  key: 'd',       label: t.keys.buildLogs },
        { id: 'view',       key: 'v',       label: t.keys.toggleView },
        { id: 'quit',       key: 'q',       label: t.keys.quit },
      ];
    }
    return [
      { id: 'start',      key: 's',       label: t.keys.start },
      { id: 'reload',     key: 'r',       label: t.keys.reload },
      { id: 'android',    key: 'a',       label: t.keys.android },
      { id: 'ios',        key: 'i',       label: t.keys.ios },
      { id: 'stop',       key: 'x',       label: t.keys.stop },
      { id: 'install',    key: 'Ctrl+I',  label: t.keys.install },
      { id: 'kill',       key: 'k',       label: t.keys.killOrphans },
      { id: 'reset',      key: 'F5',      label: t.keys.reset },
      { id: 'fullreset',  key: 'Ctrl+F5', label: t.keys.fullReset },
      { id: 'logs',       key: 'l',       label: t.keys.logs },
      { id: 'metrologs',  key: 'm',       label: t.keys.metroLogs },
      { id: 'buildlogs',  key: 'd',       label: t.keys.buildLogs },
      { id: 'livelogs',   key: 'e',       label: t.keys.liveLogs },
      { id: 'view',       key: 'v',       label: t.keys.toggleView },
      { id: 'quit',       key: 'q',       label: t.keys.quit },
    ];
  }, [isLibrary]);

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
          detachMetro(activeEnv.appRoot, addLog, setStatus);
          setState((prev) => ({ ...prev, confirmation: null }));
          Promise.all(envs.map((env) => stopAll(addLog, setStatus, env.appRoot))).then(() => exit());
        } else if (ch === 'q' || key.escape) {
          setState((prev) => ({ ...prev, confirmation: null }));
          Promise.all(envs.map((env) => stopAll(addLog, setStatus, env.appRoot))).then(() => exit());
        }
        return;
      }
      const ch = input.toLowerCase();
      if (ch === 'y') {
        setState((prev) => ({ ...prev, confirmation: null }));
        bombAtómica(activeEnv, addLog, setStatus);
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

    if (isLibrary) {
      if (input === 'b') { updateActiveWs((ws) => ({ ...ws, buildLogs: [] })); runLibraryBuild(activeEnv, addLog, setStatus); return; }
      if (input === 'x') { stopAll(addLog, setStatus, activeEnv.appRoot); return; }
      if (key.ctrl && input === 'i') { updateActiveWs((ws) => ({ ...ws, buildLogs: [] })); runInstall(activeEnv, addLog, setStatus); return; }
    } else {
      if (input === 's') { updateActiveWs((ws) => ({ ...ws, metroLogs: [] })); startMetro(activeEnv, addLog, setStatus); return; }
      if (input === 'r') { reloadMetro(addLog); return; }
      if (input === 'a') { runAndroid(activeEnv, addLog, setStatus); return; }
      if (input === 'i' && !key.ctrl) { runIOS(activeEnv, addLog, setStatus); return; }
      if (input === 'x') { stopAll(addLog, setStatus, activeEnv.appRoot); return; }
      if (key.ctrl && input === 'i') { updateActiveWs((ws) => ({ ...ws, metroLogs: [] })); runInstall(activeEnv, addLog, setStatus); return; }
      if (input.toLowerCase() === 'k') { killOrphanMetro(activeEnv.appRoot, addLog, setStatus); return; }
    }

    if (input === '\u001b[15~') {
      updateActiveWs((ws) => ({ ...ws, metroLogs: [] }));
      stopMetro(addLog, setStatus, activeEnv.appRoot).then(() => startMetro(activeEnv, addLog, setStatus, true));
      return;
    }
    if (input === '\u001b[15;5~') {
      updateActiveWs((ws) => ({ ...ws, metroLogs: [], buildLogs: [], liveLogs: [] }));
      setState((prev) => ({ ...prev, confirmation: { action: 'bomba', message: t.app.bombaMessage } }));
      return;
    }

    if (input === 'l') { updateActiveWs((ws) => ({ ...ws, showSystemLogs: !ws.showSystemLogs })); return; }
    if (input === 'm') { updateActiveWs((ws) => ({ ...ws, showMetroLogs: !ws.showMetroLogs })); return; }
    if (input === 'd') { updateActiveWs((ws) => ({ ...ws, showBuildLogs: !ws.showBuildLogs })); return; }
    if (input === 'e') { updateActiveWs((ws) => ({ ...ws, showLiveLogs: !ws.showLiveLogs })); return; }
    if (input.toLowerCase() === 'v') { cycleLayout(); return; }

    if (nav.focusedPanel === 'logs') {
      if (key.upArrow) {
        const len = focusedLogChannel === 'metro' ? activeWs.metroLogs.length
          : focusedLogChannel === 'build' ? activeWs.buildLogs.length
          : focusedLogChannel === 'live'  ? activeWs.liveLogs.length
          : activeWs.systemLogs.length;
        nav.scrollLog('up', len, maxVisibleLogs);
        return;
      }
      if (key.downArrow) {
        const len = focusedLogChannel === 'metro' ? activeWs.metroLogs.length
          : focusedLogChannel === 'build' ? activeWs.buildLogs.length
          : focusedLogChannel === 'live'  ? activeWs.liveLogs.length
          : activeWs.systemLogs.length;
        nav.scrollLog('down', len, maxVisibleLogs);
        return;
      }
      if (input === '1') { setFocusedLogChannel('system'); return; }
      if (input === '2') { setFocusedLogChannel('metro');  return; }
      if (input === '3') { setFocusedLogChannel('build');  return; }
      if (input === '4') { setFocusedLogChannel('live');   return; }
    }

    if (nav.focusedPanel !== 'logs') {
      const numericKey = parseInt(input, 10);
      if (!isNaN(numericKey) && numericKey >= 1 && numericKey <= envs.length) {
        setState((prev) => ({ ...prev, activeIndex: numericKey - 1 }));
        return;
      }
    }

    if (nav.focusedPanel === 'keys') {
      if (key.leftArrow)  { nav.moveKey('left');  return; }
      if (key.rightArrow) { nav.moveKey('right'); return; }
      if (key.return) {
        const action = nav.focusedAction;
        if (action) {
          switch (action.id) {
            case 'build':     updateActiveWs((ws) => ({ ...ws, buildLogs: [] })); runLibraryBuild(activeEnv, addLog, setStatus); break;
            case 'start':     updateActiveWs((ws) => ({ ...ws, metroLogs: [] })); startMetro(activeEnv, addLog, setStatus); break;
            case 'reload':    reloadMetro(addLog); break;
            case 'android':   runAndroid(activeEnv, addLog, setStatus); break;
            case 'ios':       runIOS(activeEnv, addLog, setStatus); break;
            case 'stop':      stopAll(addLog, setStatus, activeEnv.appRoot); break;
            case 'install':   updateActiveWs((ws) => ({ ...ws, metroLogs: [] })); runInstall(activeEnv, addLog, setStatus); break;
            case 'kill':      killOrphanMetro(activeEnv.appRoot, addLog, setStatus); break;
            case 'reset':     updateActiveWs((ws) => ({ ...ws, metroLogs: [] })); stopMetro(addLog, setStatus, activeEnv.appRoot).then(() => startMetro(activeEnv, addLog, setStatus, true)); break;
            case 'fullreset': updateActiveWs((ws) => ({ ...ws, metroLogs: [], buildLogs: [], liveLogs: [] })); setState((prev) => ({ ...prev, confirmation: { action: 'bomba', message: t.app.bombaMessage } })); break;
            case 'logs':      updateActiveWs((ws) => ({ ...ws, showSystemLogs: !ws.showSystemLogs })); break;
            case 'metrologs': updateActiveWs((ws) => ({ ...ws, showMetroLogs: !ws.showMetroLogs })); break;
            case 'buildlogs': updateActiveWs((ws) => ({ ...ws, showBuildLogs: !ws.showBuildLogs })); break;
            case 'livelogs':  updateActiveWs((ws) => ({ ...ws, showLiveLogs: !ws.showLiveLogs })); break;
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
        envs={envs}
        activeIndex={state.activeIndex}
        version={VERSION}
        metro={activeWs.metro}
        android={activeWs.android}
        ios={activeWs.ios}
        workspaces={state.workspaces}
        logLayout={state.logLayout}
      />
      <LogsPanel
        systemLogs={activeWs.systemLogs}
        metroLogs={activeWs.metroLogs}
        buildLogs={activeWs.buildLogs}
        liveLogs={activeWs.liveLogs}
        showSystemLogs={activeWs.showSystemLogs}
        showMetroLogs={activeWs.showMetroLogs}
        showBuildLogs={activeWs.showBuildLogs}
        showLiveLogs={activeWs.showLiveLogs}
        metroActive={activeWs.metro.status === 'running' || activeWs.metro.status === 'building'}
        deviceActive={activeWs.android.status === 'building' || activeWs.ios.status === 'building'}
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
        metroRunning={activeWs.metro.status === 'running'}
        showLogs={activeWs.showSystemLogs}
        focused={nav.focusedPanel === 'keys'}
        focusedKeyIndex={nav.focusedKeyIndex}
        actions={navActions}
      />
    </Box>
  );
};

import { useState, useCallback } from 'react';

export type FocusPanel = 'status' | 'logs' | 'keys';
export type LogChannel = 'system' | 'metro' | 'build' | 'live';

export interface NavAction {
  key: string;
  label: string;
  id: string;
}

const PANELS: FocusPanel[] = ['status', 'logs', 'keys'];

const INITIAL_OFFSETS: Record<LogChannel, number> = {
  system: 0,
  metro:  0,
  build:  0,
  live:   0,
};

export function useNavigation(actions: NavAction[]) {
  const [focusedPanel, setFocusedPanel] = useState<FocusPanel>('keys');
  const [focusedKeyIndex, setFocusedKeyIndex] = useState(0);
  const [logOffsets, setLogOffsets] = useState<Record<LogChannel, number>>(INITIAL_OFFSETS);

  const cyclePanel = useCallback(() => {
    setFocusedPanel((prev) => {
      const idx = PANELS.indexOf(prev);
      return PANELS[(idx + 1) % PANELS.length];
    });
  }, []);

  const moveKey = useCallback((dir: 'left' | 'right') => {
    setFocusedKeyIndex((prev) => {
      if (dir === 'right') return Math.min(prev + 1, actions.length - 1);
      return Math.max(prev - 1, 0);
    });
  }, [actions.length]);

  const scrollLog = useCallback((dir: 'up' | 'down', channel: LogChannel, totalLogs: number, maxVisible: number) => {
    setLogOffsets((prev) => {
      const maxOffset = Math.max(0, totalLogs - maxVisible);
      const current = prev[channel];
      const next = dir === 'up'
        ? Math.min(current + 1, maxOffset)
        : Math.max(current - 1, 0);
      return { ...prev, [channel]: next };
    });
  }, []);

  const resetLogOffset = useCallback((channel?: LogChannel) => {
    if (channel) {
      setLogOffsets((prev) => ({ ...prev, [channel]: 0 }));
    } else {
      setLogOffsets(INITIAL_OFFSETS);
    }
  }, []);

  return {
    focusedPanel,
    focusedKeyIndex,
    logOffsets,
    cyclePanel,
    moveKey,
    scrollLog,
    resetLogOffset,
    focusedAction: actions[focusedKeyIndex],
  };
}

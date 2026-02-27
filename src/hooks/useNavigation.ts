import { useState, useCallback } from 'react';

export type FocusPanel = 'status' | 'logs' | 'keys';

export interface NavAction {
  key: string;
  label: string;
  id: string;
}

const PANELS: FocusPanel[] = ['status', 'logs', 'keys'];

export function useNavigation(actions: NavAction[]) {
  const [focusedPanel, setFocusedPanel] = useState<FocusPanel>('keys');
  const [focusedKeyIndex, setFocusedKeyIndex] = useState(0);
  const [logOffset, setLogOffset] = useState(0);

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

  const scrollLog = useCallback((dir: 'up' | 'down', totalLogs: number, maxVisible: number) => {
    setLogOffset((prev) => {
      const maxOffset = Math.max(0, totalLogs - maxVisible);
      if (dir === 'up') return Math.min(prev + 1, maxOffset);
      return Math.max(prev - 1, 0);
    });
  }, []);

  const resetLogOffset = useCallback(() => setLogOffset(0), []);

  return {
    focusedPanel,
    focusedKeyIndex,
    logOffset,
    cyclePanel,
    moveKey,
    scrollLog,
    resetLogOffset,
    focusedAction: actions[focusedKeyIndex],
  };
}

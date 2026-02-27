import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { ProcessState, ProcessStatus } from '../types.js';
import { t } from '../i18n/index.js';

interface ProcessRowProps {
  label: string;
  state: ProcessState;
}

function statusDot(status: ProcessStatus): { symbol: string; color: string } {
  switch (status) {
    case 'running':  return { symbol: '●', color: '#adff2f' };  // greenyellow
    case 'building': return { symbol: '◌', color: '#ff8c00' };  // darkorange
    case 'error':    return { symbol: '●', color: '#ff4500' };  // orangered
    default:         return { symbol: '○', color: '#808080' };  // gray
  }
}

const ProcessRow: React.FC<ProcessRowProps> = ({ label, state }) => {
  const { symbol, color } = statusDot(state.status);
  const isBuilding = state.status === 'building';

  return (
    <Box>
      <Text color="white" dimColor>{label.padEnd(10)}</Text>
      {isBuilding ? (
        <Text color="#ff8c00">
          <Spinner type="dots" />
          {' '}
        </Text>
      ) : (
        <Text color={color as any}>{symbol} </Text>
      )}
      <Text color={color as any} bold={state.status === 'running'}>
        {t.processStatus[state.status]}
      </Text>
      {state.pid && state.status === 'running' && (
        <Text color="#808080" dimColor>  (pid: {state.pid})</Text>
      )}
    </Box>
  );
};

interface StatusPanelProps {
  metro: ProcessState;
  android: ProcessState;
  ios: ProcessState;
  focused?: boolean;
}

export const StatusPanel: React.FC<StatusPanelProps> = ({ metro, android, ios, focused }) => {
  return (
    <Box borderStyle="round" borderColor={focused ? '#00ffff' : '#00bfff'} paddingX={1} flexDirection="column">
      <Text color="#00ffff" bold>{t.status.title}</Text>
      <ProcessRow label={t.status.metro + ':'} state={metro} />
      <ProcessRow label={t.status.android + ':'} state={android} />
      <ProcessRow label={t.status.ios + ':'} state={ios} />
    </Box>
  );
};

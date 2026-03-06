import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { RNEnvironment } from '../utils/detectEnv.js';
import { useGitInfo } from '../hooks/useGitInfo.js';
import { t } from '../i18n/index.js';
import { ProcessState, ProcessStatus, LogLayout, WorkspaceState } from '../types.js';
import * as os from 'os';
import * as path from 'path';

interface HeaderProps {
  envs: RNEnvironment[];
  activeIndex: number;
  workspaces: WorkspaceState[];
  version: string;
  metro: ProcessState;
  android: ProcessState;
  ios: ProcessState;
  logLayout: LogLayout;
}

const COL_ICON = 3;
const COL_LABEL = 8;
const COL_STATUS_LABEL = 10;

function shortenPath(full: string): string {
  const home = os.homedir();
  return full.startsWith(home) ? full.replace(home, '~') : full;
}

const InfoRow: React.FC<{ icon: string; label: string; value: string; valueColor?: string }> = ({
  icon, label, value, valueColor = '#00ffff',
}) => (
  <Box>
    <Text color="#1e90ff">{icon.padEnd(COL_ICON)}</Text>
    <Text color="white" dimColor>{label.padEnd(COL_LABEL)}</Text>
    <Text color="white" dimColor>{': '}</Text>
    <Text color={valueColor as any}>{value}</Text>
  </Box>
);

function statusDot(status: ProcessStatus): { symbol: string; color: string } {
  switch (status) {
    case 'running':  return { symbol: '●', color: '#adff2f' };
    case 'building': return { symbol: '◌', color: '#ff8c00' };
    case 'error':    return { symbol: '●', color: '#ff4500' };
    default:         return { symbol: '○', color: '#808080' };
  }
}

const StatusRow: React.FC<{ label: string; state: ProcessState }> = ({ label, state }) => {
  const { symbol, color } = statusDot(state.status);
  const isBuilding = state.status === 'building';
  return (
    <Box>
      <Text color="white" dimColor>{label.padEnd(COL_STATUS_LABEL)}</Text>
      {isBuilding ? (
        <Text color="#ff8c00"><Spinner type="dots" />{' '}</Text>
      ) : (
        <Text color={color as any}>{symbol} </Text>
      )}
      <Text color={color as any} bold={state.status === 'running'}>
        {t.processStatus[state.status]}
      </Text>
      {state.pid && state.status === 'running' && (
        <Text color="#808080" dimColor>  ({state.pid})</Text>
      )}
    </Box>
  );
};

const LAYOUT_LABELS: Record<LogLayout, string> = {
  grid:   '⊞ GRID',
  rows:   '☰ ROWS',
  merged: '▣ ALL',
};

const ASCII_LOGO = [
  ' /\\ /\\ ',
  '/ / \\ \\',
  '\\ \\_/ /',
  ' \\___/ ',
];

const WorkspaceTabs: React.FC<{
  envs: RNEnvironment[];
  activeIndex: number;
  workspaces: WorkspaceState[];
}> = ({ envs, activeIndex, workspaces }) => (
  <Box flexDirection="row" paddingX={1} borderStyle="round" borderColor="#1e90ff">
    {envs.map((env, idx) => {
      const name = path.basename(env.appRoot);
      const ws = workspaces[idx];
      const { symbol, color } = statusDot(ws.metro.status);
      const isActive = idx === activeIndex;
      return (
        <Box key={env.appRoot} marginRight={2}>
          <Text
            color={isActive ? '#000000' : '#808080'}
            backgroundColor={isActive ? '#00ffff' : undefined}
            bold={isActive}
          >
            [{idx + 1}] {name}
          </Text>
          <Text color={color as any}> {symbol}</Text>
        </Box>
      );
    })}
  </Box>
);

export const Header: React.FC<HeaderProps> = ({ envs, activeIndex, workspaces, version, metro, android, ios, logLayout }) => {
  const env = envs[activeIndex];
  const git = useGitInfo(env.appRoot);
  const shortPath = shortenPath(env.appRoot);
  const multiWorkspace = envs.length > 1;

  return (
    <Box flexDirection="column">
      {multiWorkspace && (
        <WorkspaceTabs envs={envs} activeIndex={activeIndex} workspaces={workspaces} />
      )}
      <Box flexDirection="row" alignItems="stretch">
        {/* Left + Center: equal-width auto-grow pair */}
        <Box flexDirection="row" flexGrow={1} alignItems="stretch">
          {/* Left: env info */}
          <Box flexDirection="column" alignItems="flex-start" flexGrow={1} flexShrink={1} flexBasis={0} borderStyle="round" borderColor="#00bfff" paddingX={1}>
            <Text color="#00ffff" bold>{t.header.title}</Text>
            <InfoRow icon="⬡" label={t.header.node}    value={env.nodeVersion} />
            <InfoRow icon="⌂" label={t.header.path}    value={shortPath} valueColor="white" />
            <InfoRow icon="⎇" label={t.header.branch}  value={git.branch ?? 'n/a'} valueColor="#adff2f" />
            <Box>
              <Text color="#1e90ff">{'±'.padEnd(COL_ICON)}</Text>
              <Text color="white" dimColor>{t.header.diff.padEnd(COL_LABEL)}</Text>
              <Text color="white" dimColor>{': '}</Text>
              {git.changedFiles > 0 ? (
                <>
                  <Text color="#808080">{git.changedFiles} files  </Text>
                  {git.additions > 0 && <Text color="#adff2f">+{git.additions} </Text>}
                  {git.deletions > 0 && <Text color="#ff4500">-{git.deletions}</Text>}
                </>
              ) : (
                <Text color="#808080">{t.header.diffClean}</Text>
              )}
            </Box>
            <InfoRow icon="⚙" label={t.header.pkgMgr} value={env.packageManager + (env.isMonorepo ? ` · ${t.header.monorepo}` : '')} valueColor="#ffa07a" />
          </Box>

          {/* Center: process status */}
          <Box flexDirection="column" alignItems="flex-start" flexGrow={1} flexShrink={1} flexBasis={0} paddingX={2} borderStyle="round" borderColor="#00bfff">
            <Text color="#00ffff" bold>{t.status.title}</Text>
            <StatusRow label={t.status.metro + ':'} state={metro} />
            <StatusRow label={t.status.android + ':'} state={android} />
            <StatusRow label={t.status.ios + ':'} state={ios} />
          </Box>
        </Box>

        {/* Right: logo + version + layout badge */}
        <Box flexDirection="column" alignItems="flex-end" flexShrink={0} paddingX={1}>
          {ASCII_LOGO.map((line, i) => (
            <Text key={i} color="#00ffff" bold>{line}</Text>
          ))}
          <Text color="#ff00ff" bold>rn-dev-manager</Text>
          <Text color="#808080">v{version}</Text>
          <Box marginTop={1} borderStyle="round" borderColor="#1e90ff" paddingX={1}>
            <Text color="#1e90ff" bold>{LAYOUT_LABELS[logLayout]}</Text>
            <Text color="#808080" dimColor>  V</Text>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

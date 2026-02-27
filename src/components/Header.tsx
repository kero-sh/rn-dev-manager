import React from 'react';
import { Box, Text } from 'ink';
import { RNEnvironment } from '../utils/detectEnv.js';
import { useGitInfo } from '../hooks/useGitInfo.js';
import { t } from '../i18n/index.js';
import * as os from 'os';

interface HeaderProps {
  env: RNEnvironment;
  version: string;
}

const COL_ICON = 3;
const COL_LABEL = 8;

function shortenPath(full: string): string {
  const home = os.homedir();
  return full.startsWith(home) ? full.replace(home, '~') : full;
}

const InfoRow: React.FC<{ icon: string; label: string; value: string; valueColor?: string }> = ({
  icon,
  label,
  value,
  valueColor = '#00ffff',
}) => (
  <Box>
    <Text color="#1e90ff">{icon.padEnd(COL_ICON)}</Text>
    <Text color="white" dimColor>{label.padEnd(COL_LABEL)}</Text>
    <Text color="white" dimColor>{': '}</Text>
    <Text color={valueColor as any}>{value}</Text>
  </Box>
);

const ASCII_LOGO = [
  ' /\\ /\\ ',
  '/ / \\ \\',
  '\\ \\_/ /',
  ' \\___/ ',
];

export const Header: React.FC<HeaderProps> = ({ env, version }) => {
  const git = useGitInfo(env.appRoot);
  const shortPath = shortenPath(env.appRoot);

  return (
    <Box flexDirection="row" justifyContent="space-between" alignItems="flex-start" paddingX={1}>
      <Box flexDirection="column">
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

      <Box flexDirection="column" alignItems="flex-end">
        {ASCII_LOGO.map((line, i) => (
          <Text key={i} color="#00ffff" bold>{line}</Text>
        ))}
        <Text color="#ff00ff" bold>rn-dev-manager</Text>
        <Text color="#808080">v{version}</Text>
      </Box>
    </Box>
  );
};

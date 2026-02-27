import React from 'react';
import { Box, Text } from 'ink';
import { LogEntry } from '../types.js';
import { t } from '../i18n/index.js';

const SOURCE_COLORS: Record<LogEntry['source'], string> = {
  metro:   '#1e90ff',  // dodgerblue
  android: '#adff2f',  // greenyellow
  ios:     '#b0c4de',  // lightsteelblue
  system:  '#00ffff',  // aqua
};

const LEVEL_COLORS: Record<LogEntry['level'], string> = {
  info:  'white',
  warn:  '#ff8c00',   // darkorange
  error: '#ff4500',   // orangered
};

function formatSource(source: LogEntry['source']): string {
  return `[${source.padEnd(7)}]`;
}

interface LogsPanelProps {
  logs: LogEntry[];
  visible: boolean;
  rows: number;
  focused?: boolean;
  logOffset?: number;
}

export const LogsPanel: React.FC<LogsPanelProps> = ({ logs, visible, rows, focused, logOffset = 0 }) => {
  const maxLines = Math.max(5, rows - 14);

  const end = logs.length - logOffset;
  const start = Math.max(0, end - maxLines);
  const visible_logs = logs.slice(start, end);

  return (
    <Box
      borderStyle="round"
      borderColor={focused ? '#00ffff' : visible ? '#00bfff' : '#808080'}
      paddingX={1}
      flexDirection="column"
      flexGrow={1}
    >
      <Text color="#00ffff" bold>
        {t.logs.title}{' '}
        <Text color="#808080" dimColor>
          {visible ? `(l ${t.logs.toggleHide})` : `(l ${t.logs.toggleShow})`}
        </Text>
      </Text>
      {visible ? (
        visible_logs.length === 0 ? (
          <Text color="#808080" dimColor>—</Text>
        ) : (
          visible_logs.map((entry) => (
            <Box key={entry.id}>
              <Text color={SOURCE_COLORS[entry.source] as any} dimColor>
                {formatSource(entry.source)}{' '}
              </Text>
              <Text
                color={LEVEL_COLORS[entry.level] as any}
                dimColor={entry.level === 'info'}
              >
                {entry.text}
              </Text>
            </Box>
          ))
        )
      ) : (
        <Text color="#808080" dimColor>{logs.length} lines (hidden)</Text>
      )}
    </Box>
  );
};

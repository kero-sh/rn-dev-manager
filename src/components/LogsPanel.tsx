import React from 'react';
import { Box, Text } from 'ink';
import { LogEntry, LogLayout } from '../types.js';
import { t } from '../i18n/index.js';

const SOURCE_COLORS: Record<LogEntry['source'], string> = {
  metro:   '#1e90ff',
  android: '#adff2f',
  ios:     '#b0c4de',
  system:  '#00ffff',
};

const LEVEL_COLORS: Record<LogEntry['level'], string> = {
  info:  'white',
  warn:  '#ff8c00',
  error: '#ff4500',
};

function formatSource(source: LogEntry['source']): string {
  return `[${source.padEnd(7)}]`;
}

interface SinglePanelProps {
  title: string;
  toggleKey: string;
  logs: LogEntry[];
  visible: boolean;
  maxLines: number;
  logOffset: number;
  focused: boolean;
  autoEmerge: boolean;
}

const SingleLogPanel: React.FC<SinglePanelProps> = ({
  title, toggleKey, logs, visible, maxLines, logOffset, focused, autoEmerge,
}) => {
  const isVisible = visible || autoEmerge;
  const end = logs.length - logOffset;
  const start = Math.max(0, end - maxLines);
  const visibleLogs = logs.slice(start, end);

  if (!isVisible) {
    return (
      <Box
        borderStyle="round"
        borderColor="#404040"
        paddingX={1}
      >
        <Text color="#606060">
          {title}
          {'  '}
        </Text>
        <Text color="#404040" dimColor>
          [{toggleKey}] {t.logs.toggleShow}  ·  {logs.length} {t.logs.linesHidden}
        </Text>
      </Box>
    );
  }

  return (
    <Box
      borderStyle="round"
      borderColor={focused ? '#00ffff' : autoEmerge ? '#ff8c00' : '#00bfff'}
      paddingX={1}
      flexDirection="column"
      flexGrow={1}
    >
      <Text color={autoEmerge ? '#ff8c00' : '#00ffff'} bold>
        {title}
        {autoEmerge && <Text color="#ff8c00">  ●</Text>}
        {'  '}
        <Text color="#808080" dimColor>
          [{toggleKey}] {t.logs.toggleHide}
        </Text>
      </Text>
      {visibleLogs.length === 0 ? (
        <Text color="#808080" dimColor>—</Text>
      ) : (
        visibleLogs.map((entry) => (
          <Box key={entry.id}>
            <Text color={SOURCE_COLORS[entry.source] as any} dimColor>
              {formatSource(entry.source)}{' '}
            </Text>
            <Text color={LEVEL_COLORS[entry.level] as any} dimColor={entry.level === 'info'}>
              {entry.text}
            </Text>
          </Box>
        ))
      )}
    </Box>
  );
};

export type LogChannel = 'system' | 'metro' | 'build' | 'live';

export interface LogsPanelProps {
  systemLogs: LogEntry[];
  metroLogs: LogEntry[];
  buildLogs: LogEntry[];
  liveLogs: LogEntry[];
  showSystemLogs: boolean;
  showMetroLogs: boolean;
  showBuildLogs: boolean;
  showLiveLogs: boolean;
  metroActive: boolean;
  deviceActive: boolean;
  layout: LogLayout;
  rows: number;
  focused?: boolean;
  focusedChannel?: LogChannel;
  logOffset?: number;
}

export const LogsPanel: React.FC<LogsPanelProps> = ({
  systemLogs, metroLogs, buildLogs, liveLogs,
  showSystemLogs, showMetroLogs, showBuildLogs, showLiveLogs,
  metroActive, deviceActive,
  layout, rows, focused, focusedChannel, logOffset = 0,
}) => {
  const totalRows = Math.max(12, rows - 8);

  if (layout === 'merged') {
    const allLogs = [...systemLogs, ...metroLogs, ...buildLogs, ...liveLogs]
      .sort((a, b) => a.id - b.id);
    const maxLines = Math.max(4, totalRows - 2);
    return (
      <Box flexDirection="column" flexGrow={1}>
        <SingleLogPanel
          title={t.logs.title}
          toggleKey="l"
          logs={allLogs}
          visible={showSystemLogs || showMetroLogs || showBuildLogs || showLiveLogs}
          maxLines={maxLines}
          logOffset={logOffset}
          focused={focused === true}
          autoEmerge={(metroActive || deviceActive) && !showSystemLogs}
        />
      </Box>
    );
  }

  const maxLines = layout === 'grid'
    ? Math.max(3, Math.floor(totalRows / 2) - 2)
    : Math.max(3, Math.floor(totalRows / 4) - 1);

  const panels = [
    {
      key: 'system' as LogChannel,
      title: t.logs.systemTitle,
      toggleKey: 'l',
      logs: systemLogs,
      visible: showSystemLogs,
      autoEmerge: false,
    },
    {
      key: 'metro' as LogChannel,
      title: t.logs.metroTitle,
      toggleKey: 'm',
      logs: metroLogs,
      visible: showMetroLogs,
      autoEmerge: metroActive && !showMetroLogs,
    },
    {
      key: 'build' as LogChannel,
      title: t.logs.buildTitle,
      toggleKey: 'd',
      logs: buildLogs,
      visible: showBuildLogs,
      autoEmerge: deviceActive && !showBuildLogs,
    },
    {
      key: 'live' as LogChannel,
      title: t.logs.liveTitle,
      toggleKey: 'e',
      logs: liveLogs,
      visible: showLiveLogs,
      autoEmerge: deviceActive && !showLiveLogs,
    },
  ];

  if (layout === 'rows') {
    return (
      <Box flexDirection="column" flexGrow={1}>
        {panels.map((p) => (
          <SingleLogPanel
            key={p.key}
            title={p.title}
            toggleKey={p.toggleKey}
            logs={p.logs}
            visible={p.visible}
            maxLines={maxLines}
            logOffset={focusedChannel === p.key ? logOffset : 0}
            focused={focused === true && focusedChannel === p.key}
            autoEmerge={p.autoEmerge}
          />
        ))}
      </Box>
    );
  }

  // grid: 2 columns × 2 rows
  const [topLeft, topRight, botLeft, botRight] = panels;
  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box flexDirection="row" flexGrow={1}>
        <Box flexDirection="column" flexGrow={1}>
          <SingleLogPanel
            title={topLeft.title} toggleKey={topLeft.toggleKey}
            logs={topLeft.logs} visible={topLeft.visible}
            maxLines={maxLines}
            logOffset={focusedChannel === topLeft.key ? logOffset : 0}
            focused={focused === true && focusedChannel === topLeft.key}
            autoEmerge={topLeft.autoEmerge}
          />
        </Box>
        <Box flexDirection="column" flexGrow={1}>
          <SingleLogPanel
            title={topRight.title} toggleKey={topRight.toggleKey}
            logs={topRight.logs} visible={topRight.visible}
            maxLines={maxLines}
            logOffset={focusedChannel === topRight.key ? logOffset : 0}
            focused={focused === true && focusedChannel === topRight.key}
            autoEmerge={topRight.autoEmerge}
          />
        </Box>
      </Box>
      <Box flexDirection="row" flexGrow={1}>
        <Box flexDirection="column" flexGrow={1}>
          <SingleLogPanel
            title={botLeft.title} toggleKey={botLeft.toggleKey}
            logs={botLeft.logs} visible={botLeft.visible}
            maxLines={maxLines}
            logOffset={focusedChannel === botLeft.key ? logOffset : 0}
            focused={focused === true && focusedChannel === botLeft.key}
            autoEmerge={botLeft.autoEmerge}
          />
        </Box>
        <Box flexDirection="column" flexGrow={1}>
          <SingleLogPanel
            title={botRight.title} toggleKey={botRight.toggleKey}
            logs={botRight.logs} visible={botRight.visible}
            maxLines={maxLines}
            logOffset={focusedChannel === botRight.key ? logOffset : 0}
            focused={focused === true && focusedChannel === botRight.key}
            autoEmerge={botRight.autoEmerge}
          />
        </Box>
      </Box>
    </Box>
  );
};

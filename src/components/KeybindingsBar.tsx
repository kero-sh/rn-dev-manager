import React from 'react';
import { t } from '../i18n/index.js';
import { Box, Text } from 'ink';
import { NavAction } from '../hooks/useNavigation.js';

interface KeyHintProps {
  keys: string;
  label: string;
  disabled?: boolean;
  active?: boolean;
}

const KeyHint: React.FC<KeyHintProps> = ({ keys, label, disabled, active }) => (
  <Box marginRight={2}>
    <Text
      color={active ? '#000000' : disabled ? '#808080' : '#1e90ff'}
      backgroundColor={active ? '#00ffff' : undefined}
      bold={!disabled}
    >
      [{keys}]
    </Text>
    <Text
      color={active ? '#00ffff' : disabled ? '#808080' : 'white'}
      dimColor={disabled}
      bold={active}
    >
      {' '}{label}
    </Text>
  </Box>
);

interface KeybindingsBarProps {
  metroRunning: boolean;
  showLogs: boolean;
  focused?: boolean;
  focusedKeyIndex?: number;
  actions?: NavAction[];
}

export const KeybindingsBar: React.FC<KeybindingsBarProps> = ({
  metroRunning,
  showLogs,
  focused,
  focusedKeyIndex = -1,
  actions = [],
}) => {
  return (
    <Box borderStyle="round" borderColor={focused ? '#00ffff' : '#1e90ff'} paddingX={1} flexWrap="wrap">
      {actions.map((action, idx) => (
        <KeyHint
          key={action.id}
          keys={action.key}
          label={action.label}
          disabled={action.id === 'start' && metroRunning}
          active={focused && idx === focusedKeyIndex}
        />
      ))}
    </Box>
  );
};

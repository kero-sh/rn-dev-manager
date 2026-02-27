import React from 'react';
import { Box, Text } from 'ink';
import { t } from '../i18n/index.js';

interface ConfirmModalProps {
  action: 'bomba' | 'quit';
  message: string;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({ action, message }) => {
  if (action === 'quit') {
    return (
      <Box
        borderStyle="round"
        borderColor="#1e90ff"
        paddingX={2}
        paddingY={1}
        flexDirection="column"
        alignItems="center"
      >
        <Text color="#00ffff" bold>{t.modal.quit.title}</Text>
        <Box marginY={1}>
          <Text color="white">{message}</Text>
        </Box>
        <Text>
          <Text color="#adff2f" bold>{t.modal.quit.detachLabel}</Text>
          <Text color="white">{t.modal.quit.detachDesc}</Text>
          <Text color="#ff4500" bold>{t.modal.quit.quitLabel}</Text>
          <Text color="white">{t.modal.quit.quitDesc}</Text>
        </Text>
      </Box>
    );
  }

  return (
    <Box
      borderStyle="double"
      borderColor="#ff4500"
      paddingX={2}
      paddingY={1}
      flexDirection="column"
      alignItems="center"
    >
      <Text color="#ff4500" bold>{t.modal.bomba.title}</Text>
      <Box marginY={1}>
        <Text color="#ff8c00">{message}</Text>
      </Box>
      <Text>
        <Text color="#adff2f" bold>{t.modal.bomba.confirmLabel}</Text>
        <Text color="white">{t.modal.bomba.confirmDesc}</Text>
        <Text color="#ff4500" bold>{t.modal.bomba.cancelLabel}</Text>
        <Text color="white">{t.modal.bomba.cancelDesc}</Text>
      </Text>
    </Box>
  );
};

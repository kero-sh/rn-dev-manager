#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import { detectEnvironment } from './utils/detectEnv.js';
import { App } from './App.js';

async function main() {
  const env = await detectEnvironment(process.cwd());

  const { waitUntilExit } = render(React.createElement(App, { env }), { exitOnCtrlC: false });

  await waitUntilExit();
  process.exit(0);
}

main().catch((err) => {
  console.error('Error al iniciar rn-dev-manager:', err);
  process.exit(1);
});

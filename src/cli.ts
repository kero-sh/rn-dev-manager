#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import * as path from 'path';
import { detectEnvironment } from './utils/detectEnv.js';
import { App } from './App.js';

async function main() {
  const args = process.argv.slice(2);
  const rawPaths = args.length > 0 ? args : [process.cwd()];
  const resolvedPaths = rawPaths.map((p) => path.resolve(process.cwd(), p));

  const envs = await Promise.all(resolvedPaths.map((p) => detectEnvironment(p)));

  const { waitUntilExit } = render(React.createElement(App, { envs }), { exitOnCtrlC: false });

  await waitUntilExit();
  process.exit(0);
}

main().catch((err) => {
  console.error('Error al iniciar rn-dev-manager:', err);
  process.exit(1);
});

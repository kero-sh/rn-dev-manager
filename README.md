# rn-dev-manager

> A k9s-style TUI dashboard for React Native development. Tames monorepo terminal hell.

[![npm version](https://img.shields.io/npm/v/rn-dev-manager.svg)](https://www.npmjs.com/package/rn-dev-manager)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/carlosherrera/rn-dev-manager/pulls)
[![Issues](https://img.shields.io/github/issues/carlosherrera/rn-dev-manager)](https://github.com/carlosherrera/rn-dev-manager/issues)

## Installation

```bash
npm install -g rn-dev-manager
```

Or run without installing:

```bash
npx rn-dev-manager
```

## Usage

Run inside your React Native project (or monorepo app folder):

```bash
manager-rn
```

## Keybindings

| Key | Action |
|-----|--------|
| `s` / `Enter` | Start Metro Bundler |
| `a` | Run Android |
| `i` | Run iOS |
| `x` | Stop all processes |
| `r` | Reset Metro (`--reset-cache`) |
| `R` (Shift+R) | **Bomba Atómica** — stops everything, clears `node_modules` & Android caches, reinstalls, restarts Metro |
| `l` | Toggle Logs panel |
| `q` / `Ctrl+C` | Quit |

## Requirements

- Node.js >= 18
- A React Native project (detects npm/yarn/pnpm automatically)

---

## Contributing

Contributions are welcome and appreciated! Here's how you can help:

### Getting Started

1. Fork the repository on GitHub.
2. Clone your fork locally:

   ```bash
   git clone https://github.com/<your-username>/rn-dev-manager.git
   cd rn-dev-manager
   ```

3. Install dependencies:

   ```bash
   npm install
   ```

4. Start the dev build in watch mode:

   ```bash
   npm run dev
   ```

### Workflow

1. Create a branch for your feature or fix:

   ```bash
   git checkout -b feat/my-feature
   # or
   git checkout -b fix/my-bugfix
   ```

2. Make your changes, keeping commits small and focused.
3. Run tests before pushing:

   ```bash
   npm test
   ```

4. Push your branch and open a **Pull Request** against `main`.

### Pull Request Guidelines

- Describe **what** changed and **why** in the PR description.
- Reference any related issue with `Closes #<issue-number>`.
- Keep PRs focused — one feature or fix per PR.
- Make sure `npm test` passes and the project builds (`npm run build`) without errors.

---

## Reporting Issues

Found a bug or have a feature request? Please [open an issue](https://github.com/carlosherrera/rn-dev-manager/issues/new/choose) and include:

- **Bug reports**: steps to reproduce, expected vs actual behaviour, Node.js version, OS, and package manager used.
- **Feature requests**: a clear description of the problem it solves and any alternatives you've considered.

Search [existing issues](https://github.com/carlosherrera/rn-dev-manager/issues) first to avoid duplicates.

---

## Roadmap

Planned improvements (contributions welcome!):

- [ ] Web socket log streaming with filtering
- [ ] Support for Expo / Expo Go workflows
- [ ] Plugin system for custom keybindings and commands
- [ ] Multi-app monorepo support (select target app from TUI)
- [ ] Windows support

---

## Code of Conduct

This project follows the [Contributor Covenant](https://www.contributor-covenant.org/) Code of Conduct. By participating you are expected to uphold a welcoming and respectful environment for everyone. Please report unacceptable behaviour to the maintainers via GitHub.

---

## License

[MIT](./LICENSE) © Carlos Herrera

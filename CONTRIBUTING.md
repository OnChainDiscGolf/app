# Contributing to On-Chain Disc Golf

First off, thank you for considering contributing to On-Chain Disc Golf! 🥏⛓️

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates. When you create a bug report, include as many details as possible:

- **Use a clear and descriptive title**
- **Describe the exact steps to reproduce the problem**
- **Describe the behavior you observed and what you expected**
- **Include screenshots if applicable**
- **Include your device/browser information**

### Suggesting Features

Feature suggestions are welcome! Please:

- **Use a clear and descriptive title**
- **Provide a detailed description of the proposed feature**
- **Explain why this feature would be useful**
- **Consider how it fits with the existing app**

### Pull Requests

1. **Fork the repo** and create your branch from `develop`
2. **Follow the coding style** of the project
3. **Write clear commit messages**
4. **Test your changes** thoroughly
5. **Update documentation** if needed
6. **Submit a PR** to the `develop` branch

## Development Setup

### Prerequisites

- Node.js 20+ (see `.nvmrc`)
- npm

### Getting Started

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/On-Chain-Disc-Golf.git
cd On-Chain-Disc-Golf

# Install dependencies
npm install

# Start development server
npm run dev
```

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Fix auto-fixable lint issues |
| `npm run typecheck` | Run TypeScript type checking |

### Branch Strategy

- `main` - Production-ready code (protected)
- `develop` - Integration branch for features
- `feature/*` - New features
- `fix/*` - Bug fixes
- `chore/*` - Maintenance tasks

### Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

## Technical Overview

On-Chain Disc Golf is built with:

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Nostr** - Decentralized data layer
- **Cashu** - eCash payments
- **NWC** - Nostr Wallet Connect

## Questions?

Feel free to open an issue or reach out to the maintainers.

Thank you for contributing! 🎉


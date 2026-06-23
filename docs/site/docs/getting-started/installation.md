---
title: Installation
sidebar_position: 2
description: Detailed installation options for Kairos.
---

# Installation

Kairos supports multiple installation methods. Choose the one that best fits your environment.

## Pre-built Binaries

### Linux x64

```bash
curl -fsSL https://github.com/dhakalnirajan/Kairos/releases/latest/download/kairos-linux-x64.tar.gz | tar -xz
chmod +x kairos
sudo mv kairos /usr/local/bin/
```

### macOS (Intel)

```bash
curl -fsSL https://github.com/dhakalnirajan/Kairos/releases/latest/download/kairos-darwin-x64.tar.gz | tar -xz
chmod +x kairos
sudo mv kairos /usr/local/bin/
```

### macOS (Apple Silicon)

```bash
curl -fsSL https://github.com/dhakalnirajan/Kairos/releases/latest/download/kairos-darwin-arm64.tar.gz | tar -xz
chmod +x kairos
sudo mv kairos /usr/local/bin/
```

### Windows

```powershell
# Download and extract
curl -fsSL https://github.com/dhakalnirajan/Kairos/releases/latest/download/kairos-win-x64.zip -o kairos.zip
Expand-Archive kairos.zip -DestinationPath C:\Kairos

# Add to PATH
$env:PATH += ";C:\Kairos"
```

Or with WinGet:
```powershell
winget install dhakalnirajan.Kairos
```

## From Source

### Prerequisites

- Git
- Bun 1.0+

```bash
# Install Bun (if not already installed)
curl -fsSL https://bun.sh/install | bash

# Clone and build
git clone https://github.com/dhakalnirajan/Kairos.git
cd Kairos
bun install
bun run build
```

The binary will be at `dist/cli.js`.

## Using as Global Command

After building from source, link it globally:

```bash
bun link
# Now 'kairos' command is available globally
```

Or create a symlink manually:

```bash
sudo ln -s $(pwd)/dist/cli.js /usr/local/bin/kairos
```

## Docker

```bash
docker build -t kairos .
docker run -it kairos kairos setup
```

## Verifying Installation

```bash
kairos --version
# Output: kairos-code v0.1.1
```

## System Requirements

- **OS**: Linux, macOS, or Windows
- **Runtime**: Bun 1.0+
- **Memory**: 256MB minimum, 1GB recommended
- **Disk**: 100MB for installation
- **Network**: Required for cloud providers; local providers work offline

## Next Steps

- [Getting Started](../getting-started.md) — First-time setup
- [Configuration](../user-guide/configuration.md) — Customize your installation
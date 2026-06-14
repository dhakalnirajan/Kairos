# Kairos Code Documentation

## Overview

Kairos Code is a terminal-native AI coding agent with 19 LLM providers, 110+ commands, and a 6-layer safety pipeline.

## Quick Links

- [Getting Started](getting-started.md)
- [Installation](installation.md)
- [Configuration](configuration.md)
- [Providers](providers.md)
- [Slash Commands](slash-commands.md)
- [CLI Flags](cli-flags.md)
- [Safety](safety.md)
- [Memory](memory.md)
- [Tools](tools.md)
- [TUI](tui.md)
- [API Reference](api-reference.md)

## Installation

```bash
# From source
git clone https://github.com/dhakalnirajan/Kairos.git
cd Kairos
bun install

# Or download binary
curl -fsSL https://github.com/dhakalnirajan/Kairos/releases/latest/download/kairos-linux-x64.tar.gz | tar -xz
```

## Quick Start

```bash
# Start TUI
kairos

# Headless query
kairos -p "Explain this code"

# Provider management
kairos provider list
kairos provider discover
kairos provider test llamacpp
```

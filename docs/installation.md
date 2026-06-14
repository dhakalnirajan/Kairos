# Installation

## Prerequisites

- [Bun](https://bun.sh) v1.1+
- Git

## From Source

```bash
git clone https://github.com/dhakalnirajan/Kairos.git
cd Kairos
bun install
bun run build
```

## Binary Downloads

```bash
# Linux x64
curl -fsSL https://github.com/dhakalnirajan/Kairos/releases/latest/download/kairos-linux-x64.tar.gz | tar -xz

# macOS
curl -fsSL https://github.com/dhakalnirajan/Kairos/releases/latest/download/kairos-macos-arm64.tar.gz | tar -xz

# Windows
curl -fsSL https://github.com/dhakalnirajan/Kairos/releases/latest/download/kairos-windows-x64.zip -o kairos.zip
unzip kairos.zip
```

## Global Installation

```bash
bun install -g kairos-code
```

## Local LLM Setup

### llama.cpp

```bash
./llama-server -m models/llama-3-8b-instruct.gguf
```

### Ollama

```bash
ollama serve
ollama pull llama3
```

---
name: Kairos Code
version: "alpha"
description: Terminal-native AI coding agent visual identity
colors:
  primary: "#208AAE"
  secondary: "#A0A0A0"
  accent: "#FF6B6B"
  background: "#1A1A2E"
  foreground: "#E0E0E0"
  surface: "#16213E"
  muted: "#666666"
  success: "#4ECDC4"
  error: "#FF6B6B"
  warning: "#FFE66D"
  border: "#3A3A5C"
  highlight: "#208AAE"
  kairos: "#208AAE"
  code: "#A0A0A0"
  bright-kairos: "#64C8F0"
  bright-code: "#DCDCDC"
typography:
  h1:
    fontFamily: JetBrains Mono
    fontSize: 1.5rem
    fontWeight: bold
  h2:
    fontFamily: JetBrains Mono
    fontSize: 1.25rem
    fontWeight: bold
  body:
    fontFamily: JetBrains Mono
    fontSize: 1rem
    lineHeight: 1.5
  code:
    fontFamily: JetBrains Mono
    fontSize: 0.875rem
  label:
    fontFamily: JetBrains Mono
    fontSize: 0.75rem
    fontWeight: bold
rounded:
  sm: 2px
  md: 4px
  lg: 8px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
components:
  chat-pane:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    borderColor: "{colors.border}"
    typography: "{typography.body}"
  context-pane:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.secondary}"
    borderColor: "{colors.border}"
    typography: "{typography.body}"
  input-box:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    borderColor: "{colors.primary}"
    focusBorderColor: "{colors.primary}"
    typography: "{typography.code}"
  status-bar:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.muted}"
    typography: "{typography.label}"
  command-palette:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    borderColor: "{colors.border}"
    typography: "{typography.code}"
  mascot-kairos:
    textColor: "{colors.kairos}"
    fontWeight: bold
  mascot-code:
    textColor: "{colors.code}"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.background}"
    rounded: "{rounded.sm}"
    typography: "{typography.label}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    borderColor: "{colors.border}"
    rounded: "{rounded.sm}"
    typography: "{typography.label}"
  success-message:
    textColor: "{colors.success}"
    typography: "{typography.code}"
  error-message:
    textColor: "{colors.error}"
    typography: "{typography.code}"
  warning-message:
    textColor: "{colors.warning}"
    typography: "{typography.code}"
---

## Overview

Kairos Code is a terminal-native AI coding agent with a professional, developer-focused aesthetic. The design evokes a premium code editor — dark backgrounds with crisp, readable text and a distinctive teal accent color.

## Colors

The palette is built for long coding sessions with high contrast and low eye strain.

- **Primary (#208AAE):** Teal — the signature Kairos color used for highlights, links, and the mascot "KAIROS" text.
- **Secondary (#A0A0A0):** Neutral gray for borders, captions, and the mascot "CODE" text.
- **Accent (#FF6B6B):** Coral red for errors, warnings, and call-to-action elements.
- **Background (#1A1A2E):** Deep navy — the main canvas color for dark theme.
- **Foreground (#E0E0E0):** Light gray for primary text readability.
- **Surface (#16213E):** Slightly lighter navy for elevated surfaces like sidebars.
- **Success (#4ECDC4):** Teal-green for positive confirmations.
- **Warning (#FFE66D):** Warm yellow for caution states.

## Typography

All text uses JetBrains Mono — a monospace font designed for developers with excellent ligature support and clear character distinction.

- **Headings:** Bold, 1.25-1.5rem for clear hierarchy
- **Body:** Regular weight, 1rem with 1.5 line height for readability
- **Code:** Slightly smaller at 0.875rem for density
- **Labels:** Bold, 0.75rem for compact UI elements

## Layout

The TUI uses a split-pane layout optimized for coding workflows:

- **Chat Pane (70%):** Main interaction area with deep navy background
- **Context Pane (30%):** Supporting information with slightly lighter surface
- **Status Bar:** Single-line footer with system information
- **Input Box:** Full-width input at bottom with teal border focus

## Components

### Mascot
The Kairos mascot renders "KAIROS" in primary teal (#208AAE) and "CODE" in secondary gray (#A0A0A0). A metallic shine effect sweeps left-to-right every 15 seconds when the agent is actively thinking.

### Chat Messages
- User messages: Teal prefix with bold name
- Assistant messages: Primary color prefix with bold name
- Tool messages: Warning color prefix

### Command Palette
- Triggered by Ctrl+K
- Fuzzy search across 110+ commands
- Categorized display with keyboard navigation

### Status Bar
- Shows current model, mode, token count
- Compact single-line layout
- Muted color scheme for non-intrusive display

## Do's and Don'ts

### Do's
- Use teal (#208AAE) for primary actions and highlights
- Maintain high contrast between text and background
- Use monospace font for all code-related content
- Keep the dark theme as default for developer comfort
- Use coral (#FF6B6B) sparingly for errors and warnings

### Don'ts
- Don't use bright colors that cause eye strain
- Don't clutter the interface with unnecessary elements
- Don't deviate from the monospace font family
- Don't use light themes as default (available but not recommended)
- Don't overload the status bar with too much information

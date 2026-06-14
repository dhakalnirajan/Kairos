#!/usr/bin/env bun

import { main } from './cli/commands.ts';

main(process.argv).catch((error: unknown) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

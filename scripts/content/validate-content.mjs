#!/usr/bin/env node

// Keep package.json's cross-platform validation entry point small and delegate
// the detailed content, source, ID, answer, ACS, and asset checks to the
// dependency-free Python validator beside this file.

import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, '../..');
const validator = resolve(scriptDirectory, 'validate_bundle.py');
const bundle = resolve(projectRoot, 'src/content/catalog.json');

const result = spawnSync('python3', [validator, bundle], {
  cwd: projectRoot,
  stdio: 'inherit',
});

if (result.error) {
  console.error(`Unable to run content validator: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);

#!/usr/bin/env node
// Launch Python without shell parsing; preserve the harness input and exit code.
const { spawnSync } = require('node:child_process');
const path = require('node:path');

function findPython(platform = process.platform, spawn = spawnSync) {
  const candidates = platform === 'win32'
    ? [['py', '-3'], ['python'], ['python3']]
    : [['python3'], ['python']];
  for (const [program, ...prefix] of candidates) {
    const probe = spawn(program, [...prefix, '-c', 'import sys; sys.exit(0 if sys.version_info.major == 3 else 1)'],
      { stdio: 'ignore', timeout: 1500, windowsHide: true });
    if (!probe.error && probe.status === 0) return [program, ...prefix];
  }
  return null;
}

function main() {
  const python = findPython();
  if (!python) {
    console.error('Simple English: Python 3 was not found. Install Python 3 and make it available on PATH.');
    return 1;
  }
  const [program, ...prefix] = python;
  const result = spawnSync(program, [...prefix, path.join(__dirname, 'lint_hook.py')],
    { stdio: 'inherit', windowsHide: true });
  if (result.error) console.error(`Simple English: ${result.error.message}`);
  return result.status === null ? 1 : result.status;
}

if (require.main === module) process.exitCode = main();
module.exports = { findPython, main };

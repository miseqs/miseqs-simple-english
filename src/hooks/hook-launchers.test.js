const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const { findPython } = require('./run-lint-hook');
const root = path.resolve(__dirname, '../..');
const codex = JSON.parse(fs.readFileSync(path.join(root, '.codex-plugin/hooks.json')));
const claude = JSON.parse(fs.readFileSync(path.join(root, '.claude-plugin/hooks.json')));
const env = { ...process.env, PLUGIN_ROOT: root, CLAUDE_PLUGIN_ROOT: root,
  PATH: path.dirname(process.execPath) + path.delimiter + process.env.PATH };

function runClaude(event, input = '{}') {
  const hook = claude.hooks[event][0].hooks[0];
  assert.equal(hook.command, 'node');
  const args = hook.args.map(arg => arg.replace('${CLAUDE_PLUGIN_ROOT}', root));
  return spawnSync(process.execPath, args, { env, input, encoding: 'utf8', timeout: 10000 });
}

test('Claude exec form emits session context', () => {
  const result = runClaude('SessionStart');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /SIMPLE ENGLISH SKILL ACTIVE AUTOMATICALLY/);
});

test('Codex platform command emits the same context as Claude', () => {
  const hook = codex.hooks.SessionStart[0].hooks[0];
  const windows = process.platform === 'win32';
  // Match Codex command_runner.rs: Windows /C plus literal outer quotes.
  const result = windows
    ? spawnSync(process.env.COMSPEC || 'cmd.exe', ['/C', `"${hook.commandWindows}"`],
      { env, encoding: 'utf8', timeout: 10000, windowsVerbatimArguments: true })
    : spawnSync('/bin/sh', ['-c', hook.command], { env, encoding: 'utf8', timeout: 10000 });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, runClaude('SessionStart').stdout);
});

test('Python discovery tries Windows launcher then Python executables', () => {
  const calls = [];
  const found = findPython('win32', (program, args) => {
    calls.push([program, args]);
    return { status: program === 'python' ? 0 : 1 };
  });
  assert.deepEqual(found, ['python']);
  assert.equal(calls[0][0], 'py');
  assert.equal(calls[0][1][0], '-3');
});

test('Python discovery rejects missing, failing, or timed-out candidates', () => {
  assert.equal(findPython('linux', () => ({ status: null, error: new Error('missing') })), null);
  assert.equal(findPython('win32', () => ({ status: 1 })), null);
});

test('Claude Stop launcher forwards input and returns advisory JSON', () => {
  const result = runClaude('Stop', JSON.stringify({ hook_event_name: 'Stop', last_assistant_message: 'Certainly, great question!' }));
  assert.equal(result.status, 0, result.stderr);
  assert.ok(JSON.parse(result.stdout).systemMessage);
});

test('Claude PostToolUse launcher preserves the advisory exit code', () => {
  const result = runClaude('PostToolUse', JSON.stringify({ hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: { file_path: path.join(root, 'prompts/system-prompt.md') } }));
  assert.equal(result.status, 2, result.stderr);
  assert.ok(result.stderr.length > 0);
});

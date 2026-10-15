# Simple English hooks

The Claude Code and Codex plugins include a `SessionStart` hook. The hook loads the Simple English writing rules when a session starts, resumes, clears, or compacts. You do not need to name the skill.

The startup hook requires Node.js on PATH. Claude Code uses exec-form hooks (`command` plus `args`) to launch Node without a shell. Use a Claude Code release that supports exec-form hooks. Older releases that ignore `args` are unsupported.

Codex uses `command` on macOS/Linux and `commandWindows` on Windows. The Windows command resolves `PLUGIN_ROOT` inside Node and calls the exported `main()` function. The Unix command retains its original behavior, including `|| true`. Windows startup failures remain visible. Codex must support `commandWindows`.

The configurations are harness-specific. Do not copy Claude's `args` field into Codex or Codex's `commandWindows` field into Claude. Both invoke the same startup implementation. No Bash installation is required on Windows.

Claude's Python lint hooks run through `run-lint-hook.js`. It probes `py -3`, `python`, then `python3` on Windows; elsewhere it probes `python3`, then `python`. A probe must start Python 3 successfully. The launcher uses no shell and preserves stdin, stdout, stderr, and the Python exit code. Missing Python produces a visible error. Node and Python 3 are prerequisites for all Claude hooks.

## Install

Claude Code:

```bash
claude plugin marketplace add AminBlg/SimpleEnglish
claude plugin install simple-english@simple-english
```

Codex:

```bash
codex plugin marketplace add AminBlg/SimpleEnglish
codex plugin add simple-english@simple-english
```

Codex asks you to review and trust the hook before its first run. Open `/hooks` to approve it.

## What the hook sends

The hook writes the fenced rule block of `prompts/system-prompt.md` to standard output, about 3,500 characters. The page title, the paste instructions, and the word-budget variant stay out. The full skill, `skills/simple-english/SKILL.md`, is about 7,500 characters, and Claude Code caps hook output at 10,000 characters. Output over the cap goes to a file and the model gets only a preview. The condensed rules fit, and the hook names the full skill path so the model can read it for a compliance check or strict mode.

Codex applies its own cap to hook context. The `additionalContextLimit: 0` setting in `.codex-plugin/hooks.json` turns off the spill-to-disk threshold. It does not remove the cap. The condensed rules fit under it.

If the hook cannot read the prompt file, it tries the next location. If every location fails, it prints a short fallback rule set and exits 0. The session still starts.

## Where each harness loads the hook

- Claude Code: `.claude-plugin/hooks.json`, referenced by the manifest. There is no second registration in `hooks/hooks.json`.
- Codex: `.codex-plugin/hooks.json`, named by the `hooks` field in `.codex-plugin/plugin.json`. The marketplace catalog is `.agents/plugins/marketplace.json`.

## Test

From the repository root:

```bash
node --test src/hooks/simple-english-activate.test.js src/hooks/hook-launchers.test.js
```

## Advisory writing checks (Claude Code)

Two more hooks run under Claude Code, both advisory. Neither one blocks.

- `PostToolUse` on `Write` and `Edit`: when the file is Markdown, `src/hooks/lint_hook.py` lints it with `evals/ste_lint.py` and shows a one-line summary of the violations to the model.
- `Stop`: the same script reads the last reply and adds a system message when the reply breaks the register: an em-dash, bold, a header, a list item, a filler opener or closer, or a slop word.

Codex runs only the `SessionStart` hook. Test the checks with `python3 src/hooks/test_lint_hook.py`.

## What the file check skips

The writing rules cover the documents that you write for a reader. They do not cover the files that the agent keeps for itself, such as memory files. A summary of the violations in such a file only spends tokens. The `PostToolUse` check therefore skips three groups of paths:

- Every path under the Claude configuration directory. The check reads `CLAUDE_CONFIG_DIR` and falls back to `~/.claude`.
- Every path with a `.claude` directory component, for example `my-project/.claude/agent-memory/reviewer/MEMORY.md`. A skill or a command that you write under `.claude/` is also skipped.
- Every path that matches a glob in `SIMPLE_ENGLISH_LINT_EXCLUDE`.

A symlink does not defeat a skip. The check tests the absolute path in two forms, as written and with the symlinks resolved. A match on either form is enough.

`SIMPLE_ENGLISH_LINT_EXCLUDE` holds glob patterns, separated by the path separator of the platform (`:` on Linux and macOS, `;` on Windows). In a pattern, `*` also matches `/`. The check expands a leading `~` to your home directory.

```bash
export SIMPLE_ENGLISH_LINT_EXCLUDE="$HOME/notes/*:*/CHANGELOG.md"
```

To turn the file check off, set the variable to `*`. The `Stop` reply check stays on.

## Compatibility validation

CI runs the checks on Windows, Linux, and macOS with Node 22 and Python 3.12. The launcher tests execute the configured commands and compare their context output. They also exercise Python discovery, input forwarding, and advisory exit codes. The POSIX unreadable-file test skips Windows and root because mode 000 is not enforced there.

These subprocess tests do not prove harness registration, trust, or context delivery. After updating an installed plugin, inspect its cached configuration. In Codex, review the changed definition through `/hooks` and start a fresh session. Confirm that the startup context reaches the session. Test Claude in a fresh session as well. Do not use the absence of an error as proof of context delivery.

References: [Codex hooks](https://learn.chatgpt.com/docs/hooks), [Codex discovery](https://github.com/openai/codex/blob/main/codex-rs/hooks/src/engine/discovery.rs), and [Claude exec-form hooks](https://code.claude.com/docs/en/hooks#exec-form-and-shell-form). The source documents describe current behavior, not a verified minimum release for this plugin.

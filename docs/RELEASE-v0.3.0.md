# v0.3.0 release notes

## What's New

**SkillForge Desktop for Windows.** The web version can only export files. The desktop app works on the real skill folders on your computer:

- It scans the skill folders of the agents you have installed: 27 built-in folders taken from each agent's documentation, and automatic discovery for any other agent whose skills are kept as `<folder>/skills/<name>/SKILL.md`.
- It installs a skill into the agent folders you pick, after confirmation, and replaces an existing file only after a second confirmation. The replaced file goes to the Recycle Bin; other files are left alone.
- It refreshes when a folder changes. A skill you imported from disk follows its file, and a change on both sides is shown as a conflict for you to resolve.
- The library is a file on this computer, in the app data folder.

## Downloads

| File | Use |
| --- | --- |
| `SkillForge-Setup-<version>-x64.exe` | Installer: choose the folder, create shortcuts, appear in “Apps” |
| `SkillForge-<version>-x64-portable.exe` | Portable: run it from anywhere, nothing is installed |
| `SHA256SUMS-desktop.txt` | SHA-256 of the two programs above |

The installer and the portable program keep their data in the same folder (`%APPDATA%\SkillForge`), so the library and the installation records are shared. Either one is enough.

Both programs are **not code-signed**. Windows SmartScreen shows a warning on first run (“Windows protected your PC”); choose **More info → Run anyway**.

The web version is unchanged and still needs no installation. `source.zip` and `web-*.zip` are for hosting it yourself.

## Agent folders

| Agent | Folder |
| --- | --- |
| Claude Code | `~/.claude/skills` |
| Cursor | `~/.cursor/skills` |
| Codex | `~/.agents/skills` (also read by GitHub Copilot, OpenCode, Gemini CLI, Windsurf, Goose, ZCode, Qwen Code, Roo Code, Amp, Zed and Kimi Code CLI) |
| Codex (`.codex` folder) | `~/.codex/skills` |
| GitHub Copilot | `~/.copilot/skills` |
| OpenCode | `~/.config/opencode/skills` |
| Doubao | `~/Doubao/skills`, and the two Agent workspace folders when present |
| Gemini CLI | `~/.gemini/skills` |
| Antigravity | `~/.gemini/config/skills` |
| Windsurf | `~/.codeium/windsurf/skills` |
| Kiro | `~/.kiro/skills` |
| Trae / Trae CLI | `~/.trae/skills` / `~/.traecli/skills` |
| Qoder CLI / QoderWork | `~/.qoder/skills` / `~/.qoderwork/skills` |
| CodeBuddy Code | `~/.codebuddy/skills` |
| ZCode | `~/.zcode/skills` |
| Kimi Code CLI | `~/.config/agents/skills` (also read by Amp) |
| Amp | `~/.config/amp/skills` |
| iFlow CLI | `~/.iflow/skills` |
| Qwen Code | `~/.qwen/skills` |
| Cline | `~/.cline/skills` |
| Roo Code | `~/.roo/skills` |
| OpenHands | `~/.openhands/skills` |
| Devin | `~/.config/devin/skills` |

Sources for each folder are listed in [docs/DESKTOP.md](DESKTOP.md). Other agents are found automatically by the shape of their skills folder, or can be added with **Add folder**.

## Verification

- `npm test`: 60 tests (18 for the desktop core).
- The smoke run drives the real app in an isolated home folder: 36 checks, passed from source and on the packaged Windows program. It covers discovery of an unlisted agent folder, scanning, import, a file edited on disk, installation into a folder that does not exist yet, confirmation before replacing a file, uninstall (including the removal of folders created on install), and the refusal of calls that break the security rules.
- A read-only run against a real home folder listed 53 skills from 32 folders with no page errors. Automatic discovery took about 0.15 s and found five folders of agents that are not in the built-in list.
- One install-and-uninstall was done for real in the Codex folder and in the folder of an agent that was not installed: the files were written and removed, existing files were identical before and after (compared by hash), and no empty folder was left behind.

## Known limitations

- Windows x64 only. No macOS or Linux build.
- Not code-signed; SmartScreen warns on first run.
- Folder locations come from each agent's documentation. Installing was tested for real in two folders only (see above); other agents were not exercised.
- Automatic discovery does not recognize grouped layouts (`skills/<group>/<skill>/SKILL.md`) or agents whose skills live somewhere other than a `skills` folder. Add those with **Add folder**.
- The Doubao folder locations come from the local runtime configuration of one Windows machine.
- Imports and installs copy files only. Nothing inside a skill is executed.
- The AI features behave as in the web version: they call the provider you configure, and model calling was verified against a mock provider, not a paid one.

## Status

v0.3.0 was published on 2026-11-26 by the repository's Release workflow from commit `4ad4342`, because the workflow publishes a version on push to `main` when no Release with that tag exists. The [run](https://github.com/ZZZ234234234/SkillForge/actions/runs/45831811270) passed every step in both jobs: typecheck, lint, test, build, integration, packaging, attestation and publish for the web archives; build, packaging, verification of the packaged program, attestation and upload for the desktop programs. The [CI run](https://github.com/ZZZ234234234/SkillForge/actions/runs/45831811174) for the same commit passed as well.

Assets: `SkillForge-Setup-0.3.0-x64.exe` (121,733,889 bytes), `SkillForge-0.3.0-x64-portable.exe` (110,757,784 bytes), `SHA256SUMS-desktop.txt`, `SkillForge-v0.3.0-source.zip`, `SkillForge-v0.3.0-web.zip`, `SHA256SUMS.txt`.

What was not checked:

- The attestation records themselves were not opened.
- The two programs attached to the Release were not downloaded and run afterwards. The workflow's verification step ran the smoke checks on the unpacked program it had just built on the runner, not on the installer. Installing through `SkillForge-Setup-0.3.0-x64.exe` has not been exercised anywhere: the local checks used the unpacked build and the portable program.
- The hosted Demo was not redeployed.

Author: ZZZ234234234 (pyjx3141@gmail.com)

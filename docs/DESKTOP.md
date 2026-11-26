# Desktop app

SkillForge has an Electron desktop app for Windows (x64). It is **local**, not a web page: it reads the skill folders of the agents installed on this computer, writes skills into them, and refreshes when those folders change.

The desktop app is **unreleased**. It is built from this repository and has not been published on the Releases page.

## What it does

1. **Scan.** It lists the skill folders of every known agent on this computer, with the skill name, description, source folder and file count. Other folders can be added with **Add folder**.
2. **Install and sync.** A skill from the library, or from another agent's folder, can be written into any of those folders. Folders are re-read when files change, and skills that were added from disk follow the file.
3. **Library.** The rest of SkillForge (editor, inspector, generator, tests, export) works as in the browser. The library is stored in a file under the app data folder instead of `localStorage`.

## Scanned folders

Built-in locations follow each agent's official documentation. Only locations that could be verified are included.

| Agent | Folder | Also read by | Source |
| --- | --- | --- | --- |
| Claude Code | `~/.claude/skills` | Cursor, OpenCode | [code.claude.com/docs/en/skills](https://code.claude.com/docs/en/skills) |
| Cursor | `~/.cursor/skills` | — | [cursor.com/docs/context/skills](https://cursor.com/docs/context/skills) |
| Codex | `~/.agents/skills` (`$CODEX_HOME/skills` when `CODEX_HOME` is set) | GitHub Copilot, OpenCode | [developers.openai.com/codex/skills](https://developers.openai.com/codex/skills) |
| Codex (`.codex` folder) | `~/.codex/skills` | Cursor | [cursor.com/docs/context/skills](https://cursor.com/docs/context/skills) |
| GitHub Copilot | `~/.copilot/skills` | — | [docs.github.com](https://docs.github.com/en/copilot/concepts/agents/about-agent-skills) |
| OpenCode | `~/.config/opencode/skills` | — | [opencode.ai/docs/skills](https://opencode.ai/docs/skills/) |
| Doubao | `~/Doubao/skills` | — | Local runtime configuration; no public documentation |
| Doubao (built-in skills) | `%LOCALAPPDATA%\Doubao\User Data\Default\.doubao\agent_mode\workspace\.skills` | — | Folder registered by the local Doubao Agent runtime; no public documentation |
| Doubao (my skills) | `…\agent_mode\workspace\.user_skills` | — | Same |

The two Doubao Agent workspace folders are listed only when they exist on the computer.

Recognized layouts: `<name>/SKILL.md`, a root-level `<name>.md` (OpenCode), and one level of grouping (`<group>/<skill>/SKILL.md`). Symbolic links, hidden folders and `node_modules` are skipped. A folder without `SKILL.md` is listed under “folders without SKILL.md” and is not treated as a skill.

Not included because their locations were not verified: Gemini CLI, Windsurf, Kiro, Goose, Trae, Qoder, CodeBuddy and ZCode. Add those with **Add folder**. Hidden folders inside a skills folder (for example `.system` in `~/.codex/skills`) are skipped.

## How files are written

- **Install** copies the whole skill folder (scripts and references included), or writes the files generated from the library. Limits: 2000 files, 64 MB, depth 10. The target must contain a `SKILL.md`.
- **Other files are left alone.** A file that is not part of the installation is never modified or removed.
- **Existing files are replaced only after confirmation.** The old file goes to the Recycle Bin. If the Recycle Bin is unavailable it is moved to `backups/<timestamp>/` in the app data folder. Nothing is deleted permanently.
- **Uninstall** removes only the files SkillForge wrote, and moves them to the Recycle Bin.
- A skill cannot be installed into the folder it was copied from. Names must match the [Agent Skills specification](https://agentskills.io/specification): lowercase letters, digits and hyphens, at most 64 characters. Reserved names of an agent (`synced`, `anthropic-skills` for Claude Code) are refused.

## Sync model

A skill added from disk is linked to its file (recorded in `metadata.local`).

| Situation | Result |
| --- | --- |
| The file changes, the library copy was not edited | The library copy is updated, with a notice |
| Both the file and the library copy changed | Marked as a conflict; choose **Use disk version** or **Keep library version** |
| The library copy was edited | Shown as “not written back”; use **Write back** to update the file |
| The file is removed | Marked as missing; the library copy is kept |

“Changed” compares a fingerprint of the fields that `SKILL.md` can express (name, description, license, role, goals, instructions, workflow, tools, constraints, input/output formats, error handling, examples, tests). Version, tags and author live only in `skill.json` and do not count as a change.

When a `SKILL.md` does not follow SkillForge's data schema, the skill is imported in a compatibility mode: the full text is kept in the instructions and the front matter is preserved in `metadata.importedFrontmatter`. If no license is declared, the skill is set to `UNLICENSED`.

## Run and build

```bash
cd desktop
npm install
npm run build:ui     # builds the interface into desktop/dist
npm start            # starts the app from source
npm run smoke        # full run in an isolated home folder, writes desktop/smoke/
npm run dist         # installer and portable exe into desktop/release/
```

`npm run dev` starts the Vite dev server and loads it in Electron, so interface changes apply immediately. It keeps its data in `desktop/.dev-data/`.

The desktop package is separate from the web package. It has two development dependencies (`electron`, `electron-builder`) and resolves the interface's dependencies from the repository root. Set `ELECTRON_MIRROR` and `ELECTRON_BUILDER_BINARIES_MIRROR` if downloads are slow in your region.

To verify a packaged build instead of the source, point `SKILLFORGE_EXE` at the program: `SKILLFORGE_EXE=release/win-unpacked/SkillForge.exe npm run smoke`.

## Where data is stored

| Data | Location |
| --- | --- |
| Library | `%APPDATA%\SkillForge\library-skillforge-local-v1.json` |
| Added folders and installation records | `%APPDATA%\SkillForge\settings.json` |
| Copies that could not be moved to the Recycle Bin | `%APPDATA%\SkillForge\backups\` |

Files are written to a temporary file and then renamed, so an interrupted write does not leave a damaged file.

## Security model

- The page runs with `contextIsolation`, sandbox and no Node integration. It reaches the system only through a fixed list of asynchronous calls exposed by the preload script.
- The main process validates every call: the sender, the path (which must be inside a scanned folder), the skill name, reserved names, relative paths and the storage key.
- Links open in the system browser. Webviews are disabled and navigation away from the app is blocked.
- The main process reads and writes files. It does not parse `SKILL.md`; parsing happens in the page with the same code as the web version.

## Verification

| Check | Result |
| --- | --- |
| `npm test` (repository root) | 55 tests, including 6 for the sync model and 13 for the desktop core |
| `npm run smoke` from source | 28 checks passed |
| `npm run smoke` on the packaged program (`SKILLFORGE_EXE`) | 28 checks passed |
| Visual check of the scan, import, auto-refresh, install and conflict states | Done on screenshots from the smoke run |
| Read-only check against a real home folder (`--snapshot=<out.png>`) | 47 skills from 2 folders listed in about 1.4 s, no page errors |

The smoke run covers: first scan, grouped and root-level layouts, folders without `SKILL.md`, import, a file edited on disk and picked up automatically, installation into a folder that does not exist yet, confirmation before replacing an existing file, an unrelated file left untouched, installation of a library skill, uninstall, and the refusal of calls that break the rules above. CI repeats it on Windows.

## Known limitations

- Windows x64 only. No macOS or Linux build.
- The locations of the Doubao folders come from the local runtime configuration, not from public documentation, and were checked on one Windows machine.
- **Not code-signed.** Windows SmartScreen shows a warning on first run.
- Change detection uses file-system events with a short delay; a change made in the same instant as a scan is picked up on the next scan or by **Rescan**.
- Imports are never executed. Scripts inside a skill folder are copied as files.
- The AI features behave as in the browser: they call the provider you configure, and model calling was verified against a mock provider, not a paid one.

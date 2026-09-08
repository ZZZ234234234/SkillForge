# SkillForge v0.1.1

## What's New

Fix a rule-evaluation bug discovered while exercising the public Demo: text assertions could match their own definitions inside the exported Markdown. Rule checks now use only authored behavioral fields and exclude test and example text. This prevents both false passes and false failures.

## Features

Includes the v0.1.0 local-first library, editor, inspector, heuristic scoring, offline/configurable AI generator, rule/mock/optional model tester, shared-suite comparison, 18 Demo Skills, import/export and platform instruction adapters. Updates release documentation with actual GitHub provenance and desktop browser evidence.

## Installation

Download `SkillForge-v0.1.1-source.zip` from this official GitHub Release. Extract it, use Node.js 22.13+, then run `npm ci` and `npm run dev`. Open the printed URL and visit `/demo`. The `web.zip` is a Cloudflare Worker/assets bundle, not a desktop installer. Hosted Demo: https://skillforge.honey-chick-7267.chatgpt.site/demo

## Verification / SHA256

Download `SHA256SUMS.txt` alongside both ZIP files. Linux: `sha256sum -c SHA256SUMS.txt`. macOS: `shasum -a 256 -c SHA256SUMS.txt`. Windows: `certutil -hashfile "SkillForge-v0.1.1-source.zip" SHA256`, then compare its output to the checksum file.

The release workflow generates provenance for both ZIP files before publishing. Verify the file you downloaded with `gh attestation verify SkillForge-v0.1.1-source.zip --repo ZZZ234234234/SkillForge`. Provenance does not imply a security audit.

## Known Limitations

No real agent tool execution, desktop installer, filesystem watching or CLI. SDK/MCP bundles are experimental instruction exports. Rule checks inspect instructions, not task behavior; scores and model judgments are fallible. Browser-based model calls require provider CORS support and were not tested with paid credentials. ZIP generation/import round-trip is automated-tested; browser download completion and phone/iPad visual checks remain unverified. Export browser data regularly for backup.

## Author

Created and maintained independently by 爱吃孜然芥末. Contact: 2014546082@qq.com.

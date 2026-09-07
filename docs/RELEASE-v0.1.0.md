# SkillForge v0.1.0

Release candidate prepared on 2026-09-07. A GitHub Release is not confirmed until the release workflow completes.

## What's New

A local-first workspace to build, inspect and test AI Agent Skills, with an 18-entry labeled demo registry, form/Markdown/JSON editing and portable export packages.

## Features

- Searchable library, favorites, tags, categories, versions and browser-local installation.
- Explainable inspector, nine-dimensional heuristic scoring and secret redaction.
- Offline template generation and a configurable real model request path.
- Rule/mock/optional LLM evaluations and multiple skills on one shared test suite.
- Bounded local ZIP/folder/Markdown/JSON import and public GitHub file URL import.
- Codex/Claude/Generic export and experimental SDK/MCP instruction bundles.
- Chinese/English interface and dark/light mode.

## Installation

Download `SkillForge-v0.1.0-source.zip` from the verified official repository Releases, extract it, then run `npm ci` and `npm run dev` with Node.js 22.13+. The development console prints the local address. Visit `/demo` without a key. The `web.zip` is a generated worker/assets bundle, not a Windows installer.

## Verification / SHA256

Use the attached `SHA256SUMS.txt`: Linux `sha256sum -c SHA256SUMS.txt`, macOS `shasum -a 256 -c SHA256SUMS.txt`, or Windows `certutil -hashfile "SkillForge-v0.1.0-source.zip" SHA256` and compare manually.

The release workflow is configured to generate GitHub attestations before publishing. Verify availability on the actual successful workflow; then run `gh attestation verify SkillForge-v0.1.0-source.zip --repo ZZZ234234234/SkillForge`. Configuration alone does not prove that an attestation exists.

## Known Limitations

No real agent tools or sandbox, direct local folder management, desktop app or CLI. Community trending lacks a real source and is Coming Soon. Rule evaluation tests instruction contracts, not task outcomes. Scores and model judgments are fallible. SDK/MCP bundles are experimental. Real-provider calls and browser visual QA remain unverified in the creation environment. Provider CORS support is required. Basic Markdown preview does not implement every Markdown extension. Browser storage is unencrypted; export backups.

## Author

Created and maintained independently by 爱吃孜然芥末. Contact: 2014546082@qq.com.

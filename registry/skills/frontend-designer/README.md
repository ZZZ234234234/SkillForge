# Frontend Designer

Design responsive interfaces with usable states and accessible interactions.

- Author: 爱吃孜然芥末
- Version: 1.0.0
- License: MIT
- Compatibility targets: Codex, Claude Code, Generic

## Usage

Read SKILL.md before use. Review tool permissions in skill.json. No tools are executed by SkillForge.

## Inputs
Task description plus relevant source text, files, and constraints.

## Outputs
Markdown with Summary, Evidence, Findings, Verification and Limitations.

## Testing

Import skill.json into SkillForge and run Rule Evaluation. Rule checks inspect instructions, not real agent execution. Tests are in tests/cases.json.

## Security

Review every imported skill. Never embed credentials. Platform support depends on the receiving agent.

# Agent Governance — Maker-Checker for AI Agent Permissions

**Live replay (animated bank ops floor):** https://eshwarpotturi.github.io/agent-governance-maker-checker/

Governing what AI agents may do across a bank's systems — the "entitlements for agents" problem — shown as a top-down operations floor you can watch.

**Maker-checker:** AI proposes, Compliance approves, code enforces, and every incident makes the rules stronger.

- **The Gate** — a deterministic entitlement check on every agent action (plain code, no LLM, fails closed).
- **Governance agent (checker)** — handles exceptions only: grants narrow, masked, time-boxed access; isolates an agent that exceeds its mandate; drafts rule changes. Never widens rules without human sign-off.
- **Control assurance (auditor)** — stress-tests the rules each round; gaps found become new rules, re-tested, approved by Compliance.

## The replayed run (trade operations, synthetic data, GPT-4.1-mini)
3 working agents (Reconciliation, Settlement, Reporting), 6 systems, one Gate.

| Scene | What happens |
|---|---|
| 0 | Governance drafts a least-privilege rulebook; Compliance approves v1 |
| 1 | Recon raises the genuine reconciliation breaks; every move allowed |
| 2 | Recon is denied client personal data, requests it, and gets a masked, 60-minute badge |
| 3 | A hijacked Recon tries to amend the books; every attempt denied; agent isolated |
| 4 | Arms race, 3 rounds: auditor finds a new gap each round (personal-data over-grant → tolerance tampering → borrowed access via another agent); Governance fixes each; Compliance approves v2, v3, v4; every re-test holds |

Result: books altered by agents = 0, 3 control gaps found and closed, 0 gaps left open, 1 isolation, 4 rulebook versions.

## Files
- `index.html` — the animated replay (open it, press Play)
- `core.js` — bank, tools, deterministic gateway, masking, delegation logic
- `run.js` — the agent loop, governance checker, auditor, and the scenes
- `data.js` — the recorded event log this page replays

## Limits
Synthetic data, fictional clients, 3 agents and 6 systems. It demonstrates the method, not coverage of a real 160+ system estate. Control-assurance agents add to human penetration testing; they do not replace it.

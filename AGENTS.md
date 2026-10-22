# Agent instructions

## Source of truth for game rules
- The only rules source is the official Sangue e Aço rulebook: https://fnandesrafael.github.io/sangue-e-aco/ (source: https://github.com/fnandesrafael/sangue-e-aco). The co-author, Rafa, owns the rules.
- Never use summaries, transcriptions, notes or AI-generated docs as a rules source, and never add such files to this repo. Read the rulebook page itself.
- If the rulebook does not define a rule (for example initiative, combat, monster attacks or criticals), stop and ask. Do not invent it.
- Files under `docs/` describe the current implementation. They are not requirements.

## Scope
- Implement only the requested item. Ideas go into the PR description as proposals, not into code.
- Do not remove or change existing behavior unless the request asks for it.
- One requested item per PR.

## UI text
- Use the rulebook's terms verbatim (for example Pontos de Sangue, Nível de Personagem).
- UI text is pt-BR. Never show raw keys or English identifiers to players.

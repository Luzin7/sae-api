# Table: Roster, Character Sheet, Height/Weight and Roll Permissions

Frontend handoff. English prose, pt-BR strings quoted verbatim. Backend is the source of truth for every rule below.

## 1. Scope and summary

| Item | Backend change | Frontend action | Breaking |
| --- | --- | --- | --- |
| Roster | `session.state` / `presence` and `GET /games/:id/players` separate `master` from `players`, and players carry `characterIds[]` | Render master as its own card, open sheets by `characterId`, consume the pushed `presence` frame; refetch on reconnect | Yes — shape changed |
| Sheet | New `GET /characters/:id/sheet` returning character + items + skills in one payload; `GET /characters/:id/skills` gains `skillName` and `attribute` | Use the single sheet call, stop chaining three requests | No — additive |
| Height / weight | Create accepts exactly one source per field; explicit ranges enforced; partial update stays partial | Never submit without one source per field; map the 400 field prefix back to the input | Yes — validation tightened |
| Roll permissions | Server enforces test/turn rules; master always allowed | Remove free-roll; gate test and turn roll buttons by declared test / combatant | Yes — previously allowed rolls now fail |

Out of scope for this document: anything not listed above.

## 2. Roster

### 2.1 WebSocket

`session.state` and `presence` send the same roster shape:

```json
{
  "master": { "playerId": "uuid", "name": "Mestre" },
  "players": [
    { "playerId": "uuid", "name": "Ana", "characterIds": ["uuid-old", "uuid-new"] }
  ]
}
```

- `master` is `null` when the master is not connected.
- `players` never contains the master.
- `characterIds` is ordered oldest-first, contains every character that player owns in the game, and is `[]` when the player owns none.

`session.player-joined` and `session.player-left` carry:

```json
{ "player": { "playerId": "uuid", "name": "Ana", "characterIds": ["uuid-old"] } }
```

A master joining or leaving emits neither event.

### 2.2 REST

`GET /games/:id/players`:

```json
{
  "master": { "id": "uuid", "name": "Mestre" },
  "players": [ { "id": "uuid", "name": "Ana", "characterIds": ["uuid-old"] } ]
}
```

- DB-based: the master is listed even when offline.
- `players` excludes the master.
- Requires game membership; the master is allowed.

### 2.3 UI rules

- Render the master as a separate card, never as a player card, and never open a character sheet for the master.
- Open a sheet with a `characterId` from `characterIds`, never with `playerId`.
- If a player has more than one character id, let the user choose or default to the first (oldest) entry.
- The backend pushes `{ "type": "presence", "master": ..., "players": [...] }` to the active session room after any character create, update or delete.
- The push is best-effort: if no active session exists or the push fails, no frame is sent. Refetch `GET /games/:id/players` on reconnect or when a frame is missed.
- No presence frame is sent by the HP, PE, item or skill endpoints. An NP change goes through `PATCH /characters/:id`, so it may emit a `presence` frame; the payload's `characterIds` are unchanged (see the vitals section below).

## 3. Character sheet

### 3.1 Endpoint

`GET /characters/:id/sheet` → `200`:

```json
{
  "character": { "...": "same shape as GET /characters/:id -> character" },
  "items": [ { "...": "existing character item shape" } ],
  "skills": [
    {
      "id": "uuid",
      "characterId": "uuid",
      "skillId": "uuid",
      "proficiencyBonus": 0,
      "skillName": "Furtividade",
      "attribute": "motricity"
    }
  ]
}
```

`attribute` is one of `cognition | psyche | instinct | constitution | motricity | perception`.

### 3.1.1 Advancement balance (`advancement`)

Read responses carry a derived `advancement` object: `GET /characters/mine`, `GET /characters/game/:gameId`, `GET /characters/:id` and `GET /characters/:id/sheet` (inside `character`). Write responses (`POST`, `PATCH`) do not include it; refetch to update it. Nothing is stored: unspent points are the budget for the character's NP minus what the sheet already spends.

```json
"advancement": {
  "attributePoints": { "budget": 22, "spent": 20, "remaining": 2 },
  "skillPoints": {
    "cognition": { "budget": 20, "spent": 10, "remaining": 10 },
    "psyche": { "budget": 4, "spent": 0, "remaining": 4 },
    "instinct": { "budget": 4, "spent": 0, "remaining": 4 },
    "constitution": { "budget": 4, "spent": 0, "remaining": 4 },
    "motricity": { "budget": 4, "spent": 0, "remaining": 4 },
    "perception": { "budget": 4, "spent": 0, "remaining": 4 }
  }
}
```

- `attributePoints.budget` is the attribute budget for the NP; `spent` is the sum of the attribute costs.
- `skillPoints.<attribute>.budget` is the proficiency pool of that attribute (level pool x tiers earned at the NP); `spent` is the sum of `proficiencyBonus` of the skills of that attribute.
- `remaining = budget - spent`; leveling is add-only, so it is never negative for a valid sheet.

### 3.2 Access and status

- The `GET /characters/:id/sheet` endpoint itself is read-only. Access is allowed for the character owner **or** the master of that character's game; write access is defined in the matrix below.
- `401` unauthenticated, `403` authenticated but neither owner nor master, `404` unknown character.
- Read access is not a blanket write grant. The allowed writes are:

| Actor | Allowed writes |
| --- | --- |
| Master | Read any sheet in their game; `PATCH /characters/:id` (general fields and NP); `PATCH /characters/:id/hp`; `PATCH /characters/:id/pe`; `character.hp-change` / `character.pe-change` over WS. |
| Player | Own character's general fields, items and skills (never HP or PE: only the Mestre changes them, `403` otherwise); delete their own character. Cannot change NP (`403`, `Apenas o mestre pode alterar o NP.`). |

- Master write access is still owner-only for adding, updating and deleting items, upserting skills and deleting a player's character.
- The master read widening below does not extend any write beyond the table above.

The master can also read `GET /characters/:id`, `GET /characters/:id/items`, `GET /characters/:id/skills` and `GET /characters/:id/sheet` for characters in their game.

`GET /characters/:id/skills` is additive: it now returns the same objects with `skillName` and `attribute`.

### 3.3 Fetching and updates

- Use the single sheet call when opening a sheet. Do not chain three calls.
- Refetch after mutations.
- The backend pushes `character.hp-changed` (`{ "characterId": "uuid", "oldHp": 10, "newHp": 7 }`) when HP changes through REST or the WS force path.
- `character.pe-changed` (`{ "characterId": "uuid", "oldPe": 5, "newPe": 8 }`) is pushed whenever PE changes: `character.pe-change` frame, `PATCH /characters/:id/pe`, or per-turn recovery. See section 3.5 (PE) and 3.6 (PS).
- `character.np-changed` (`{ "characterId": "uuid", "oldNp": 3, "newNp": 4 }`) is pushed to the game room after `PATCH /characters/:id` changes NP (Mestre only). Nothing is pushed when NP is unchanged or the save fails (including a `409` version conflict). Refetch the sheet on receipt: `maxHp`, `bExp` and the attribute and skill pools change with NP. Best-effort: no active session, no frame.
- Lowering NP below what is already spent answers `400 VALIDATION` (never `409`) with a message naming each item, e.g. `Não dá para descer: Perícias de Cognição usam 14 de 10. Pontos de Atributo usam 22 de 20.`; nothing is written.
- Items and skills are not pushed; refetch after those mutations.

### 3.4 Legacy data

Legacy rows may still have `character.heightCm`, `character.weightKg` and `character.size` as `null`. Render them gracefully (placeholder, omit the line, never crash or print `null`).

### 3.5 Pontos de Esforco (PE)

Rules (rulebook, Cap. 2): PE starts at 0 and rises. Limite de Esforco = 20 + proficiency bonus in Condicionamento (`maxEffort`). Exausto means `currentEffort >= maxEffort`; clients compute it, the server never stores it.

- Gain: effort is capped at the limit and each excess point removes 1 PS (floor 0).
- Recovery (negative delta): effort - r, floor 0, PS untouched.
- Limit lowered below the current value (skill change): current PE and PS are clamped to the new limit, with no PS loss.

Changing PE:

- WS `{ "type": "character.pe-change", "sessionId": "uuid", "characterId": "uuid", "delta": 3 }`. `delta` is an integer, `delta != 0`, `|delta| <= 100`. Mestre only; anyone else, including the character's owner, gets `FORBIDDEN`, a character outside the session's game gets `NOT_FOUND`.
- REST `PATCH /characters/:id/pe` body `{ "delta": 3 }` (same bounds, Mestre only; the owner gets `403`), answers `{ "character": ... }` with the new `currentEffort` / `currentHp` and a bumped `version`. The old body `{ "currentEffort": n }` is rejected with `400`.
- After commit the server broadcasts `character.pe-changed` and, only when PS moved, `character.hp-changed`. Nothing is broadcast when neither value moved. The WS path writes `pe_change` (and `hp_change`) session log rows; the REST path has no session context and writes none.
- Master only: `{ "type": "master.monster-pe-change", "sessionId": "uuid", "monsterId": "uuid", "delta": -2 }` (`monsterId` is the bestiary id, as in `master.monster-hp-change`). Same rule on the combat instance's PE and PS; the server broadcasts `session.combat`.

Per-turn recovery: on every successful `master.next-turn`, each combatant with PE > 0 except the one whose turn starts now loses 1 PE (characters and monster instances). The server broadcasts one `character.pe-changed` per recovered character and then `session.combat` (instance PE inside `entries`). A stale or duplicate `master.next-turn` frame recovers nothing. Recovery writes no log row of its own; the `combat_state` row carries the monster PE.

Monsters: bestiary entries only have `maxEffort`. Combat instances (`master.start-combat`, `master.add-monster`) start at `currentEffort = 0`. `currentEffort` was removed from the bestiary create/update bodies and from the monster response. There is no frame that sets a monster's `currentEffort` or `currentHp` to an absolute value; see PS below.

When a Vitalidade or Condicionamento skill is saved, `maxHp` / `maxEffort` are recomputed in the same transaction and current values clamped; refetch the sheet after a skill change.

### 3.6 Pontos de Sangue (PS) are deltas

No client sends an absolute PS. Every PS change is a signed delta applied atomically on the server (row lock): `PS = clamp(current + delta, 0, maxHp)`.

- WS `{ "type": "character.hp-change", "sessionId": "uuid", "characterId": "uuid", "delta": -4 }`. `delta` is an integer, `delta != 0`, `|delta| <= 1000`. Mestre only (`FORBIDDEN` for anyone else, including the character's owner; `NOT_FOUND` for a character outside the session's game). Writes an `hp_change` log row (actual delta after clamping), bumps `version`, then broadcasts `character.hp-changed` only if PS moved.
- REST `PATCH /characters/:id/hp` body `{ "delta": 5 }` (same bounds, Mestre only; the owner gets `403`), answers `{ "character": ... }`, bumps `version`, pushes `character.hp-changed` if PS moved, writes no session log. The old body `{ "currentHp": n }` is rejected with `400`.
- WS (Mestre only) `{ "type": "master.monster-hp-change", "sessionId": "uuid", "monsterId": "uuid", "delta": -3 }`: locks the combatant row, clamps PS to 0..`maxHp` of the instance, broadcasts `session.combat`.
- WS (Mestre only) `{ "type": "master.monster-afflictions-update", "sessionId": "uuid", "monsterId": "uuid", "afflictions": ["fobia", "vicio"] }`: `afflictions` is the full list (replaces the current one; `[]` clears it) and every key must be a known affliction key, otherwise the frame is rejected with a validation error. It locks the combatant row, writes a `combat_state` log row and broadcasts `session.combat`.
- `master.monster-attack` applies its `damage` through the same locked write (`delta = -damage`) and now also writes an `hp_change` log row.

Removed (an absolute PS is never accepted): WS frames `character.hp-update`, `master.force-hp-update`, `master.monster-vitals-update` (its `afflictions` moved to `master.monster-afflictions-update`), and the outbound event `session.monster-vitals`. The REST `/hp` field `currentHp` is gone.

## 4. Height and weight (create / update)

### 4.1 Sources

`POST /characters` must send exactly one source per field:

- height: `heightCm` XOR `heightRoll` (`'min' | 'max'`)
- weight: `weightKg` XOR `weightRoll`

Explicit ranges: `heightCm` 150–250, `weightKg` 50–150 (`weightKg` must be whole kg). Roll-resolved values may fall outside those ranges by design and are valid: height 140–149 / 251–270, weight 40–49 / 151–170.

`PATCH /characters/:id` stays partial: updating only `nickname` is valid. If a height or weight source is sent, still send only one per field.

### 4.2 Validation errors

HTTP 400 envelope:

```json
{ "error": { "code": "VALIDATION", "message": "Dados inválidos: heightCm: Informe a altura ou deixe para o destino.; weightKg: Informe o peso ou deixe para o destino." } }
```

| Case | Field path | Message |
| --- | --- | --- |
| Missing height | `heightCm` | Informe a altura ou deixe para o destino. |
| Missing weight | `weightKg` | Informe o peso ou deixe para o destino. |
| Both height sources | `heightCm` | Escolha a altura ou deixe para o destino, não os dois. |
| Both weight sources | `weightKg` | Escolha o peso ou deixe para o destino, não os dois. |
| Height out of range | `heightCm` | Altura deve estar entre 150 e 250 cm. |
| Weight out of range | `weightKg` | Peso deve estar entre 50 e 150 kg. |
| Weight not whole kg | `weightKg` | Peso deve ser um número inteiro. |

The message is `Dados inválidos: <field>: <message>; <field>: <message>...`, so split it by `;` and take the prefix before the first `:` of each segment.

UI rule: never submit the form without one source per field; offer manual value or roll, and map the 400 prefix back to the corresponding field.

## 5. Roll permissions

### 5.1 Matrix

| Actor | Allowed when |
| --- | --- |
| Master | Always: any character, test or not, any turn. |
| Player | Test roll: `testId` sent, the declared test is `open` **or** `targetCharacterId` equals their character, the test is not closed, and that character has not already rolled that `testId`. |
| Player | Turn roll: no `testId`, combat is active, and the current combatant is their character (`entries[turnIndex].kind === 'character'` and `entries[turnIndex].refId === characterId`). |

`dice.roll` frame fields: `sessionId`, `characterId`, `skillId` (all required) and `testId` (optional; send it for test rolls, omit it for turn rolls). The rolled `skillId` may differ from the test's skill; the roll is still judged against the test's `cd`: `success` is `total >= cd`, so a total equal to the `cd` is a success.

Dice count is `|attribute|` d20 (an attribute of 0 rolls one die): positive keeps the best, negative keeps the worst.

### 5.2 Detecting test, turn and initiative

`session.test-declared` payload, shown to every socket in the session:

```json
{ "testId": "uuid", "skillId": "uuid", "grade": 3, "cd": 15, "mode": "open", "targetCharacterId": "uuid", "targetName": "Ana" }
```

`grade` is the difficulty grade (1..10) and `cd` is derived by the server from it; `grade` is absent on tests declared before this change. `mode` is `'open' | 'targeted'`; `targetCharacterId` and `targetName` are nullable.

Combat state arrives in `session.combat` (`active`, `turnIndex`, `round`, `entries[]`). `entries[turnIndex]` identifies the current combatant.

#### Initiative

When combat is active, a player rolls initiative for their own character with the `combat.roll-initiative` frame; the master rolls for any character and for every monster (monster rolls are master-only).

```json
{ "type": "combat.roll-initiative", "sessionId": "uuid", "kind": "character", "refId": "uuid" }
```

- `kind` is `'character' | 'monster'`; `refId` is the character id or the monster id.
- A player rolling another player's character, or a monster, gets `403 FORBIDDEN`; combat must be active, otherwise `404 NOT_FOUND`.
- A second initiative roll for the same combatant is a no-op: the server returns the current state unchanged.
- The master cannot advance the turn until every combatant has rolled initiative (`400 VALIDATION`, `A ordem de iniciativa só pode avançar quando todos rolaram.`).
- `hasRolled` on a combat entry means initiative was rolled, not that the turn action was used. Keep the turn action visible when `hasRolled` is true.

`master.declare-test` frame (master only): `{ "type": "master.declare-test", "sessionId", "skillId", "grade", "mode", "targetCharacterId" }`. There is no `cd` field.

`dice.rolled` carries `characterId` (always), plus `declaredSkillId` and `grade` when a test applied.

#### Closing a test and state on join

`master.close-test` frame (master only): `{ "type": "master.close-test", "sessionId": "uuid", "testId": "uuid" }`. The server persists a `test_closed` event and broadcasts `session.test-closed` to the whole room:

```json
{ "type": "session.test-closed", "testId": "uuid" }
```

Closing an already closed test is a silent no-op (no event). Two simultaneous close requests may both pass the check and write two `test_closed` rows, broadcasting `session.test-closed` twice; the web ignores the repeat. An unknown `testId` returns `404 NOT_FOUND` (`Teste não encontrado.`). Once closed, nobody can roll that test, the master included.

On `session.join` the joining socket receives, in order: `chat.history`, `session.test-snapshot`, and `session.combat` (only when a combat exists). Both snapshots go only to the joining socket.

```json
{
  "type": "session.test-snapshot",
  "test": {
    "testId": "uuid", "skillId": "uuid", "grade": 3, "cd": 15, "mode": "open",
    "targetCharacterId": null, "targetName": null,
    "rolledCharacterIds": ["uuid"]
  }
}
```

- `test` is `null` when the latest declared test is closed or no test was declared.
- `rolledCharacterIds` lists the characters that already rolled that test; disable the roll button for those.
- `session.combat` keeps the same shape described above.

### 5.3 Errors

WS frame: `{ "type": "error", "error": { "code", "message" } }`.

| Code | Message | When |
| --- | --- | --- |
| 403 `FORBIDDEN` | Este teste não é para seu personagem. | Test targeted at someone else. |
| 403 `FORBIDDEN` | Nenhum teste ou turno ativo para rolar. | No test and combat inactive. |
| 403 `FORBIDDEN` | Não é seu turno. | Combat active, another combatant's turn. |
| 400 `VALIDATION` | Grau de dificuldade inválido. | `master.declare-test` with a `grade` outside 1..10. |
| 409 `CONFLICT` | Você já rolou este teste. | Duplicate roll for the same `testId` by the same character (checked per character, not per player). |
| 409 `CONFLICT` | Este teste já foi encerrado. | Roll on a closed test; applies to the master too. |

### 5.4 UI rules

- Remove any free-roll button.
- Show a test roll only when the declared test is open or targets the player's character.
- Show a turn roll only when it is the player's turn.
- Show the initiative roll control when combat is active and the player's character has not rolled initiative yet; hide it when that entry's `hasRolled` is already true.
- Master always sees roll controls.
- Disable the test roll after a successful roll.

## 6. Frontend checklist

1. Update the roster model to `{ master, players[] }`, with `master` nullable.
2. Render the master in a separate card and never open a sheet for the master.
3. Open sheets by `characterId`; choose or default to the first id when there are several.
4. Consume the pushed `presence` frame; refetch `GET /games/:id/players` on reconnect.
5. Replace the three sheet requests with `GET /characters/:id/sheet`.
6. Handle `401` / `403` / `404` on the sheet endpoint; keep mutation checks separate from read access.
7. Send PS and PE changes as deltas (`character.hp-change`, `character.pe-change`, REST `{ delta }`); update HP from `character.hp-changed` and PE from `character.pe-changed`; refetch after item and skill changes.
8. The master can change HP, PE and NP; the player cannot change NP.
9. Render `null` legacy `heightCm`, `weightKg` and `size` gracefully.
10. Enforce exactly one source per height field and one per weight field in create and update forms.
11. Map the 400 issue prefix back to the field and show the returned message.
12. Remove the free-roll button.
13. Gate test and turn rolls using `session.test-declared` and `entries[turnIndex]`; keep the turn action visible when `hasRolled` is true.
14. Gate the initiative roll control on combat active and the player's combatant `hasRolled === false`; hide it once rolled.
15. Disable the test roll after success and show the 400/403/409 messages from the error frame.

## 7. Open risks

- **Multiple characters per player:** `characterIds` can hold several ids; choose or default to the oldest, and keep the choice consistent.
- **Legacy nulls:** `heightCm`, `weightKg` and `size` may be `null`; do not assume numeric values.
- **Roster push is best-effort:** no frame is sent when no active session exists or when the push fails; refetch `GET /games/:id/players` on reconnect.
- **Master read widening and write scope:** the master can read sheets of characters in their game and can write general fields, NP, HP and PE; items, skills and deleting a player's character remain owner-only.
- **PE push is best-effort over REST:** `character.pe-changed` from `PATCH /characters/:id/pe` goes through the game-session notifier (no active session, no frame); refetch on reconnect.
- **HP and PE pushed:** `character.hp-changed` and `character.pe-changed` are pushed character events; handle them independently of sheet refetches.

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

### 3.2 Access and status

- The `GET /characters/:id/sheet` endpoint itself is read-only. Access is allowed for the character owner **or** the master of that character's game; write access is defined in the matrix below.
- `401` unauthenticated, `403` authenticated but neither owner nor master, `404` unknown character.
- Read access is not a blanket write grant. The allowed writes are:

| Actor | Allowed writes |
| --- | --- |
| Master | Read any sheet in their game; `PATCH /characters/:id` (general fields and NP); `PATCH /characters/:id/hp`; `PATCH /characters/:id/pe`; `master.force-hp-update` over WS. |
| Player | Own character's general fields, HP, PE, items and skills; delete their own character. Cannot change NP (`403`, `Apenas o mestre pode alterar o NP.`). |

- Master write access is still owner-only for adding, updating and deleting items, upserting skills and deleting a player's character.
- The master read widening below does not extend any write beyond the table above.

The master can also read `GET /characters/:id`, `GET /characters/:id/items`, `GET /characters/:id/skills` and `GET /characters/:id/sheet` for characters in their game.

`GET /characters/:id/skills` is additive: it now returns the same objects with `skillName` and `attribute`.

### 3.3 Fetching and updates

- Use the single sheet call when opening a sheet. Do not chain three calls.
- Refetch after mutations.
- The backend pushes `character.hp-changed` (`{ "characterId": "uuid", "oldHp": 10, "newHp": 7 }`) when HP changes through REST or the WS force path.
- `character.pe-changed` is intentionally **not** emitted for now (PE rules will change); the client must refetch the sheet after a PE change.
- Items and skills are not pushed; refetch after those mutations.

### 3.4 Legacy data

Legacy rows may still have `character.heightCm`, `character.weightKg` and `character.size` as `null`. Render them gracefully (placeholder, omit the line, never crash or print `null`).

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
{ "error": { "code": "VALIDATION", "message": "Dados inválidos: heightCm: Informe a altura ou escolha rolar.; weightKg: Informe o peso ou escolha rolar." } }
```

| Case | Field path | Message |
| --- | --- | --- |
| Missing height | `heightCm` | Informe a altura ou escolha rolar. |
| Missing weight | `weightKg` | Informe o peso ou escolha rolar. |
| Both height sources | `heightCm` | Informe a altura ou a rolagem, não as duas. |
| Both weight sources | `weightKg` | Informe o peso ou a rolagem, não as duas. |
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

`dice.roll` frame fields: `sessionId`, `characterId`, `skillId` (all required) and `testId` (optional; send it for test rolls, omit it for turn rolls). The rolled `skillId` may differ from the test's skill; the roll is still judged against the test's `cd`.

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
7. Update HP from `character.hp-changed`; refetch after PE, item and skill changes.
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
- **PE not pushed:** `character.pe-changed` is in the schema but deliberately never emitted for now because PE rules will change; refetch instead.
- **HP pushed:** `character.hp-changed` is the only pushed character event; handle it independently of sheet refetches.

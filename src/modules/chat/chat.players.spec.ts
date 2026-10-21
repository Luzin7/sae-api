import { describe, expect, it, vi } from 'vitest';
import { resolvePlayerPresence, resolvePresence } from './chat.players.js';
import { directoryCharacter, makePlayerDirectory } from './chat.testkit.js';

describe('resolvePresence', () => {
  it('splits the master out of players and joins character ids', async () => {
    const directory = makePlayerDirectory(
      { master: 'Mestre', p1: 'Ana', p2: 'Bia' },
      [directoryCharacter('p1', 'char-1')],
    );

    const presence = await resolvePresence(
      directory,
      'game-1',
      ['master', 'p1', 'p2'],
      'master',
    );

    expect(presence).toEqual({
      master: { playerId: 'master', name: 'Mestre' },
      players: [
        { playerId: 'p1', name: 'Ana', characterIds: ['char-1'] },
        { playerId: 'p2', name: 'Bia', characterIds: [] },
      ],
    });
    expect(vi.mocked(directory.findCharactersByGame)).toHaveBeenCalledTimes(1);
  });

  it('keeps every character of the same player, oldest first', async () => {
    const directory = makePlayerDirectory({ p1: 'Ana' }, [
      directoryCharacter('p1', 'char-new', '2024-03-01T00:00:00.000Z'),
      directoryCharacter('p1', 'char-old', '2024-01-01T00:00:00.000Z'),
      directoryCharacter('p1', 'char-mid', '2024-02-01T00:00:00.000Z'),
    ]);

    const presence = await resolvePresence(
      directory,
      'game-1',
      ['p1'],
      'master',
    );

    expect(presence.players).toEqual([
      {
        playerId: 'p1',
        name: 'Ana',
        characterIds: ['char-old', 'char-mid', 'char-new'],
      },
    ]);
  });

  it('breaks a creation tie by character id', async () => {
    const directory = makePlayerDirectory({ p1: 'Ana' }, [
      directoryCharacter('p1', 'char-b'),
      directoryCharacter('p1', 'char-a'),
      directoryCharacter('p1', 'char-c'),
    ]);

    const presence = await resolvePresence(
      directory,
      'game-1',
      ['p1'],
      'master',
    );

    expect(presence.players[0]?.characterIds).toEqual([
      'char-a',
      'char-b',
      'char-c',
    ]);
  });

  it('drops unknown ids and reports an offline master as null', async () => {
    const directory = makePlayerDirectory({ p1: 'Ana' });

    const presence = await resolvePresence(
      directory,
      'game-1',
      ['ghost', 'p1'],
      'master',
    );

    expect(presence).toEqual({
      master: null,
      players: [{ playerId: 'p1', name: 'Ana', characterIds: [] }],
    });
  });
});

describe('resolvePlayerPresence', () => {
  it('returns the character links for one player', async () => {
    const directory = makePlayerDirectory({ p1: 'Ana' }, [
      directoryCharacter('p1', 'char-1'),
    ]);

    await expect(
      resolvePlayerPresence(directory, 'game-1', 'p1'),
    ).resolves.toEqual({
      playerId: 'p1',
      name: 'Ana',
      characterIds: ['char-1'],
    });
  });

  it('returns null for an unknown player', async () => {
    const directory = makePlayerDirectory();

    await expect(
      resolvePlayerPresence(directory, 'game-1', 'ghost'),
    ).resolves.toBeNull();
  });
});

import { createHash, randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { Database } from '@infra/db/index.js';
import {
  authSessionRepository,
  credentialsRepository,
} from '@infra/db/repositories/auth.repository.js';
import { characterAccessRepository } from '@infra/db/repositories/character-access.repository.js';
import { characterRepository } from '@infra/db/repositories/character.repository.js';
import { chatMessageRepository } from '@infra/db/repositories/chat-message.repository.js';
import { combatRepository } from '@infra/db/repositories/combat.repository.js';
import { combatantSourceRepository } from '@infra/db/repositories/combatant-source.repository.js';
import { gameAccessRepository } from '@infra/db/repositories/game-access.repository.js';
import { gameRepository } from '@infra/db/repositories/game.repository.js';
import { monsterRepository } from '@infra/db/repositories/monster.repository.js';
import { playerDirectoryRepository } from '@infra/db/repositories/player-directory.repository.js';
import { playerRepository } from '@infra/db/repositories/player.repository.js';
import { sessionRepository } from '@infra/db/repositories/session.repository.js';
import { skillCatalogRepository } from '@infra/db/repositories/skill-catalog.repository.js';
import type {
  TokenPayload,
  WsTokenPayload,
} from '@modules/auth/auth.entity.js';
import type { AuthServices } from '@modules/auth/auth.routes.js';
import type { MonsterRepository } from '@modules/bestiary/bestiary.repository.js';
import type { BestiaryServices } from '@modules/bestiary/bestiary.routes.js';
import { CreateMonsterService } from '@modules/bestiary/create-monster/create-monster.service.js';
import { DeleteMonsterService } from '@modules/bestiary/delete-monster/delete-monster.service.js';
import { MonsterQueryService } from '@modules/bestiary/monster-query.service.js';
import { UpdateMonsterService } from '@modules/bestiary/update-monster/update-monster.service.js';
import { CharacterQueryService } from '@modules/character/character-query.service.js';
import { AddMonsterService } from '@modules/chat/add-monster/add-monster.service.js';
import { InMemoryMessageBus } from '@modules/chat/chat.bus.js';
import type { CharacterAccess } from '@modules/chat/character-access.contract.js';
import type { ChatServices } from '@modules/chat/chat.gateway.js';
import type { CombatantSource } from '@modules/chat/combatant-source.contract.js';
import type { CombatRepository } from '@modules/chat/combat.repository.js';
import type { ChatMessageRepository } from '@modules/chat/chat.repository.js';
import { CloseTestService } from '@modules/chat/close-test/close-test.service.js';
import { ConnectService } from '@modules/chat/connect/connect.service.js';
import { DeclareTestService } from '@modules/chat/declare-test/declare-test.service.js';
import { EndCombatService } from '@modules/chat/end-combat/end-combat.service.js';
import { GameSessionNotifierService } from '@modules/chat/game-session-notifier/game-session-notifier.service.js';
import { LeaveService } from '@modules/chat/leave/leave.service.js';
import { MasterBroadcastService } from '@modules/chat/master-broadcast/master-broadcast.service.js';
import { MonsterAttackService } from '@modules/chat/monster-attack/monster-attack.service.js';
import { NextTurnService } from '@modules/chat/next-turn/next-turn.service.js';
import type { PlayerDirectory } from '@shared/player-directory/player-directory.contract.js';
import type { SkillCatalog } from '@modules/rules/skill-catalog.contract.js';
import { RollDiceService } from '@modules/chat/roll-dice/roll-dice.service.js';
import { RollInitiativeService } from '@modules/chat/roll-initiative/roll-initiative.service.js';
import { RollMonsterTestService } from '@modules/chat/roll-monster-test/roll-monster-test.service.js';
import { SendMessageService } from '@modules/chat/send-message/send-message.service.js';
import { StartCombatService } from '@modules/chat/start-combat/start-combat.service.js';
import { SetMonsterAfflictionsService } from '@modules/chat/set-monster-afflictions/set-monster-afflictions.service.js';
import { ChangeHpService } from '@modules/chat/change-hp/change-hp.service.js';
import { ChangeMonsterHpService } from '@modules/chat/change-monster-hp/change-monster-hp.service.js';
import { ChangeEffortService } from '@modules/chat/change-effort/change-effort.service.js';
import { ChangeMonsterEffortService } from '@modules/chat/change-monster-effort/change-monster-effort.service.js';
import type { CharacterRepository } from '@modules/character/character.repository.js';
import type { CharacterServices } from '@modules/character/character.routes.js';
import { AdvanceCharacterService } from '@modules/character/advance-character/advance-character.service.js';
import { CreateCharacterService } from '@modules/character/create-character/create-character.service.js';
import { DeleteCharacterService } from '@modules/character/delete-character/delete-character.service.js';
import { GetCharacterService } from '@modules/character/get-character/get-character.service.js';
import { GetSheetService } from '@modules/character/get-sheet/get-sheet.service.js';
import { AddItemService } from '@modules/character/items/add-item/add-item.service.js';
import { DeleteItemService } from '@modules/character/items/delete-item/delete-item.service.js';
import { UpdateItemService } from '@modules/character/items/update-item/update-item.service.js';
import { MemoizedSkillDirectory } from '@modules/character/preview-character/memoized-skill-directory.js';
import { PreviewCharacterService } from '@modules/character/preview-character/preview-character.service.js';
import { UpdateCharacterService } from '@modules/character/update-character/update-character.service.js';
import { ChangeHpService as ChangeCharacterHpService } from '@modules/character/change-hp/change-hp.service.js';
import { ChangeEffortService as ChangeCharacterEffortService } from '@modules/character/change-effort/change-effort.service.js';
import { CreateGameService } from '@modules/game/create-game/create-game.service.js';
import { DeleteGameService } from '@modules/game/delete-game/delete-game.service.js';
import { GameQueryService } from '@modules/game/game-query.service.js';
import type { GameRepository } from '@modules/game/game.repository.js';
import type { GameServices } from '@modules/game/game.routes.js';
import { JoinGameService } from '@modules/game/join-game/join-game.service.js';
import { LeaveGameService } from '@modules/game/leave-game/leave-game.service.js';
import { UpdateGameService } from '@modules/game/update-game/update-game.service.js';
import type {
  AuthSessionRepository,
  CredentialsRepository,
} from '@modules/auth/auth.repository.js';
import { LoginService } from '@modules/auth/login/login.service.js';
import { LogoutService } from '@modules/auth/logout/logout.service.js';
import { RefreshService } from '@modules/auth/refresh/refresh.service.js';
import { RegisterService } from '@modules/auth/register/register.service.js';
import { WsTokenService } from '@modules/auth/ws-token/ws-token.service.js';
import { EndSessionService } from '@modules/session/end-session/end-session.service.js';
import type { GameAccess } from '@shared/game-access/game-access.contract.js';
import { GetActiveService } from '@modules/session/get-active/get-active.service.js';
import { ListLogsService } from '@modules/session/list-logs/list-logs.service.js';
import type { SessionRepository } from '@modules/session/session.repository.js';
import type { SessionServices } from '@modules/session/session.routes.js';
import { StartSessionService } from '@modules/session/start-session/start-session.service.js';
import { GetMeService } from '@modules/player/get-me/get-me.service.js';
import { GetPlayerService } from '@modules/player/get-player/get-player.service.js';
import type { PlayerRepository } from '@modules/player/player.repository.js';
import type { PlayerServices } from '@modules/player/player.routes.js';
import { UpdateMeService } from '@modules/player/update-me/update-me.service.js';
import { systemRng } from '@shared/dice/random.js';
import { systemClock } from '@shared/time/clock.js';
import { hash, verify } from './lib/hash.js';
import { generateInviteCode } from './lib/invite-code.js';

export interface Container {
  repositories: {
    players: PlayerRepository;
    authCredentials: CredentialsRepository;
    authSessions: AuthSessionRepository;
    sessions: SessionRepository;
    games: GameRepository;
    gameAccess: GameAccess;
    characters: CharacterRepository;
    chatMessages: ChatMessageRepository;
    characterAccess: CharacterAccess;
    playerDirectory: PlayerDirectory;
    skillCatalog: SkillCatalog;
    monsters: MonsterRepository;
    combat: CombatRepository;
    combatants: CombatantSource;
  };
  services: {
    player: PlayerServices;
    auth: AuthServices;
    session: SessionServices;
    game: GameServices;
    character: CharacterServices;
    bestiary: BestiaryServices;
    chat: ChatServices;
  };
  bus: InMemoryMessageBus;
  verifyWsToken(token: string): string | null;
}

export function buildContainer(deps: {
  db: Database;
  app: FastifyInstance;
}): Container {
  const players = playerRepository();
  const authCredentials = credentialsRepository();
  const authSessions = authSessionRepository();
  const sessions = sessionRepository();
  const games = gameRepository();
  const gameAccess = gameAccessRepository();
  const characters = characterRepository();
  const chatMessages = chatMessageRepository();
  const characterAccess = characterAccessRepository();
  const playerDirectory = playerDirectoryRepository();
  const skillCatalog = skillCatalogRepository();
  const monsters = monsterRepository();
  const combat = combatRepository();
  const combatants = combatantSourceRepository();

  const bus = new InMemoryMessageBus();
  const sessionNotifier = new GameSessionNotifierService(
    sessions,
    gameAccess,
    playerDirectory,
    bus,
    combat,
    deps.app.log,
  );

  const signing = {
    sign(
      payload: TokenPayload | WsTokenPayload,
      options?: { expiresIn?: string | number },
    ): string {
      return deps.app.jwt.sign(payload, options);
    },
  };

  const passwords = { hash, verify };

  const refreshTokens = {
    generate(): string {
      return randomBytes(32).toString('hex');
    },
    hash(token: string): string {
      return createHash('sha256').update(token).digest('hex');
    },
  };

  const verifyWsToken = (token: string): string | null => {
    try {
      const payload = deps.app.jwt.verify<{
        sub?: unknown;
        scope?: unknown;
      }>(token);
      if (payload.scope !== 'ws') return null;
      if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
        return null;
      }

      return payload.sub;
    } catch {
      return null;
    }
  };

  return {
    repositories: {
      players,
      authCredentials,
      authSessions,
      sessions,
      games,
      gameAccess,
      characters,
      chatMessages,
      characterAccess,
      playerDirectory,
      skillCatalog,
      monsters,
      combat,
      combatants,
    },
    services: {
      player: {
        getMe: new GetMeService(players),
        getPlayer: new GetPlayerService(players),
        updateMe: new UpdateMeService(players),
      },
      auth: {
        register: new RegisterService(
          authCredentials,
          authSessions,
          signing,
          passwords,
          refreshTokens,
        ),
        login: new LoginService(
          authCredentials,
          authSessions,
          signing,
          passwords,
          refreshTokens,
        ),
        refresh: new RefreshService(authSessions, signing, refreshTokens),
        logout: new LogoutService(authSessions),
        wsToken: new WsTokenService(signing),
      },
      session: {
        startSession: new StartSessionService(sessions, gameAccess),
        endSession: new EndSessionService(sessions, gameAccess),
        getActive: new GetActiveService(sessions, gameAccess),
        listLogs: new ListLogsService(sessions, gameAccess),
      },
      game: {
        createGame: new CreateGameService(games, {
          generate: generateInviteCode,
        }),
        joinGame: new JoinGameService(games),
        updateGame: new UpdateGameService(games),
        deleteGame: new DeleteGameService(games),
        leaveGame: new LeaveGameService(games),
        query: new GameQueryService(games, playerDirectory),
      },
      character: {
        createCharacter: new CreateCharacterService(
          characters,
          gameAccess,
          systemRng,
          sessionNotifier,
        ),
        previewCharacter: new PreviewCharacterService(
          new MemoizedSkillDirectory(() => skillCatalog.list()),
        ),
        getCharacter: new GetCharacterService(characters, gameAccess),
        getSheet: new GetSheetService(characters, gameAccess),
        updateCharacter: new UpdateCharacterService(
          characters,
          gameAccess,
          systemRng,
          sessionNotifier,
        ),
        advanceCharacter: new AdvanceCharacterService(
          characters,
          sessionNotifier,
        ),
        deleteCharacter: new DeleteCharacterService(
          characters,
          gameAccess,
          sessionNotifier,
        ),
        changeHp: new ChangeCharacterHpService(
          characters,
          gameAccess,
          sessionNotifier,
        ),
        changeEffort: new ChangeCharacterEffortService(
          characters,
          gameAccess,
          sessionNotifier,
        ),
        addItem: new AddItemService(characters),
        updateItem: new UpdateItemService(characters),
        deleteItem: new DeleteItemService(characters),
        query: new CharacterQueryService(characters, gameAccess),
      },
      bestiary: {
        createMonster: new CreateMonsterService(monsters, gameAccess),
        updateMonster: new UpdateMonsterService(monsters, gameAccess),
        deleteMonster: new DeleteMonsterService(monsters, gameAccess),
        query: new MonsterQueryService(monsters, gameAccess),
      },
      chat: {
        connect: new ConnectService(
          chatMessages,
          gameAccess,
          playerDirectory,
          bus,
          combat,
        ),
        sendMessage: new SendMessageService(chatMessages, gameAccess, bus),
        rollDice: new RollDiceService(
          chatMessages,
          gameAccess,
          characterAccess,
          playerDirectory,
          bus,
          systemRng,
          combat,
        ),
        changeHp: new ChangeHpService(
          chatMessages,
          gameAccess,
          characterAccess,
          bus,
        ),
        changeEffort: new ChangeEffortService(
          chatMessages,
          gameAccess,
          characterAccess,
          bus,
        ),
        changeMonsterEffort: new ChangeMonsterEffortService(
          chatMessages,
          gameAccess,
          combat,
          bus,
        ),
        masterBroadcast: new MasterBroadcastService(
          chatMessages,
          gameAccess,
          playerDirectory,
          bus,
          systemClock,
        ),
        leave: new LeaveService(chatMessages, gameAccess, playerDirectory, bus),
        startCombat: new StartCombatService(
          chatMessages,
          gameAccess,
          combatants,
          combat,
          bus,
          systemRng,
        ),
        rollInitiative: new RollInitiativeService(
          chatMessages,
          gameAccess,
          combatants,
          combat,
          bus,
          systemRng,
        ),
        nextTurn: new NextTurnService(chatMessages, gameAccess, combat, bus),
        endCombat: new EndCombatService(chatMessages, gameAccess, combat, bus),
        declareTest: new DeclareTestService(
          chatMessages,
          gameAccess,
          combatants,
          bus,
        ),
        closeTest: new CloseTestService(chatMessages, gameAccess, bus),
        rollMonsterTest: new RollMonsterTestService(
          chatMessages,
          gameAccess,
          combat,
          bus,
          systemRng,
        ),
        setMonsterAfflictions: new SetMonsterAfflictionsService(
          chatMessages,
          gameAccess,
          combat,
          bus,
        ),
        changeMonsterHp: new ChangeMonsterHpService(
          chatMessages,
          gameAccess,
          combat,
          bus,
        ),
        monsterAttack: new MonsterAttackService(
          chatMessages,
          gameAccess,
          characterAccess,
          combat,
          bus,
          systemRng,
        ),
        addMonster: new AddMonsterService(
          chatMessages,
          gameAccess,
          combatants,
          combat,
          bus,
        ),
      },
    },
    bus,
    verifyWsToken,
  };
}

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
import { gameAccessRepository } from '@infra/db/repositories/game-access.repository.js';
import { gameRepository } from '@infra/db/repositories/game.repository.js';
import { playerDirectoryRepository } from '@infra/db/repositories/player-directory.repository.js';
import { playerRepository } from '@infra/db/repositories/player.repository.js';
import { sessionRepository } from '@infra/db/repositories/session.repository.js';
import { skillCatalogRepository } from '@infra/db/repositories/skill-catalog.repository.js';
import type {
  TokenPayload,
  WsTokenPayload,
} from '@modules/auth/auth.entity.js';
import type { AuthServices } from '@modules/auth/auth.routes.js';
import { CharacterQueryService } from '@modules/character/character-query.service.js';
import { InMemoryMessageBus } from '@modules/chat/chat.bus.js';
import type { CharacterAccess } from '@modules/chat/character-access.contract.js';
import type { ChatServices } from '@modules/chat/chat.gateway.js';
import type { ChatMessageRepository } from '@modules/chat/chat.repository.js';
import { ConnectService } from '@modules/chat/connect/connect.service.js';
import { ForceHpService } from '@modules/chat/force-hp/force-hp.service.js';
import { LeaveService } from '@modules/chat/leave/leave.service.js';
import { MasterBroadcastService } from '@modules/chat/master-broadcast/master-broadcast.service.js';
import type { PlayerDirectory } from '@modules/chat/player-directory.contract.js';
import type { SkillCatalog } from '@modules/rules/skill-catalog.contract.js';
import { RollDiceService } from '@modules/chat/roll-dice/roll-dice.service.js';
import { SendMessageService } from '@modules/chat/send-message/send-message.service.js';
import { SetInitiativeService } from '@modules/chat/set-initiative/set-initiative.service.js';
import { UpdateHpService } from '@modules/chat/update-hp/update-hp.service.js';
import type { CharacterRepository } from '@modules/character/character.repository.js';
import type { CharacterServices } from '@modules/character/character.routes.js';
import { CreateCharacterService } from '@modules/character/create-character/create-character.service.js';
import { DeleteCharacterService } from '@modules/character/delete-character/delete-character.service.js';
import { GetCharacterService } from '@modules/character/get-character/get-character.service.js';
import { AddItemService } from '@modules/character/items/add-item/add-item.service.js';
import { DeleteItemService } from '@modules/character/items/delete-item/delete-item.service.js';
import { UpdateItemService } from '@modules/character/items/update-item/update-item.service.js';
import { UpsertSkillService } from '@modules/character/skills/upsert-skill/upsert-skill.service.js';
import { UpdateCharacterService } from '@modules/character/update-character/update-character.service.js';
import { UpdateVitalsService } from '@modules/character/update-vitals/update-vitals.service.js';
import { CreateGameService } from '@modules/game/create-game/create-game.service.js';
import { DeleteGameService } from '@modules/game/delete-game/delete-game.service.js';
import type { DiceServices } from '@modules/dice/dice.routes.js';
import { RollService } from '@modules/dice/roll/roll.service.js';
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
  };
  services: {
    player: PlayerServices;
    auth: AuthServices;
    session: SessionServices;
    game: GameServices;
    dice: DiceServices;
    character: CharacterServices;
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

  const bus = new InMemoryMessageBus();

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
        query: new GameQueryService(games),
      },
      dice: {
        roll: new RollService(systemRng),
      },
      character: {
        createCharacter: new CreateCharacterService(
          characters,
          gameAccess,
          systemRng,
        ),
        getCharacter: new GetCharacterService(characters),
        updateCharacter: new UpdateCharacterService(characters, systemRng),
        deleteCharacter: new DeleteCharacterService(characters),
        updateVitals: new UpdateVitalsService(characters),
        addItem: new AddItemService(characters),
        updateItem: new UpdateItemService(characters),
        deleteItem: new DeleteItemService(characters),
        upsertSkill: new UpsertSkillService(characters),
        query: new CharacterQueryService(characters, gameAccess),
      },
      chat: {
        connect: new ConnectService(
          chatMessages,
          gameAccess,
          playerDirectory,
          bus,
        ),
        sendMessage: new SendMessageService(chatMessages, gameAccess, bus),
        rollDice: new RollDiceService(
          chatMessages,
          gameAccess,
          characterAccess,
          playerDirectory,
          bus,
          systemRng,
        ),
        updateHp: new UpdateHpService(
          chatMessages,
          gameAccess,
          characterAccess,
          bus,
        ),
        forceHp: new ForceHpService(
          chatMessages,
          gameAccess,
          characterAccess,
          bus,
        ),
        masterBroadcast: new MasterBroadcastService(
          chatMessages,
          gameAccess,
          playerDirectory,
          bus,
          systemClock,
        ),
        setInitiative: new SetInitiativeService(chatMessages, gameAccess, bus),
        leave: new LeaveService(chatMessages, playerDirectory, bus),
      },
    },
    bus,
    verifyWsToken,
  };
}

import type { RealtimeEvent } from './chat.entity.js';

export type ChatSink = (event: RealtimeEvent) => void;

interface Connection {
  playerId: string;
  sink: ChatSink;
}

/**
 * Single concrete implementation (locked decision: single instance, no Redis).
 * The one instance is created in `container.ts` and injected into the gateway
 * and publishing services — never a module-level socket map.
 */
export class InMemoryMessageBus {
  private readonly rooms = new Map<string, Set<string>>();
  private readonly connections = new Map<string, Connection>();

  register(socketId: string, playerId: string, sink: ChatSink): void {
    this.connections.set(socketId, { playerId, sink });
  }

  unregister(socketId: string): void {
    this.connections.delete(socketId);
    for (const members of this.rooms.values()) members.delete(socketId);
  }

  join(room: string, socketId: string): void {
    const members = this.rooms.get(room) ?? new Set<string>();
    members.add(socketId);
    this.rooms.set(room, members);
  }

  leave(room: string, socketId: string): void {
    this.rooms.get(room)?.delete(socketId);
  }

  publish(room: string, event: RealtimeEvent): void {
    const members = this.rooms.get(room);
    if (!members) return;

    for (const socketId of members) {
      const connection = this.connections.get(socketId);
      if (connection) connection.sink(event);
    }
  }

  presence(room: string): string[] {
    const members = this.rooms.get(room);
    if (!members) return [];

    const players = new Set<string>();
    for (const socketId of members) {
      const connection = this.connections.get(socketId);
      if (connection) players.add(connection.playerId);
    }

    return [...players];
  }
}

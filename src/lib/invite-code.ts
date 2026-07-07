import { nanoid } from 'nanoid';

export function generateInviteCode(): string {
  return nanoid(10).toUpperCase();
}

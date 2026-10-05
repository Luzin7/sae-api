import { compare, hash as bcryptHash } from 'bcryptjs';

const SALT_ROUNDS = 12;

export function hash(password: string): Promise<string> {
  return bcryptHash(password, SALT_ROUNDS);
}

export function verify(password: string, hashed: string): Promise<boolean> {
  return compare(password, hashed);
}

export const hashPassword = hash;
export const verifyPassword = verify;

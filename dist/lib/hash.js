import { hash, compare } from 'bcryptjs';
const SALT_ROUNDS = 12;
export async function hashPassword(password) {
    return hash(password, SALT_ROUNDS);
}
export async function verifyPassword(password, hashedPassword) {
    return compare(password, hashedPassword);
}
//# sourceMappingURL=hash.js.map
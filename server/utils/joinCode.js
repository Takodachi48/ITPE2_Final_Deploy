// server/utils/joinCode.js
import crypto from 'node:crypto';

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateJoinCode(length = 8) {
  let code = '';
  for (let i = 0; i < length; i++) {
    const index = crypto.randomInt(0, ALPHABET.length);
    code += ALPHABET[index];
  }
  return code;
}
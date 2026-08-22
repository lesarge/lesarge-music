import { randomUUID } from 'crypto';

// UUID generation helper
export function generateUUID(): string {
  return randomUUID();
}

import { nanoid } from 'nanoid';

// https://nodejs.org/api/crypto.html#cryptorandomuuidoptions
export default function randomUUID({ disableEntropyCache = false } = {}) {
  return nanoid();
}

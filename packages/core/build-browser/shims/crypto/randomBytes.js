import randombytes from 'randombytes';

// https://nodejs.org/api/crypto.html#cryptorandombytessize-callback
export default function randomBytes(size, callback) {
  randombytes(size, callback);
}

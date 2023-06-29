// Copy-pasted from the source code of an unmaintained package:
// https://github.com/browserify/randombytes/blob/master/browser.js
//
// Fixed `Uncaught ReferenceError: global is not defined`.
// https://github.com/browserify/randombytes/issues/33
//
// Replaced `safe-buffer` with `buffer`.

// eslint-disable-next-line unicorn/prefer-node-protocol
import Buffer from 'buffer';

// limit of Crypto.getRandomValues()
// https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues
const MAX_BYTES = 65_536;

// Node supports requesting up to this number of bytes
// https://github.com/nodejs/node/blob/master/lib/internal/crypto/random.js#L48
const MAX_UINT32 = 4_294_967_295;

// eslint-disable-next-line no-undef
const crypto = typeof window === 'undefined' ? null : window.crypto;

// https://nodejs.org/api/crypto.html#cryptorandombytessize-callback
export default function randomBytes_(size, callback) {
  if (!crypto || !crypto.getRandomValues) {
    throw new Error('Secure random number generation is not supported by this browser.\nUse Chrome, Firefox or Internet Explorer 11');
  }

  return randomBytes(size, callback);
}

function randomBytes(size, cb) {
  // phantomjs needs to throw
  if (size > MAX_UINT32) {
    throw new RangeError('requested too many random bytes');
  }

  const bytes = Buffer.allocUnsafe(size);

  if (size > 0) { // getRandomValues fails on IE if size == 0
    if (size > MAX_BYTES) { // this is the max bytes crypto.getRandomValues
      // can do at once see https://developer.mozilla.org/en-US/docs/Web/API/window.crypto.getRandomValues
      for (let generated = 0; generated < size; generated += MAX_BYTES) {
        // buffer.slice automatically checks if the end is past the end of
        // the buffer so we don't have to here
        crypto.getRandomValues(bytes.slice(generated, generated + MAX_BYTES));
      }
    } else {
      crypto.getRandomValues(bytes);
    }
  }

  if (typeof cb === 'function') {
    return process.nextTick(() => {
      cb(null, bytes);
    });
  }

  return bytes;
}

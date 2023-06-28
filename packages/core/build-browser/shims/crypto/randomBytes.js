// RollupError: "default" is not exported by "../../node_modules/randombytes/browser.js", imported by "build-browser/shims/crypto/randomBytes.js".
// import randombytes from 'randombytes';
const randombytes = require('randombytes');

// https://nodejs.org/api/crypto.html#cryptorandombytessize-callback
export default function randomBytes(size, callback) {
  randombytes(size, callback);
}

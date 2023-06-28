// https://nodejs.org/api/util.html#utilpromisifyoriginal
// https://procodings.ru/dev-ru/polifill-dlya-promisify/
export default function promisify(func) {
  return function promisifiedFunc(...args) {
    const self = this;

    return new Promise((resolve, reject) => {
      // Node.js's `util.promisify()` supports only one `result` argument on a callback.
      // https://stackoverflow.com/questions/54039289/nodejs-util-promisify-where-the-callback-function-has-multiple-arguments
      // So there's no requirement to handle multiple `result` arguments.
      func.apply(self, args.concat((error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }));
    });
  };
}

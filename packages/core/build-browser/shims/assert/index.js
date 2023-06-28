// https://www.geeksforgeeks.org/node-js-assert-function/
export default function assert(variable, message) {
  if (!variable) {
    throw new Error(message || `An expression evaluated to a falsy value (${variable})`);
  }
}

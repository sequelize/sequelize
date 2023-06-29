export default function inspect(variable) {
  // eslint-disable-next-line no-console
  console.log(variable);
}

inspect.custom = Symbol.for('nodejs.util.inspect.custom');

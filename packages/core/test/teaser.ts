const DIALECT = process.env.DIALECT;

if (!DIALECT) {
  throw new Error('Environment variable DIALECT is undefined');
}

const header = '#'.repeat(DIALECT.length + 22);
const message = `${header}\n# Running tests for ${DIALECT} #\n${header}`;

console.info(message);

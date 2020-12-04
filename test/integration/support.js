'use strict';

// Store local references to `setTimeout` and `clearTimeout` asap, so that we can use them within `p-timeout`,
// avoiding to be affected unintentionally by `sinon.useFakeTimers()` called by the tests themselves.
const { setTimeout, clearTimeout } = global;

const pTimeout = require('p-timeout');
const Support = require('../support');

const CLEANUP_TIMEOUT = Number.parseInt(process.env.SEQ_TEST_CLEANUP_TIMEOUT, 10) || 10000;

let runningQueries = new Set();

before(function() {
  this.sequelize.addHook('beforeQuery', (options, query) => {
    runningQueries.add(query);
  });
  this.sequelize.addHook('afterQuery', (options, query) => {
    runningQueries.delete(query);
  });
});

beforeEach(async function() {
  await Support.clearDatabase(this.sequelize);
});

afterEach(async function() {
  // Note: recall that throwing an error from a `beforeEach` or `afterEach` hook in Mocha causes the entire test suite to abort.

  let runningQueriesProblem;

  if (runningQueries.size > 0) {
    runningQueriesProblem = `Expected 0 queries running after this test, but there are still ${
      runningQueries.size
    } queries running in the database (or, at least, the \`afterQuery\` Sequelize hook did not fire for them):\n\n${
      // prettier-ignore
      [...runningQueries].map(query => `       ${query.uuid}: ${query.sql}`).join('\n')
    }`;
  }

  runningQueries = new Set();

  try {
    await pTimeout(
      Support.clearDatabase(this.sequelize),
      CLEANUP_TIMEOUT,
      `Could not clear database after this test in less than ${CLEANUP_TIMEOUT}ms. This test crashed the DB, and testing cannot continue. Aborting.`,
      { customTimers: { setTimeout, clearTimeout } }
    );
  } catch (error) {
    let message = error.message;
    if (runningQueriesProblem) {
      message += `\n\n     Also, ${runningQueriesProblem}`;
    }
    message += `\n\n     Full test name:\n       ${this.currentTest.fullTitle()}`;

    // Throw, aborting the entire Mocha execution
    throw new Error(message);
  }

  if (runningQueriesProblem) {
    if (this.test.ctx.currentTest.state === 'passed') {
      // `this.test.error` is an obscure Mocha API that allows failing a test from the `afterEach` hook
      // This is better than throwing because throwing would cause the entire Mocha execution to abort
      this.test.error(new Error(`This test passed, but ${runningQueriesProblem}`));
    } else {
      console.log(`     ${runningQueriesProblem}`);
    }
  }
});

module.exports = Support;

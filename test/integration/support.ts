import assert from 'node:assert';
import { QueryTypes } from '@sequelize/core';
import type { AbstractQuery } from '@sequelize/core/_non-semver-use-at-your-own-risk_/dialects/abstract/query.js';
import pTimeout from 'p-timeout';
import * as Support from '../support';

// Mocha still relies on 'this' https://github.com/mochajs/mocha/issues/2657
/* eslint-disable @typescript-eslint/no-invalid-this */

// Store local references to `setTimeout` and `clearTimeout` asap, so that we can use them within `p-timeout`,
// avoiding to be affected unintentionally by `sinon.useFakeTimers()` called by the tests themselves.

const { setTimeout, clearTimeout } = global;
const CLEANUP_TIMEOUT = Number.parseInt(process.env.SEQ_TEST_CLEANUP_TIMEOUT ?? '', 10) || 10_000;

let runningQueries = new Set<AbstractQuery>();

before(async () => {
  // Sometimes the SYSTOOLSPACE tablespace is not available when running tests on DB2. This creates it.
  if (Support.getTestDialect() === 'db2') {
    const res = await Support.sequelize.query<{ TBSPACE: string }>(`SELECT TBSPACE FROM SYSCAT.TABLESPACES WHERE TBSPACE = 'SYSTOOLSPACE'`, {
      type: QueryTypes.SELECT,
    });

    const tableExists = res[0]?.TBSPACE === 'SYSTOOLSPACE';

    if (!tableExists) {
      // needed by dropSchema function
      await Support.sequelize.query(`
        CREATE TABLESPACE SYSTOOLSPACE IN IBMCATGROUP
        MANAGED BY AUTOMATIC STORAGE USING STOGROUP IBMSTOGROUP
        EXTENTSIZE 4;
      `);

      await Support.sequelize.query(`
        CREATE USER TEMPORARY TABLESPACE SYSTOOLSTMPSPACE IN IBMCATGROUP
        MANAGED BY AUTOMATIC STORAGE USING STOGROUP IBMSTOGROUP
        EXTENTSIZE 4
      `);
    }
  }

  Support.sequelize.addHook('beforeQuery', (options, query) => {
    runningQueries.add(query);
  });
  Support.sequelize.addHook('afterQuery', (options, query) => {
    runningQueries.delete(query);
  });
});

let databaseResetDisabled = false;
export function disableDatabaseResetForSuite() {
  before(async () => {
    databaseResetDisabled = true;
    // Reset the DB a single time for the whole suite
    await Support.clearDatabase(Support.sequelize);
  });

  after(() => {
    databaseResetDisabled = false;
  });
}

beforeEach(async () => {
  if (databaseResetDisabled) {
    return;
  }

  await Support.clearDatabase(Support.sequelize);
});

afterEach(async function checkRunningQueries() {
  // Note: recall that throwing an error from a `beforeEach` or `afterEach` hook in Mocha causes the entire test suite to abort.
  if (databaseResetDisabled) {
    return;
  }

  let runningQueriesProblem;

  if (runningQueries.size > 0) {
    runningQueriesProblem = `Expected 0 queries running after this test, but there are still ${
      runningQueries.size
    } queries running in the database (or, at least, the \`afterQuery\` Sequelize hook did not fire for them):\n\n${
      [...runningQueries].map((query: AbstractQuery) => `       ${query.uuid}: ${query.sql}`).join('\n')
    }`;
  }

  runningQueries = new Set();

  try {
    await pTimeout(
      Support.clearDatabase(Support.sequelize),
      CLEANUP_TIMEOUT,
      `Could not clear database after this test in less than ${CLEANUP_TIMEOUT}ms. This test crashed the DB, and testing cannot continue. Aborting.`,
      { customTimers: { setTimeout, clearTimeout } },
    );
  } catch (error) {
    assert(error instanceof Error, 'A non-Error error was thrown');

    let message = error.message;
    if (runningQueriesProblem) {
      message += `\n\n     Also, ${runningQueriesProblem}`;
    }

    message += `\n\n     Full test name:\n       ${this.currentTest!.fullTitle()}`;

    // Throw, aborting the entire Mocha execution
    throw new Error(message);
  }

  if (runningQueriesProblem) {
    if (this.test!.ctx!.currentTest!.state === 'passed') {
      // `this.test.error` is an obscure Mocha API that allows failing a test from the `afterEach` hook
      // This is better than throwing because throwing would cause the entire Mocha execution to abort
      // @ts-expect-error -- it is not declared in mocha's typings
      this.test!.error(new Error(`This test passed, but ${runningQueriesProblem}`));
    } else {
      console.error(`     ${runningQueriesProblem}`);
    }
  }
});

export * from '../support';

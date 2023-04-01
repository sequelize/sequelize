import pTimeout from 'p-timeout';
import type { Sequelize } from '@sequelize/core';
import { QueryTypes } from '@sequelize/core';
import type { AbstractQuery } from '@sequelize/core/_non-semver-use-at-your-own-risk_/dialects/abstract/query.js';
import { getTestDialect, sequelize } from '../support';

// Store local references to `setTimeout` and `clearTimeout` asap, so that we can use them within `p-timeout`,
// avoiding to be affected unintentionally by `sinon.useFakeTimers()` called by the tests themselves.

const { setTimeout, clearTimeout } = global;
const CLEANUP_TIMEOUT = Number.parseInt(process.env.SEQ_TEST_CLEANUP_TIMEOUT ?? '', 10) || 10_000;

const runningQueries = new Set<AbstractQuery>();

before(async () => {
  // Sometimes the SYSTOOLSPACE tablespace is not available when running tests on DB2. This creates it.
  if (getTestDialect() === 'db2') {
    const res = await sequelize.query<{ TBSPACE: string }>(`SELECT TBSPACE FROM SYSCAT.TABLESPACES WHERE TBSPACE = 'SYSTOOLSPACE'`, {
      type: QueryTypes.SELECT,
    });

    const tableExists = res[0]?.TBSPACE === 'SYSTOOLSPACE';

    if (!tableExists) {
      // needed by dropSchema function
      await sequelize.query(`
        CREATE TABLESPACE SYSTOOLSPACE IN IBMCATGROUP
        MANAGED BY AUTOMATIC STORAGE USING STOGROUP IBMSTOGROUP
        EXTENTSIZE 4;
      `);

      await sequelize.query(`
        CREATE USER TEMPORARY TABLESPACE SYSTOOLSTMPSPACE IN IBMCATGROUP
        MANAGED BY AUTOMATIC STORAGE USING STOGROUP IBMSTOGROUP
        EXTENTSIZE 4
      `);
    }
  }

  sequelize.hooks.addListener('beforeQuery', (options, query) => {
    runningQueries.add(query);
  });
  sequelize.hooks.addListener('afterQuery', (options, query) => {
    runningQueries.delete(query);
  });
});

type ResetMode = 'none' | 'truncate' | 'destroy' | 'drop';
let currentSuiteResetMode: ResetMode = 'drop';

// TODO: make "none" the default.
/**
 * Controls how the current test suite will reset the database between each test.
 * Note that this does not affect how the database is reset between each suite, only between each test.
 *
 * @param mode The reset mode to use:
 * - `drop`: All tables will be dropped and recreated (default).
 * - `none`: The database will not be reset at all.
 * - `truncate`: All tables will be truncated, but not dropped.
 * - `destroy`: All rows of all tables will be deleted using DELETE FROM, and identity columns will be reset.
 */
export function setResetMode(mode: ResetMode) {
  let previousMode: ResetMode | undefined;
  before(async () => {
    previousMode = currentSuiteResetMode;
    currentSuiteResetMode = mode;

    // Reset the DB a single time for the whole suite
    await clearDatabase();
  });

  after(() => {
    currentSuiteResetMode = previousMode ?? 'drop';
  });
}

beforeEach(async () => {
  switch (currentSuiteResetMode) {
    case 'drop':
      await clearDatabase();
      break;

    case 'truncate':
      await sequelize.truncate({ restartIdentity: true });
      break;

    case 'destroy':
      await sequelize.destroyAll({ cascade: true });
      break;

    case 'none':
    default:
      break;
  }
});

async function clearDatabaseInternal(customSequelize: Sequelize) {
  const qi = customSequelize.getQueryInterface();
  await qi.dropAllTables();
  customSequelize.modelManager.models = [];
  customSequelize.models = {};

  if (qi.dropAllEnums) {
    await qi.dropAllEnums();
  }

  await dropTestSchemas(customSequelize);
}

export async function clearDatabase(customSequelize: Sequelize = sequelize) {
  await pTimeout(
    clearDatabaseInternal(customSequelize),
    CLEANUP_TIMEOUT,
    `Could not clear database after this test in less than ${CLEANUP_TIMEOUT}ms. This test crashed the DB, and testing cannot continue. Aborting.`,
    { customTimers: { setTimeout, clearTimeout } },
  );
}

afterEach(() => {
  if (runningQueries.size > 0) {
    throw new Error(`Expected 0 queries running after this test, but there are still ${
      runningQueries.size
    } queries running in the database (or, at least, the \`afterQuery\` Sequelize hook did not fire for them):\n\n${
      [...runningQueries].map((query: AbstractQuery) => `       ${query.uuid}: ${query.sql}`).join('\n')
    }`);
  }
});

export async function dropTestSchemas(customSequelize: Sequelize = sequelize) {
  if (!customSequelize.dialect.supports.schemas) {
    await customSequelize.drop({});

    return;
  }

  const schemas = await customSequelize.showAllSchemas();
  const schemasPromise = [];
  for (const schema of schemas) {
    // @ts-expect-error -- TODO: type return value of "showAllSchemas"
    const schemaName = schema.name ? schema.name : schema;
    if (schemaName !== customSequelize.config.database) {
      const promise = customSequelize.dropSchema(schemaName);

      if (getTestDialect() === 'db2') {
        // https://github.com/sequelize/sequelize/pull/14453#issuecomment-1155581572
        // DB2 can sometimes deadlock / timeout when deleting more than one schema at the same time.
        // eslint-disable-next-line no-await-in-loop
        await promise;
      } else {
        schemasPromise.push(promise);
      }
    }
  }

  await Promise.all(schemasPromise);
}

export * from '../support';

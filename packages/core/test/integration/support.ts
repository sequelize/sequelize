import type { Options } from '@sequelize/core';
import { QueryTypes, Sequelize } from '@sequelize/core';
import type { AbstractQuery } from '@sequelize/core/_non-semver-use-at-your-own-risk_/dialects/abstract/query.js';
import uniq from 'lodash/uniq';
import fs from 'node:fs';
import pTimeout from 'p-timeout';
import {
  createSequelizeInstance,
  getSqliteDatabasePath,
  getTestDialect,
  rand,
  resetSequelizeInstance,
  sequelize,
} from '../support';

// Store local references to `setTimeout` and `clearTimeout` asap, so that we can use them within `p-timeout`,
// avoiding to be affected unintentionally by `sinon.useFakeTimers()` called by the tests themselves.

const { setTimeout, clearTimeout } = global;
const CLEANUP_TIMEOUT = Number.parseInt(process.env.SEQ_TEST_CLEANUP_TIMEOUT ?? '', 10) || 10_000;

const runningQueries = new Set<AbstractQuery>();

before(async () => {
  // Sometimes the SYSTOOLSPACE tablespace is not available when running tests on DB2. This creates it.
  if (getTestDialect() === 'db2') {
    const res = await sequelize.query<{ TBSPACE: string }>(
      `SELECT TBSPACE FROM SYSCAT.TABLESPACES WHERE TBSPACE = 'SYSTOOLSPACE'`,
      {
        type: QueryTypes.SELECT,
      },
    );

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

/** used to run reset on all used sequelize instances for a given suite */
const allSequelizeInstances = new Set<Sequelize>();
Sequelize.hooks.addListener('afterInit', sequelizeInstance => {
  allSequelizeInstances.add(sequelizeInstance);
});

const singleTestInstances = new Set<Sequelize>();

/**
 * Creates a sequelize instance that will be disposed of after the current test.
 * Can only be used within a test. For before/after hooks, use {@link createSequelizeInstance}.
 *
 * @param options
 */
export function createSingleTestSequelizeInstance(options: Options = {}): Sequelize {
  const instance = createSequelizeInstance(options);
  destroySequelizeAfterTest(instance);

  return instance;
}

export function destroySequelizeAfterTest(sequelizeInstance: Sequelize): void {
  singleTestInstances.add(sequelizeInstance);
}

/**
 * Creates a Sequelize instance to use in transaction-related tests.
 * You must dispose of this instance manually.
 *
 * If you're creating the instance within a test, consider using {@link createSingleTransactionalTestSequelizeInstance}.
 *
 * @param sequelizeOrOptions
 */
export async function createMultiTransactionalTestSequelizeInstance(
  sequelizeOrOptions: Sequelize | Options,
): Promise<Sequelize> {
  const sequelizeOptions =
    sequelizeOrOptions instanceof Sequelize ? sequelizeOrOptions.options : sequelizeOrOptions;
  const dialect = getTestDialect();

  if (dialect === 'sqlite') {
    const p = getSqliteDatabasePath(`transactional-${rand()}.sqlite`);
    if (fs.existsSync(p)) {
      fs.unlinkSync(p);
    }

    const options = { ...sequelizeOptions, storage: p };
    if (sequelizeOrOptions instanceof Sequelize) {
      options.database = sequelizeOrOptions.config.database;
    }

    const _sequelize = createSequelizeInstance(options);

    await _sequelize.sync({ force: true });

    return _sequelize;
  }

  return createSequelizeInstance(sequelizeOptions);
}

/**
 * Creates a sequelize instance to use in transaction-related tests.
 * This instance will be disposed of after the current test.
 *
 * Can only be used within a test. For before/after hooks, use {@link createMultiTransactionalTestSequelizeInstance}.
 *
 * @param sequelizeOrOptions
 */
export async function createSingleTransactionalTestSequelizeInstance(
  sequelizeOrOptions: Sequelize | Options,
): Promise<Sequelize> {
  const instance = await createMultiTransactionalTestSequelizeInstance(sequelizeOrOptions);
  destroySequelizeAfterTest(instance);

  return instance;
}

before('first database reset', async () => {
  // Reset the DB a single time for the whole suite
  await clearDatabase();
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
  before('setResetMode before', async () => {
    previousMode = currentSuiteResetMode;
    currentSuiteResetMode = mode;
  });

  after('setResetMode after', async () => {
    currentSuiteResetMode = previousMode ?? 'drop';

    // Reset the DB a single time for the whole suite
    await clearDatabase();
  });
}

afterEach('database reset', async () => {
  const sequelizeInstances = uniq([sequelize, ...allSequelizeInstances]);

  for (const sequelizeInstance of sequelizeInstances) {
    if (sequelizeInstance.connectionManager.isClosed) {
      allSequelizeInstances.delete(sequelizeInstance);
      continue;
    }

    if (currentSuiteResetMode === 'none') {
      continue;
    }

    /* eslint-disable no-await-in-loop */
    switch (currentSuiteResetMode) {
      case 'drop':
        await clearDatabase(sequelizeInstance);
        // unregister all models
        resetSequelizeInstance(sequelizeInstance);
        break;

      case 'truncate':
        await sequelizeInstance.truncate(sequelizeInstance.dialect.supports.truncate);
        break;

      case 'destroy':
        await sequelizeInstance.destroyAll({ force: true });
        break;

      default:
        break;
      /* eslint-enable no-await-in-loop */
    }
  }

  if (sequelize.connectionManager.isClosed) {
    throw new Error('The main sequelize instance was closed. This is not allowed.');
  }

  await Promise.all(
    [...singleTestInstances].map(async instance => {
      allSequelizeInstances.delete(instance);
      if (!instance.connectionManager.isClosed) {
        await instance.close();
      }
    }),
  );

  singleTestInstances.clear();

  if (allSequelizeInstances.size > 2) {
    throw new Error(`There are more than two test-specific sequelize instance. This indicates that some sequelize instances were not closed.
Sequelize instances created in beforeEach/before must be closed in a corresponding afterEach/after block.
Sequelize instances created inside of a test must be closed after the test.

The following methods can be used to mark a sequelize instance for automatic disposal:
- destroySequelizeAfterTest
- createSingleTransactionalTestSequelizeInstance
- createSingleTestSequelizeInstance
- sequelize.close()
`);
  }
});

async function clearDatabaseInternal(customSequelize: Sequelize) {
  const qi = customSequelize.queryInterface;
  await qi.dropAllTables();
  resetSequelizeInstance(customSequelize);

  if (qi.dropAllEnums) {
    await qi.dropAllEnums();
  }

  await dropTestSchemas(customSequelize);
  await dropTestDatabases(customSequelize);
}

export async function clearDatabase(customSequelize: Sequelize = sequelize) {
  await pTimeout(
    clearDatabaseInternal(customSequelize),
    CLEANUP_TIMEOUT,
    `Could not clear database after this test in less than ${CLEANUP_TIMEOUT}ms. This test crashed the DB, and testing cannot continue. Aborting.`,
    { customTimers: { setTimeout, clearTimeout } },
  );
}

afterEach('no running queries checker', () => {
  if (runningQueries.size > 0) {
    throw new Error(
      `Expected 0 queries running after this test, but there are still ${
        runningQueries.size
      } queries running in the database (or, at least, the \`afterQuery\` Sequelize hook did not fire for them):\n\n${[
        ...runningQueries,
      ]
        .map((query: AbstractQuery) => `       ${query.uuid}: ${query.sql}`)
        .join('\n')}`,
    );
  }
});

export async function dropTestDatabases(customSequelize: Sequelize = sequelize) {
  if (!customSequelize.dialect.supports.multiDatabases) {
    return;
  }

  const qi = customSequelize.queryInterface;
  const databases = await qi.listDatabases({ skip: [customSequelize.config.database] });
  if (getTestDialect() === 'db2') {
    for (const db of databases) {
      // DB2 can sometimes deadlock / timeout when deleting more than one schema at the same time.
      // eslint-disable-next-line no-await-in-loop
      await qi.dropDatabase(db.name);
    }
  } else {
    await Promise.all(databases.map(async db => qi.dropDatabase(db.name)));
  }
}

export async function dropTestSchemas(customSequelize: Sequelize = sequelize) {
  if (!customSequelize.dialect.supports.schemas) {
    await customSequelize.drop({});

    return;
  }

  await customSequelize.queryInterface.dropAllSchemas({ skip: [customSequelize.config.database] });
}

export * from '../support';

import { execSync } from 'child_process';
import type { Dialect, Options } from '@sequelize/core';
import { default as semver } from 'semver';

const { env } = process;

//  ██████╗ ██╗ █████╗ ██╗     ███████╗ ██████╗████████╗███████╗
//  ██╔══██╗██║██╔══██╗██║     ██╔════╝██╔════╝╚══██╔══╝██╔════╝
//  ██║  ██║██║███████║██║     █████╗  ██║        ██║   ███████╗
//  ██║  ██║██║██╔══██║██║     ██╔══╝  ██║        ██║   ╚════██║
//  ██████╔╝██║██║  ██║███████╗███████╗╚██████╗   ██║   ███████║
//  ╚═════╝ ╚═╝╚═╝  ╚═╝╚══════╝╚══════╝ ╚═════╝   ╚═╝   ╚══════╝
//

const configs: { [key in Dialect]: Record<('default' | 'native' | number), Options> } = {

  //  ╔═╗╔═╗ ╦    ╔═╗╔═╗╦═╗╦  ╦╔═╗╦═╗  ┌─┐┌─┐┌┬┐┌┬┐┬┌┐┌┌─┐┌─┐
  //  ╚═╗║═╬╗║    ╚═╗║╣ ╠╦╝╚╗╔╝║╣ ╠╦╝  └─┐├┤  │  │ │││││ ┬└─┐
  //  ╚═╝╚═╝╚╩═╝  ╚═╝╚═╝╩╚═ ╚╝ ╚═╝╩╚═  └─┘└─┘ ┴  ┴ ┴┘└┘└─┘└─┘

  mssql: {
    // When SQL Server has one instance it runs under 1433, with multiple instances
    //   ports are dynamic in range of 49152-65535
    //   https://stackoverflow.com/a/49669700/10408280
    native: { port: 1433 },
    default: {
      host: env.SEQ_MSSQL_HOST || env.SEQ_HOST || 'localhost',
      username: env.SEQ_MSSQL_USER || env.SEQ_USER || 'SA',
      password: env.SEQ_MSSQL_PW || env.SEQ_PW || 'Password12!',
      port: env.SEQ_MSSQL_PORT || env.SEQ_PORT, // || 22_019,
      database: env.SEQ_MSSQL_DB || env.SEQ_DB || 'sequelize_test',
      dialectOptions: {
        options: {
          encrypt: false,
          requestTimeout: 25_000,
        },
      },
      pool: {
        max: Number(env.SEQ_MSSQL_POOL_MAX || env.SEQ_POOL_MAX || 5),
        idle: Number(env.SEQ_MSSQL_POOL_IDLE || env.SEQ_POOL_IDLE || 3000),
      },
    },
    2019: {
      port: env.SEQ_MSSQL_PORT || env.SEQ_PORT || 22_019,
    },
  },

  //  ╔╦╗╦ ╦╔═╗╔═╗ ╦    ┌─┐┌─┐┌┬┐┌┬┐┬┌┐┌┌─┐┌─┐
  //  ║║║╚╦╝╚═╗║═╬╗║    └─┐├┤  │  │ │││││ ┬└─┐
  //  ╩ ╩ ╩ ╚═╝╚═╝╚╩═╝  └─┘└─┘ ┴  ┴ ┴┘└┘└─┘└─┘

  mysql: {
    native: { port: 3306 },
    default: {
      database: env.SEQ_MYSQL_DB || env.SEQ_DB || 'sequelize_test',
      username: env.SEQ_MYSQL_USER || env.SEQ_USER || 'sequelize_test',
      password: env.SEQ_MYSQL_PW || env.SEQ_PW || 'sequelize_test',
      host: env.MYSQL_PORT_3306_TCP_ADDR || env.SEQ_MYSQL_HOST || env.SEQ_HOST || '127.0.0.1',
      port: env.MYSQL_PORT_3306_TCP_PORT || env.SEQ_MYSQL_PORT || env.SEQ_PORT, // || 20_057,
      pool: {
        max: Number(env.SEQ_MYSQL_POOL_MAX || env.SEQ_POOL_MAX || 5),
        idle: Number(env.SEQ_MYSQL_POOL_IDLE || env.SEQ_POOL_IDLE || 3000),
      },
    },
    5.7: {
      port: env.MYSQL_PORT_3306_TCP_PORT || env.SEQ_MYSQL_PORT || env.SEQ_PORT || 20_057,
    },
    8: {
      port: env.MYSQL_PORT_3306_TCP_PORT || env.SEQ_MYSQL_PORT || env.SEQ_PORT || 20_080,
    },
  },

  //  ╔═╗╔╗╔╔═╗╦ ╦╔═╗╦  ╔═╗╦╔═╔═╗  ┌─┐┌─┐┌┬┐┌┬┐┬┌┐┌┌─┐┌─┐
  //  ╚═╗║║║║ ║║║║╠╣ ║  ╠═╣╠╩╗║╣   └─┐├┤  │  │ │││││ ┬└─┐
  //  ╚═╝╝╚╝╚═╝╚╩╝╚  ╩═╝╩ ╩╩ ╩╚═╝  └─┘└─┘ ┴  ┴ ┴┘└┘└─┘└─┘

  snowflake: {
    native: { port: 443 },
    default: {
      username: env.SEQ_SNOWFLAKE_USER || env.SEQ_USER || 'root',
      password: env.SEQ_SNOWFLAKE_PW || env.SEQ_PW || '',
      database: env.SEQ_SNOWFLAKE_DB || env.SEQ_DB || 'sequelize_test',
      dialectOptions: {
        account: env.SEQ_SNOWFLAKE_ACCOUNT || env.SEQ_ACCOUNT || 'sequelize_test',
        role: env.SEQ_SNOWFLAKE_ROLE || env.SEQ_ROLE || 'role',
        warehouse: env.SEQ_SNOWFLAKE_WH || env.SEQ_WH || 'warehouse',
        schema: env.SEQ_SNOWFLAKE_SCHEMA || env.SEQ_SCHEMA || '',
      },
    },
  },

  //  ╔╦╗╔═╗╦═╗╦╔═╗╔╦╗╔╗   ┌─┐┌─┐┌┬┐┌┬┐┬┌┐┌┌─┐┌─┐
  //  ║║║╠═╣╠╦╝║╠═╣ ║║╠╩╗  └─┐├┤  │  │ │││││ ┬└─┐
  //  ╩ ╩╩ ╩╩╚═╩╩ ╩═╩╝╚═╝  └─┘└─┘ ┴  ┴ ┴┘└┘└─┘└─┘

  mariadb: {
    native: { port: 3306 },
    default: {
      database: env.SEQ_MARIADB_DB || env.SEQ_DB || 'sequelize_test',
      username: env.SEQ_MARIADB_USER || env.SEQ_USER || 'sequelize_test',
      password: env.SEQ_MARIADB_PW || env.SEQ_PW || 'sequelize_test',
      host: env.MARIADB_PORT_3306_TCP_ADDR || env.SEQ_MARIADB_HOST || env.SEQ_HOST || '127.0.0.1',
      port: env.MARIADB_PORT_3306_TCP_PORT || env.SEQ_MARIADB_PORT || env.SEQ_PORT, // || 21_103,
      pool: {
        max: Number(env.SEQ_MARIADB_POOL_MAX || env.SEQ_POOL_MAX || 5),
        idle: Number(env.SEQ_MARIADB_POOL_IDLE || env.SEQ_POOL_IDLE || 3000),
      },
    },
    10.3: {
      port: env.MARIADB_PORT_3306_TCP_PORT || env.SEQ_MARIADB_PORT || env.SEQ_PORT || 21_103,
    },
  },

  //  ╔═╗╔═╗ ╦  ╦╔╦╗╔═╗  ┌─┐┌─┐┌┬┐┌┬┐┬┌┐┌┌─┐┌─┐
  //  ╚═╗║═╬╗║  ║ ║ ║╣   └─┐├┤  │  │ │││││ ┬└─┐
  //  ╚═╝╚═╝╚╩═╝╩ ╩ ╚═╝  └─┘└─┘ ┴  ┴ ┴┘└┘└─┘└─┘

  sqlite: {
    native: {},
    default: {},
  },

  //  ╔═╗╔═╗╔═╗╔╦╗╔═╗╦═╗╔═╗╔═╗╔═╗ ╦    ┌─┐┌─┐┌┬┐┌┬┐┬┌┐┌┌─┐┌─┐
  //  ╠═╝║ ║╚═╗ ║ ║ ╦╠╦╝║╣ ╚═╗║═╬╗║    └─┐├┤  │  │ │││││ ┬└─┐
  //  ╩  ╚═╝╚═╝ ╩ ╚═╝╩╚═╚═╝╚═╝╚═╝╚╩═╝  └─┘└─┘ ┴  ┴ ┴┘└┘└─┘└─┘

  postgres: {
    native: { port: 5432 },
    default: {
      database: env.SEQ_PG_DB || env.SEQ_DB || 'sequelize_test',
      username: env.SEQ_PG_USER || env.SEQ_USER || 'sequelize_test',
      password: env.SEQ_PG_PW || env.SEQ_PW || 'sequelize_test',
      host: env.POSTGRES_PORT_5432_TCP_ADDR || env.SEQ_PG_HOST || env.SEQ_HOST || '127.0.0.1',
      port: env.POSTGRES_PORT_5432_TCP_PORT || env.SEQ_PG_PORT || env.SEQ_PORT, // || 23_010,
      pool: {
        max: Number(env.SEQ_PG_POOL_MAX || env.SEQ_POOL_MAX || 5),
        idle: Number(env.SEQ_PG_POOL_IDLE || env.SEQ_POOL_IDLE || 3000),
      },
      minifyAliases: Boolean(env.SEQ_PG_MINIFY_ALIASES),
    },
    10: {
      port: env.POSTGRES_PORT_5432_TCP_PORT || env.SEQ_PG_PORT || env.SEQ_PORT || 23_010,
    },
    12: {
      port: env.POSTGRES_PORT_5432_TCP_PORT || env.SEQ_PG_PORT || env.SEQ_PORT || 23_012,
    },
  },

  //  ╔╦╗╔╗ ╔═╗  ┌─┐┌─┐┌┬┐┌┬┐┬┌┐┌┌─┐┌─┐
  //   ║║╠╩╗╔═╝  └─┐├┤  │  │ │││││ ┬└─┐
  //  ═╩╝╚═╝╚═╝  └─┘└─┘ ┴  ┴ ┴┘└┘└─┘└─┘

  db2: {
    // DB2 v11.5.5 and older: 50000; v11.5.6 and newer: 25000
    native: { port: 50_000 },
    default: {
      database: env.SEQ_DB2_DB || env.SEQ_DB || env.IBM_DB_DBNAME || 'testdb',
      username: env.SEQ_DB2_USER || env.SEQ_USER || env.IBM_DB_UID || 'db2inst1',
      password: env.SEQ_DB2_PW || env.SEQ_PW || env.IBM_DB_PWD || 'password',
      host: env.DB2_PORT_50000_TCP_ADDR || env.SEQ_DB2_HOST || env.SEQ_HOST || env.IBM_DB_HOSTNAME || '127.0.0.1',
      port: env.DB2_PORT_50000_TCP_PORT || env.SEQ_DB2_PORT || env.SEQ_PORT || env.IBM_DB_PORT, // || 50_000,
      pool: {
        max: Number(env.SEQ_DB2_POOL_MAX || env.SEQ_POOL_MAX || 5),
        idle: Number(env.SEQ_DB2_POOL_IDLE || env.SEQ_POOL_IDLE || 3000),
      },
    },
    11.5: {
      port: env.DB2_PORT_50000_TCP_PORT || env.SEQ_DB2_PORT || env.SEQ_PORT || env.IBM_DB_PORT || 50_000,
    },
  },

  //  ╦╔╗ ╔╦╗╦  ┌─┐┌─┐┌┬┐┌┬┐┬┌┐┌┌─┐┌─┐
  //  ║╠╩╗║║║║  └─┐├┤  │  │ │││││ ┬└─┐
  //  ╩╚═╝╩ ╩╩  └─┘└─┘ ┴  ┴ ┴┘└┘└─┘└─┘

  ibmi: {
    native: { port: 8471 },
    default: {
      database: env.SEQ_IBMI_DB || env.SEQ_DB,
      username: env.SEQ_IBMI_USER || env.SEQ_USER,
      password: env.SEQ_IBMI_PW || env.SEQ_PW,
      pool: {
        max: Number(env.SEQ_IBMI_POOL_MAX || env.SEQ_POOL_MAX || env.SEQ_POOL_MAX || 5),
        idle: Number(env.SEQ_IBMI_POOL_IDLE || env.SEQ_POOL_IDLE || 3000),
      },
      dialectOptions: {
        odbcConnectionString: env.SEQ_IBMI_CONN_STR,
      },
    },
  },
};

//   ██████╗ ██████╗ ███╗   ██╗███████╗██╗ ██████╗     ███████╗██╗   ██╗███╗   ██╗ ██████╗
//  ██╔════╝██╔═══██╗████╗  ██║██╔════╝██║██╔════╝     ██╔════╝██║   ██║████╗  ██║██╔════╝
//  ██║     ██║   ██║██╔██╗ ██║█████╗  ██║██║  ███╗    █████╗  ██║   ██║██╔██╗ ██║██║
//  ██║     ██║   ██║██║╚██╗██║██╔══╝  ██║██║   ██║    ██╔══╝  ██║   ██║██║╚██╗██║██║
//  ╚██████╗╚██████╔╝██║ ╚████║██║     ██║╚██████╔╝    ██║     ╚██████╔╝██║ ╚████║╚██████╗
//   ╚═════╝ ╚═════╝ ╚═╝  ╚═══╝╚═╝     ╚═╝ ╚═════╝     ╚═╝      ╚═════╝ ╚═╝  ╚═══╝ ╚═════╝
//

export function Config(dialect: string | undefined): Options {

  if (dialect === undefined) {
    return {};
  }

  let _fullString: string;
  let dialectName: string;
  let dialectVersion: string;
  let didEncounterSpecialCase = false;

  //  ┌─┐┌─┐┌─┐┌─┐┬┌─┐┬    ┌─┐┌─┐┌─┐┌─┐┌─┐
  //  └─┐├─┘├┤ │  │├─┤│    │  ├─┤└─┐├┤ └─┐
  //  └─┘┴  └─┘└─┘┴┴ ┴┴─┘  └─┘┴ ┴└─┘└─┘└─┘

  // dialects that end with a nubmer in their name
  const specialCases: [Dialect] = ['db2'];
  for (const specialCase of specialCases) {
    if (dialect.startsWith(specialCase)) {
      didEncounterSpecialCase = true;
      const re: RegExp = new RegExp(`(${specialCase})(.*)`);

      // can use `.match()!` (With bang) b/c we know `re` will match based on `if` condition
      [_fullString, dialectName, dialectVersion] = dialect.match(re)!;
      break;
    }
  }

  //  \│/   ┌┐┌┌─┐┌┬┐┬┬  ┬┌─┐
  //  ─ ────│││├─┤ │ │└┐┌┘├┤
  //  /│\   ┘└┘┴ ┴ ┴ ┴ └┘ └─┘

  if (!didEncounterSpecialCase) {
    // can use `.match()!` b/c we know `dialect` is populated with something and below will capture
    [_fullString, dialectName, dialectVersion] = dialect.match(/([a-z-]+)(.*)/)!;

    // Example: "postgres-native" -> "postgres"; "mysql-native" -> "mysql" (REM: not yet implemented)
    dialectName = dialectName.replace(/(.+?)-native/, '$1');
  }

  // TypeScript isn't intelligent enough to realize this will be assigned
  dialectName = dialectName!;
  dialectVersion = dialectVersion!;

  const defaults: { [key: string]: any } = configs;
  const config = defaults[dialectName].default as Options;
  const versions = Object.keys(defaults[dialectName]).filter(v => !/(?:default|native)/.test(v));

  //  ┌┬┐┌─┐┌─┐┬┌─┌─┐┬─┐  ┌─┐┌─┐┬─┐┌┬┐  ┬  ┌─┐┌─┐┬┌─┬ ┬┌─┐
  //   │││ ││  ├┴┐├┤ ├┬┘  ├─┘│ │├┬┘ │   │  │ ││ │├┴┐│ │├─┘
  //  ─┴┘└─┘└─┘┴ ┴└─┘┴└─  ┴  └─┘┴└─ ┴   ┴─┘└─┘└─┘┴ ┴└─┘┴

  if (!dialectVersion) {
    // attempt to get database port from newest running container for that dialect
    // requires: the dialect to be part of the container name
    let dockerDatabasePort: string = '';
    try {
      const consoleOutput = Buffer.from(execSync(`docker container ls --filter "name=sequelize-${dialect}" -l --format="{{.Ports}}"`)).toString();
      const matches = consoleOutput.match(/:(\d+)->/);
      if (matches) {
        dockerDatabasePort = matches[1];
      }
    } catch {
      // most likely `docker` doesn't exist -- no need to do anything
    }

    // Set default to most recent running database for the dialect if found
    if (dockerDatabasePort && !config.port) {
      config.port = Number(dockerDatabasePort);
    }
  }

  //  ┌┬┐┌─┐ ┬┌─┐┬─┐  ┬  ┬┌─┐┬─┐┌─┐┬┌─┐┌┐┌  ┌┬┐┌─┐┌┬┐┌─┐┬ ┬
  //  │││├─┤ ││ │├┬┘  └┐┌┘├┤ ├┬┘└─┐││ ││││  │││├─┤ │ │  ├─┤
  //  ┴ ┴┴ ┴└┘└─┘┴└─   └┘ └─┘┴└─└─┘┴└─┘┘└┘  ┴ ┴┴ ┴ ┴ └─┘┴ ┴

  // used to final cleanup of values that might not be set (like port)
  const preReturnValues = { config, defaults, dialect, dialectName, dialectVersion };

  if (Boolean(dialectVersion) && versions.length) {

    // format version set in environment
    const semSeekVersion = semver.coerce(dialectVersion);
    if (semSeekVersion === null) {
      return (postProcess(preReturnValues));
    }

    const versionMatch: string = `<=${semSeekVersion.version.replace(/\b0+\b/g, 'x')}`;

    // ordered by greatest semver first
    const versionOptions = semver.rsort(versions.map(v => semver.coerce(v) ?? ''));
    if (!versionOptions.length) {
      return postProcess(preReturnValues);
    }

    // find the largest semver that matches.  `.satisfies()` compares pattern with
    //   the 'x' in the range pattern representing largest possible value:
    //     `.satisfies('5.7.0','<=5.x.x')` is true; 5.x (infinity) is greater than 5.7
    //     `.satisfies('8.2.3','<=5.x.x')` is false; 8 is greater than 5
    const foundSemver = versionOptions.find((versionOption: any) => semver.satisfies(versionOption, versionMatch));
    if (!foundSemver) {
      return postProcess(preReturnValues);
    }

    const databaseVersion = versions.find(v => semver.eq(semver.coerce(v) ?? '', foundSemver));
    if (!databaseVersion) {
      return postProcess(preReturnValues);
    }

    env.DEBUG && console.debug({ databaseVersion });

    return Object.assign(config, defaults[dialectName][databaseVersion]);
  }

  return postProcess(preReturnValues);
}

//  ╔═╗╔═╗╔═╗╔╦╗  ╔═╗╦═╗╔═╗╔═╗╔═╗╔═╗╔═╗
//  ╠═╝║ ║╚═╗ ║   ╠═╝╠╦╝║ ║║  ║╣ ╚═╗╚═╗
//  ╩  ╚═╝╚═╝ ╩   ╩  ╩╚═╚═╝╚═╝╚═╝╚═╝╚═╝

/**
 * Perform any final maintenance before returning to caller
 * @param args Post-processing arguments object
 * @param args.config Database connection values
 * @param args.defaults Default connection values for the database
 * @param args.dialectName Name of the database dialect (type)
 * @returns Dialect config details
 */
function postProcess({ config, defaults, dialectName }: {
  config: Options,
  defaults: { [key: string]: any },
  dialectName: string,
}): Options {

  //  ┌─┐┌─┐┬  ┬  ┌┐ ┌─┐┌─┐┬┌─  ┌─┐┌─┐┬─┐┌┬┐  ┌─┐┌─┐┌┬┐┌┬┐┬┌┐┌┌─┐
  //  ├┤ ├─┤│  │  ├┴┐├─┤│  ├┴┐  ├─┘│ │├┬┘ │   └─┐├┤  │  │ │││││ ┬
  //  └  ┴ ┴┴─┘┴─┘└─┘┴ ┴└─┘┴ ┴  ┴  └─┘┴└─ ┴   └─┘└─┘ ┴  ┴ ┴┘└┘└─┘

  if (!config.port) {
    // remember: config is mutable
    config.port = defaults[dialectName]?.native?.port;
  }

  return config;
}

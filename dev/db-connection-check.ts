// Wanted: '@sequelize/core' in place of '..'
// Issue: dev/tsconfig.json not configured correctly
// import { Sequelize } from '@sequelize/core';

import type { Dialect, Options } from '..';
import { Sequelize } from '..';
import { Config } from '../test/config/config';

const isLoggingEnabled: Boolean = !!process.env.DEBUG;
const logger = isLoggingEnabled ? console.debug : false;

(async () => {
  const dialectName: Dialect = getDialectName(process.env.DIALECT || '') as Dialect;
  const config: Options = Config(process.env.DIALECT);
  isLoggingEnabled && console.debug({config})
  const sequelize = new Sequelize(
    config.database ?? '',
    config.username ?? '',
    config.password ?? '',
    { ...config,
      dialect: dialectName
    }
  );

  await sequelize.authenticate({logging: logger});
  await sequelize.close();

})();


function getDialectName(dialect: string): Dialect|undefined{
  // dialects that end with a nubmer in their name
  const specialCases: [Dialect] = ['db2'];
  let dialectName: Dialect;

  // if encounter special case, exit early
  for ( const specialCase of specialCases ) {
    if ( dialect.startsWith(specialCase) ){
      return dialectName = specialCase;
    }
  }

  // didn't encounter specialCase
  return dialectName = (process.env.DIALECT || '').replace(/[^a-z]+$/g,'') as Dialect;
}
/**
 * CommonJS type entry point, paired with index.cjs.
 *
 * index.cjs assigns the constructor itself to `module.exports`, so CJS consumers
 * need the `export =` shape rather than the ESM `export default` declared in
 * index.d.ts. Re-exporting the default binding carries every meaning it has —
 * value, type and namespace — so `new Sequelize()`, `Sequelize.QueryInterface`
 * as a type, and `import { Op } from 'sequelize'` all keep working.
 */
import Sequelize from './index.js';

export = Sequelize;

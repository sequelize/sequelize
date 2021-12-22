/**
 * Helpers to load OOTB dialect by default. It could be delete and control by customer when we 
 * refactor all the dialect as separate lib like '@sequelize/db2'
 */
const { registerDialect } = require('./abstract/registry');

registerDialect(require('./mysql'));
registerDialect(require('./db2'));
registerDialect(require('./mssql'));
registerDialect(require('./sqlite'));
registerDialect(require('./mariadb'));
registerDialect(require('./postgres'));
registerDialect(require('./snowflake'));

var assert = require("assert")
  , QueryGenerator = require("../../lib/sequelize/query-generator")
  , eql = assert.equal
  
module.exports = {
  'create table query': function() {
    eql(QueryGenerator.createTableQuery('myTable', {title: 'VARCHAR(255)', name: 'VARCHAR(255)'}), "CREATE TABLE IF NOT EXISTS `myTable` (`title` VARCHAR(255), `name` VARCHAR(255));")
  },
  'drop table query': function() {
    eql(QueryGenerator.dropTableQuery('myTable'), "DROP TABLE IF EXISTS `myTable`;")
  }
}
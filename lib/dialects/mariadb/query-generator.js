var Utils     = require("../../utils")

module.exports = (function() {
  var QueryGenerator = {
    dialect: 'mariadb'
  }
  // "MariaDB is a drop-in replacement for MySQL." - so thats exactly what we do, drop in the mysql query generator

  return Utils._.extend(Utils._.clone(require("../mysql/query-generator")), QueryGenerator)
})()

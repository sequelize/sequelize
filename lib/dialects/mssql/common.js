var common;

common.quoteTable: function(param, as) {
  var table = '';

  if (as === true) {
    as = param.as || param.name || param;
  }

  if (_.isObject(param)) {
    if (common._dialect.supports.schemas) {
      if (param.schema) {
        table += common.quoteIdentifier(param.schema) + '.';
      }

      table += common.quoteIdentifier(param.tableName);
    } else {
      if (param.schema) {
        table += param.schema + param.delimiter;
      }

      table += param.tableName;
      table = common.quoteIdentifier(table);
    }


  } else {
    table = common.quoteIdentifier(param);
  }

  if (as) {
    table += ' AS ' + common.quoteIdentifier(as);
  }
  return table;
};


/*
  Escape an identifier (e.g. a table or attribute name)
*/
/* istanbul ignore next */
common.quoteIdentifier: function(identifier, force) {
  throwMethodUndefined('quoteIdentifier');
},

/*
  Split an identifier into .-separated tokens and quote each part
*/
common.quoteIdentifiers: function(identifiers, force) {
  if (identifiers.indexOf('.') !== -1) {
    identifiers = identifiers.split('.');
    return common.quoteIdentifier(identifiers.slice(0, identifiers.length - 1).join('.')) + '.' + common.quoteIdentifier(identifiers[identifiers.length - 1]);
  } else {
    return common.quoteIdentifier(identifiers);
  }
},

module.exports = function (queryGenerator) {
  common = queryGenerator;
};

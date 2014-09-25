var Utils = require('../../utils');

/*
  Returns a query for selecting elements in the table <tableName>.
  Options:
    - attributes -> An array of attributes (e.g. ['name', 'birthday']). Default: *
    - where -> A hash with conditions (e.g. {name: 'foo'})
               OR an ID as integer
               OR a string with conditions (e.g. 'name="foo"').
               If you use a string, you have to escape it on your own.
    - order -> e.g. 'id DESC'
    - group
    - limit -> The maximum count you want to get.
    - offset -> An offset value to start from. Only useable with limit!
*/
var selectQuery = function(tableName, options, model) {
  // Enter and change at your own peril -- Mick Hansen
  options = options || {};

  var table = null
    , self = this
    , query
    , limit = options.limit
    , mainQueryItems = []
    , mainAttributes = options.attributes && options.attributes.slice(0)
    , mainJoinQueries = []
    // We'll use a subquery if we have hasMany associations and a limit and a filtered/required association
    , subQuery = limit && (options.hasIncludeWhere || options.hasIncludeRequired || options.hasMultiAssociation) && options.subQuery !== false
    , subQueryItems = []
    , subQueryAttributes = null
    , subJoinQueries = []
    , mainTableAs = null;

  if (!Array.isArray(tableName) && model) {
    options.tableAs = mainTableAs = this.quoteTable(model.name);
  }
  options.table = table = !Array.isArray(tableName) ? this.quoteTable(tableName) : tableName.map(function(t) {
    if (Array.isArray(t)) {
      return this.quoteTable(t[0], t[1]);
    }
    return this.quoteTable(t, true);
  }.bind(this)).join(', ');

  if (subQuery && mainAttributes) {
    model.primaryKeyAttributes.forEach(function(keyAtt) {
      // Check if mainAttributes contain the primary key of the model either as a field or an aliased field
      if (!_.find(mainAttributes, function (attr) {
        return keyAtt === attr || keyAtt === attr[0] || keyAtt === attr[1];
      })) {
        mainAttributes.push(model.rawAttributes[keyAtt].field ? [keyAtt, model.rawAttributes[keyAtt].field] : keyAtt);
      }
    });
  }

  // Escape attributes
  mainAttributes = mainAttributes && mainAttributes.map(function(attr) {
    var addTable = true;

    if (attr._isSequelizeMethod) {
      return attr.toString(self);
    }

    if (Array.isArray(attr) && attr.length === 2) {
      if (attr[0]._isSequelizeMethod) {
        attr[0] = attr[0].toString(self);
        addTable = false;
      } else {
        if (attr[0].indexOf('(') === -1 && attr[0].indexOf(')') === -1) {
          attr[0] = self.quoteIdentifier(attr[0]);
        }
      }
      attr = [attr[0], self.quoteIdentifier(attr[1])].join(' AS ');
    } else {
      attr = attr.indexOf(Utils.TICK_CHAR) < 0 && attr.indexOf('"') < 0 ? self.quoteIdentifiers(attr) : attr;
    }

    if (options.include && attr.indexOf('.') === -1 && addTable) {
      attr = mainTableAs + '.' + attr;
    }
    return attr;
  });

  // If no attributes specified, use *
  mainAttributes = mainAttributes || (options.include ? [mainTableAs + '.*'] : ['*']);

  // If subquery, we ad the mainAttributes to the subQuery and set the mainAttributes to select * from subquery
  if (subQuery) {
    // We need primary keys
    subQueryAttributes = mainAttributes;
    mainAttributes = [mainTableAs + '.*'];
  }


  if (options.include) {
    var generateJoinQueries = function(include, parentTable) {
      var table = include.model.getTableName()
        , as = include.as
        , joinQueryItem = ''
        , joinQueries = {
          mainQuery: [],
          subQuery: []
        }
        , attributes
        , association = include.association
        , through = include.through
        , joinType = include.required ? ' INNER JOIN ' : ' LEFT OUTER JOIN '
        , includeWhere = {}
        , whereOptions = Utils._.clone(options);

      whereOptions.keysEscaped = true;

      if (tableName !== parentTable && mainTableAs !== parentTable) {
        as = parentTable + '.' + include.as;
      }

      // includeIgnoreAttributes is used by aggregate functions
      if (options.includeIgnoreAttributes !== false) {

        attributes = include.attributes.map(function(attr) {
          var attrAs = attr,
              verbatim = false;

          if (Array.isArray(attr) && attr.length === 2) {
            if (attr[0]._isSequelizeMethod) {
              if (attr[0] instanceof Utils.literal ||
                attr[0] instanceof Utils.cast ||
                attr[0] instanceof Utils.fn
              ) {
                verbatim = true;
              }
            }

            attr = attr.map(function($attr) {
              return $attr._isSequelizeMethod ? $attr.toString(self) : $attr;
            });

            attrAs = attr[1];
            attr = attr[0];
          } else if (attr instanceof Utils.literal) {
            return attr.toString(self); // We trust the user to rename the field correctly
          } else if (attr instanceof Utils.cast ||
            attr instanceof Utils.fn
          ) {
            throw new Error("Tried to select attributes using Sequelize.cast or Sequelize.fn without specifying an alias for the result, during eager loading. " +
              "This means the attribute will not be added to the returned instance");
          }

          var prefix;
          if (verbatim === true) {
            prefix = attr;
          } else {
            prefix = self.quoteIdentifier(as) + '.' + self.quoteIdentifier(attr);
          }
          return prefix + ' AS ' + self.quoteIdentifier(as + '.' + attrAs);
        });

        if (include.subQuery && subQuery) {
          subQueryAttributes = subQueryAttributes.concat(attributes);
        } else {
          mainAttributes = mainAttributes.concat(attributes);
        }
      }

      if (through) {
        var throughTable = through.model.getTableName()
          , throughAs = as + '.' + through.as
          , throughAttributes = through.attributes.map(function(attr) {
            return self.quoteIdentifier(throughAs) + '.' + self.quoteIdentifier(attr) + ' AS ' + self.quoteIdentifier(throughAs + '.' + attr);
          })
          , primaryKeysSource = association.source.primaryKeyAttributes
          , tableSource = parentTable
          , identSource = association.identifier
          , attrSource = primaryKeysSource[0]
          , where

          , primaryKeysTarget = association.target.primaryKeyAttributes
          , tableTarget = as
          , identTarget = association.foreignIdentifier
          , attrTarget = primaryKeysTarget[0]

          , sourceJoinOn
          , targetJoinOn
          , targetWhere;

        if (options.includeIgnoreAttributes !== false) {
          // Through includes are always hasMany, so we need to add the attributes to the mainAttributes no matter what (Real join will never be executed in subquery)
          mainAttributes = mainAttributes.concat(throughAttributes);
        }

        // Filter statement for left side of through
        // Used by both join and subquery where
        sourceJoinOn = self.quoteTable(tableSource) + '.' + self.quoteIdentifier(attrSource) + ' = ';
        sourceJoinOn += self.quoteIdentifier(throughAs) + '.' + self.quoteIdentifier(identSource);

        // Filter statement for right side of through
        // Used by both join and subquery where
        targetJoinOn = self.quoteIdentifier(tableTarget) + '.' + self.quoteIdentifier(attrTarget) + ' = ';
        targetJoinOn += self.quoteIdentifier(throughAs) + '.' + self.quoteIdentifier(identTarget);

        if (self._dialect.supports.joinTableDependent) {
          // Generate a wrapped join so that the through table join can be dependent on the target join
          joinQueryItem += joinType + '(';
          joinQueryItem += self.quoteTable(throughTable, throughAs);
          joinQueryItem += joinType + self.quoteTable(table, as) + ' ON ';
          joinQueryItem += targetJoinOn;
          joinQueryItem += ') ON '+sourceJoinOn;
        } else {
          // Generate join SQL for left side of through
          joinQueryItem += joinType + self.quoteTable(throughTable, throughAs)  + ' ON ';
          joinQueryItem += sourceJoinOn;

          // Generate join SQL for right side of through
          joinQueryItem += joinType + self.quoteTable(table, as) + ' ON ';
          joinQueryItem += targetJoinOn;
        }

        if (include.where) {
          targetWhere = self.getWhereConditions(include.where, self.sequelize.literal(self.quoteIdentifier(as)), include.model, whereOptions);
          joinQueryItem += ' AND ' + targetWhere;
          if (subQuery && include.required) {
            if (!options.where) options.where = {};

            // Creating the as-is where for the subQuery, checks that the required association exists
            options.where['__' + throughAs] = self.sequelize.asIs(['(',

              'SELECT ' + self.quoteIdentifier(throughAs) + '.' + self.quoteIdentifier(identSource) + ' FROM ' + self.quoteTable(throughTable, throughAs),
              ! include.required && joinType + self.quoteTable(association.source.tableName, tableSource) + ' ON ' + sourceJoinOn || '',
              joinType + self.quoteTable(table, as) + ' ON ' + targetJoinOn,
              'WHERE ' + (! include.required && targetWhere || sourceJoinOn + ' AND ' + targetWhere),
              'LIMIT 1',

            ')', 'IS NOT NULL'].join(' '));
          }
        }
      } else {
        var left = association.associationType === 'BelongsTo' ? association.target : association.source
          , primaryKeysLeft = left.primaryKeyAttributes
          , tableLeft = association.associationType === 'BelongsTo' ? as : parentTable
          , attrLeft = primaryKeysLeft[0]
          , tableRight = association.associationType === 'BelongsTo' ? parentTable : as
          , attrRight = association.identifier
          , joinOn;

        // Alias the left attribute if the left attribute is not from a subqueried main table
        // When doing a query like SELECT aliasedKey FROM (SELECT primaryKey FROM primaryTable) only aliasedKey is available to the join, this is not the case when doing a regular select where you can't used the aliased attribute
        if (!subQuery || parentTable !== mainTableAs || tableLeft !== parentTable) {
          if (left.rawAttributes[attrLeft].field) {
            attrLeft = left.rawAttributes[attrLeft].field;
          }
        }

        // Filter statement
        // Used by both join and subquery where
        joinOn =
          // Left side
          (
            (subQuery && !include.subQuery && include.parent.subQuery && !(include.hasParentRequired && include.hasParentWhere)) && self.quoteIdentifier(tableLeft + '.' + attrLeft) ||
            self.quoteTable(tableLeft) + '.' + self.quoteIdentifier(attrLeft)
          )

          + ' = ' +

          // Right side
          (
            (subQuery && !include.subQuery && include.parent.subQuery && (include.hasParentRequired && include.hasParentWhere)) && self.quoteIdentifier(tableRight + '.' + attrRight) ||
            self.quoteTable(tableRight) + '.' + self.quoteIdentifier(attrRight)
          );

        if (include.where) {
          joinOn += ' AND ' + self.getWhereConditions(include.where, self.sequelize.literal(self.quoteIdentifier(as)), include.model, whereOptions);

          // If its a multi association we need to add a where query to the main where (executed in the subquery)
          if (subQuery && association.isMultiAssociation && include.required) {
            if (!options.where) options.where = {};

            // Creating the as-is where for the subQuery, checks that the required association exists
            options.where['__' + as] = self.sequelize.asIs(['(',

              'SELECT ' + self.quoteIdentifier(attrRight),
              'FROM ' + self.quoteTable(table, as),
              'WHERE ' + joinOn,
              'LIMIT 1',

            ')', 'IS NOT NULL'].join(' '));
          }
        }

        // Generate join SQL
        joinQueryItem += joinType + self.quoteTable(table, as) + ' ON ' + joinOn;

      }

      if (include.subQuery && subQuery) {
        joinQueries.subQuery.push(joinQueryItem);
      } else {
        joinQueries.mainQuery.push(joinQueryItem);
      }

      if (include.include) {
        include.include.forEach(function(childInclude) {
          if (childInclude._pseudo) return;
          var childJoinQueries = generateJoinQueries(childInclude, as);

          if (childInclude.subQuery && subQuery) {
            joinQueries.subQuery = joinQueries.subQuery.concat(childJoinQueries.subQuery);
          }
          if (childJoinQueries.mainQuery) {
            joinQueries.mainQuery = joinQueries.mainQuery.concat(childJoinQueries.mainQuery);
          }

        }.bind(this));
      }

      return joinQueries;
    };

    // Loop through includes and generate subqueries
    options.include.forEach(function(include) {
      var joinQueries = generateJoinQueries(include, options.tableAs);

      subJoinQueries = subJoinQueries.concat(joinQueries.subQuery);
      mainJoinQueries = mainJoinQueries.concat(joinQueries.mainQuery);

    }.bind(this));
  }

  // If using subQuery select defined subQuery attributes and join subJoinQueries
  if (subQuery) {
    subQueryItems.push('SELECT ' + subQueryAttributes.join(', ') + ' FROM ' + options.table);
    if (mainTableAs) {
      subQueryItems.push(' AS ' + mainTableAs);
    }
    subQueryItems.push(subJoinQueries.join(''));

  // Else do it the reguar way
  } else {
    mainQueryItems.push('SELECT ' + mainAttributes.join(', ') + ' FROM ' + options.table);
    if (mainTableAs) {
      mainQueryItems.push(' AS ' + mainTableAs);
    }
    mainQueryItems.push(mainJoinQueries.join(''));
  }

  // Add WHERE to sub or main query
  if (options.hasOwnProperty('where')) {
    options.where = this.getWhereConditions(options.where, mainTableAs || tableName, model, options);
    if (options.where) {
      if (subQuery) {
        subQueryItems.push(' WHERE ' + options.where);
      } else {
        mainQueryItems.push(' WHERE ' + options.where);
      }
    }
  }

  // Add GROUP BY to sub or main query
  if (options.group) {
    options.group = Array.isArray(options.group) ? options.group.map(function(t) { return this.quote(t, model); }.bind(this)).join(', ') : options.group;
    if (subQuery) {
      subQueryItems.push(' GROUP BY ' + options.group);
    } else {
      mainQueryItems.push(' GROUP BY ' + options.group);
    }
  }

  // Add HAVING to sub or main query
  if (options.hasOwnProperty('having')) {
    options.having = this.getWhereConditions(options.having, tableName, model, options, false);
    if (subQuery) {
      subQueryItems.push(' HAVING ' + options.having);
    } else {
      mainQueryItems.push(' HAVING ' + options.having);
    }
  }
  // Add ORDER to sub or main query
  if (options.order) {
    var mainQueryOrder = [];
    var subQueryOrder = [];

    if (Array.isArray(options.order)) {
      options.order.forEach(function(t) {
        if (subQuery && !(t[0] instanceof Model) && !(t[0].model instanceof Model)) {
          subQueryOrder.push(this.quote(t, model));
        }
        mainQueryOrder.push(this.quote(t, model));
      }.bind(this));
    } else {
      mainQueryOrder.push(options.order);
    }

    if (mainQueryOrder.length) {
      mainQueryItems.push(' ORDER BY ' + mainQueryOrder.join(', '));
    }
    if (subQueryOrder.length) {
      subQueryItems.push(' ORDER BY ' + subQueryOrder.join(', '));
    }
  }

  var limitOrder = this.addLimitAndOffset(options, query);

  // Add LIMIT, OFFSET to sub or main query
  if (limitOrder) {
    if (subQuery) {
      subQueryItems.push(limitOrder);
    } else {
      mainQueryItems.push(limitOrder);
    }
  }

  // If using subQuery, select attributes from wrapped subQuery and join out join tables
  if (subQuery) {
    query = 'SELECT ' + mainAttributes.join(', ') + ' FROM (';
    query += subQueryItems.join('');
    query += ') AS ' + options.tableAs;
    query += mainJoinQueries.join('');
    query += mainQueryItems.join('');
  } else {
    query = mainQueryItems.join('');
  }

  if (options.lock && this._dialect.supports.lock) {
    if (options.lock === 'SHARE') {
      query += ' ' + this._dialect.supports.forShare;
    } else {
      query += ' FOR UPDATE';
    }
  }

  query += ';';
  console.log(query);
  return query;
}

module.exports = selectQuery;

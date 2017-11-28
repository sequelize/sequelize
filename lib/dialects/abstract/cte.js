'use strict';

const Utils = require('../../utils');
const _ = require('lodash');

const CTE = {
  generateCTEQuery(topLevelInfo) {
    // just in case
    if (!topLevelInfo.options.cte) {
      return;
    }

    const cteQueryItems = [];

    const someRecursive = topLevelInfo.options.cte.some(cte => {
      return cte.recursive;
    });

    // iterate over each defined cte
    topLevelInfo.options.cte.forEach(cte => {
      const cteModelAttributes = [];
      const cteAdditionalAttributes = cte.cteAttributes ? cte.cteAttributes.slice() : [];
      const useModel = cte.useModel || true;
      const cteName = cte.name;

      let cteAllAttributes = [];
      let modelName = null;
      let modelAs = null;
      let cteModel;

      // check and throw some errors right of the bat
      if (cteName === undefined || cteName.length < 1) {
        throw new Error('No \'name\' property given to CTE.');
      }

      if (cte.initial === undefined) {
        throw new Error('No \'initial\' property given to CTE.');
      }

      const quotedCteName = cteName.indexOf(Utils.TICK_CHAR) < 0 && cteName.indexOf('"') < 0 ? this.quoteIdentifiers(cteName) : cteName;

      // the CTE is going to use the model of the findA; unless a different one is given or useModel is false
      if (useModel) {
        if (_.isUndefined(cte.model)) {
          cteModel = topLevelInfo.names.model;
        } else {
          cteModel = cte.model;
        }
      }

      // todo: this logic needs topLevelInfo.names baked out since we put cteSelect in there now
      if (cteModel) {
        modelAs = this.quoteTable(topLevelInfo.names.model.name);
        modelName = this.quoteTable(cteModel.getTableName());

        modelName = modelName.indexOf(Utils.TICK_CHAR) < 0 && modelName.indexOf('"') < 0 ? this.quoteIdentifiers(modelName) : modelName;
        // include all model attributes
        _.forIn(cteModel.attributes, (attr, name) => {
          cteModelAttributes.push(name);
        });

      }

      cteAllAttributes = cteModelAttributes.concat(cteAdditionalAttributes);
      const cteAttributes = cteAllAttributes.map(this.escapeAttribute, this).join(',');
      // build initial select; iife to keep some local vars closer to where they are needed
      const initialSelect = (() => {
        const initial = cte.initial;
        const initialAs = modelAs !== null ? ` AS ${modelAs}` : '';

        const initialSelectColumns = [];
        const initialOrderItems = [];

        let initialOrderBy = '';

        // 1. add model attributes and additional ctes columns to the initial select
        cteModelAttributes.forEach(attr => {
          const addTable = !(Array.isArray(attr) && attr.length === 2 && attr[0]._isSequelizeMethod);
          attr = this.escapeAttribute(attr);
          if (initial !== undefined && initial.include && attr.indexOf('.') === -1 && addTable) {
            attr = `${modelAs}.${attr}`;
          }
          initialSelectColumns.push(attr);
        });

        cteAdditionalAttributes.forEach(attr => {
          if (_.has(initial, attr)) {
            if (_.isPlainObject(initial[attr])) {
              initialSelectColumns.push(this.attributeItemQuery(initial[attr], topLevelInfo.options, modelAs));
            } else {
              initialSelectColumns.push(initial[attr]);
            }
          } else {
            throw new Error(`Missing attribute ${attr} value in CTE definition of initial selection.`);
          }
        });

        // 2. add any include we might need
        const initialJoins = initial.include === undefined ? '' : initial.include.map(include => {
          return this.generateInclude(include, modelAs, topLevelInfo, undefined).mainQuery;
        }).join('');

        // 3. if there is an initial where add it too
        const initialWhere = initial.where === undefined ? '' : ` WHERE ${this.getWhereConditions(initial.where, modelAs || modelName, topLevelInfo.names.model, topLevelInfo.options)}`;

        // 4. we need the order clause here if there is no recursive query since we depend on the recursive query for order otherwise
        if (this._dialect.supports.cteLimitOffsetOrder && cte.order && !cte.recursive) {
          if (Array.isArray(cte.order)) {
            cte.order.forEach(e => {
              if (Array.isArray(e) && _.size(e) > 1 && _.indexOf(cteAllAttributes, e[0]) !== -1) {
                this.validateOrder(_.last(e));
                initialOrderItems.push(`${(_.indexOf(cteAllAttributes, e[0]) + 1).toString()} ${_.last(e)}`);
              }
            });
          }
          if (initialOrderItems.length) {
            initialOrderBy = ` ORDER BY ${initialOrderItems.join(', ')}`;
          }
        }

        return `SELECT ${initialSelectColumns.join(', ')} FROM ${modelName}${initialAs}${initialJoins}${initialWhere}${initialOrderBy}`;

      })();

      // build recursive select, or return empty string; iife to keep some local vars closer to where they are needed
      const recursiveSelect = (() => {
        if (!cte.recursive) {
          return '';
        }

        const recursive = cte.recursive;
        const recursiveSelectColumns = [];
        const recursiveJoinItems = [];
        const recursiveOrderItems = [];
        const recursiveWhereItems = [];
        const recursiveUnion = cte.unique === false ? 'UNION ALL' : 'UNION';

        let recursiveJoinTable;
        let recursiveWhere = '';
        let recursiveOrderBy = '';

        // 1. make sure we have next
        if (recursive.next === undefined) {
          throw new Error(`Recursive object in cte ${cteName} must be given next property`);
        }

        // 2. figure out the name of our next table
        recursiveJoinTable = recursive.next.as;
        recursiveJoinTable = recursiveJoinTable.indexOf(Utils.TICK_CHAR) < 0 && recursiveJoinTable.indexOf('"') < 0 ? this.quoteIdentifiers(recursiveJoinTable) : recursiveJoinTable;

        // 3. add all attributes we will be sleecting from the model
        cteModelAttributes.forEach(attr => {
          recursiveSelectColumns.push(`${recursiveJoinTable}.${this.escapeAttribute(attr)}`);
        });

        // 4. add any additional attributes the cte may have
        cteAdditionalAttributes.forEach(attr => {
          if (recursive[attr] === undefined) {
            throw new Error(`Missing attribute ${attr} value in CTE definition of recursive selection.`);
          }
          if (_.isPlainObject(recursive[attr])) {
            recursiveSelectColumns.push(this.attributeItemQuery(recursive[attr], topLevelInfo.options, recursiveJoinTable, quotedCteName));
          } else {
            recursiveSelectColumns.push(recursive[attr]);
          }
        });

        // 5. add the next join and any includes
        recursiveJoinItems.push(this.generateInclude(recursive.next, recursiveJoinTable, topLevelInfo, cte).mainQuery);

        if (recursive.include !== undefined) {
          recursive.include.forEach(include => {
            recursiveJoinItems.push(this.generateInclude(include, include.as, topLevelInfo, _.assign(cte, { name: recursive.next.as })).mainQuery);
          });
        }

        const recursiveJoins = recursiveJoinItems.length > 0 ? `${recursiveJoinItems.join('')}` : '';

        // 6. handle the where if there is one
        if (recursive.where !== undefined) {

          if (recursive.where.model) {
            recursiveWhereItems.push(`${this.getWhereConditions(recursive.where.model, modelAs || modelName, topLevelInfo.names.model, topLevelInfo.options)}`);
          }
          if (recursive.where.cte) {
            if (recursiveWhereItems.length > 0) {
              recursiveWhereItems.push('AND');
            }
            recursiveWhereItems.push(`${this.getWhereConditions(recursive.where.cte, quotedCteName, topLevelInfo.names.model, topLevelInfo.options)}`);
          }
          if (recursiveWhereItems.length > 0) {
            recursiveWhere = ` WHERE ${recursiveWhereItems.join(' ')}`;
          }
        }

        // 7. handle the order if there is one
        if (this._dialect.supports.cteLimitOffsetOrder && cte.order) {
          if (Array.isArray(cte.order)) {
            cte.order.forEach(order => {
              if (Array.isArray(order) && order.length > 1 && _.indexOf(cteAllAttributes, order[0]) !== -1) {
                this.validateOrder(_.last(order));
                recursiveOrderItems.push(`${(_.indexOf(cteAllAttributes, order[0]) + 1).toString()} ${_.last(order)}`);
              }
            });
          }
          if (recursiveOrderItems.length > 0) {
            recursiveOrderBy = ` ORDER BY ${recursiveOrderItems.join(', ')}`;
          }
        }

        return ` ${recursiveUnion} SELECT ${recursiveSelectColumns.join(', ')} FROM ${quotedCteName}${recursiveJoins}${recursiveWhere}${recursiveOrderBy}`;
      })();

      // add limit if we support it
      const limitAndOffset = this._dialect.supports.cteLimitOffsetOrder ? this.addLimitAndOffset(cte) : '';

      cteQueryItems.push(`${cteName}(${cteAttributes}) AS (${initialSelect}${recursiveSelect}${limitAndOffset})`);
    });

    return `WITH ${someRecursive ? 'RECURSIVE ' : ''}${cteQueryItems.join(', ')} `;
  }
};

module.exports = CTE;
module.exports.CTE = CTE;
module.exports.default = CTE;

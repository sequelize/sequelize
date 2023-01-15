import NodeUtil from 'node:util';
import type { IndexOptions } from './dialects/abstract/query-interface.js';
import { EagerLoadingError } from './errors';
import type { Transactionable } from './model';
import type { Sequelize } from './sequelize';
import { isModelStatic } from './utils/model-utils.js';
// TODO: strictly type this file during the TS migration of model.js

// The goal of this file is to include the different private methods that are currently present on the Model class.
// This reduces the risk of having a user implement a static method with the same name as us in their Model subclass,
// it also prevents accessing internal methods.

export function _validateIncludedElements(options: any, tableNames: any = {}) {
  if (!isModelStatic(options.model)) {
    throw new TypeError('options.model must be provided, and a Model subclass.');
  }

  const ModelSubclass = options.model;

  options.includeNames = [];
  options.includeMap = {};

  /* Legacy */
  options.hasSingleAssociation = false;
  options.hasMultiAssociation = false;

  if (!options.parent) {
    options.topModel = options.model;
    options.topLimit = options.limit;
  }

  options.include = options.include.map((include: any) => {
    include = ModelSubclass._conformInclude(include, options.model);
    include.parent = options;
    include.topLimit = options.topLimit;

    ModelSubclass._validateIncludedElement.call(options.model, include, tableNames, options);

    if (include.duplicating === undefined) {
      include.duplicating = include.association.isMultiAssociation;
    }

    include.hasDuplicating = include.hasDuplicating || include.duplicating;
    include.hasRequired = include.hasRequired || include.required;

    options.hasDuplicating = options.hasDuplicating || include.hasDuplicating;
    options.hasRequired = options.hasRequired || include.required;

    options.hasWhere = options.hasWhere || include.hasWhere || Boolean(include.where);

    return include;
  });

  for (const include of options.include) {
    include.hasParentWhere = options.hasParentWhere || Boolean(options.where);
    include.hasParentRequired = options.hasParentRequired || Boolean(options.required);

    if (include.subQuery !== false && options.hasDuplicating && options.topLimit) {
      if (include.duplicating) {
        include.subQuery = include.subQuery || false;
        include.subQueryFilter = include.hasRequired;
      } else {
        include.subQuery = include.hasRequired;
        include.subQueryFilter = false;
      }
    } else {
      include.subQuery = include.subQuery || false;
      if (include.duplicating) {
        include.subQueryFilter = include.subQuery;
      } else {
        include.subQueryFilter = false;
        include.subQuery = include.subQuery || include.hasParentRequired && include.hasRequired && !include.separate;
      }
    }

    options.includeMap[include.as] = include;
    options.includeNames.push(include.as);

    // Set top level options
    if (options.topModel === options.model && options.subQuery === undefined && options.topLimit) {
      if (include.subQuery) {
        options.subQuery = include.subQuery;
      } else if (include.hasDuplicating) {
        options.subQuery = true;
      }
    }

    /* Legacy */
    options.hasIncludeWhere = options.hasIncludeWhere || include.hasIncludeWhere || Boolean(include.where);
    options.hasIncludeRequired = options.hasIncludeRequired || include.hasIncludeRequired || Boolean(include.required);

    if (include.association.isMultiAssociation || include.hasMultiAssociation) {
      options.hasMultiAssociation = true;
    }

    if (include.association.isSingleAssociation || include.hasSingleAssociation) {
      options.hasSingleAssociation = true;
    }
  }

  if (options.topModel === options.model && options.subQuery === undefined) {
    options.subQuery = false;
  }

  return options;
}

export function combineIncludes(a: any, b: any): any {
  if (a == null) {
    return b;
  }

  if (b == null) {
    return a;
  }

  if (!Array.isArray(a) || !Array.isArray(b)) {
    throw new TypeError('Includes should have already been normalized before calling this method, but it received something else than an array.');
  }

  const combinedIncludes = [...a];

  for (const newInclude of b) {
    const existingIndex = combinedIncludes.findIndex(include => {
      if (!include.association || !newInclude.association) {
        throw new TypeError('Include should have been normalized');
      }

      return include.association === newInclude.association;
    });

    if (existingIndex === -1) {
      combinedIncludes.push(newInclude);
      continue;
    }

    const ModelClass = newInclude.model;
    // _assignOptions *must* be called on the class of the Include's Model,
    //  otherwise the Include's includes won't be checked correctly.
    ModelClass._assignOptions(combinedIncludes[existingIndex], newInclude);
  }

  return combinedIncludes;
}

export function throwInvalidInclude(include: any): never {
  throw new EagerLoadingError(`Invalid Include received. Include has to be either a Model, an Association, the name of an association, or a plain object compatible with IncludeOptions.
Got ${NodeUtil.inspect(include)} instead`);
}

export function setTransactionFromCls(options: Transactionable, sequelize: Sequelize): void {
  if (options.transaction === undefined) {
    options.transaction = sequelize.getCurrentClsTransaction();
  }
}

export function conformIndex(index: IndexOptions): IndexOptions {
  if (!index.fields) {
    throw new Error('Missing "fields" property for index definition');
  }

  index = { ...index };

  if (index.type && index.type.toLowerCase() === 'unique') {
    index.unique = true;
    delete index.type;
  }

  return index;
}

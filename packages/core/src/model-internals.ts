import { cloneDeepPlainValues, freezeDescendants } from '@sequelize/utils';
import NodeUtil from 'node:util';
import type { IndexOptions } from './abstract-dialect/query-interface.js';
import type { WhereAttributeHash } from './abstract-dialect/where-sql-builder-types.js';
import { EagerLoadingError } from './errors';
import type { Attributes, Filterable, Model, Transactionable } from './model';
import type { ModelDefinition } from './model-definition.js';
import type { Sequelize } from './sequelize';
import { isDevEnv } from './utils/check.js';
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
        include.subQuery =
          include.subQuery ||
          (include.hasParentRequired && include.hasRequired && !include.separate);
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
    options.hasIncludeWhere =
      options.hasIncludeWhere || include.hasIncludeWhere || Boolean(include.where);
    options.hasIncludeRequired =
      options.hasIncludeRequired || include.hasIncludeRequired || Boolean(include.required);

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
    throw new TypeError(
      'Includes should have already been normalized before calling this method, but it received something else than an array.',
    );
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
  if (
    options.transaction &&
    options.connection &&
    options.connection !== options.transaction.getConnection()
  ) {
    throw new Error(
      `You are using mismatching "transaction" and "connection" options. Please pass either one of them, or make sure they're both using the same connection.`,
    );
  }

  if (options.transaction === undefined && options.connection == null) {
    const currentTransaction = sequelize.getCurrentClsTransaction();
    if (currentTransaction) {
      options.transaction = currentTransaction;
    }
  }

  if (options.connection) {
    const clsTransaction = sequelize.getCurrentClsTransaction();
    const transactionConnection = clsTransaction?.getConnectionIfExists();
    if (transactionConnection && transactionConnection === options.connection) {
      options.transaction = clsTransaction;
    }
  } else {
    const connection = options.transaction?.getConnectionIfExists();
    if (connection) {
      options.connection = connection;
    }
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

export function getPrimaryKeyValueOrThrow(instance: Model, attributeName: string): unknown {
  const attrVal = instance.get(attributeName, { raw: true });
  if (attrVal == null) {
    throw new TypeError(
      `This model instance method needs to be able to identify the entity in a stable way, but this model instance is missing the value of its primary key "${attributeName}". Make sure that attribute was not excluded when retrieving the model from the database.`,
    );
  }

  return attrVal;
}

/**
 * Returns a Where Object that can be used to uniquely select this instance, using the instance's primary keys.
 *
 * @param instance The instance for which the where options should be built.
 * @param checkVersion include version attribute in where hash
 * @param nullIfImpossible return null instead of throwing an error if the instance is missing its
 *   primary keys and therefore no Where object can be built.
 */
export function getModelPkWhere<M extends Model>(
  instance: M,
  checkVersion?: boolean,
  nullIfImpossible?: boolean,
): WhereAttributeHash<Attributes<M>> | null {
  const modelDefinition = instance.modelDefinition;

  if (modelDefinition.primaryKeysAttributeNames.size === 0) {
    if (nullIfImpossible) {
      return null;
    }

    assertHasPrimaryKey(modelDefinition);
  }

  const where = Object.create(null);

  for (const attributeName of modelDefinition.primaryKeysAttributeNames) {
    const attrVal = nullIfImpossible
      ? instance.get(attributeName, { raw: true })
      : getPrimaryKeyValueOrThrow(instance, attributeName);

    // nullIfImpossible case
    if (attrVal == null) {
      return null;
    }

    where[attributeName] = attrVal;
  }

  const versionAttr = modelDefinition.versionAttributeName;
  if (checkVersion && versionAttr) {
    where[versionAttr] = instance.get(versionAttr, { raw: true });
  }

  return where;
}

export function assertHasPrimaryKey(modelDefinition: ModelDefinition<any>) {
  if (modelDefinition.primaryKeysAttributeNames.size === 0) {
    throw new Error(
      `This model instance method needs to be able to identify the entity in a stable way, but the model does not have a primary key attribute definition.
Either add a primary key to this model, or use one of the following alternatives:

- instance methods "save", "update", "decrement", "increment": Use the static "update" method instead.
- instance method "reload": Use the static "findOne" method instead.
- instance methods "destroy" and "restore": use the static "destroy" and "restore" methods instead.
        `.trim(),
    );
  }
}

export function assertHasWhereOptions(options: Filterable | undefined): void {
  if (options?.where == null) {
    throw new Error(
      'As a safeguard, this method requires explicitly specifying a "where" option. If you actually mean to delete all rows in the table, set the option to a dummy condition such as sql`1 = 1`.',
    );
  }
}

export function ensureOptionsAreImmutable<T extends object>(options: T): T {
  if (isDevEnv()) {
    // Users should not mutate any mutable value inside `options`, and instead mutate the `options` object directly
    // This ensures `options` remains immutable while limiting ourselves to a shallow clone in production,
    // improving performance.
    return freezeDescendants(cloneDeepPlainValues(options, true));
  }

  return options;
}

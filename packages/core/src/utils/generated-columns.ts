import type { TableNameWithSchema } from '../abstract-dialect/query-interface.js';
import { BelongsToManyAssociation } from '../associations/belongs-to-many.js';
import { BelongsToAssociation } from '../associations/belongs-to.js';
import { HasManyAssociation } from '../associations/has-many.js';
import { HasOneAssociation } from '../associations/has-one.js';
import { BaseSqlExpression } from '../expression-builders/base-sql-expression.js';
import type { ModelStatic, NormalizedAttributeOptions } from '../model.js';

/**
 * A table read by generated attributes that use `dependsOn`: when its rows change, the rows of the model
 * whose `key` column matches one of the keys selected by `selectKeys` must be recomputed.
 */
export interface GeneratedColumnDependency {
  table: TableNameWithSchema;
  /** A column of the model's table */
  key: string;
  /**
   * Returns the SQL that selects the values of `key` of the rows to recompute.
   *
   * @param changedRows the relation that holds the changed rows of `table`
   */
  selectKeys(changedRows: string): string;
}

/**
 * Returns the associations an attribute's `generatedAs` option depends on, if any.
 *
 * @param attribute
 */
export function getGeneratedAttributeDependsOn(
  attribute: Pick<NormalizedAttributeOptions, 'generatedAs'>,
): readonly string[] | undefined {
  const { generatedAs } = attribute;
  if (generatedAs == null || generatedAs instanceof BaseSqlExpression) {
    return undefined;
  }

  return generatedAs.dependsOn;
}

/**
 * Lists the tables read by the generated attributes of a model that use `dependsOn`,
 * resolved from the model's associations.
 *
 * @param model
 */
export function getGeneratedColumnDependencies(model: ModelStatic): GeneratedColumnDependency[] {
  const { queryGenerator } = model.sequelize;
  const q = (identifier: string) => queryGenerator.quoteIdentifier(identifier);
  const dependencies = new Map<string, GeneratedColumnDependency>();

  function add(dependency: GeneratedColumnDependency) {
    // two associations to one table differ by the key of the model they match
    dependencies.set(
      `${queryGenerator.quoteTable(dependency.table)} ${dependency.key} ${dependency.selectKeys('')}`,
      dependency,
    );
  }

  for (const attribute of model.modelDefinition.attributes.values()) {
    for (const associationName of getGeneratedAttributeDependsOn(attribute) ?? []) {
      const association = model.associations[associationName];
      if (!association) {
        throw new Error(
          `Generated attribute "${model.name}.${attribute.attributeName}" depends on association "${associationName}", which ${model.name} does not have.`,
        );
      }

      if (association instanceof BelongsToManyAssociation) {
        const throughTable = association.throughModel.table;
        const sourceKey = q(association.identifierField);

        add({
          table: throughTable,
          key: association.sourceKeyField,
          selectKeys: rows => `SELECT ${sourceKey} FROM ${rows}`,
        });
        add({
          table: association.target.table,
          key: association.sourceKeyField,
          selectKeys: rows =>
            `SELECT through.${sourceKey} FROM ${queryGenerator.quoteTable(throughTable)} AS through INNER JOIN ${rows} AS target ON through.${q(association.foreignIdentifierField)} = target.${q(association.targetKeyField)}`,
        });
      } else if (
        association instanceof HasManyAssociation ||
        association instanceof HasOneAssociation
      ) {
        add({
          table: association.target.table,
          key: association.sourceKeyField,
          selectKeys: rows => `SELECT ${q(association.identifierField)} FROM ${rows}`,
        });
      } else if (association instanceof BelongsToAssociation) {
        add({
          table: association.target.table,
          key: association.identifierField,
          selectKeys: rows => `SELECT ${q(association.targetKeyField)} FROM ${rows}`,
        });
      }
    }
  }

  return [...dependencies.values()];
}

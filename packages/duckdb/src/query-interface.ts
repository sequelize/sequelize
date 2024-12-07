import {
    AbstractQueryInterface,
    AttributeOptions, CreateSavepointOptions, DropSchemaOptions,
    Model, NormalizedAttributeOptions,
    QiOptionsWithReplacements,
    QiUpsertOptions,
    QueryTypes, RollbackSavepointOptions,
    TableName, Transaction,
} from "@sequelize/core";
import type { DuckDbDialect } from "./dialect";
import { DuckDbQueryInterfaceInternal } from "./query-interface.internal";
import {
    assertNoReservedBind,
    combineBinds,
} from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/sql.js';
import { map } from "@sequelize/utils";
import { getObjectFromMap } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/object.js';
import { difference, intersection, uniq } from "lodash";

interface UpsertOptionsWithAllProperties<M extends Model> extends QiUpsertOptions<M> {
    updateOnDuplicate?: string[],
    upsertKeys?: string[],
    conflictFields?: string[],
    replacement?: any,
}

interface QiOptionsWithReplacementsWithAllProperties extends QiOptionsWithReplacements {
    updateOnDuplicate?: string[],
    upsertKeys?: string[],
}

export class DuckDbQueryInterface<
  Dialect extends DuckDbDialect = DuckDbDialect,
> extends AbstractQueryInterface<Dialect> {
    readonly #internalQueryInterface: DuckDbQueryInterfaceInternal;

    constructor(dialect: Dialect, internalQueryInterface?: DuckDbQueryInterfaceInternal) {
        internalQueryInterface ??= new DuckDbQueryInterfaceInternal(dialect);

        super(dialect, internalQueryInterface);
        this.#internalQueryInterface = internalQueryInterface;
    }

    // a copy of the one in core, except conflict columns do not get updated
    // to work around DuckDB's overly strict unique constraint enforcement
    async upsert<M extends Model>(tableName: TableName, insertValues: object, updateValues: object, where: object,
            inputOptions: QiUpsertOptions<M>): Promise<object> {

        if (inputOptions?.bind) {
            assertNoReservedBind(inputOptions.bind);
        }

        const options: UpsertOptionsWithAllProperties<M> = { ...inputOptions };

        const model = options.model;
        const modelDefinition = model.modelDefinition;

        options.type = QueryTypes.UPSERT;
        options.updateOnDuplicate = Object.keys(updateValues);
        options.upsertKeys = options.conflictFields || [];

        if (options.upsertKeys.length === 0) {
            const primaryKeys = Array.from(
                map(
                    modelDefinition.primaryKeysAttributeNames,
                    pkAttrName => modelDefinition.attributes?.get(pkAttrName)?.columnName || pkAttrName,
                ),
            );

            const uniqueColumnNames = Object.values(model.getIndexes())
                .filter(c => c.unique && c.fields?.length && c.fields?.length > 0)
                .map(c => c.fields as string[]);
            // For fields in updateValues, try to find a constraint or unique index
            // that includes given field. Only first matching upsert key is used.
            for (const field of options.updateOnDuplicate) {
                const indexKey = uniqueColumnNames.find(fields => fields.includes(field));
                if (indexKey && typeof indexKey === "string") {
                    options.upsertKeys.push(indexKey);
                    break;
                }
            }

            // Always use PK, if no constraint available OR update data contains PK
            if (
                options.upsertKeys.length === 0 ||
                intersection(options.updateOnDuplicate, primaryKeys).length > 0
            ) {
                options.upsertKeys = primaryKeys;
            }

            options.upsertKeys = uniq(options.upsertKeys);
            // This is the only real difference from the built-in upsert -- the keys do not participate
            // in the DO UPDATE SET clause. This should ideally be done in  abstract-dialect/query-interface
            // since those keys should not ever need to get updated, but since this is only causing problems
            // in DuckDB, for now the difference lives here.
            options.updateOnDuplicate = difference(options.updateOnDuplicate, options.upsertKeys);
        }

        const { bind, query } = this.queryGenerator.insertQuery(
            tableName,
            insertValues,
            getObjectFromMap(modelDefinition.attributes),
            options,
        ) as any as { query: string, bind?: { [key: string]: unknown }};

        // unlike bind, replacements are handled by QueryGenerator, not QueryRaw
        delete options.replacement;
        options.bind = combineBinds(options.bind || {}, bind || {});

        return this.sequelize.queryRaw(query, options);
    }

    // TBD: upsert and bulk insert can probably hijack the query and modify return fields before delegating to super
    async bulkInsert(tableName: TableName, records: object[], inputOptions?: QiOptionsWithReplacements,
                     attributes?: Record<string, AttributeOptions>): Promise<object | number> {

        const options: QiOptionsWithReplacementsWithAllProperties = { ...inputOptions, type: QueryTypes.INSERT };
        if (options.updateOnDuplicate && options.upsertKeys) {
            options.updateOnDuplicate = difference(options.updateOnDuplicate, options.upsertKeys);
        }

        const attrubutesWithCoercedType = attributes as { [columnName: string]: NormalizedAttributeOptions };
        const sql = this.queryGenerator.bulkInsertQuery(tableName, records, options, attrubutesWithCoercedType);

        // unlike bind, replacements are handled by QueryGenerator, not QueryRaw
        delete options.replacements;

        const results = await this.sequelize.queryRaw(sql, options);

        return results[0];
    }


    // Override private methods for savepoints for now since DuckDB does not support savepoints.
    // The alternative is or to gate the calls in transaction.ts on `this.sequelize.dialect.supports.savepoints`
    async _createSavepoint(_transaction: Transaction, _options: CreateSavepointOptions): Promise<void> {
        // no-op
    }

    async _rollbackSavepoint(_transaction: Transaction, _options: RollbackSavepointOptions): Promise<void> {
        // no-op
    }

    async dropSchema(schema: string, options?: DropSchemaOptions): Promise<void> {
        if (schema !== 'main') {
            // main schema cannot be dropped
            return super.dropSchema(schema, options);
        }
    }
}

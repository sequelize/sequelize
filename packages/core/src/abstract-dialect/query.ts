import Dottie from 'dottie';
import isEmpty from 'lodash/isEmpty';
import { randomUUID } from 'node:crypto';
import NodeUtil from 'node:util';
import type { Association } from '../associations/index.js';
import { QueryTypes } from '../enums.js';
import type { BuildOptions, IncludeOptions, Model, ModelStatic } from '../model';
import type { Sequelize } from '../sequelize';
import * as deprecations from '../utils/deprecations.js';
import type { AbstractConnection } from './connection-manager.js';
import type { NormalizedDataType } from './data-types.js';
import { AbstractDataType } from './data-types.js';

const uniqueKeyAttributesCache = new WeakMap<ModelStatic, readonly string[]>();
const columnAttributeNameCache = new WeakMap<ModelStatic, Map<string, string>>();

interface IncludeOptionsWithMap extends IncludeOptions {
  model?: ModelStatic;
  includeMap?: Record<string, IncludeOptionsWithMap | undefined>;
}

type IncludeMap = Record<string, IncludeOptionsWithMap | undefined>;

type RootIncludeOptions = IncludeOptionsWithMap & {
  model: ModelStatic;
  includeNames?: readonly string[];
};

interface BulkBuildOptionsInternal extends BuildOptions {
  includeNames?: readonly string[] | undefined;
  includeMap?: IncludeMap | undefined;
  includeValidated?: boolean | undefined;
  attributes?: readonly string[] | undefined;
  comesFromDatabase?: boolean | undefined;
}

interface HashEntry {
  itemHash: string;
  parentHash: string | null;
}

type LegacyUniqueKeyDefinition = { fields?: readonly string[] };

type ModelWithLegacyUniqueKeys = ModelStatic & {
  uniqueKeys?: Record<string, LegacyUniqueKeyDefinition>;
};

type metaEntry = {
  key: string;
  attribute: string;
  prefixParts: readonly string[];
  prefixLength: number;
  prefixId: string;
  lastKeySegment: string;
  include: IncludeOptionsWithMap | undefined;
  parentPrefixId: string;
  primaryKeyAttributes: readonly string[];
  uniqueKeyAttributes: readonly string[];
};

function getAttributeNameFromColumn(model: ModelStatic, columnOrAttribute: string): string {
  const definition = model.modelDefinition;

  if (definition.attributes.has(columnOrAttribute)) {
    return columnOrAttribute;
  }

  let cache = columnAttributeNameCache.get(model);
  if (!cache) {
    cache = new Map<string, string>();
    for (const attribute of definition.attributes.values()) {
      cache.set(attribute.columnName, attribute.attributeName);
    }

    columnAttributeNameCache.set(model, cache);
  }

  return cache.get(columnOrAttribute) ?? columnOrAttribute;
}

function remapRowFields(
  row: Record<string, unknown>,
  fieldMap: Record<string, string>,
): Record<string, unknown> {
  const output: Record<string, unknown> = { ...row };

  for (const field of Object.keys(fieldMap)) {
    const name = fieldMap[field];
    if (field in output && name !== field) {
      output[name] = output[field];
      delete output[field];
    }
  }

  return output;
}

function isIterable(value: unknown): value is Iterable<unknown> {
  return value != null && typeof (value as Iterable<unknown>)[Symbol.iterator] === 'function';
}

function extractAssociation(
  association: IncludeOptions['association'] | undefined,
): Association | undefined {
  if (association && typeof association === 'object') {
    return association;
  }

  return undefined;
}

function getUniqueKeyAttributes(model: ModelStatic): readonly string[] {
  const cached = uniqueKeyAttributesCache.get(model);
  if (cached) {
    return cached;
  }

  const uniqueKeys = (model as ModelWithLegacyUniqueKeys).uniqueKeys ?? {};
  const uniqueKeyAttributes: string[] = [];

  if (!isEmpty(uniqueKeys)) {
    const [firstUniqueKeyName] = Object.keys(uniqueKeys);
    const uniqueKey = firstUniqueKeyName ? uniqueKeys[firstUniqueKeyName] : undefined;
    const fields: readonly unknown[] = uniqueKey?.fields ?? [];

    for (const field of fields) {
      if (typeof field !== 'string') {
        continue;
      }

      uniqueKeyAttributes.push(getAttributeNameFromColumn(model, field));
    }
  }

  uniqueKeyAttributesCache.set(model, uniqueKeyAttributes);

  return uniqueKeyAttributes;
}

function sortByDepth(inputKeys: string[]) {
  return inputKeys.sort((a, b) => a.split('.').length - b.split('.').length);
}

function stringify(obj: unknown) {
  return obj instanceof Buffer ? obj.toString('hex') : (obj?.toString() ?? '');
}

function getHash(model: ModelStatic, row: Record<string, unknown>): string {
  const strings: string[] = [];
  const primaryKeyAttributes = model.primaryKeyAttributes ?? [];

  if (primaryKeyAttributes.length > 0) {
    for (const attributeName of primaryKeyAttributes) {
      strings.push(stringify(row[attributeName]));
    }
  } else {
    const uniqueKeyAttributes = getUniqueKeyAttributes(model);
    for (const attributeName of uniqueKeyAttributes) {
      strings.push(stringify(row[attributeName]));
    }
  }

  if (isEmpty(strings) && !isEmpty(model.getIndexes())) {
    for (const index of model.getIndexes()) {
      if (!index.unique || !index.fields) {
        continue;
      }

      for (const field of index.fields) {
        // Skip function-based or literal index fields - we can only hash simple attribute names
        if (typeof field !== 'string') {
          continue;
        }

        const attributeName = getAttributeNameFromColumn(model, field);
        strings.push(stringify(row[attributeName]));
      }
    }
  }

  return strings.join('');
}

function getHashesForPrefix(
  prefix: string,
  currentRow: Record<string, unknown>,
  currentIncludeMap: IncludeMap,
  currentPrefixMeta: Map<string, metaEntry>,
  currentTopHash: string,
  prefixHashCache?: Map<string, HashEntry>,
): HashEntry {
  const cache = prefixHashCache ?? new Map<string, HashEntry>();

  if (!cache.has('')) {
    cache.set('', { itemHash: currentTopHash, parentHash: null });
  }

  if (prefix === '') {
    return cache.get('')!;
  }

  const cached = cache.get(prefix);
  if (cached) {
    return cached;
  }

  const include = currentIncludeMap[prefix] ?? currentPrefixMeta.get(prefix)?.include;
  if (!include?.model) {
    return cache.get('')!;
  }

  const prefixInfo = currentPrefixMeta.get(prefix);

  const primaryKeyAttributes = prefixInfo?.primaryKeyAttributes?.length
    ? prefixInfo.primaryKeyAttributes
    : [...include.model.modelDefinition.primaryKeysAttributeNames.values()];

  let attributesToHash = primaryKeyAttributes;

  if (attributesToHash.length === 0) {
    const uniqueKeyAttributes = prefixInfo?.uniqueKeyAttributes?.length
      ? prefixInfo.uniqueKeyAttributes
      : getUniqueKeyAttributes(include.model);

    attributesToHash = uniqueKeyAttributes;
  }

  let hash = prefix;

  if (attributesToHash.length > 0) {
    for (const attributeName of attributesToHash) {
      const key = prefix ? `${prefix}.${attributeName}` : attributeName;
      hash += stringify(currentRow[key]);
    }
  }

  const parentPrefixIndex = prefix.lastIndexOf('.');
  const parentPrefix = parentPrefixIndex === -1 ? '' : prefix.slice(0, parentPrefixIndex);
  const parentHashes = getHashesForPrefix(
    parentPrefix,
    currentRow,
    currentIncludeMap,
    currentPrefixMeta,
    currentTopHash,
    cache,
  );
  const parentHashValue = parentHashes.itemHash;

  const result: HashEntry = {
    itemHash: parentHashValue + hash,
    parentHash: parentHashValue,
  };
  cache.set(prefix, result);

  return result;
}

export interface AbstractQueryGroupJoinDataOptions {
  checkExisting: boolean;
}

export interface AbstractQueryOptions {
  instance?: Model;
  model?: ModelStatic;
  type?: QueryTypes;
  fieldMap?: Record<string, string> | boolean;
  plain: boolean;
  raw: boolean;
  nest?: boolean;
  hasJoin?: boolean;
  hasMultiAssociation?: boolean;
  logging?: boolean | ((sql: string, timing?: number) => void);
  benchmark?: boolean;
  logQueryParameters?: boolean;
  queryLabel?: string;
  include?: IncludeOptions[] | boolean;
  includeNames?: readonly string[];
  includeMap?: IncludeMap;
  originalAttributes?: readonly string[];
  attributes?: readonly string[];
  rawErrors?: boolean;
  [key: string]: unknown;
}

export interface AbstractQueryFormatBindOptions {
  /** skip unescaping $$ */
  skipUnescape: boolean;
  /** do not replace (but do unescape $$) */
  skipValueReplace: boolean;
}

export class AbstractQuery {
  declare sql: string;
  readonly uuid: string;
  readonly connection: AbstractConnection;
  readonly instance?: Model | undefined;
  readonly model?: ModelStatic | undefined;
  readonly sequelize: Sequelize;
  options: AbstractQueryOptions;

  constructor(
    connection: AbstractConnection,
    sequelize: Sequelize,
    options?: AbstractQueryOptions,
  ) {
    this.uuid = randomUUID();
    this.connection = connection;
    this.sequelize = sequelize;

    const mergedOptions: AbstractQueryOptions = {
      plain: false,
      raw: false,
      logging: console.debug,
      ...options,
    };

    this.instance = mergedOptions.instance;
    this.model = mergedOptions.model;
    this.options = mergedOptions;
    this.checkLoggingOption();

    if (mergedOptions.rawErrors) {
      this.formatError = AbstractQuery.prototype.formatError;
    }
  }

  async logWarnings<T>(results: T): Promise<T> {
    const warningResultsRaw = await this.run('SHOW WARNINGS');
    const warningRows = Array.isArray(warningResultsRaw) ? warningResultsRaw : [];
    const warningMessage = `${this.sequelize.dialect.name} warnings (${this.connection.uuid || 'default'}): `;
    const messages: string[] = [];

    for (const warningRow of warningRows) {
      if (!isIterable(warningRow)) {
        continue;
      }

      for (const warningResult of warningRow) {
        if (
          warningResult &&
          typeof warningResult === 'object' &&
          Object.hasOwn(warningResult, 'Message') &&
          typeof (warningResult as { Message: unknown }).Message === 'string'
        ) {
          messages.push((warningResult as { Message: string }).Message);
          continue;
        }

        const keysFunction = (warningResult as { keys?(): Iterable<string> })?.keys;
        if (!keysFunction) {
          continue;
        }

        const iterator = keysFunction.call(warningResult);
        if (!isIterable(iterator)) {
          continue;
        }

        const record = warningResult as Record<string, unknown>;
        for (const objectKey of iterator) {
          messages.push([objectKey, record[objectKey]].join(': '));
        }
      }
    }

    this.sequelize.log(warningMessage + messages.join('; '), this.options);

    return results;
  }

  formatError<T extends Error>(error: T, errStack?: string): T {
    if (errStack) {
      error.stack = errStack;
    }

    return error;
  }

  async run(_sql: string, _parameters?: unknown, _options?: unknown): Promise<unknown> {
    throw new Error("The run method wasn't overwritten!");
  }

  private checkLoggingOption(): void {
    if (this.options.logging === true) {
      deprecations.noTrueLogging();
      this.options.logging = console.debug;
    }
  }

  protected getInsertIdField(): string {
    return 'insertId';
  }

  protected getUniqueConstraintErrorMessage(field?: string): string {
    if (!field) {
      return 'Must be unique';
    }

    const message = `${field} must be unique`;

    if (!this.model) {
      return message;
    }

    const model = this.model;

    for (const index of model.getIndexes()) {
      if (!index.unique || !index.fields) {
        continue;
      }

      const normalizedField = field.replaceAll('"', '');
      const matches = index.fields.some(
        indexField => typeof indexField === 'string' && indexField === normalizedField,
      );

      if (matches && index.msg) {
        return index.msg;
      }
    }

    return message;
  }

  protected isRawQuery(): boolean {
    return this.options.type === QueryTypes.RAW;
  }

  protected isUpsertQuery(): boolean {
    return this.options.type === QueryTypes.UPSERT;
  }

  protected isInsertQuery(
    results?: Record<string, unknown>,
    metaData?: Record<string, unknown>,
  ): boolean {
    if (this.options.type === QueryTypes.INSERT) {
      return true;
    }

    const sql = this.sql?.toLowerCase() ?? '';
    let result = true;
    result &&= sql.startsWith('insert into');
    result &&= !results || Object.hasOwn(results, this.getInsertIdField());
    result &&= !metaData || Object.hasOwn(metaData, this.getInsertIdField());

    return result;
  }

  protected handleInsertQuery(
    results?: Record<string, unknown>,
    metaData?: Record<string, unknown>,
  ): void {
    if (!this.instance) {
      return;
    }

    const autoIncrementAttribute = this.model?.modelDefinition?.autoIncrementAttributeName;

    if (!autoIncrementAttribute) {
      return;
    }

    const id = results?.[this.getInsertIdField()] ?? metaData?.[this.getInsertIdField()] ?? null;
    const instanceRecord = this.instance as unknown as Record<string, unknown>;
    instanceRecord[autoIncrementAttribute] = id;
  }

  protected isShowIndexesQuery(): boolean {
    return this.options.type === QueryTypes.SHOWINDEXES;
  }

  protected isShowConstraintsQuery(): boolean {
    return this.options.type === QueryTypes.SHOWCONSTRAINTS;
  }

  protected isDescribeQuery(): boolean {
    return this.options.type === QueryTypes.DESCRIBE;
  }

  protected isSelectQuery(): boolean {
    return this.options.type === QueryTypes.SELECT;
  }

  protected isBulkUpdateQuery(): boolean {
    return this.options.type === QueryTypes.BULKUPDATE;
  }

  protected isDeleteQuery(): boolean {
    return this.options.type === QueryTypes.DELETE;
  }

  protected isUpdateQuery(): boolean {
    return this.options.type === QueryTypes.UPDATE;
  }

  protected handleSelectQuery(results: Array<Record<string, unknown>>): unknown {
    let processedResults: Array<Record<string, unknown>> = results;
    let result: unknown = null;

    if (this.options.fieldMap && typeof this.options.fieldMap === 'object') {
      processedResults = processedResults.map(row =>
        remapRowFields(row, this.options.fieldMap as Record<string, string>),
      );
    }

    if (this.options.raw) {
      const rawRows = processedResults.map(row => {
        const output: Record<string, unknown> = {};

        for (const key of Object.keys(row)) {
          output[key] = row[key];
        }

        return this.options.nest ? Dottie.transform(output) : output;
      });

      result = rawRows;
    } else if (this.options.hasJoin === true && this.model) {
      const model = this.model;
      const includeMap = this.options.includeMap;

      const joinedResults = AbstractQuery._groupJoinData(
        processedResults,
        {
          model,
          ...(includeMap !== undefined && { includeMap }),
          ...(this.options.includeNames !== undefined && {
            includeNames: this.options.includeNames,
          }),
        },
        {
          checkExisting: Boolean(this.options.hasMultiAssociation),
        },
      );

      const parsedRows = this._parseDataArrayByType(joinedResults, model, includeMap);
      const buildOptions: BulkBuildOptionsInternal = {
        isNewRecord: false,
        includeNames: this.options.includeNames,
        includeMap,
        includeValidated: true,
        attributes: this.options.originalAttributes ?? this.options.attributes,
        raw: true,
        comesFromDatabase: true,
      };

      const includeOption =
        typeof this.options.include === 'boolean' ? undefined : this.options.include;
      if (includeOption !== undefined) {
        buildOptions.include = includeOption;
      }

      result = model.bulkBuild(
        parsedRows as unknown as Parameters<typeof model.bulkBuild>[0],
        buildOptions as unknown as Parameters<typeof model.bulkBuild>[1],
      );
    } else if (this.model) {
      const model = this.model;
      const parsedRows = this._parseDataArrayByType(
        processedResults,
        model,
        this.options.includeMap,
      );
      const buildOptions: BulkBuildOptionsInternal = {
        isNewRecord: false,
        raw: true,
        comesFromDatabase: true,
        attributes: this.options.originalAttributes ?? this.options.attributes,
      };

      result = model.bulkBuild(
        parsedRows as unknown as Parameters<typeof model.bulkBuild>[0],
        buildOptions as unknown as Parameters<typeof model.bulkBuild>[1],
      );
    }

    if (this.options.plain && Array.isArray(result)) {
      return result.length === 0 ? null : result[0];
    }

    return result;
  }

  protected _parseDataArrayByType(
    valueArrays: Array<Record<string, unknown>>,
    model?: ModelStatic,
    includeMap?: IncludeMap,
  ): Array<Record<string, unknown>> {
    for (const values of valueArrays) {
      this._parseDataByType(values, model, includeMap);
    }

    return valueArrays;
  }

  protected _parseDataByType(
    values: Record<string, unknown>,
    model?: ModelStatic,
    includeMap?: IncludeMap,
  ): Record<string, unknown> {
    for (const key of Object.keys(values)) {
      const nestedInclude = includeMap?.[key];
      if (nestedInclude) {
        const child = values[key];
        if (Array.isArray(child)) {
          values[key] = this._parseDataArrayByType(
            child as Array<Record<string, unknown>>,
            nestedInclude.model,
            nestedInclude.includeMap,
          );
        } else if (child && typeof child === 'object') {
          values[key] = this._parseDataByType(
            child as Record<string, unknown>,
            nestedInclude.model,
            nestedInclude.includeMap,
          );
        }

        continue;
      }

      const attribute = model?.modelDefinition?.attributes.get(key);
      values[key] = this._parseDatabaseValue(values[key], attribute?.type);
    }

    return values;
  }

  protected _parseDatabaseValue(value: unknown, attributeType?: NormalizedDataType): unknown {
    if (value == null) {
      return value;
    }

    if (!attributeType || !(attributeType instanceof AbstractDataType)) {
      return value;
    }

    return attributeType.parseDatabaseValue(value);
  }

  protected isShowOrDescribeQuery(): boolean {
    const sql = this.sql?.toLowerCase() ?? '';

    return sql.startsWith('show') || sql.startsWith('describe');
  }

  protected isCallQuery(): boolean {
    return (this.sql?.toLowerCase() ?? '').startsWith('call');
  }

  protected _logQuery(
    sql: string,
    debugContext: (msg: string) => void,
    parameters?: unknown[] | Record<string, unknown>,
  ): () => void {
    const { connection, options } = this;
    const benchmark = this.sequelize.options.benchmark || options.benchmark;
    const logQueryParameters =
      this.sequelize.options.logQueryParameters || options.logQueryParameters;
    const startTime = Date.now();
    let logParameter = '';

    if (logQueryParameters && parameters) {
      const delimiter = sql.endsWith(';') ? '' : ';';
      logParameter = `${delimiter} with parameters ${NodeUtil.inspect(parameters)}`;
    }

    const fmt = `(${connection.uuid || 'default'}): ${sql}${logParameter}`;
    const queryLabel = options.queryLabel ? `${options.queryLabel}\n` : '';
    const msg = `${queryLabel}Executing ${fmt}`;
    debugContext(msg);
    if (!benchmark) {
      this.sequelize.log(`${queryLabel}Executing ${fmt}`, options);
    }

    return () => {
      const afterMsg = `${queryLabel}Executed ${fmt}`;
      debugContext(afterMsg);
      if (benchmark) {
        this.sequelize.log(afterMsg, Date.now() - startTime, options);
      }
    };
  }

  static _groupJoinData(
    rows: Array<Record<string, unknown>>,
    includeOptions: RootIncludeOptions,
    options: AbstractQueryGroupJoinDataOptions,
  ): Array<Record<string, unknown>> {
    if (rows.length === 0) {
      return [];
    }

    let length: number;
    const rowsLength = rows.length;
    let keys: string[] = [];

    let keyLength = 0;
    let keyMeta: metaEntry[] = [];
    let prefixMeta = new Map<string, metaEntry>();
    let meta: metaEntry | undefined;
    let prevMeta: metaEntry | undefined;
    let values: Record<string, unknown> = {};
    let topValues: Record<string, unknown> = {};
    let topExists = false;
    const checkExisting = options.checkExisting;
    let itemHash = '';
    let parentHash: string | null = null;

    const results: Array<Record<string, unknown>> = checkExisting
      ? []
      : Array.from({ length: rowsLength });
    const resultMap: Record<string, Record<string, unknown>> = {};
    const includeMap: IncludeMap = {};
    let $current: Record<string, unknown> | undefined;

    let primaryKeyAttributes: readonly string[] = [];
    let uniqueKeyAttributes: readonly string[] = [];

    for (let rowsI = 0; rowsI < rowsLength; rowsI++) {
      const row = rows[rowsI];
      let prefixHashCache: Map<string, HashEntry> | undefined;
      let topHash = '';

      if (rowsI === 0) {
        keys = sortByDepth(Object.keys(row));
        keyLength = keys.length;
        keyMeta = [];
        prefixMeta = new Map<string, metaEntry>();
        const prefixPartsCache = new Map<string, readonly string[]>();

        for (const rawKey of keys) {
          const lastDotIndex = rawKey.lastIndexOf('.');
          const prefixId = lastDotIndex === -1 ? '' : rawKey.slice(0, lastDotIndex);
          let prefixParts = prefixPartsCache.get(prefixId);
          if (!prefixParts) {
            prefixParts = prefixId ? prefixId.split('.') : [];
            prefixPartsCache.set(prefixId, prefixParts);
          }

          const prefixLength = prefixParts.length;
          const attribute = lastDotIndex === -1 ? rawKey : rawKey.slice(lastDotIndex + 1);
          const lastKeySegment = prefixLength ? prefixParts[prefixLength - 1] : '';

          if (!Object.hasOwn(includeMap, rawKey)) {
            if (prefixLength === 0) {
              includeMap[rawKey] = includeOptions;
              includeMap[''] = includeOptions;
            } else {
              let currentInclude: IncludeOptionsWithMap | undefined = includeOptions;
              let previousPiece: string | undefined;
              let resolvedInclude: IncludeOptionsWithMap | undefined;

              for (const piece of prefixParts) {
                const nextInclude: IncludeOptionsWithMap | undefined =
                  currentInclude?.includeMap?.[piece];
                if (!nextInclude) {
                  resolvedInclude = undefined;
                  break;
                }

                resolvedInclude = nextInclude;
                previousPiece = previousPiece ? `${previousPiece}.${piece}` : piece;
                includeMap[previousPiece] = nextInclude;
                currentInclude = nextInclude;
              }

              if (resolvedInclude) {
                includeMap[rawKey] = resolvedInclude;
              }
            }
          }

          const includeForKey = includeMap[rawKey];
          const modelForKey = includeForKey?.model;
          const parentPrefixId =
            prefixLength === 0
              ? ''
              : prefixId.slice(0, Math.max(0, prefixId.lastIndexOf('.'))) || '';
          primaryKeyAttributes = modelForKey?.primaryKeyAttributes ?? [];
          const hasUniqueKeys = modelForKey ? !isEmpty(modelForKey.uniqueKeys) : false;
          uniqueKeyAttributes =
            hasUniqueKeys && modelForKey ? getUniqueKeyAttributes(modelForKey) : [];

          const metaEntry = {
            key: rawKey,
            attribute,
            prefixParts,
            prefixLength,
            prefixId,
            lastKeySegment,
            include: includeForKey,
            parentPrefixId,
            primaryKeyAttributes,
            uniqueKeyAttributes,
          };

          keyMeta.push(metaEntry);

          if (!prefixMeta.has(prefixId)) {
            prefixMeta.set(prefixId, metaEntry);
          }
        }
      }

      if (checkExisting) {
        topExists = false;
        topHash = getHash(includeOptions.model, row);
        prefixHashCache = new Map<string, HashEntry>();
        prefixHashCache.set('', { itemHash: topHash, parentHash: null });
      }

      values = {};
      topValues = values;
      prevMeta = undefined;
      for (let keyI = 0; keyI < keyLength; keyI++) {
        const key = keys[keyI];
        meta = keyMeta[keyI];

        if (prevMeta && prevMeta.prefixParts !== meta.prefixParts) {
          if (checkExisting) {
            length = prevMeta.prefixLength;
            parentHash = null;
            if (length) {
              const hashes = getHashesForPrefix(
                prevMeta.prefixId,
                row,
                includeMap,
                prefixMeta,
                topHash,
                prefixHashCache,
              );

              itemHash = hashes.itemHash;
              parentHash = hashes.parentHash;
            } else {
              itemHash = topHash;
            }

            if (itemHash === topHash) {
              if (!resultMap[itemHash]) {
                resultMap[itemHash] = values;
              } else {
                topExists = true;
              }
            } else if (!resultMap[itemHash]) {
              resultMap[itemHash] = values;
              const lastKeySegment = prevMeta.lastKeySegment;
              const association = extractAssociation(prevMeta.include?.association);
              const parentContainer = parentHash ? resultMap[parentHash] : undefined;

              if (association?.isSingleAssociation) {
                if (parentContainer) {
                  parentContainer[lastKeySegment] = values;
                }
              } else if (parentContainer) {
                const existing = parentContainer[lastKeySegment];
                const associationValues: Array<Record<string, unknown>> = Array.isArray(existing)
                  ? (existing as Array<Record<string, unknown>>)
                  : [];

                if (!Array.isArray(existing)) {
                  parentContainer[lastKeySegment] = associationValues;
                }

                associationValues.push(values);
              }
            }

            values = {};
          } else {
            $current = topValues;
            length = meta.prefixLength;
            if (length) {
              const prefixParts = meta.prefixParts;
              let index = 0;
              for (const part of prefixParts) {
                if (index === length - 1) {
                  $current[part] = {};
                  values = $current[part] as Record<string, unknown>;
                }

                const nextCurrent = $current[part];
                if (typeof nextCurrent !== 'object' || nextCurrent == null) {
                  $current[part] = {};
                }

                $current = $current[part] as Record<string, unknown>;
                index++;
              }
            }
          }
        }

        values[meta.attribute] = row[key];
        prevMeta = meta;
      }

      if (checkExisting && prevMeta) {
        length = prevMeta.prefixLength;
        parentHash = null;

        if (length) {
          const hashes = getHashesForPrefix(
            prevMeta.prefixId,
            row,
            includeMap,
            prefixMeta,
            topHash,
            prefixHashCache,
          );

          itemHash = hashes.itemHash;
          parentHash = hashes.parentHash;
        } else {
          itemHash = topHash;
        }

        if (itemHash === topHash) {
          if (!resultMap[itemHash]) {
            resultMap[itemHash] = values;
          } else {
            topExists = true;
          }
        } else if (!resultMap[itemHash]) {
          resultMap[itemHash] = values;
          const parentContainer = parentHash ? resultMap[parentHash] : undefined;
          const lastKeyPrefix = prevMeta.lastKeySegment;
          const association = extractAssociation(prevMeta.include?.association);

          if (association?.isSingleAssociation) {
            if (parentContainer) {
              parentContainer[lastKeyPrefix] = values;
            }
          } else if (parentContainer) {
            const existing = parentContainer[lastKeyPrefix];
            const associationValues: Array<Record<string, unknown>> = Array.isArray(existing)
              ? (existing as Array<Record<string, unknown>>)
              : [];

            if (!Array.isArray(existing)) {
              parentContainer[lastKeyPrefix] = associationValues;
            }

            associationValues.push(values);
          }
        }

        if (!topExists) {
          results.push(topValues);
        }
      } else if (!checkExisting) {
        results[rowsI] = topValues;
      }
    }

    return results;
  }
}

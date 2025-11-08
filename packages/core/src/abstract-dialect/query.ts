/* eslint-disable unicorn/no-for-loop */

// We're disabling the unicorn/no-for-loop rule in this file
// because we need the performance benefits of traditional for-loops
// and JIT compilers love the reduced complexity

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
  hashAttributeRowKeys: readonly string[];
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

  const fields = Object.keys(fieldMap);

  for (let index = 0; index < fields.length; ++index) {
    const field = fields[index];
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

function buildHashAttributeRowKeys(
  prefixId: string,
  primaryKeyAttributes: readonly string[],
  uniqueKeyAttributes: readonly string[],
): readonly string[] {
  const attributeNames =
    primaryKeyAttributes.length > 0 ? primaryKeyAttributes : uniqueKeyAttributes;

  if (attributeNames.length === 0) {
    return [];
  }

  const rowKeyPrefix = prefixId ? `${prefixId}.` : '';

  return attributeNames.map(attributeName => `${rowKeyPrefix}${attributeName}`);
}

type ExistingSegmentResult = {
  nextValues: Record<string, unknown>;
  topExists: boolean;
};

function computeHashesForMeta(
  meta: metaEntry,
  row: Record<string, unknown>,
  includeMap: IncludeMap,
  prefixMeta: Map<string, metaEntry>,
  topHash: string,
  prefixHashCache: Map<string, HashEntry> | undefined,
): HashEntry {
  if (meta.prefixLength === 0) {
    return { itemHash: topHash, parentHash: null };
  }

  return getHashesForPrefix(meta.prefixId, row, includeMap, prefixMeta, topHash, prefixHashCache);
}

function attachToParent(
  meta: metaEntry,
  parentHash: string | null,
  resultMap: Record<string, Record<string, unknown>>,
  childValues: Record<string, unknown>,
): void {
  if (!parentHash) {
    return;
  }

  const parentContainer = resultMap[parentHash];
  if (!parentContainer) {
    return;
  }

  const association = extractAssociation(meta.include?.association);
  const associationKey = meta.lastKeySegment;

  if (!association || !association.isMultiAssociation) {
    parentContainer[associationKey] = childValues;

    return;
  }

  let associationValues = parentContainer[associationKey];
  if (!Array.isArray(associationValues)) {
    const newAssociationValues: Array<Record<string, unknown>> = [];
    parentContainer[associationKey] = newAssociationValues;
    associationValues = newAssociationValues;
  }

  (associationValues as Array<Record<string, unknown>>).push(childValues);
}

function attachExistingSegment(
  previousMeta: metaEntry,
  row: Record<string, unknown>,
  includeMap: IncludeMap,
  prefixMeta: Map<string, metaEntry>,
  topHash: string,
  prefixHashCache: Map<string, HashEntry> | undefined,
  currentValues: Record<string, unknown>,
  resultMap: Record<string, Record<string, unknown>>,
): ExistingSegmentResult {
  const hashes = computeHashesForMeta(
    previousMeta,
    row,
    includeMap,
    prefixMeta,
    topHash,
    prefixHashCache,
  );
  const nextValues: Record<string, unknown> = {};

  if (hashes.itemHash === topHash) {
    if (!resultMap[topHash]) {
      resultMap[topHash] = currentValues;

      return { nextValues, topExists: false };
    }

    return { nextValues, topExists: true };
  }

  if (!resultMap[hashes.itemHash]) {
    resultMap[hashes.itemHash] = currentValues;
    attachToParent(previousMeta, hashes.parentHash, resultMap, currentValues);
  }

  return { nextValues, topExists: false };
}

function ensureNestedContainer(
  topValues: Record<string, unknown>,
  meta: metaEntry,
): Record<string, unknown> {
  if (meta.prefixLength === 0) {
    return topValues;
  }

  let current = topValues;
  const { prefixParts, prefixLength } = meta;

  for (let index = 0; index < prefixLength; ++index) {
    const part = prefixParts[index];
    if (index === prefixLength - 1) {
      if (typeof current[part] !== 'object' || current[part] == null) {
        current[part] = {};
      }

      return current[part] as Record<string, unknown>;
    }

    if (typeof current[part] !== 'object' || current[part] == null) {
      current[part] = {};
    }

    current = current[part] as Record<string, unknown>;
  }

  return current;
}

function finalizeExistingRow(
  previousMeta: metaEntry,
  row: Record<string, unknown>,
  includeMap: IncludeMap,
  prefixMeta: Map<string, metaEntry>,
  topHash: string,
  prefixHashCache: Map<string, HashEntry> | undefined,
  currentValues: Record<string, unknown>,
  resultMap: Record<string, Record<string, unknown>>,
  currentTopExists: boolean,
): boolean {
  const hashes = computeHashesForMeta(
    previousMeta,
    row,
    includeMap,
    prefixMeta,
    topHash,
    prefixHashCache,
  );

  if (hashes.itemHash === topHash) {
    if (!resultMap[topHash]) {
      resultMap[topHash] = currentValues;

      return currentTopExists;
    }

    return true;
  }

  if (!resultMap[hashes.itemHash]) {
    resultMap[hashes.itemHash] = currentValues;
    attachToParent(previousMeta, hashes.parentHash, resultMap, currentValues);
  }

  return currentTopExists;
}

function resolveIncludeForKey(
  rawKey: string,
  prefixParts: readonly string[],
  rootInclude: IncludeOptionsWithMap,
  includeMap: IncludeMap,
): IncludeOptionsWithMap | undefined {
  if (prefixParts.length === 0) {
    includeMap[rawKey] = rootInclude;
    includeMap[''] = rootInclude;

    return rootInclude;
  }

  let resolvedInclude: IncludeOptionsWithMap | undefined;
  let currentInclude: IncludeOptionsWithMap | undefined = rootInclude;
  let accumulatedPath: string | undefined;

  for (const piece of prefixParts) {
    currentInclude = currentInclude?.includeMap?.[piece];
    if (!currentInclude) {
      return undefined;
    }

    accumulatedPath = accumulatedPath ? `${accumulatedPath}.${piece}` : piece;
    includeMap[accumulatedPath] = currentInclude;
    resolvedInclude = currentInclude;
  }

  if (resolvedInclude) {
    includeMap[rawKey] = resolvedInclude;
  }

  return resolvedInclude;
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

    for (let fieldIndex = 0; fieldIndex < fields.length; fieldIndex++) {
      const field = fields[fieldIndex];
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
  const primaryKeyAttributes = model.modelDefinition.primaryKeysAttributeNames;

  if (primaryKeyAttributes.size > 0) {
    for (const attributeName of primaryKeyAttributes) {
      strings.push(stringify(row[attributeName]));
    }
  } else {
    const uniqueKeyAttributes = getUniqueKeyAttributes(model);
    for (let attributeIndex = 0; attributeIndex < uniqueKeyAttributes.length; attributeIndex++) {
      const attributeName = uniqueKeyAttributes[attributeIndex];
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

  const prefixInfo = currentPrefixMeta.get(prefix);
  const include = currentIncludeMap[prefix] ?? prefixInfo?.include;
  if (!include?.model) {
    return cache.get('')!;
  }

  let hash = prefix;
  let hashAttributeRowKeys = prefixInfo?.hashAttributeRowKeys ?? [];

  if (hashAttributeRowKeys.length === 0) {
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

    if (attributesToHash.length > 0) {
      const rowKeyPrefix = prefix ? `${prefix}.` : '';
      hashAttributeRowKeys = attributesToHash.map(
        attributeName => `${rowKeyPrefix}${attributeName}`,
      );
      if (prefixInfo) {
        prefixInfo.hashAttributeRowKeys = hashAttributeRowKeys;
      }
    }
  }

  if (hashAttributeRowKeys.length > 0) {
    for (const attributeKey of hashAttributeRowKeys) {
      hash += stringify(currentRow[attributeKey]);
    }
  }

  const parentPrefix =
    prefixInfo?.parentPrefixId ??
    (prefix.includes('.') ? prefix.slice(0, prefix.lastIndexOf('.')) : '');
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

        const keys = Object.keys(row);
        for (let index = 0; index < keys.length; ++index) {
          const key = keys[index];
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
    for (let index = 0; index < valueArrays.length; ++index) {
      const values = valueArrays[index];
      this._parseDataByType(values, model, includeMap);
    }

    return valueArrays;
  }

  protected _parseDataByType(
    values: Record<string, unknown>,
    model?: ModelStatic,
    includeMap?: IncludeMap,
  ): Record<string, unknown> {
    const keys = Object.keys(values);
    for (let index = 0; index < keys.length; ++index) {
      const key = keys[index];
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

    const rowsLength = rows.length;
    let keys: string[] = [];
    let keyLength = 0;
    let keyMeta: metaEntry[] = [];
    let prefixMeta = new Map<string, metaEntry>();
    const checkExisting = options.checkExisting;

    // disabled eslint rule for this line as we want a fixed length array here for optimization.
    // at scale, this gives a measurable performance improvement.
    //
    // Benchmarks: N = 250_000 K = 20
    // new Array(n) + indexed write x 979 ops/sec ±1.06% (91 runs sampled)
    // Array.from({length:n}) x 100 ops/sec ±0.60% (74 runs sampled)
    // push into [] x 331 ops/sec ±1.81% (78 runs sampled)
    // pre-sized results[i] = obj x 882 ops/sec ±1.92% (85 runs sampled)
    // results.push(obj) x 329 ops/sec ±3.28% (85 runs sampled)
    //
    // Benchmarks: N = 250_000 K = 60
    // new Array(n) + indexed write x 917 ops/sec ±0.87% (93 runs sampled)
    // Array.from({length:n}) x 117 ops/sec ±1.21% (74 runs sampled)
    // push into [] x 302 ops/sec ±3.22% (85 runs sampled)
    // pre-sized results[i] = obj x 819 ops/sec ±1.41% (89 runs sampled)
    // results.push(obj) x 286 ops/sec ±1.98% (84 runs sampled)
    //
    // Benchmarks: N = 1_000_000 K = 60
    // new Array(n) + indexed write x 482 ops/sec ±1.03% (89 runs sampled)
    // Array.from({length:n}) x 27.11 ops/sec ±1.14% (49 runs sampled)
    // push into [] x 72.85 ops/sec ±15.85% (63 runs sampled)
    // pre-sized results[i] = obj x 426 ops/sec ±1.10% (88 runs sampled)
    // results.push(obj) x 68.01 ops/sec ±10.89% (61 runs sampled)

    // eslint-disable-next-line unicorn/no-new-array
    const results: Array<Record<string, unknown>> = checkExisting ? [] : new Array(rowsLength);
    const resultMap: Record<string, Record<string, unknown>> = {};
    const includeMap: IncludeMap = {};

    for (let rowIndex = 0; rowIndex < rowsLength; ++rowIndex) {
      const row = rows[rowIndex];
      let prefixHashCache: Map<string, HashEntry> | undefined;
      let topHash = '';

      if (rowIndex === 0) {
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
            resolveIncludeForKey(rawKey, prefixParts, includeOptions, includeMap);
          }

          const includeForKey = includeMap[rawKey];
          const modelForKey = includeForKey?.model;
          const parentPrefixId =
            prefixLength === 0
              ? ''
              : prefixId.slice(0, Math.max(0, prefixId.lastIndexOf('.'))) || '';
          const primaryKeyAttributes = modelForKey?.primaryKeyAttributes ?? [];
          const hasUniqueKeys = modelForKey ? !isEmpty(modelForKey.uniqueKeys) : false;
          const uniqueKeyAttributes =
            hasUniqueKeys && modelForKey ? getUniqueKeyAttributes(modelForKey) : [];
          const hashAttributeRowKeys = buildHashAttributeRowKeys(
            prefixId,
            primaryKeyAttributes,
            uniqueKeyAttributes,
          );

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
            hashAttributeRowKeys,
          };

          keyMeta.push(metaEntry);

          if (!prefixMeta.has(prefixId)) {
            prefixMeta.set(prefixId, metaEntry);
          }
        }
      }

      let topExistsForRow = false;

      if (checkExisting) {
        topHash = getHash(includeOptions.model, row);
        prefixHashCache = new Map<string, HashEntry>();
        prefixHashCache.set('', { itemHash: topHash, parentHash: null });
      }

      let currentValues: Record<string, unknown> = {};
      const topValues = currentValues;
      let previousMeta: metaEntry | undefined;

      for (let keyIndex = 0; keyIndex < keyLength; ++keyIndex) {
        const meta = keyMeta[keyIndex];
        const key = keys[keyIndex];

        if (previousMeta && previousMeta.prefixId !== meta.prefixId) {
          if (checkExisting) {
            const segmentResult = attachExistingSegment(
              previousMeta,
              row,
              includeMap,
              prefixMeta,
              topHash,
              prefixHashCache,
              currentValues,
              resultMap,
            );
            currentValues = segmentResult.nextValues;
            topExistsForRow ||= segmentResult.topExists;
          } else {
            currentValues = ensureNestedContainer(topValues, meta);
          }
        }

        currentValues[meta.attribute] = row[key];
        previousMeta = meta;
      }

      if (checkExisting && previousMeta) {
        const finalTopExists = finalizeExistingRow(
          previousMeta,
          row,
          includeMap,
          prefixMeta,
          topHash,
          prefixHashCache,
          currentValues,
          resultMap,
          topExistsForRow,
        );

        if (!finalTopExists) {
          results.push(topValues);
        }

        topExistsForRow = finalTopExists;
      } else if (!checkExisting) {
        results[rowIndex] = topValues;
      }
    }

    return results;
  }
}

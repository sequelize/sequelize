/* eslint-disable unicorn/no-for-loop */

// We're disabling the unicorn/no-for-loop rule in this file
// because we need the performance benefits of traditional for-loops
// and JIT compilers love the reduced complexity

/**
 * Abstract query utilities and base implementation used by all dialects.
 *
 * This module contains:
 * - The `AbstractQuery` base class used by dialect query implementations.
 * - Helper utilities to post-process raw result sets into nested include graphs.
 * - Internal hashing and grouping logic for JOIN de-duplication.
 *
 * All symbols are documented for Typedoc/JSDoc consumption. Unless marked otherwise,
 * everything in this file is considered internal to Sequelize's query pipeline.
 */
import isEmpty from 'lodash/isEmpty';
import { randomUUID } from 'node:crypto';
import NodeUtil from 'node:util';
import type { Association } from '../associations/index.js';
import { QueryTypes } from '../enums.js';
import type { BuildOptions, IncludeOptions, Model, ModelStatic } from '../model';
import type { Sequelize } from '../sequelize';
import * as deprecations from '../utils/deprecations.js';
import type { PrecompiledTransform } from '../utils/undot';
import {
  precompileKeys,
  setByPathArray,
  tokenizePath,
  transformRowWithPrecompiled,
} from '../utils/undot';
import type { AbstractConnection } from './connection-manager.js';
import type { NormalizedDataType } from './data-types.js';
import { AbstractDataType } from './data-types.js';

/**
 * Cache of unique-key attribute name arrays per model.
 * Used by JOIN de-duplication and hashing to avoid repeated model inspection.
 */
const uniqueKeyAttributesCache = new WeakMap<ModelStatic, readonly string[]>();

/**
 * Cache mapping a model to a mapping from column name -> attribute name.
 * Accelerates resolving attribute names from raw column identifiers.
 */
const columnAttributeNameCache = new WeakMap<ModelStatic, Map<string, string>>();

/**
 * Include options extended with pre-resolved model and a fast lookup map for child includes.
 */
interface IncludeOptionsWithMap extends IncludeOptions {
  /**
   * Model associated to this include (present after include resolution).
   */
  model?: ModelStatic;
  /**
   * Map of child include name -> include options for constant-time lookups.
   */
  includeMap?: Record<string, IncludeOptionsWithMap | undefined>;
}

/**
 * Lookup table from dotted include path (e.g., "posts.comments") to the corresponding include options.
 */
type IncludeMap = Record<string, IncludeOptionsWithMap | undefined>;

/**
 * The root include options used when grouping JOINed rows. Root must always have a model.
 */
type RootIncludeOptions = IncludeOptionsWithMap & {
  /** The root model for the query. */
  model: ModelStatic;
  /**
   * List of include names in resolution order; used by model building.
   */
  includeNames?: readonly string[];
};

/**
 * Internal options passed to `Model.bulkBuild` when materializing rows.
 */
interface BulkBuildOptionsInternal extends BuildOptions {
  /** Names of includes applied to the rows. */
  includeNames?: readonly string[] | undefined;
  /** Resolved include map for nested parsing. */
  includeMap?: IncludeMap | undefined;
  /** Whether include configuration was already validated. */
  includeValidated?: boolean | undefined;
  /** Attributes that were originally requested (pre-alias). */
  attributes?: readonly string[] | undefined;
  /** Hints that data originates from the DB rather than user input. */
  comesFromDatabase?: boolean | undefined;
}

/**
 * Hash information for a single node of a joined graph.
 */
interface HashEntry {
  /** The computed hash for the current item (includes parent hash prefix). */
  itemHash: string;
  /** The computed hash for the parent item, or null if at the root. */
  parentHash: string | null;
}

/**
 * Legacy unique key definition shape used by historical model definitions.
 */
type LegacyUniqueKeyDefinition = { fields?: readonly string[] };

/**
 * Model type guard for models that expose legacy `uniqueKeys` metadata.
 */
type ModelWithLegacyUniqueKeys = ModelStatic & {
  /** A record of legacy unique keys keyed by name. */
  uniqueKeys?: Record<string, LegacyUniqueKeyDefinition>;
};

/**
 * Metadata describing a single dotted key in the raw result set and how it maps into the include tree.
 */
type metaEntry = {
  /** The full raw dotted key (e.g., "posts.comments.id"). */
  key: string;
  /** The attribute portion of the key (segment after the last dot). */
  attribute: string;
  /** The dotted path segments leading to the attribute. */
  prefixParts: readonly string[];
  /** Number of segments in `prefixParts`. */
  prefixLength: number;
  /** The dotted prefix id (e.g., "posts.comments"). */
  prefixId: string;
  /** The last segment of the prefix (e.g., "comments"). */
  lastKeySegment: string;
  /** Resolved include options for this prefix, if any. */
  include: IncludeOptionsWithMap | undefined;
  /** The parent prefix id (one level up). */
  parentPrefixId: string;
  /** The primary key attributes of the model at this prefix. */
  primaryKeyAttributes: readonly string[];
  /** Fallback unique key attributes, if PKs are absent. */
  uniqueKeyAttributes: readonly string[];
  /** Fully-qualified row keys used to compute the hash for this prefix. */
  hashAttributeRowKeys: readonly string[];
};

/**
 * Resolves the attribute name corresponding to a column or attribute identifier.
 *
 * If the identifier is already an attribute name present in the model definition,
 * it is returned as-is. Otherwise, a per-model cache mapping column names to
 * attribute names is consulted (and lazily populated) to resolve the attribute name.
 *
 * @param model - The Sequelize model to resolve against.
 * @param columnOrAttribute - A column name (DB) or attribute name (model).
 * @returns The resolved attribute name if known, otherwise `columnOrAttribute`.
 */
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

/**
 * Produces a shallow copy of a row with keys remapped according to `fieldMap`.
 * Keys present in `fieldMap` are renamed; original keys are removed.
 *
 * @param row - The input row to transform.
 * @param fieldMap - Mapping from "from" key -> "to" key.
 * @returns A new object containing the remapped fields.
 */
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

/**
 * Runtime type guard to determine whether a value implements the iterator protocol.
 *
 * @param value - The value to check.
 * @returns `true` if the value is iterable, `false` otherwise.
 */
function isIterable(value: unknown): value is Iterable<unknown> {
  return value != null && typeof (value as Iterable<unknown>)[Symbol.iterator] === 'function';
}

/**
 * Extracts an `Association` from an include option only when it has been resolved.
 *
 * @param association - The include's `association` property.
 * @returns The `Association` instance if available, otherwise `undefined`.
 */
function extractAssociation(
  association: IncludeOptions['association'] | undefined,
): Association | undefined {
  if (association && typeof association === 'object') {
    return association;
  }

  return undefined;
}

/**
 * Builds the list of fully-qualified row keys used for hashing at a given include prefix.
 *
 * @param prefixId - Dotted path to the include prefix (e.g., "posts.comments").
 * @param primaryKeyAttributes - Primary key attribute names for the model at the prefix.
 * @param uniqueKeyAttributes - Fallback unique attribute names if PKs are absent.
 * @returns An array of keys to read from a raw row for hashing.
 */
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

/**
 * Result of attaching an existing segment during de-duplication.
 */
type ExistingSegmentResult = {
  /** The next scratch object to receive subsequent attributes. */
  nextValues: Record<string, unknown>;
  /** Indicates whether the top-level container already existed. */
  topExists: boolean;
};

/**
 * Computes the hash values for a particular meta entry, delegating to `getHashesForPrefix`.
 * Optimizes the root prefix by returning the provided root hash entry.
 *
 * @param meta - The meta entry describing the current segment.
 * @param row - The current raw row.
 * @param includeMap - The include lookup map.
 * @param prefixMeta - Metadata per prefix, used to infer parent/child relations.
 * @param topHashEntry - Pre-computed hash entry for the root item.
 * @param prefixHashCache - Optional memoization cache.
 * @returns The computed `HashEntry` for this meta.
 */
function computeHashesForMeta(
  meta: metaEntry,
  row: Record<string, unknown>,
  includeMap: IncludeMap,
  prefixMeta: Map<string, metaEntry>,
  topHashEntry: HashEntry,
  prefixHashCache: Map<string, HashEntry> | undefined,
): HashEntry {
  if (meta.prefixLength === 0) {
    return topHashEntry;
  }

  return getHashesForPrefix(
    meta.prefixId,
    row,
    includeMap,
    prefixMeta,
    topHashEntry.itemHash,
    prefixHashCache,
  );
}

/**
 * Attaches a child object into its parent at the include key, handling both
 * single-association (assign) and multi-association (array push) cases.
 *
 * No-ops if the parent container cannot be found (e.g., filtered out by hashing).
 *
 * @param meta - Meta information describing the relationship and key.
 * @param parentHash - Hash of the parent container; `null` for root.
 * @param resultMap - Global map of hash -> container.
 * @param childValues - The child object to attach.
 */
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

/**
 * Retrieves a reusable plain object from the pool, clearing previous contents.
 *
 * @param pool - Pool of reusable objects.
 * @returns An emptied object ready for population.
 */
function acquireValuesObject(pool: Array<Record<string, unknown>>): Record<string, unknown> {
  const reusable = pool.pop();
  if (!reusable) {
    return {};
  }

  const keys = Object.keys(reusable);
  for (let i = 0; i < keys.length; i++) {
    delete reusable[keys[i]];
  }

  return reusable;
}

/**
 * Returns an object to the reuse pool after the caller is done with it.
 *
 * @param pool - Pool to return the object to.
 * @param obj - Object to recycle.
 */
function releaseValuesObject(
  pool: Array<Record<string, unknown>>,
  obj: Record<string, unknown>,
): void {
  pool.push(obj);
}

/**
 * Handles the transition between prefixes in deduplication mode:
 * - hashes the previous prefix
 * - attaches its container into the result map if needed
 * - releases unused containers
 * - returns a fresh container for the next prefix
 *
 * @param previousMeta - Metadata for the previous prefix.
 * @param row - Current raw row.
 * @param includeMap - Include lookup map.
 * @param prefixMeta - Metadata per prefix id.
 * @param prefixHashCache - Optional hash cache.
 * @param currentValues - Container holding the previous prefix's attributes.
 * @param resultMap - Global hash -> container map.
 * @param freeList - Pool of reusable containers.
 * @param topHashEntry - Hash entry representing the root object.
 * @returns The next container and whether the top already existed.
 */
function attachExistingSegment(
  previousMeta: metaEntry,
  row: Record<string, unknown>,
  includeMap: IncludeMap,
  prefixMeta: Map<string, metaEntry>,
  prefixHashCache: Map<string, HashEntry> | undefined,
  currentValues: Record<string, unknown>,
  resultMap: Record<string, Record<string, unknown>>,
  freeList: Array<Record<string, unknown>>,
  topHashEntry: HashEntry,
): ExistingSegmentResult {
  const hashes = computeHashesForMeta(
    previousMeta,
    row,
    includeMap,
    prefixMeta,
    topHashEntry,
    prefixHashCache,
  );
  const nextValues = acquireValuesObject(freeList);

  if (hashes.itemHash === topHashEntry.itemHash) {
    if (!resultMap[topHashEntry.itemHash]) {
      resultMap[topHashEntry.itemHash] = currentValues;

      return { nextValues, topExists: false };
    }

    releaseValuesObject(freeList, currentValues);

    return { nextValues, topExists: true };
  }

  if (!resultMap[hashes.itemHash]) {
    resultMap[hashes.itemHash] = currentValues;
    attachToParent(previousMeta, hashes.parentHash, resultMap, currentValues);
  } else {
    releaseValuesObject(freeList, currentValues);
  }

  return { nextValues, topExists: false };
}

/**
 * Ensures that the nested object chain exists for the given `meta` prefix and
 * returns the container into which attributes for this prefix should be written.
 * Used when de-duplication is disabled.
 *
 * @param topValues - The root output object for the current row.
 * @param meta - Meta describing the current prefix path.
 * @returns The nested container for this prefix.
 */
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

/**
 * Finalizes the wiring of the last processed segment in a deduplicated row and
 * returns whether the top-level container already existed in `resultMap`.
 *
 * @param previousMeta - The meta of the last processed key.
 * @param row - The current raw row.
 * @param includeMap - Include lookup map.
 * @param prefixMeta - Metadata per prefix id.
 * @param prefixHashCache - Hash memoization cache.
 * @param currentValues - The object containing attributes of the last segment.
 * @param resultMap - Global map of hash -> container.
 * @param currentTopExists - Whether the root already existed before finalization.
 * @param freeList - Pool used to recycle unused containers.
 * @param topHashEntry - Pre-computed root hash entry for the current row.
 * @returns The updated `topExists` state.
 */
function finalizeExistingRow(
  previousMeta: metaEntry,
  row: Record<string, unknown>,
  includeMap: IncludeMap,
  prefixMeta: Map<string, metaEntry>,
  prefixHashCache: Map<string, HashEntry> | undefined,
  currentValues: Record<string, unknown>,
  resultMap: Record<string, Record<string, unknown>>,
  currentTopExists: boolean,
  freeList: Array<Record<string, unknown>>,
  topHashEntry: HashEntry,
): boolean {
  const hashes = computeHashesForMeta(
    previousMeta,
    row,
    includeMap,
    prefixMeta,
    topHashEntry,
    prefixHashCache,
  );
  if (hashes.itemHash === topHashEntry.itemHash) {
    if (!resultMap[topHashEntry.itemHash]) {
      resultMap[topHashEntry.itemHash] = currentValues;

      return currentTopExists;
    }

    releaseValuesObject(freeList, currentValues);

    return true;
  }

  if (!resultMap[hashes.itemHash]) {
    resultMap[hashes.itemHash] = currentValues;
    attachToParent(previousMeta, hashes.parentHash, resultMap, currentValues);
  } else {
    releaseValuesObject(freeList, currentValues);
  }

  return currentTopExists;
}

/**
 * Resolves and caches the include options matching a dotted raw key by traversing
 * the `includeMap` chain. Intermediate segments are memoized to speed up future lookups.
 *
 * @param rawKey - The full dotted key from the result set.
 * @param prefixParts - The path segments preceding the attribute.
 * @param rootInclude - The root include options.
 * @param includeMap - The lookup map to populate.
 * @returns The resolved include options for the key, if any.
 */
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

  let currentInclude: IncludeOptionsWithMap | undefined = rootInclude;
  let accumulatedPath: string | undefined;

  for (const piece of prefixParts) {
    currentInclude = currentInclude?.includeMap?.[piece];
    if (!currentInclude) {
      return undefined;
    }

    accumulatedPath = accumulatedPath ? `${accumulatedPath}.${piece}` : piece;
    includeMap[accumulatedPath] = currentInclude;
  }

  includeMap[rawKey] = currentInclude;

  return currentInclude;
}

/**
 * Retrieves the attribute names that form the first unique key in a model, mapping
 * column names to attribute names when necessary. Results are cached per model.
 *
 * @param model - The Sequelize model to inspect.
 * @returns A (possibly empty) array of attribute names for a unique key.
 */
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

/**
 * Sorts dotted keys so that shallower paths (parents) come before deeper ones (children).
 * This ordering ensures prefix metadata is computed in dependency order.
 *
 * @param inputKeys - The array of dotted keys to sort (mutated in-place by `sort`).
 * @returns The sorted `inputKeys` reference.
 */
function sortByDepth(inputKeys: string[]) {
  return inputKeys.sort((a, b) => a.split('.').length - b.split('.').length);
}

/**
 * Converts a value into a string suitable for hash concatenation. Buffers are rendered as hex.
 *
 * @param obj - The value to stringify.
 * @returns The string representation used for hashing.
 */
function stringify(obj: unknown) {
  return obj instanceof Buffer ? obj.toString('hex') : (obj?.toString() ?? '');
}

/**
 * Generates a deterministic hash for a single raw row for the provided model.
 * Priority of attributes used:
 * 1) Primary keys
 * 2) First legacy unique key definition (if any)
 * 3) First unique index fields (string fields only)
 *
 * @param model - The model whose identity should be represented by the hash.
 * @param row - The row object to read values from.
 * @returns A stable string hash composed by concatenating selected attribute values.
 */
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

      break; // Only use the first unique index, matching getUniqueKeyAttributes logic
    }
  }

  return strings.join('');
}

/**
 * Returns or computes the `HashEntry` for the given dotted include prefix.
 *
 * The hash of an item is defined as `parentHash + prefix + attributeValues`, where
 * `attributeValues` are the PK or unique key values at this prefix. This makes each
 * child's hash dependent on its parent, preventing collisions across siblings.
 *
 * @param prefix - The dotted include prefix (empty string for root).
 * @param currentRow - The current raw row.
 * @param currentIncludeMap - Include lookup map.
 * @param currentPrefixMeta - Metadata per prefix id.
 * @param currentTopHash - Root hash for the current row.
 * @param prefixHashCache - Optional memoization cache shared within the row.
 * @returns The computed `HashEntry` for the prefix.
 */
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

  const hashParts: string[] = [prefix];
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
      hashParts.push(stringify(currentRow[attributeKey]));
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

  const hash = hashParts.join('');
  const result: HashEntry = {
    itemHash: parentHashValue + hash,
    parentHash: parentHashValue,
  };
  cache.set(prefix, result);

  return result;
}

export interface AbstractQueryGroupJoinDataOptions {
  /**
   * Whether to de-duplicate rows by hashing PK/unique keys when grouping JOIN results.
   * If `false`, rows are nested directly without deduplication (faster for no-join queries).
   */
  checkExisting: boolean;
}

export interface AbstractQueryOptions {
  /** The instance being operated on (e.g., for INSERT/UPDATE). */
  instance?: Model;
  /** The model associated with this query. */
  model?: ModelStatic;
  /** The query type used to adjust result processing. */
  type?: QueryTypes;
  /** Map from raw column name to model attribute name, or `true` to disable. */
  fieldMap?: Record<string, string> | boolean;
  /** If `true`, returns only the first row (or `null`). */
  plain: boolean;
  /** If `true`, returns raw objects instead of model instances. */
  raw: boolean;
  /** If `true`, uses dotted key nesting for raw results. */
  nest?: boolean;
  /** Internal flag indicating that the select has JOINs. */
  hasJoin?: boolean;
  /** Internal flag indicating presence of a multi association. */
  hasMultiAssociation?: boolean;
  /** Logging function or `false` to disable; `true` is deprecated. */
  logging?: boolean | ((sql: string, timing?: number) => void);
  /** If `true`, emits benchmark timings instead of raw SQL logging. */
  benchmark?: boolean;
  /** If `true`, logs bound parameter values. */
  logQueryParameters?: boolean;
  /** Optional label prefixed to the log line. */
  queryLabel?: string;
  /** Include definitions passed by the user. */
  include?: IncludeOptions[] | boolean;
  /** Resolved include names used by builder. */
  includeNames?: readonly string[];
  /** Resolved include map used by parser. */
  includeMap?: IncludeMap;
  /** The attributes originally selected by the user. */
  originalAttributes?: readonly string[];
  /** The attributes currently selected by the query. */
  attributes?: readonly string[];
  /** If `true`, skip error wrapping and re-throw database errors as-is. */
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

  /**
   * Post-processes a SELECT result set according to the query options:
   * - Remaps field names when `fieldMap` is provided.
   * - Returns raw nested objects when `raw` and `nest` are set.
   * - Groups JOINed rows into nested include graphs and builds model instances otherwise.
   *
   * @param results - The raw rows returned by the driver.
   * @returns Raw objects or built model instances depending on `options`.
   */
  protected handleSelectQuery(results: Array<Record<string, unknown>>): unknown {
    let processedResults: Array<Record<string, unknown>> = results;
    let result: unknown = null;

    if (this.options.fieldMap && typeof this.options.fieldMap === 'object') {
      processedResults = processedResults.map(row =>
        remapRowFields(row, this.options.fieldMap as Record<string, string>),
      );
    }

    if (this.options.raw) {
      let precompiled: PrecompiledTransform | undefined;

      const rawRows = processedResults.map(row => {
        if (!this.options.nest) {
          return row;
        }

        if (!precompiled) {
          precompiled = precompileKeys(Object.keys(row));
        }

        const target: Record<string, unknown> = {};
        transformRowWithPrecompiled(row, precompiled, target);

        // If this row contains keys not present in the initial precompilation,
        // compile and set them once and extend the cache for subsequent rows.
        const rowKeys = Object.keys(row);
        for (let i = 0; i < rowKeys.length; ++i) {
          const k = rowKeys[i];
          if (!precompiled.index.has(k)) {
            const path = tokenizePath(k);
            const v = row[k];
            if (v !== undefined) {
              setByPathArray(target, path, v);
            }

            precompiled.index.set(k, path);
            precompiled.compiled.push({ sourceKey: k, path });
          }
        }

        return target;
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

    if (result == null) {
      result = processedResults;
    }

    if (this.options.plain && Array.isArray(result)) {
      return result.length === 0 ? null : result[0];
    }

    return result;
  }

  /**
   * Applies attribute-type parsing to an array of value objects.
   *
   * @param valueArrays - Array of objects to parse in-place.
   * @param model - The model providing attribute types for parsing.
   * @param includeMap - Include lookup map for nested parsing.
   * @returns The same array instance after parsing.
   */
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

  /**
   * Applies attribute-type parsing to a single object. Descends into includes when present.
   *
   * @param values - The object to mutate with parsed values.
   * @param model - The model providing attribute types for parsing.
   * @param includeMap - Include lookup map for nested parsing.
   * @returns The mutated `values` object.
   */
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

  /**
   * Parses a raw database value using the attribute's data-type parser when available.
   *
   * @param value - The raw value to parse.
   * @param attributeType - The normalized data type to parse with.
   * @returns The parsed value, or the original value if no parser applies.
   */
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

  /**
   * Logs a SQL query with optional parameters and returns a function to log completion.
   * When benchmarking is enabled, the completion logger emits timing information.
   *
   * @param sql - The SQL string to log.
   * @param debugContext - A function receiving debug messages.
   * @param parameters - Optional bound parameters to display when enabled.
   * @returns A callback to be invoked after query execution to finalize logging.
   */
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

  /**
   * Groups a flat array of JOINed rows into nested objects according to include definitions.
   *
   * Algorithm overview:
   * - Sorts row keys by depth to build prefix metadata once on the first row.
   * - For each row, computes stable identity hashes for each include prefix
   *   using PK/unique-key values to de-duplicate repeated JOIN combinations.
   * - Uses a global `resultMap` keyed by hash to re-use previously materialized
   *   containers and attach children in O(1) time.
   * - In non-dedup mode, directly builds nested objects for each row without hashing.
   *
   * Complexity:
   * - First row metadata setup: O(K log K) for K keys due to depth sort.
   * - Each subsequent row: O(K) for value assignment and at most O(depth) hash lookups.
   *
   * @param rows - Raw rows as returned by the driver with dotted keys.
   * @param includeOptions - The root include options and model information.
   * @param options - Controls whether de-duplication is applied.
   * @returns An array of nested objects ready for model-building or raw return.
   */
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
      const freeList: Array<Record<string, unknown>> = [];
      let prefixHashCache: Map<string, HashEntry> | undefined;
      let topHashEntry: HashEntry | undefined;
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
        const rootEntry: HashEntry = { itemHash: topHash, parentHash: null };
        prefixHashCache.set('', rootEntry);
        topHashEntry = rootEntry;
      }

      let currentValues: Record<string, unknown> = checkExisting
        ? acquireValuesObject(freeList)
        : {};
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
              prefixHashCache,
              currentValues,
              resultMap,
              freeList,
              topHashEntry!,
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
          prefixHashCache,
          currentValues,
          resultMap,
          topExistsForRow,
          freeList,
          topHashEntry!,
        );

        if (!finalTopExists) {
          results.push(topValues);
        }

        // Removed unused assignment to topExistsForRow
      } else if (!checkExisting) {
        results[rowIndex] = topValues;
      }
    }

    return results;
  }
}

import crypto from 'node:crypto';
import { isDataType } from '../../abstract-dialect/data-types-utils.js';
import type { BlobLength, DataType } from '../../abstract-dialect/data-types.js';
import { AbstractDataType, DataTypeIdentifier } from '../../abstract-dialect/data-types.js';
import * as DataTypes from '../../data-types.js';
import type { ModelStatic } from '../../model.js';
import { Model } from '../../model.js';
import { registerModelAttributeOptions } from '../shared/model.js';
import type { PropertyOrGetterDescriptor } from './decorator-utils.js';
import {
  throwMustBeAttribute,
  throwMustBeInstanceProperty,
  throwMustBeModel,
} from './decorator-utils.js';

// ────────────────────────────────────────────────────────────────────────────
// Cipher Strategy
// ────────────────────────────────────────────────────────────────────────────

/**
 * Represents the result of an encryption operation.
 * The strategy is responsible for packing all metadata (IV, authTag, etc.)
 * into the returned Buffer so that {@link CipherStrategy.decrypt} can unpack it.
 */
export interface EncryptionResult {
  /** The fully-packed ciphertext (version + iv + ciphertext + tag, etc.) */
  data: Buffer;
}

/**
 * A pluggable encryption strategy.
 *
 * Sequelize ships with {@link Aes256GcmStrategy} and {@link Aes256CbcStrategy},
 * but consumers can implement their own by satisfying this interface.
 *
 * @example
 * ```ts
 * const myStrategy: CipherStrategy = {
 *   encrypt(plaintext, key) { ... },
 *   decrypt(packed, key) { ... },
 *   get deterministic() { return false; },
 * };
 * ```
 */
export interface CipherStrategy {
  /**
   * Encrypts *plaintext* using *key*.
   * The implementation **must** generate a unique random IV per call and pack
   * it into the returned buffer so that {@link decrypt} can recover it.
   */
  encrypt(plaintext: Buffer, key: Buffer): EncryptionResult;

  /**
   * Decrypts the packed buffer previously returned by {@link encrypt}.
   */
  decrypt(packed: Buffer, key: Buffer): Buffer;

  /**
   * Whether this strategy produces deterministic ciphertext for the same
   * plaintext + key combination.
   *
   * When `true`, the decorator will support equality lookups in `where`
   * clauses by encrypting the search value and comparing ciphertexts.
   *
   * **Security note:** Deterministic encryption leaks whether two rows
   * contain the same plaintext.  Use only when equality search is required
   * and you understand the trade-off.
   *
   * Built-in strategies are always **non-deterministic** (`false`).
   */
  readonly deterministic: boolean;
}

// ────────────────────────────────────────────────────────────────────────────
// Built-in strategies
// ────────────────────────────────────────────────────────────────────────────

/**
 * Version byte prefixed to every packed ciphertext so the format can evolve
 * without breaking existing data.
 */
const CIPHERTEXT_FORMAT_VERSION = 0x01;

/**
 * AES-256-GCM with a random 12-byte IV and 16-byte authentication tag.
 *
 * Packed format (total overhead: 29 bytes):
 * ```
 * [1 B version][12 B IV][N B ciphertext][16 B authTag]
 * ```
 *
 * This is the recommended default strategy.
 */
export const Aes256GcmStrategy: CipherStrategy = Object.freeze({
  encrypt(plaintext: Buffer, key: Buffer): EncryptionResult {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authTag = cipher.getAuthTag(); // 16 bytes

    const packed = Buffer.allocUnsafe(1 + 12 + encrypted.length + 16);
    packed[0] = CIPHERTEXT_FORMAT_VERSION;
    iv.copy(packed, 1);
    encrypted.copy(packed, 13);
    authTag.copy(packed, 13 + encrypted.length);

    return { data: packed };
  },

  decrypt(packed: Buffer, key: Buffer): Buffer {
    if (packed[0] !== CIPHERTEXT_FORMAT_VERSION) {
      throw new Error(
        `@EncryptedAttribute: unsupported ciphertext format version ${packed[0]}. ` +
          `Expected ${CIPHERTEXT_FORMAT_VERSION}.`,
      );
    }

    const iv = packed.subarray(1, 13);
    const authTag = packed.subarray(packed.length - 16);
    const ciphertext = packed.subarray(13, packed.length - 16);

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  },

  deterministic: false,
});

/**
 * AES-256-CBC with a random 16-byte IV and PKCS#7 padding.
 *
 * Packed format:
 * ```
 * [1 B version][16 B IV][N B ciphertext]
 * ```
 *
 * **Note:** CBC does not provide authentication.  If tamper-resistance is
 * required, prefer {@link Aes256GcmStrategy} instead.
 */
export const Aes256CbcStrategy: CipherStrategy = Object.freeze({
  encrypt(plaintext: Buffer, key: Buffer): EncryptionResult {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);

    const packed = Buffer.allocUnsafe(1 + 16 + encrypted.length);
    packed[0] = CIPHERTEXT_FORMAT_VERSION;
    iv.copy(packed, 1);
    encrypted.copy(packed, 17);

    return { data: packed };
  },

  decrypt(packed: Buffer, key: Buffer): Buffer {
    if (packed[0] !== CIPHERTEXT_FORMAT_VERSION) {
      throw new Error(
        `@EncryptedAttribute: unsupported ciphertext format version ${packed[0]}. ` +
          `Expected ${CIPHERTEXT_FORMAT_VERSION}.`,
      );
    }

    const iv = packed.subarray(1, 17);
    const ciphertext = packed.subarray(17);

    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);

    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  },

  deterministic: false,
});

// ────────────────────────────────────────────────────────────────────────────
// Serialisation helpers
// ────────────────────────────────────────────────────────────────────────────

/**
 * Serialises an arbitrary JS value to a Buffer for encryption.
 *
 * @param value The value to serialise.
 */
function serialise(value: unknown): Buffer {
  if (value instanceof Buffer) {
    return value;
  }

  if (value instanceof Date) {
    return Buffer.from(value.toISOString());
  }

  if (typeof value === 'string') {
    return Buffer.from(value);
  }

  if (typeof value === 'boolean') {
    return Buffer.from(value ? '1' : '0');
  }

  if (typeof value === 'number' || typeof value === 'bigint') {
    return Buffer.from(value.toString());
  }

  // objects, arrays, etc.  JSON.stringify handles most DataTypes.JSON / JSONB values.
  return Buffer.from(JSON.stringify(value));
}

/**
 * Coerce for the declared *logicalType* that the user annotated.
 */
type Deserialiser = (raw: Buffer) => unknown;

const STRING_TYPES = new Set([
  'STRING',
  'TEXT',
  'UUID',
  'UUIDV1',
  'UUIDV4',
  'CHAR',
  'INET',
  'CIDR',
  'MACADDR',
  'MACADDR8',
  'ENUM',
]);

const NUMERIC_TYPES = new Set([
  'INTEGER',
  'SMALLINT',
  'TINYINT',
  'MEDIUMINT',
  'FLOAT',
  'DOUBLE',
  'DECIMAL',
  'REAL',
]);

function resolveDeserialiser(logicalType: string): Deserialiser {
  if (STRING_TYPES.has(logicalType)) {
    return (buf: Buffer) => buf.toString();
  }

  if (logicalType === 'BIGINT') {
    return (buf: Buffer) => BigInt(buf.toString());
  }

  if (NUMERIC_TYPES.has(logicalType)) {
    return (buf: Buffer) => Number(buf.toString());
  }

  if (logicalType === 'JSON' || logicalType === 'JSONB') {
    return (buf: Buffer) => JSON.parse(buf.toString());
  }

  if (logicalType === 'DATE' || logicalType === 'DATEONLY' || logicalType === 'TIME') {
    return (buf: Buffer) => new Date(buf.toString());
  }

  if (logicalType === 'BOOLEAN') {
    return (buf: Buffer) => {
      const s = buf.toString();

      return s === '1' || s === 'true';
    };
  }

  if (logicalType === 'BLOB') {
    return (buf: Buffer) => buf;
  }

  // Fallback: return the raw string representation.
  return (buf: Buffer) => buf.toString();
}

/**
 * Extracts the DataType identifier string from a DataType class or instance.
 * Uses the {@link DataTypeIdentifier} symbol that every built-in DataType exposes.
 *
 * Works with:
 * - Invokable (Proxy-wrapped) class references, e.g. `DataTypes.STRING`
 * - Instances, e.g. `DataTypes.STRING(255)` / `new DataTypes.STRING()`
 *
 * @param type The DataType class or instance to identify.
 */
function getDataTypeId(type: unknown): string {
  if (!isDataType(type)) {
    throw new TypeError(
      `@EncryptedAttribute: "type" must be a Sequelize DataType class or instance. ` +
        `Received: ${String(type)}`,
    );
  }

  // Instance – the identifier lives on the constructor (static property).
  if (type instanceof AbstractDataType) {
    return (type.constructor as typeof AbstractDataType)[DataTypeIdentifier];
  }

  // Class reference (possibly Proxy-wrapped via classToInvokable).
  return (type as unknown as typeof AbstractDataType)[DataTypeIdentifier];
}

// ────────────────────────────────────────────────────────────────────────────
// Options
// ────────────────────────────────────────────────────────────────────────────

export interface EncryptedAttributeOptions {
  /**
   * The *logical* data type of the attribute.
   *
   * This is the type the attribute appears as in your TypeScript model.
   * The actual database column will always be a `BLOB`.
   *
   * @example DataTypes.STRING
   * @example DataTypes.JSON
   */
  type: DataType;

  /**
   * The 256-bit (32-byte) encryption key.
   *
   * Accepts a `Buffer` or a hex-encoded string (64 hex characters).
   *
   * **Security note:** Never hard-code keys in source.  Load them from
   * environment variables or a secrets manager.
   */
  key: Buffer | string;

  /**
   * The cipher strategy to use.
   *
   * @default Aes256GcmStrategy
   * @see {@link Aes256GcmStrategy}
   * @see {@link Aes256CbcStrategy}
   */
  strategy?: CipherStrategy;

  /**
   * The BLOB size to use for the database column.
   *
   * Encryption adds overhead (IV + authTag + version byte), so choose a size
   * that can accommodate the largest expected plaintext plus ~29 bytes for GCM
   * or ~17 bytes for CBC.
   *
   * @default 'long'
   */
  blobLength?: BlobLength;

  /**
   * If `true`, null values will be stored as `NULL` in the database instead
   * of as an encrypted representation of null.
   *
   * @default true
   */
  allowNull?: boolean;
}

// ────────────────────────────────────────────────────────────────────────────
// Key normalisation
// ────────────────────────────────────────────────────────────────────────────

function normaliseKey(key: Buffer | string): Buffer {
  if (Buffer.isBuffer(key)) {
    if (key.length !== 32) {
      throw new Error(
        `@EncryptedAttribute: key must be exactly 32 bytes (256 bits) for AES-256. ` +
          `Received ${key.length} bytes.`,
      );
    }

    return key;
  }

  if (typeof key === 'string') {
    // Accept 64-char hex strings → 32 bytes
    if (/^[\da-f]{64}$/i.test(key)) {
      return Buffer.from(key, 'hex');
    }

    throw new Error(
      '@EncryptedAttribute: when key is a string, it must be a 64-character hex-encoded ' +
        `string (representing 32 bytes). Received ${key.length} characters.`,
    );
  }

  throw new TypeError('@EncryptedAttribute: key must be a Buffer or a hex-encoded string.');
}

// ────────────────────────────────────────────────────────────────────────────
// Decorator
// ────────────────────────────────────────────────────────────────────────────

/**
 * Marks a model attribute as encrypted at rest.
 *
 * The attribute is stored in the database as a `BLOB` containing the packed
 * ciphertext (version byte + IV + ciphertext + auth tag).  On read the value
 * is transparently decrypted and coerced back to the declared *logical* type.
 *
 * Multiple `@EncryptedAttribute` decorators can be safely used on the same
 * model - each attribute gets its own independent getter / setter.
 *
 * @example
 * ```ts
 * import { Model, DataTypes, InferAttributes, InferCreationAttributes } from '@sequelize/core';
 * import { Attribute, EncryptedAttribute } from '@sequelize/core/decorators-legacy';
 *
 * class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
 *   @EncryptedAttribute({
 *     type: DataTypes.STRING,
 *     key: process.env.ENCRYPTION_KEY!,   // 64-char hex string
 *   })
 *   declare ssn: string;
 *
 *   @EncryptedAttribute({
 *     type: DataTypes.JSON,
 *     key: process.env.ENCRYPTION_KEY!,
 *     strategy: Aes256CbcStrategy,
 *   })
 *   declare metadata: Record<string, unknown>;
 * }
 * ```
 *
 * @param options - Configuration for the encrypted attribute.
 */
export function EncryptedAttribute(options: EncryptedAttributeOptions): PropertyOrGetterDescriptor {
  const strategy = options.strategy ?? Aes256GcmStrategy;
  const keyBuf = normaliseKey(options.key);
  const blobLength = options.blobLength ?? 'long';
  const allowNull = options.allowNull ?? true;

  const logicalTypeId = getDataTypeId(options.type);
  const deserialise = resolveDeserialiser(logicalTypeId);

  return function encryptedAttributeDecorator(
    target: Object,
    propertyName: string | symbol,
    propertyDescriptor?: PropertyDescriptor,
  ): void {
    if (typeof propertyName === 'symbol') {
      throwMustBeAttribute('EncryptedAttribute', target, propertyName);
    }

    if (typeof target === 'function') {
      throwMustBeInstanceProperty('EncryptedAttribute', target, propertyName);
    }

    if (!(target instanceof (Model as any))) {
      throwMustBeModel('EncryptedAttribute', target, propertyName);
    }

    // Capture user-defined getter / setter from a property descriptor if present.
    // This mirrors what attribute-utils.ts annotate() does.
    const userGet = propertyDescriptor?.get;
    const userSet = propertyDescriptor?.set;

    const attributeOptions = {
      type: DataTypes.BLOB(blobLength),
      allowNull,
      get(this: Model): unknown {
        const raw: Buffer | null | undefined = this.getDataValue(propertyName as any);
        if (raw == null || raw.length === 0) {
          return null;
        }

        const decrypted = strategy.decrypt(raw, keyBuf);
        const value = deserialise(decrypted);

        // If the user provided a custom getter, call it with the decrypted value
        // already set so getDataValue returns the decrypted form.
        if (userGet) {
          return userGet.call(this);
        }

        return value;
      },
      set(this: Model, value: unknown): void {
        // If the user provided a custom setter, let it transform the value first.
        if (userSet) {
          userSet.call(this, value);
          value = this.getDataValue(propertyName as any);
        }

        if (value == null) {
          this.setDataValue(propertyName as any, null as any);

          return;
        }

        const plaintext = serialise(value);
        const { data } = strategy.encrypt(plaintext, keyBuf);
        this.setDataValue(propertyName as any, data as any);
      },
    };

    registerModelAttributeOptions(
      target.constructor as ModelStatic,
      propertyName,
      attributeOptions,
    );
  };
}

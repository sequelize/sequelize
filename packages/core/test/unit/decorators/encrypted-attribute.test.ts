import crypto from 'node:crypto';
import type { InferAttributes, InferCreationAttributes } from '@sequelize/core';
import { DataTypes, Model } from '@sequelize/core';
import {
  Aes256CbcStrategy,
  Aes256GcmStrategy,
  EncryptedAttribute,
} from '@sequelize/core/decorators-legacy';
import { expect } from 'chai';
import { sequelize } from '../../support';

// Deterministic 32-byte key for testing (never use in production).
const TEST_KEY = crypto.randomBytes(32);
const TEST_KEY_HEX = TEST_KEY.toString('hex');

describe('@EncryptedAttribute legacy decorator', () => {
  // ── Registration ──────────────────────────────────────────────────────

  it('does not init the model itself', () => {
    class Test extends Model {
      @EncryptedAttribute({ type: DataTypes.STRING, key: TEST_KEY })
      declare secret: string;
    }

    expect(() => Test.build()).to.throw(/has not been initialized/);
  });

  it('registers the attribute as a BLOB', () => {
    class User extends Model<InferAttributes<User>> {
      @EncryptedAttribute({ type: DataTypes.STRING, key: TEST_KEY })
      declare ssn: string;
    }

    sequelize.addModels([User]);

    const attr = User.getAttributes().ssn;
    expect(attr).to.exist;
    expect(attr.type).to.be.instanceof(DataTypes.BLOB);
  });

  it('accepts a hex-encoded string as key', () => {
    class User extends Model<InferAttributes<User>> {
      @EncryptedAttribute({ type: DataTypes.STRING, key: TEST_KEY_HEX })
      declare ssn: string;
    }

    sequelize.addModels([User]);

    const user = User.build({ ssn: 'hello' } as any);
    expect(user.ssn).to.equal('hello');
  });

  // ── Key validation ────────────────────────────────────────────────────

  it('rejects a key that is not 32 bytes (Buffer)', () => {
    expect(() => {
      class User extends Model {
        @EncryptedAttribute({ type: DataTypes.STRING, key: Buffer.alloc(16) })
        declare ssn: string;
      }

      return User;
    }).to.throw(/key must be exactly 32 bytes/);
  });

  it('rejects a hex string that is not 64 characters', () => {
    expect(() => {
      class User extends Model {
        @EncryptedAttribute({ type: DataTypes.STRING, key: 'abcd' })
        declare ssn: string;
      }

      return User;
    }).to.throw(/64-character hex-encoded/);
  });

  // ── Type validation ───────────────────────────────────────────────────

  it('rejects a non-DataType as type', () => {
    expect(() => {
      class User extends Model {
        @EncryptedAttribute({ type: 'not-a-type' as any, key: TEST_KEY })
        declare ssn: string;
      }

      return User;
    }).to.throw(/must be a Sequelize DataType/);
  });

  // ── Encryption / Decryption round-trip ────────────────────────────────

  it('encrypts on set and decrypts on get (STRING)', () => {
    class User extends Model<InferAttributes<User>> {
      @EncryptedAttribute({ type: DataTypes.STRING, key: TEST_KEY })
      declare ssn: string;
    }

    sequelize.addModels([User]);

    const user = User.build({ ssn: '123-45-6789' } as any);

    // The getter should return the original plaintext
    expect(user.ssn).to.equal('123-45-6789');

    // The raw stored value should be a Buffer (encrypted), not the plaintext
    const raw = user.getDataValue('ssn' as any);
    expect(raw).to.be.instanceof(Buffer);
    expect(raw.toString()).to.not.equal('123-45-6789');
  });

  it('encrypts on set and decrypts on get (INTEGER)', () => {
    class User extends Model<InferAttributes<User>> {
      @EncryptedAttribute({ type: DataTypes.INTEGER, key: TEST_KEY })
      declare age: number;
    }

    sequelize.addModels([User]);

    const user = User.build({ age: 42 } as any);
    expect(user.age).to.equal(42);
  });

  it('encrypts on set and decrypts on get (BOOLEAN)', () => {
    class User extends Model<InferAttributes<User>> {
      @EncryptedAttribute({ type: DataTypes.BOOLEAN, key: TEST_KEY })
      declare active: boolean;
    }

    sequelize.addModels([User]);

    const userTrue = User.build({ active: true } as any);
    expect(userTrue.active).to.equal(true);

    const userFalse = User.build({ active: false } as any);
    expect(userFalse.active).to.equal(false);
  });

  it('encrypts on set and decrypts on get (JSON)', () => {
    class User extends Model<InferAttributes<User>> {
      @EncryptedAttribute({ type: DataTypes.JSON, key: TEST_KEY })
      declare metadata: Record<string, unknown>;
    }

    sequelize.addModels([User]);

    const data = { role: 'admin', permissions: ['read', 'write'] };
    const user = User.build({ metadata: data } as any);
    expect(user.metadata).to.deep.equal(data);
  });

  it('encrypts on set and decrypts on get (DATE)', () => {
    class User extends Model<InferAttributes<User>> {
      @EncryptedAttribute({ type: DataTypes.DATE, key: TEST_KEY })
      declare birthDate: Date;
    }

    sequelize.addModels([User]);

    const date = new Date('1990-01-15T00:00:00.000Z');
    const user = User.build({ birthDate: date } as any);
    expect(user.birthDate).to.deep.equal(date);
  });

  // ── Null handling ─────────────────────────────────────────────────────

  it('handles null values', () => {
    class User extends Model<InferAttributes<User>> {
      @EncryptedAttribute({ type: DataTypes.STRING, key: TEST_KEY, allowNull: true })
      declare ssn: string | null;
    }

    sequelize.addModels([User]);

    const user = User.build({ ssn: null } as any);
    expect(user.ssn).to.be.null;
  });

  it('handles undefined values as null', () => {
    class User extends Model<InferAttributes<User>> {
      @EncryptedAttribute({ type: DataTypes.STRING, key: TEST_KEY, allowNull: true })
      declare ssn: string | null;
    }

    sequelize.addModels([User]);

    const user = User.build({} as any);
    expect(user.ssn).to.be.null;
  });

  // ── Multiple encrypted attributes on the same model ───────────────────

  it('supports multiple encrypted attributes on the same model', () => {
    class User extends Model<InferAttributes<User>> {
      @EncryptedAttribute({ type: DataTypes.STRING, key: TEST_KEY })
      declare ssn: string;

      @EncryptedAttribute({ type: DataTypes.STRING, key: TEST_KEY })
      declare creditCard: string;
    }

    sequelize.addModels([User]);

    const user = User.build({
      ssn: '123-45-6789',
      creditCard: '4111-1111-1111-1111',
    } as any);

    expect(user.ssn).to.equal('123-45-6789');
    expect(user.creditCard).to.equal('4111-1111-1111-1111');
  });

  // ── Non-deterministic encryption ──────────────────────────────────────

  it('produces different ciphertexts for the same plaintext (non-deterministic)', () => {
    class User extends Model<InferAttributes<User>> {
      @EncryptedAttribute({ type: DataTypes.STRING, key: TEST_KEY })
      declare ssn: string;
    }

    sequelize.addModels([User]);

    const user1 = User.build({ ssn: 'same-value' } as any);
    const user2 = User.build({ ssn: 'same-value' } as any);

    const raw1 = user1.getDataValue('ssn' as any) as unknown as Buffer;
    const raw2 = user2.getDataValue('ssn' as any) as unknown as Buffer;

    // Both should decrypt to the same value
    expect(user1.ssn).to.equal('same-value');
    expect(user2.ssn).to.equal('same-value');

    // But the raw ciphertexts should differ (random IV)
    expect(Buffer.compare(raw1, raw2)).to.not.equal(0);
  });

  // ── Strategy selection ────────────────────────────────────────────────

  it('works with Aes256GcmStrategy (default)', () => {
    class User extends Model<InferAttributes<User>> {
      @EncryptedAttribute({
        type: DataTypes.STRING,
        key: TEST_KEY,
        strategy: Aes256GcmStrategy,
      })
      declare ssn: string;
    }

    sequelize.addModels([User]);

    const user = User.build({ ssn: 'gcm-test' } as any);
    expect(user.ssn).to.equal('gcm-test');
  });

  it('works with Aes256CbcStrategy', () => {
    class User extends Model<InferAttributes<User>> {
      @EncryptedAttribute({
        type: DataTypes.STRING,
        key: TEST_KEY,
        strategy: Aes256CbcStrategy,
      })
      declare ssn: string;
    }

    sequelize.addModels([User]);

    const user = User.build({ ssn: 'cbc-test' } as any);
    expect(user.ssn).to.equal('cbc-test');
  });

  // ── Custom strategy ───────────────────────────────────────────────────

  it('accepts a custom CipherStrategy', () => {
    // A trivial "cipher" that just XORs with 0xFF for testing purposes.
    const xorStrategy = {
      encrypt(plaintext: Buffer, _key: Buffer) {
        const data = Buffer.alloc(plaintext.length);
        for (let i = 0; i < plaintext.length; i++) {
          data[i] = plaintext[i]! ^ 0xff;
        }

        return { data };
      },
      decrypt(packed: Buffer, _key: Buffer) {
        const data = Buffer.alloc(packed.length);
        for (let i = 0; i < packed.length; i++) {
          data[i] = packed[i]! ^ 0xff;
        }

        return data;
      },
      deterministic: true,
    };

    class User extends Model<InferAttributes<User>> {
      @EncryptedAttribute({
        type: DataTypes.STRING,
        key: TEST_KEY,
        strategy: xorStrategy,
      })
      declare ssn: string;
    }

    sequelize.addModels([User]);

    const user = User.build({ ssn: 'custom-strategy' } as any);
    expect(user.ssn).to.equal('custom-strategy');
  });

  // ── BLOB size option ──────────────────────────────────────────────────

  it('respects the blobLength option', () => {
    class User extends Model<InferAttributes<User>> {
      @EncryptedAttribute({
        type: DataTypes.STRING,
        key: TEST_KEY,
        blobLength: 'tiny',
      })
      declare ssn: string;
    }

    sequelize.addModels([User]);

    const attr = User.getAttributes().ssn;
    expect(attr.type).to.be.instanceof(DataTypes.BLOB);
    // The BLOB instance should have 'tiny' as its length option.
    expect((attr.type as InstanceType<typeof DataTypes.BLOB>).options.length).to.equal('tiny');
  });

  // ── Decorator validation ──────────────────────────────────────────────

  it('throws if used on a static property', () => {
    expect(() => {
      class User extends Model {
        @EncryptedAttribute({ type: DataTypes.STRING, key: TEST_KEY })
        static declare ssn: string;
      }

      return User;
    }).to.throw(/static/i);
  });

  it('throws if used on a non-Model class', () => {
    expect(() => {
      class NotAModel {
        @EncryptedAttribute({ type: DataTypes.STRING, key: TEST_KEY })
        declare ssn: string;
      }

      return NotAModel;
    }).to.throw(/does not extend Model/);
  });
});

// ── Standalone strategy tests ─────────────────────────────────────────────

describe('Aes256GcmStrategy', () => {
  const key = crypto.randomBytes(32);

  it('round-trips arbitrary data', () => {
    const plaintext = Buffer.from('hello, world!');
    const { data } = Aes256GcmStrategy.encrypt(plaintext, key);
    const decrypted = Aes256GcmStrategy.decrypt(data, key);
    expect(decrypted.toString()).to.equal('hello, world!');
  });

  it('packs version byte at index 0', () => {
    const { data } = Aes256GcmStrategy.encrypt(Buffer.from('test'), key);
    expect(data[0]).to.equal(0x01);
  });

  it('produces unique ciphertexts per call (random IV)', () => {
    const plaintext = Buffer.from('same');
    const a = Aes256GcmStrategy.encrypt(plaintext, key);
    const b = Aes256GcmStrategy.encrypt(plaintext, key);
    expect(Buffer.compare(a.data, b.data)).to.not.equal(0);
  });

  it('rejects tampered ciphertext', () => {
    const { data } = Aes256GcmStrategy.encrypt(Buffer.from('secret'), key);
    // Flip a byte in the ciphertext region
    data[14] ^= 0xff;
    expect(() => Aes256GcmStrategy.decrypt(data, key)).to.throw();
  });

  it('rejects wrong key', () => {
    const { data } = Aes256GcmStrategy.encrypt(Buffer.from('secret'), key);
    const wrongKey = crypto.randomBytes(32);
    expect(() => Aes256GcmStrategy.decrypt(data, wrongKey)).to.throw();
  });

  it('is non-deterministic', () => {
    expect(Aes256GcmStrategy.deterministic).to.equal(false);
  });
});

describe('Aes256CbcStrategy', () => {
  const key = crypto.randomBytes(32);

  it('round-trips arbitrary data', () => {
    const plaintext = Buffer.from('hello, world!');
    const { data } = Aes256CbcStrategy.encrypt(plaintext, key);
    const decrypted = Aes256CbcStrategy.decrypt(data, key);
    expect(decrypted.toString()).to.equal('hello, world!');
  });

  it('packs version byte at index 0', () => {
    const { data } = Aes256CbcStrategy.encrypt(Buffer.from('test'), key);
    expect(data[0]).to.equal(0x01);
  });

  it('produces unique ciphertexts per call (random IV)', () => {
    const plaintext = Buffer.from('same');
    const a = Aes256CbcStrategy.encrypt(plaintext, key);
    const b = Aes256CbcStrategy.encrypt(plaintext, key);
    expect(Buffer.compare(a.data, b.data)).to.not.equal(0);
  });

  it('rejects wrong key', () => {
    const { data } = Aes256CbcStrategy.encrypt(Buffer.from('secret'), key);
    const wrongKey = crypto.randomBytes(32);
    expect(() => Aes256CbcStrategy.decrypt(data, wrongKey)).to.throw();
  });

  it('is non-deterministic', () => {
    expect(Aes256CbcStrategy.deterministic).to.equal(false);
  });
});

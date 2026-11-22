import { DataTypes } from '@sequelize/core';
import {
  buildInvalidOptionReceivedError,
  rejectInvalidOptions,
} from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/check.js';
import {
  defaultValueSchemable,
  isWhereEmpty,
} from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/query-builder-utils.js';
import { expect } from 'chai';
import { allowDeprecationsInSuite, sequelize } from '../../support';

const dialect = sequelize.dialect;

describe('utils / check', () => {
  describe('defaultValueSchemable', () => {
    allowDeprecationsInSuite(['SEQUELIZE0026']);

    it('should return false if the value is a NOW', () => {
      expect(defaultValueSchemable(DataTypes.NOW, dialect)).to.equal(false);
      expect(defaultValueSchemable(DataTypes.NOW(), dialect)).to.equal(false);
    });
    it('should return false if the value is a UUIDV1', () => {
      expect(defaultValueSchemable(DataTypes.UUIDV1, dialect)).to.equal(false);
      expect(defaultValueSchemable(DataTypes.UUIDV1(), dialect)).to.equal(false);
    });
    it('should return false if the value is a UUIDV4', () => {
      expect(defaultValueSchemable(DataTypes.UUIDV4, dialect)).to.equal(false);
      expect(defaultValueSchemable(DataTypes.UUIDV4(), dialect)).to.equal(false);
    });
    it('should return true otherwise', () => {
      expect(defaultValueSchemable('hello', dialect)).to.equal(true);
      expect(defaultValueSchemable(DataTypes.INTEGER(), dialect)).to.equal(true);
    });
  });

  describe('isWhereEmpty', () => {
    it('should return true if the where is empty', () => {
      expect(isWhereEmpty({})).to.equal(true);
    });
    it('should return false if the where is not empty', () => {
      expect(isWhereEmpty({ a: 1 })).to.equal(false);
    });
    it('should return false even if value is empty', () => {
      expect(isWhereEmpty({ a: undefined })).to.equal(false);
    });
  });

  describe('rejectInvalidOptions', () => {
    const supportableOptions = new Set(['ifExists', 'cascade', 'concurrently']);

    // supported options are cached per method name, so each test uses its own method name
    it('accepts supported options', () => {
      expect(() => {
        rejectInvalidOptions('acceptsSupported', dialect, supportableOptions, ['ifExists'], {
          ifExists: true,
        });
      }).not.to.throw();
    });

    it('ignores undefined and false values', () => {
      expect(() => {
        rejectInvalidOptions('ignoresUndefinedAndFalse', dialect, supportableOptions, [], {
          ifExists: undefined,
          cascade: false,
        });
      }).not.to.throw();
    });

    it('accepts undefined options', () => {
      expect(() => {
        rejectInvalidOptions('acceptsUndefined', dialect, supportableOptions, [], undefined);
      }).not.to.throw();
    });

    it('ignores options that are not supportable', () => {
      expect(() => {
        rejectInvalidOptions('ignoresNotSupportable', dialect, supportableOptions, [], {
          notSupportable: true,
        });
      }).not.to.throw();
    });

    it('throws if an unsupported option is received, listing them in alphabetical order', () => {
      expect(() => {
        rejectInvalidOptions('throwsUnsupported', dialect, supportableOptions, ['concurrently'], {
          ifExists: true,
          cascade: 0,
          concurrently: true,
          notSupportable: true,
        });
      }).to.throw(
        buildInvalidOptionReceivedError('throwsUnsupported', dialect.name, ['cascade', 'ifExists'])
          .message,
      );
    });

    it('accepts supported options passed as an object', () => {
      expect(() => {
        rejectInvalidOptions(
          'acceptsSupportedObject',
          dialect,
          supportableOptions,
          { ifExists: true, cascade: false },
          { ifExists: true },
        );
      }).not.to.throw();
    });

    it('rejects options that are disabled in the supported options object', () => {
      expect(() => {
        rejectInvalidOptions(
          'rejectsDisabledInObject',
          dialect,
          supportableOptions,
          { ifExists: true, cascade: false },
          { cascade: true },
        );
      }).to.throw(
        buildInvalidOptionReceivedError('rejectsDisabledInObject', dialect.name, ['cascade'])
          .message,
      );
    });

    it('ignores non-enumerable properties without calling their getter, but not enumerable inherited ones', () => {
      class OptionsWithGetter {
        get cascade(): boolean {
          throw new Error('getter should not be called');
        }
      }

      expect(() => {
        rejectInvalidOptions(
          'ignoresNonEnumerable',
          dialect,
          supportableOptions,
          [],
          new OptionsWithGetter(),
        );
      }).not.to.throw();

      expect(() => {
        rejectInvalidOptions(
          'rejectsEnumerableInherited',
          dialect,
          supportableOptions,
          [],
          Object.create({ cascade: true }),
        );
      }).to.throw(
        buildInvalidOptionReceivedError('rejectsEnumerableInherited', dialect.name, ['cascade'])
          .message,
      );
    });
  });
});

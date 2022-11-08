import { DataTypes } from '@sequelize/core';
import { expect } from 'chai';
import { sequelize } from '../../support';

describe('DataTypes.ENUM', () => {
  it('raises an error if no values are defined', () => {
    expect(() => {
      sequelize.define('omnomnom', {
        bla: { type: DataTypes.ENUM },
      });
    }).to.throwWithCause(Error, 'DataTypes.ENUM cannot be used without specifying its possible enum values.');
  });

  describe('setting values for enums', () => {
    it('should not throw if `values` is a readonly array', () => {
      const Array = ['A', 'B', 'C', 'D', 'E'] as const;
      const type = DataTypes.ENUM({ values: Array });

      expect(type.options.values).to.be.equal(Array);
    });

    it('should not throw if `values` is an mutable array', () => {
      const Array = ['A', 'B', 'C', 'D', 'E'];
      const type = DataTypes.ENUM({ values: Array });

      expect(type.options.values).to.be.equal(Array);
    });

    it('should not throw if members is a readonly array', () => {
      const Array = ['A', 'B', 'C', 'D', 'E'] as const;
      const type = DataTypes.ENUM(Array);

      expect(type.options.values).to.be.equal(Array);
    });

    it('should not throw if members is an mutable array', () => {
      const Array = ['A', 'B', 'C', 'D', 'E'];
      const type = DataTypes.ENUM(Array);

      expect(type.options.values).to.be.equal(Array);
    });
  });
});

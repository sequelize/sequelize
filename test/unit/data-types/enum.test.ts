import { DataTypes } from '@sequelize/core';

describe('DataTypes.ENUM', () => {
  describe('setting values for enums', () => {
    it('should not throw if `values` is a readonly array', () => {
      const values = ['A', 'B', 'C', 'D', 'E'] as const;
      DataTypes.ENUM({ values });
    });

    it('should not throw if `values` is an mutable array', () => {
      const values = ['A', 'B', 'C', 'D', 'E'];
      DataTypes.ENUM({ values });
    });

    it('should not throw if members is a readonly array', () => {
      const values = ['A', 'B', 'C', 'D', 'E'] as const;
      DataTypes.ENUM(values);
    });

    it('should not throw if members is an mutable array', () => {
      const values = ['A', 'B', 'C', 'D', 'E'];
      DataTypes.ENUM(values);
    });
  });
});

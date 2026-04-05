import type { InferAttributes, InferCreationAttributes } from '@sequelize/core';
import { DataTypes, Model } from '@sequelize/core';
import { expect } from 'chai';
import { beforeAll2, sequelize } from '../../support';

const dialect = sequelize.dialect;

describe('Model#changed()', () => {
  describe('Non-JSON attribute', () => {
    const vars = beforeAll2(() => {
      class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
        declare name: string | null;
        declare birthday: Date | null;
      }

      User.init(
        {
          name: DataTypes.STRING,
          birthday: DataTypes.DATE,
        },
        { sequelize },
      );

      return { User };
    });

    it('returns true when an non-fetched value is changed', () => {
      const user = vars.User.build(
        {
          name: 'a',
        },
        {
          isNewRecord: false,
          raw: true,
        },
      );

      expect(user.changed('name')).to.equal(false, 'name not be considered changed');
      user.set('name', 'b');
      expect(user.changed('name')).to.equal(true, 'name should be considered changed');
    });

    it('returns false when setting an existing value to the same primitive value', () => {
      const user = vars.User.build(
        {
          name: 'a',
          birthday: null,
        },
        {
          isNewRecord: false,
          raw: true,
        },
      );

      user.set('name', 'a');
      user.set('birthday', null);
      expect(user.changed('name')).to.equal(false);
      expect(user.changed('birthday')).to.equal(false);
    });

    it('returns false when setting a value to the same object value', () => {
      const milliseconds = 1_436_921_941_088;
      const firstDate = new Date(milliseconds);
      const secondDate = new Date(milliseconds);

      const user = vars.User.build(
        {
          birthday: firstDate,
        },
        {
          isNewRecord: false,
          raw: true,
        },
      );

      user.set('birthday', secondDate);
      expect(user.changed('birthday')).to.equal(false);
    });

    it('should return true when a value is modified by setDataValue', () => {
      const user = vars.User.build(
        {
          name: 'a',
        },
        {
          isNewRecord: false,
          raw: true,
        },
      );

      user.setDataValue('name', 'b');
      expect(user.changed('name')).to.equal(true);
    });

    it('should return true when a value is modified by direct assignations', () => {
      const user = vars.User.build(
        {
          name: 'a',
        },
        {
          isNewRecord: false,
          raw: true,
        },
      );

      user.name = 'b';

      expect(user.changed('name')).to.equal(true);
    });
  });

  if (dialect.supports.dataTypes.JSON) {
    describe('JSON attribute', () => {
      const vars = beforeAll2(() => {
        class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
          declare json: unknown;
        }

        User.init(
          {
            json: DataTypes.JSON,
          },
          { sequelize },
        );

        return { User };
      });

      it('returns false when setting a value to the same object value', () => {
        for (const value of [null, 1, 'asdf', new Date(), [], {}, Buffer.from('')]) {
          const t = vars.User.build(
            {
              json: value,
            },
            {
              isNewRecord: false,
              raw: true,
            },
          );

          t.json = value;

          expect(t.changed('json')).to.be.false;
          expect(t.changed()).to.be.false;
        }
      });

      it('returns true when setting a value to a different primitive value with Model#set & json.path notation', () => {
        const user = vars.User.build(
          {
            json: {
              city: 'Stockholm',
            },
          },
          {
            isNewRecord: false,
            raw: true,
          },
        );

        // @ts-expect-error -- TODO: fix Model#set typings to support this syntax
        user.set('json.city', 'Gothenburg');
        expect(user.changed('json')).to.equal(true);
      });

      it('returns true when setting a value to the same primitive value with Model#set & json.path notation', () => {
        const user = vars.User.build(
          {
            json: {
              city: 'Gothenburg',
            },
          },
          {
            isNewRecord: false,
            raw: true,
          },
        );

        // @ts-expect-error -- TODO: fix Model#set typings to support this syntax
        user.set('json.city', 'Gothenburg');
        expect(user.changed('json')).to.equal(false);
      });

      it('returns true when setting a value to a different object value with set & json.path notation', () => {
        const user = vars.User.build(
          {
            json: {
              address: { street: 'Main street', number: '40' },
            },
          },
          {
            isNewRecord: false,
            raw: true,
          },
        );

        // @ts-expect-error -- TODO: fix Model#set typings to support this syntax
        user.set('json.address', { street: 'Second street', number: '1' });
        expect(user.changed('json')).to.equal(true);
      });

      it('returns false when setting a value to the same object value with set & json.path notation', () => {
        const user = vars.User.build(
          {
            json: {
              address: { street: 'Main street', number: '40' },
            },
          },
          {
            isNewRecord: false,
            raw: true,
          },
        );

        // @ts-expect-error -- TODO: fix Model#set typings to support this syntax
        user.set('json.address', { street: 'Main street', number: '40' });
        expect(user.changed('json')).to.equal(false);
      });
    });
  }
});

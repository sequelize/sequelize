import type {
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from '@sequelize/core';
import { DataTypes, fn } from '@sequelize/core';
import { expect } from 'chai';
import { getTestDialect, sequelize } from '../../../support';

if (getTestDialect() === 'postgres') {
  describe('[POSTGRES Specific] Data Types', () => {
    describe('DATE SQL', () => {
      // create dummy user
      it('should be able to create and update records with Infinity/-Infinity', async () => {
        interface TUser extends Model<InferAttributes<TUser>, InferCreationAttributes<TUser>> {
          username: string | null;
          beforeTime: Date | number | null;
          sometime: Date | number | null;
          anotherTime: Date | number | null;
          afterTime: Date | number | null;
        }

        const date = new Date();
        const User = sequelize.define<TUser>(
          'User',
          {
            username: DataTypes.STRING,
            beforeTime: {
              type: DataTypes.DATE,
              defaultValue: Number.NEGATIVE_INFINITY,
            },
            sometime: {
              type: DataTypes.DATE,
              defaultValue: fn('NOW'),
            },
            anotherTime: {
              type: DataTypes.DATE,
            },
            afterTime: {
              type: DataTypes.DATE,
              defaultValue: Number.POSITIVE_INFINITY,
            },
          },
          {
            timestamps: true,
          },
        );

        await User.sync({
          force: true,
        });

        const user4 = await User.create(
          {
            username: 'bob',
            anotherTime: Number.POSITIVE_INFINITY,
          },
          {
            validate: true,
          },
        );

        expect(user4.username).to.equal('bob');
        expect(user4.beforeTime).to.equal(Number.NEGATIVE_INFINITY);
        expect(user4.sometime).to.be.withinTime(date, new Date());
        expect(user4.anotherTime).to.equal(Number.POSITIVE_INFINITY);
        expect(user4.afterTime).to.equal(Number.POSITIVE_INFINITY);

        const user3 = await user4.update(
          {
            sometime: Number.POSITIVE_INFINITY,
          },
          {
            returning: true,
          },
        );

        expect(user3.sometime).to.equal(Number.POSITIVE_INFINITY);

        const user2 = await user3.update({
          sometime: Number.POSITIVE_INFINITY,
        });

        expect(user2.sometime).to.equal(Number.POSITIVE_INFINITY);

        const user1 = await user2.update(
          {
            sometime: fn('NOW'),
          },
          {
            returning: true,
          },
        );

        expect(user1.sometime).to.be.withinTime(date, new Date());

        // find
        const users = await User.findAll();
        expect(users[0].beforeTime).to.equal(Number.NEGATIVE_INFINITY);
        expect(users[0].sometime).to.not.equal(Number.POSITIVE_INFINITY);
        expect(users[0].afterTime).to.equal(Number.POSITIVE_INFINITY);

        const user0 = await users[0].update({
          sometime: date,
        });

        expect(user0.sometime).to.equalTime(date);

        const user = await user0.update({
          sometime: date,
        });

        expect(user.sometime).to.equalTime(date);
      });
    });

    describe('DATEONLY SQL', () => {
      // create dummy user
      it('should be able to create and update records with Infinity/-Infinity', async () => {
        const date = new Date();

        interface TUser extends Model<InferAttributes<TUser>, InferCreationAttributes<TUser>> {
          username: string | null;
          beforeTime: string | number | null;
          sometime: CreationOptional<string | number>;
          anotherTime: string | number | null;
          afterTime: string | number | null;
        }

        const User = sequelize.define<TUser>(
          'User',
          {
            username: DataTypes.STRING,
            beforeTime: {
              type: DataTypes.DATEONLY,
              defaultValue: Number.NEGATIVE_INFINITY,
            },
            sometime: {
              type: DataTypes.DATEONLY,
              defaultValue: fn('NOW'),
              allowNull: false,
            },
            anotherTime: {
              type: DataTypes.DATEONLY,
            },
            afterTime: {
              type: DataTypes.DATEONLY,
              defaultValue: Number.POSITIVE_INFINITY,
            },
          },
          {
            timestamps: true,
          },
        );

        await User.sync({
          force: true,
        });

        const user4 = await User.create(
          {
            username: 'bob',
            anotherTime: Number.POSITIVE_INFINITY,
          },
          {
            validate: true,
          },
        );

        expect(user4.username).to.equal('bob');
        expect(user4.beforeTime).to.equal(Number.NEGATIVE_INFINITY);
        expect(new Date(user4.sometime)).to.be.withinDate(date, new Date());
        expect(user4.anotherTime).to.equal(Number.POSITIVE_INFINITY);
        expect(user4.afterTime).to.equal(Number.POSITIVE_INFINITY);

        const user3 = await user4.update(
          {
            sometime: Number.POSITIVE_INFINITY,
          },
          {
            returning: true,
          },
        );

        expect(user3.sometime).to.equal(Number.POSITIVE_INFINITY);

        const user2 = await user3.update({
          sometime: Number.POSITIVE_INFINITY,
        });

        expect(user2.sometime).to.equal(Number.POSITIVE_INFINITY);

        const user1 = await user2.update(
          {
            sometime: fn('NOW'),
          },
          {
            returning: true,
          },
        );

        expect(user1.sometime).to.not.equal(Number.POSITIVE_INFINITY);
        expect(new Date(user1.sometime)).to.be.withinDate(date, new Date());

        // find
        const users = await User.findAll();
        expect(users[0].beforeTime).to.equal(Number.NEGATIVE_INFINITY);
        expect(users[0].sometime).to.not.equal(Number.POSITIVE_INFINITY);
        expect(users[0].afterTime).to.equal(Number.POSITIVE_INFINITY);

        const user0 = await users[0].update({
          sometime: '1969-07-20',
        });

        expect(user0.sometime).to.equal('1969-07-20');

        const user = await user0.update({
          sometime: '1969-07-20',
        });

        expect(user.sometime).to.equal('1969-07-20');
      });
    });
  });
}

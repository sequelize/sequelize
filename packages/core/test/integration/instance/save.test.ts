import type {
  CreationOptional,
  HasManySetAssociationsMixin,
  InferAttributes,
  InferCreationAttributes,
  NonAttribute,
} from '@sequelize/core';
import { DataTypes, Model, ValidationError, sql } from '@sequelize/core';
import {
  Attribute,
  BelongsTo,
  ColumnName,
  Default,
  PrimaryKey,
  Table,
} from '@sequelize/core/decorators-legacy';
import { IsInt, Len } from '@sequelize/validator.js';
import { expect } from 'chai';
import { describe } from 'mocha';
import assert from 'node:assert';
import sinon from 'sinon';
import {
  beforeAll2,
  createSingleTransactionalTestSequelizeInstance,
  sequelize,
  setResetMode,
} from '../support';

describe('Model#save', () => {
  context('test-shared models', () => {
    setResetMode('destroy');

    const vars = beforeAll2(async () => {
      const clock = sinon.useFakeTimers();

      class Book extends Model<InferAttributes<Book>, InferCreationAttributes<Book>> {
        declare id: CreationOptional<number>;
        declare updatedAt: CreationOptional<Date>;

        @Attribute(DataTypes.STRING)
        declare title: string | null;

        @Attribute(DataTypes.DATE)
        @Default(DataTypes.NOW)
        declare publishedAt: Date | null;

        @Attribute(DataTypes.INTEGER)
        declare integer1: number | null;

        @Attribute(DataTypes.INTEGER)
        declare integer2: number | null;

        @Attribute(DataTypes.INTEGER)
        @IsInt
        declare validateTest: number | null;

        @Attribute(DataTypes.STRING)
        @Len({ msg: 'Length failed.', args: [1, 20] })
        declare validateCustom: string | null;

        declare pages?: NonAttribute<Page[]>;
        declare setPages: HasManySetAssociationsMixin<Page, Page['id']>;
      }

      class Page extends Model<InferAttributes<Page>, InferCreationAttributes<Page>> {
        declare id: CreationOptional<number>;
        declare updatedAt: CreationOptional<Date>;

        @Attribute(DataTypes.STRING)
        declare content: string | null;

        @BelongsTo(() => Book, {
          foreignKey: 'bookId',
          inverse: {
            as: 'pages',
            type: 'hasMany',
          },
        })
        declare book?: NonAttribute<Book | null>;

        declare bookId: number | null;
      }

      sequelize.addModels([Book, Page]);

      await sequelize.sync({ force: true });

      return { Book, Page, clock };
    });

    afterEach(() => {
      vars.clock.reset();
    });

    after(() => {
      vars.clock.restore();
    });

    it('inserts an entry in the database', async () => {
      const { Book } = vars;

      const title = 'user';
      const user = Book.build({
        title,
        publishedAt: new Date(1984, 8, 23),
      });

      const books = await Book.findAll();
      expect(books).to.have.length(0);
      await user.save();
      const users0 = await Book.findAll();
      expect(users0).to.have.length(1);
      expect(users0[0].title).to.equal(title);
      expect(users0[0].publishedAt).to.be.instanceof(Date);
      expect(users0[0].publishedAt).to.equalDate(new Date(1984, 8, 23));
    });

    it('only updates fields in passed array', async () => {
      const date = new Date(1990, 1, 1);

      const book = await vars.Book.create({
        title: 'foo',
        publishedAt: new Date(),
      });

      book.title = 'fizz';
      book.publishedAt = date;

      await book.save({ fields: ['title'] });

      const reloadedBook = await vars.Book.findByPk(book.id, { rejectOnEmpty: true });
      expect(reloadedBook.title).to.equal('fizz');
      expect(reloadedBook.publishedAt).not.to.equal(date);
    });

    it('sets the timestamps on insert', async () => {
      const { Book, clock } = vars;

      const now = new Date();
      now.setMilliseconds(0);

      const book = Book.build({});

      clock.tick(1000);
      await book.save();

      expect(book).have.property('updatedAt').afterTime(now);
    });

    it('sets the timestamps on update', async () => {
      const { Book, clock } = vars;

      const now = new Date();
      now.setMilliseconds(0);

      const user = await Book.create({});
      const firstUpdatedAt = user.updatedAt;

      user.title = 'title';

      clock.tick(1000);
      await user.save();

      expect(user).have.property('updatedAt').afterTime(firstUpdatedAt);
    });

    it('does not update timestamps if nothing changed', async () => {
      const book = await vars.Book.create({ title: 'title' });
      const updatedAt = book.updatedAt;

      vars.clock.tick(2000);
      const newlySavedUser = await book.save();

      expect(newlySavedUser.updatedAt).to.equalTime(updatedAt);
    });

    it('does not update timestamps when option "silent=true" is used', async () => {
      const book = await vars.Book.create({ title: 'title 1' });
      const updatedAt = book.updatedAt;

      vars.clock.tick(1000);

      book.title = 'title 2';
      await book.save({
        silent: true,
      });

      expect(book.updatedAt).to.equalTime(updatedAt);
    });

    it('updates with function and column value', async () => {
      const book = await vars.Book.create({
        integer1: 42,
      });

      // @ts-expect-error -- TODO: forbid this, but allow doing it via instance.update()
      book.integer2 = sql.attribute('integer1');

      // @ts-expect-error -- TODO: forbid this, but allow doing it via instance.update()
      book.title = sql.fn('upper', 'sequelize');

      await book.save();
      const refreshedBook = await vars.Book.findByPk(book.id, { rejectOnEmpty: true });
      expect(refreshedBook.title).to.equal('SEQUELIZE');
      expect(refreshedBook.integer2).to.equal(42);
    });

    it('validates saved attributes', async () => {
      try {
        await vars.Book.build({ validateCustom: 'aaaaaaaaaaaaaaaaaaaaaaaaaa' }).save();
      } catch (error) {
        assert(error instanceof ValidationError);
        expect(error.get('validateCustom')).to.exist;
        expect(error.get('validateCustom')).to.be.instanceof(Array);
        expect(error.get('validateCustom')[0]).to.exist;
        expect(error.get('validateCustom')[0].message).to.equal('Length failed.');
      }
    });

    it('does not validate non-saved attributes', async () => {
      await vars.Book.build({
        // @ts-expect-error -- invalid value, but not saved so not validated
        validateTest: 'cake',
        validateCustom: '1',
      }).save({
        fields: ['validateCustom'],
      });
    });

    it('supports nullish values', async () => {
      const user = await vars.Book.build({ integer1: 0 }).save({ fields: ['integer1'] });

      expect(user.integer1).to.equal(0);
    });

    it('does not lose eagerly-loaded associations', async () => {
      const { Book, Page } = vars;

      const book = await Book.create({ title: 'title', integer1: 1 });

      await Promise.all([
        Page.create({ bookId: book.id, content: 'page 1' }),
        Page.create({ bookId: book.id, content: 'page 2' }),
      ]);

      const book1 = await Book.findOne({
        where: { id: book.id },
        include: ['pages'],
        rejectOnEmpty: true,
      });

      expect(book1.title).to.equal('title');
      expect(book1.pages).to.exist;
      expect(book1.pages!.length).to.equal(2);

      book1.integer1! += 1;

      await book1.save();

      expect(book1.title).to.equal('title');
      expect(book1.integer1).to.equal(2);
      expect(book1.pages).to.exist;
      expect(book1.pages!.length).to.equal(2);
    });

    describe('hooks', () => {
      it('should update attributes added in hooks when default fields are used', async () => {
        const { Book } = vars;

        const unhook = Book.hooks.addListener('beforeUpdate', instance => {
          instance.set('title', 'B');
        });

        try {
          const book0 = await Book.create({
            title: 'A',
            integer1: 1,
          });

          await book0
            .set({
              integer1: 2,
            })
            .save();

          const book = await Book.findOne({ rejectOnEmpty: true });
          expect(book.get('title')).to.equal('B');
          expect(book.get('integer1')).to.equal(2);
        } finally {
          unhook();
        }
      });

      it('should update attributes changed in hooks when default fields are used', async () => {
        const { Book } = vars;

        const unhook = Book.hooks.addListener('beforeUpdate', instance => {
          instance.set('email', 'C');
        });

        try {
          const book0 = await Book.create({
            title: 'A',
            integer1: 1,
          });

          await book0
            .set({
              title: 'B',
              integer1: 2,
            })
            .save();

          const book = await Book.findOne({ rejectOnEmpty: true });
          expect(book.get('title')).to.equal('B');
          expect(book.get('integer1')).to.equal(2);
        } finally {
          unhook();
        }
      });

      it('validates attributes changed in hooks', async () => {
        const { Book } = vars;

        // validateTest
        const unhook = Book.hooks.addListener('beforeUpdate', instance => {
          instance.set('validateTest', 'B');
        });

        try {
          const book0 = await Book.create({
            validateTest: 1,
          });

          await expect(
            book0
              .set({
                title: 'new title',
              })
              .save(),
          ).to.be.rejectedWith(ValidationError);

          const book = await Book.findOne({ rejectOnEmpty: true });
          expect(book.get('validateTest')).to.equal(1);
        } finally {
          unhook();
        }
      });
    });
  });

  context('test-specific models', () => {
    if (sequelize.dialect.supports.transactions) {
      it('supports transactions', async () => {
        const transactionSequelize =
          await createSingleTransactionalTestSequelizeInstance(sequelize);
        const User = transactionSequelize.define('User', { username: DataTypes.STRING });
        await User.sync({ force: true });
        const transaction = await transactionSequelize.startUnmanagedTransaction();
        try {
          await User.build({ username: 'foo' }).save({ transaction });
          const count1 = await User.count();
          const count2 = await User.count({ transaction });
          expect(count1).to.equal(0);
          expect(count2).to.equal(1);
        } finally {
          await transaction.rollback();
        }
      });
    }

    it('is disallowed if no primary key is present', async () => {
      const Foo = sequelize.define('Foo', {});
      await Foo.sync({ force: true });

      const instance = await Foo.build({}, { isNewRecord: false });
      await expect(instance.save()).to.be.rejectedWith(
        'You attempted to save an instance with no primary key',
      );
    });

    it('should not throw ER_EMPTY_QUERY if changed only virtual fields', async () => {
      const User = sequelize.define(
        `User`,
        {
          name: DataTypes.STRING,
          bio: {
            type: DataTypes.VIRTUAL,
            get: () => 'swag',
          },
        },
        {
          timestamps: false,
        },
      );

      await User.sync({ force: true });

      // TODO: attempting to set a value on a virtual attribute that does not have a setter should throw
      //  the test can remain, but add a setter that does nothing
      const user = await User.create({ name: 'John', bio: 'swag 1' });
      await user.update({ bio: 'swag 2' });
    });

    it(`doesn't update the updatedAt attribute if timestamps attributes are disabled`, async () => {
      @Table({
        timestamps: false,
      })
      class User extends Model<InferAttributes<User>> {
        declare id: number;

        @Attribute(DataTypes.DATE)
        declare updatedAt: Date | null;
      }

      sequelize.addModels([User]);

      await User.sync();
      const johnDoe = await User.create({ id: 1 });

      // TODO: nullable attributes should always be set to null - https://github.com/sequelize/sequelize/issues/14671
      expect(johnDoe.updatedAt).to.beNullish();
    });

    it('still updates createdAt if updatedAt is disabled', async () => {
      @Table({
        updatedAt: false,
      })
      class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
        declare createdAt: CreationOptional<Date>;
      }

      sequelize.addModels([User]);

      await User.sync();

      const johnDoe = await User.create({});

      expect(johnDoe).to.not.have.property('updatedAt');
      expect(johnDoe.createdAt).to.notBeNullish();
    });

    it('still updates updatedAt if createdAt is disabled', async () => {
      @Table({
        createdAt: false,
      })
      class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
        declare updatedAt: CreationOptional<Date>;
      }

      sequelize.addModels([User]);

      await User.sync();

      const johnDoe = await User.create({});
      expect(johnDoe).to.not.have.property('createdAt');
      expect(johnDoe.updatedAt).to.notBeNullish();
    });

    it('should map the correct fields when saving instance (#10589)', async () => {
      class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
        @ColumnName('id2')
        @Attribute(DataTypes.INTEGER)
        declare id: number;

        @ColumnName('id3')
        @Attribute(DataTypes.INTEGER)
        declare id2: number;

        @ColumnName('id')
        @Attribute(DataTypes.INTEGER)
        @PrimaryKey
        declare id3: number;
      }

      sequelize.addModels([User]);
      await sequelize.sync({ force: true });
      await User.create({ id3: 94, id: 87, id2: 943 });
      const user = await User.findByPk(94, { rejectOnEmpty: true });

      await user.set('id2', 8877);
      await user.save();

      expect((await User.findByPk(94, { rejectOnEmpty: true })).id2).to.equal(8877);
    });
  });
});

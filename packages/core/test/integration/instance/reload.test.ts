import type {
  CreationOptional,
  HasManyCreateAssociationMixin,
  HasManySetAssociationsMixin,
  InferAttributes,
  InferCreationAttributes,
  NonAttribute,
} from '@sequelize/core';
import { DataTypes, InstanceError, Model } from '@sequelize/core';
import { Attribute, BelongsTo, HasMany, NotNull, Table } from '@sequelize/core/decorators-legacy';
import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import {
  beforeAll2,
  createSingleTransactionalTestSequelizeInstance,
  sequelize,
  setResetMode,
} from '../support';

describe('Model#reload', () => {
  context('test-shared models', () => {
    setResetMode('destroy');

    const vars = beforeAll2(async () => {
      const clock = sinon.useFakeTimers();

      class Book extends Model<InferAttributes<Book>, InferCreationAttributes<Book>> {
        declare id: CreationOptional<number>;
        declare updatedAt: CreationOptional<Date>;

        @Attribute(DataTypes.STRING)
        declare title: string | null;

        @Attribute(DataTypes.INTEGER)
        declare integer1: number | null;

        @Attribute(DataTypes.INTEGER)
        declare integer2: number | null;

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

    it('returns a reference to the same instance instead of creating a new one', async () => {
      const original = await vars.Book.create({ title: 'Book Title 1' });
      await original.update({ title: 'Book Title 2' });
      const updated = await original.reload();
      expect(original === updated).to.be.true;
    });

    it('updates local value based on the values in the database', async () => {
      const originalBook = await vars.Book.create({ title: 'Title 1' });
      const updatedBook = await vars.Book.findByPk(originalBook.id, { rejectOnEmpty: true });
      await updatedBook.update({ title: 'Title 2' });

      // We used a different reference when calling update, so originalBook is now out of sync
      expect(originalBook.title).to.equal('Title 1');
      await originalBook.reload();
      expect(originalBook.title).to.equal('Title 2');
    });

    it('uses its own "where" condition', async () => {
      const book1 = await vars.Book.create({ title: 'First Book' });
      const book2 = await vars.Book.create({ title: 'Second Book' });

      const primaryKey = book1.get('id');

      await book1.reload();
      expect(book1.get('id')).to.equal(primaryKey);

      // @ts-expect-error -- where is not a supported option in "reload"
      await book1.reload({ where: { id: book2.get('id') } });
      expect(book1.get('id')).to.equal(primaryKey).and.not.equal(book2.get('id'));
    });

    it('supports updating a subset of attributes', async () => {
      const book1 = await vars.Book.create({
        integer1: 1,
        integer2: 1,
      });

      await vars.Book.update(
        {
          integer1: 2,
          integer2: 2,
        },
        {
          where: {
            id: book1.get('id'),
          },
        },
      );

      const user = await book1.reload({
        attributes: ['integer1'],
      });

      expect(user.get('integer1')).to.equal(2);
      expect(user.get('integer2')).to.equal(1);
    });

    it('updates timestamp attributes', async () => {
      const originalBook = await vars.Book.create({ title: 'Title 1' });
      const originallyUpdatedAt = originalBook.updatedAt;

      // Wait for a second, so updatedAt will actually be different
      vars.clock.tick(1000);
      const updatedBook = await vars.Book.findByPk(originalBook.id, { rejectOnEmpty: true });
      await updatedBook.update({ title: 'Title 2' });
      await originalBook.reload();
      expect(originalBook.updatedAt).to.be.above(originallyUpdatedAt);
      expect(updatedBook.updatedAt).to.be.above(originallyUpdatedAt);
    });

    it('returns an error when reload fails', async () => {
      const user = await vars.Book.create({ title: 'Title' });
      await user.destroy();

      await expect(user.reload()).to.be.rejectedWith(
        InstanceError,
        'Instance could not be reloaded because it does not exist anymore (find call returned null)',
      );
    });

    it('updates internal options of the instance', async () => {
      const { Book, Page } = vars;

      const [book, page] = await Promise.all([
        Book.create({ title: 'A very old book' }),
        Page.create(),
      ]);

      await book.setPages([page]);

      const fetchedBook = await Book.findOne({
        where: { id: book.id },
        rejectOnEmpty: true,
      });

      // @ts-expect-error -- testing internal option
      const oldOptions = fetchedBook._options;

      await fetchedBook.reload({
        include: [Page],
      });

      // @ts-expect-error -- testing internal option
      expect(oldOptions).not.to.equal(fetchedBook._options);
      // @ts-expect-error -- testing internal option
      expect(fetchedBook._options.include.length).to.equal(1);
      expect(fetchedBook.pages!.length).to.equal(1);

      // @ts-expect-error -- type this correctly
      expect(fetchedBook.get({ plain: true }).pages!.length).to.equal(1);
    });

    it('reloads included associations', async () => {
      const { Book, Page } = vars;

      const [book, page] = await Promise.all([
        Book.create({ title: 'A very old book' }),
        Page.create({ content: 'om nom nom' }),
      ]);

      await book.setPages([page]);

      const leBook = await Book.findOne({
        where: { id: book.id },
        include: [Page],
        rejectOnEmpty: true,
      });

      const page0 = await page.update({ content: 'something totally different' });
      expect(leBook.pages!.length).to.equal(1);
      expect(leBook.pages![0].content).to.equal('om nom nom');
      expect(page0.content).to.equal('something totally different');

      await leBook.reload();
      expect(leBook.pages!.length).to.equal(1);
      expect(leBook.pages![0].content).to.equal('something totally different');
      expect(page0.content).to.equal('something totally different');
    });

    it('should set an association to null after deletion, 1-1', async () => {
      const { Book, Page } = vars;

      const page = await Page.create(
        {
          content: 'the brand',
          // @ts-expect-error -- TODO: properly type this
          book: {
            title: 'hello',
          },
        },
        { include: [Book] },
      );

      const reloadedPage = await Page.findOne({
        where: { id: page.id },
        include: [Book],
        rejectOnEmpty: true,
      });

      expect(reloadedPage.book).not.to.be.null;
      await page.book!.destroy();
      await reloadedPage.reload();
      expect(reloadedPage.book).to.be.null;
    });

    it('should set an association to empty after all deletion, 1-N', async () => {
      const { Book, Page } = vars;

      const book = await Book.create(
        {
          title: 'title',
          // @ts-expect-error -- TODO: properly type this
          pages: [
            {
              content: 'page 1',
            },
            {
              content: 'page 2',
            },
          ],
        },
        { include: [Page] },
      );

      const refetchedBook = await Book.findOne({
        where: { id: book.id },
        include: [Page],
        rejectOnEmpty: true,
      });

      expect(refetchedBook.pages).not.to.be.empty;
      await refetchedBook.pages![1].destroy();
      await refetchedBook.pages![0].destroy();

      await refetchedBook.reload();
      expect(refetchedBook.pages).to.be.empty;
    });

    it('changed should be false after reload', async () => {
      const account0 = await vars.Book.create({ title: 'Title 1' });
      account0.title = 'Title 2';
      // @ts-expect-error -- TODO: rework "changed" to avoid overloading
      expect(account0.changed()[0]).to.equal('title');
      const account = await account0.reload();
      expect(account.changed()).to.equal(false);
    });
  });

  context('test-specific models', () => {
    if (sequelize.dialect.supports.transactions) {
      it('supports transactions', async () => {
        const transactionSequelize =
          await createSingleTransactionalTestSequelizeInstance(sequelize);

        class User extends Model<InferAttributes<User>> {
          @Attribute(DataTypes.STRING)
          @NotNull
          declare username: string;
        }

        transactionSequelize.addModels([User]);

        await transactionSequelize.sync({ force: true });
        const user = await User.create({ username: 'foo' });
        const t = await transactionSequelize.startUnmanagedTransaction();
        try {
          await User.update({ username: 'bar' }, { where: { username: 'foo' }, transaction: t });
          const user1 = await user.reload();
          expect(user1.username).to.equal('foo');
          const user0 = await user1.reload({ transaction: t });
          expect(user0.username).to.equal('bar');
        } finally {
          await t.rollback();
        }
      });
    }

    it('is disallowed if no primary key is present', async () => {
      const Foo = sequelize.define('Foo', {}, { noPrimaryKey: true });
      await Foo.sync({ force: true });

      const instance = await Foo.create({});
      await expect(instance.reload()).to.be.rejectedWith(
        'but the model does not have a primary key attribute definition.',
      );
    });

    it('should inject default scope when reloading', async () => {
      class Bar extends Model<InferAttributes<Bar>> {
        @Attribute(DataTypes.STRING)
        @NotNull
        declare name: string;

        declare fooId: number;
      }

      @Table({
        defaultScope: {
          include: [{ model: Bar }],
        },
      })
      class Foo extends Model<InferAttributes<Foo>, InferCreationAttributes<Foo>> {
        declare id: CreationOptional<number>;

        @HasMany(() => Bar, 'fooId')
        declare bars?: NonAttribute<Bar[]>;

        declare createBar: HasManyCreateAssociationMixin<Bar, 'fooId'>;
      }

      sequelize.addModels([Foo, Bar]);
      await sequelize.sync();

      const foo = await Foo.create();
      await foo.createBar({ name: 'bar' });

      const fooFromFind = await Foo.findByPk(foo.id, { rejectOnEmpty: true });

      expect(fooFromFind.bars).to.be.ok;
      expect(fooFromFind.bars![0].name).to.equal('bar');

      await foo.reload();

      expect(foo.bars).to.be.ok;
      expect(foo.bars![0].name).to.equal('bar');
    });
  });
});

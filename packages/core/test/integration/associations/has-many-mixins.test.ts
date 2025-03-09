import type {
  CreationOptional,
  HasManyAddAssociationsMixin,
  HasManyHasAssociationsMixin,
  HasManyRemoveAssociationsMixin,
  HasManySetAssociationsMixin,
  InferAttributes,
  InferCreationAttributes,
} from '@sequelize/core';
import { DataTypes, Model } from '@sequelize/core';
import { AllowNull, Attribute, HasMany, NotNull } from '@sequelize/core/decorators-legacy';
import { expect } from 'chai';
import {
  beforeAll2,
  createMultiTransactionalTestSequelizeInstance,
  sequelize,
  setResetMode,
} from '../support';

const dialect = sequelize.dialect;

describe('hasMany Mixins', () => {
  setResetMode('destroy');

  const vars = beforeAll2(async () => {
    class Article extends Model<InferAttributes<Article>, InferCreationAttributes<Article>> {
      declare id: CreationOptional<number>;

      @HasMany(() => Label, 'articleId')
      declare labels?: Label[];

      declare setLabels: HasManySetAssociationsMixin<Label, Label['id']>;
      declare removeLabels: HasManyRemoveAssociationsMixin<Label, Label['id']>;
      declare hasLabels: HasManyHasAssociationsMixin<Label, Label['id']>;
      declare addLabels: HasManyAddAssociationsMixin<Label, Label['id']>;

      @HasMany(() => NonNullLabel, 'articleId')
      declare nonNullLabels?: NonNullLabel[];

      declare setNonNullLabels: HasManySetAssociationsMixin<NonNullLabel, NonNullLabel['id']>;
      declare removeNonNullLabels: HasManyRemoveAssociationsMixin<NonNullLabel, NonNullLabel['id']>;
    }

    class Label extends Model<InferAttributes<Label>, InferCreationAttributes<Label>> {
      declare id: CreationOptional<number>;

      @AllowNull
      @Attribute(DataTypes.INTEGER)
      declare articleId: number | null;
    }

    class NonNullLabel extends Model<
      InferAttributes<NonNullLabel>,
      InferCreationAttributes<NonNullLabel>
    > {
      declare id: CreationOptional<number>;

      @NotNull
      @Attribute(DataTypes.INTEGER)
      declare articleId: number;
    }

    sequelize.addModels([Article, Label, NonNullLabel]);
    await sequelize.sync({ force: true });

    return { Article, Label, NonNullLabel };
  });

  describe('setAssociations', () => {
    it('associates target models to the source model', async () => {
      const { Label, Article } = vars;

      const [article, label] = await Promise.all([Article.create(), Label.create()]);

      // TODO: this should be null - https://github.com/sequelize/sequelize/issues/14671
      expect(label.articleId).to.beNullish();

      await article.setLabels([label]);
      await label.reload();

      expect(label.articleId).to.equal(article.id);
    });

    it('supports any iterable', async () => {
      const { Label, Article } = vars;

      const [article, label] = await Promise.all([Article.create(), Label.create()]);

      // TODO: this should be null - https://github.com/sequelize/sequelize/issues/14671
      expect(label.articleId).to.beNullish();

      await article.setLabels(new Set([label]));
      await label.reload();

      expect(label.articleId).to.equal(article.id);
    });

    it('unlinks the previous associations', async () => {
      const { Label, Article } = vars;

      const article = await Article.create();
      const label1 = await Label.create({ articleId: article.id });
      const label2 = await Label.create();

      expect(label1.articleId).to.equal(article.id);
      // TODO: this should be null - https://github.com/sequelize/sequelize/issues/14671
      expect(label2.articleId).to.beNullish();

      await article.setLabels([label2]);
      await Promise.all([label1.reload(), label2.reload()]);

      expect(label1.articleId).to.equal(null);
      expect(label2.articleId).to.equal(article.id);
    });

    it('clears associations when the parameter is null', async () => {
      const { Label, Article } = vars;

      const article = await Article.create();
      const label = await Label.create({ articleId: article.id });

      expect(label.articleId).to.equal(article.id);

      await article.setLabels(null);
      await label.reload();

      expect(label.articleId).to.equal(null);
    });

    it('destroys the previous associations if `destroyPrevious` is true', async () => {
      const { Label, Article } = vars;

      const article = await Article.create();
      await Label.create({ articleId: article.id });

      await article.setLabels(null, { destroyPrevious: true });

      expect(await Label.count()).to.equal(0);
    });

    it('destroys the previous associations if the foreign key is not nullable', async () => {
      const { NonNullLabel, Article } = vars;

      const article = await Article.create();
      await NonNullLabel.create({ articleId: article.id });

      await article.setNonNullLabels(null);

      expect(await NonNullLabel.count()).to.equal(0);
    });

    it('supports passing the primary key instead of an object', async () => {
      const { Label, Article } = vars;

      const [article, label] = await Promise.all([Article.create(), Label.create()]);

      await article.setLabels([label.id]);
      await label.reload();
      expect(label.articleId).to.equal(article.id);
    });
  });

  describe('addAssociations', () => {
    it('associates target models to the source model', async () => {
      const { Label, Article } = vars;

      const [article, label] = await Promise.all([Article.create(), Label.create()]);

      // TODO: this should be null - https://github.com/sequelize/sequelize/issues/14671
      expect(label.articleId).to.beNullish();

      await article.addLabels([label]);
      await label.reload();

      expect(label.articleId).to.equal(article.id);
    });

    it('supports any iterable', async () => {
      const { Label, Article } = vars;

      const [article, label] = await Promise.all([Article.create(), Label.create()]);

      // TODO: this should be null - https://github.com/sequelize/sequelize/issues/14671
      expect(label.articleId).to.beNullish();

      await article.addLabels(new Set([label]));
      await label.reload();

      expect(label.articleId).to.equal(article.id);
    });

    it('supports passing the primary key instead of an object', async () => {
      const { Label, Article } = vars;

      const [article, label] = await Promise.all([Article.create(), Label.create()]);

      // TODO: this should be null - https://github.com/sequelize/sequelize/issues/14671
      expect(label.articleId).to.beNullish();

      await article.addLabels([label.id]);
      await label.reload();

      expect(label.articleId).to.equal(article.id);
    });
  });

  describe('removeAssociations', () => {
    it('unlinks the target models from the source model', async () => {
      const { Label, Article } = vars;

      const article = await Article.create();
      const label = await Label.create({ articleId: article.id });

      expect(label.articleId).to.equal(article.id);

      await article.removeLabels([label]);
      await label.reload();

      expect(label.articleId).to.equal(null);
    });

    it('supports any iterable', async () => {
      const { Label, Article } = vars;

      const article = await Article.create();
      const label = await Label.create({ articleId: article.id });

      expect(label.articleId).to.equal(article.id);

      await article.removeLabels(new Set([label]));
      await label.reload();

      expect(label.articleId).to.equal(null);
    });

    it('supports passing the primary key instead of an object', async () => {
      const { Label, Article } = vars;

      const article = await Article.create();
      const label = await Label.create({ articleId: article.id });

      expect(label.articleId).to.equal(article.id);

      await article.removeLabels([label.id]);
      await label.reload();

      expect(label.articleId).to.equal(null);
    });

    it('destroys the target models if `destroy` is true', async () => {
      const { Label, Article } = vars;

      const article = await Article.create();
      const label = await Label.create({ articleId: article.id });

      expect(label.articleId).to.equal(article.id);

      await article.removeLabels([label], { destroy: true });

      expect(await Label.count()).to.equal(0);
    });

    it('destroys the target models if the foreign key is not nullable', async () => {
      const { NonNullLabel, Article } = vars;

      const article = await Article.create();
      const label = await NonNullLabel.create({ articleId: article.id });

      expect(label.articleId).to.equal(article.id);

      await article.removeNonNullLabels([label]);

      expect(await NonNullLabel.count()).to.equal(0);
    });
  });

  describe('hasAssociations', () => {
    it('returns true if the target model is associated to the source model', async () => {
      const { Label, Article } = vars;

      const article = await Article.create();
      const label = await Label.create({ articleId: article.id });

      expect(await article.hasLabels([label])).to.equal(true);
    });

    it('supports any iterable', async () => {
      const { Label, Article } = vars;

      const article = await Article.create();
      const label = await Label.create({ articleId: article.id });

      expect(await article.hasLabels(new Set([label]))).to.equal(true);
    });

    it('supports passing the primary key instead of an object', async () => {
      const { Label, Article } = vars;

      const article = await Article.create();
      const label = await Label.create({ articleId: article.id });

      expect(await article.hasLabels([label.id])).to.equal(true);
    });
  });
});

describe('hasMany Mixins + transaction', () => {
  if (!dialect.supports.transactions) {
    return;
  }

  setResetMode('destroy');

  const vars = beforeAll2(async () => {
    class Article extends Model<InferAttributes<Article>, InferCreationAttributes<Article>> {
      declare id: CreationOptional<number>;

      @HasMany(() => Label, 'articleId')
      declare labels?: Label[];

      declare setLabels: HasManySetAssociationsMixin<Label, Label['id']>;
      declare removeLabels: HasManyRemoveAssociationsMixin<Label, Label['id']>;
    }

    class Label extends Model<InferAttributes<Label>, InferCreationAttributes<Label>> {
      declare id: CreationOptional<number>;

      @AllowNull
      @Attribute(DataTypes.INTEGER)
      declare articleId: number | null;
    }

    const transactionSequelize = await createMultiTransactionalTestSequelizeInstance(sequelize);
    transactionSequelize.addModels([Article, Label]);
    await transactionSequelize.sync({ force: true });

    return { Article, Label, transactionSequelize };
  });

  after(async () => {
    return vars.transactionSequelize.close();
  });

  describe('setAssociations', () => {
    it('supports transactions', async () => {
      const { Label, Article, transactionSequelize } = vars;

      const [article, label] = await Promise.all([Article.create(), Label.create()]);

      await transactionSequelize.transaction(async transaction => {
        await article.setLabels([label], { transaction });
        const labels0 = await Label.findAll({
          where: { articleId: article.id },
          transaction: null,
        });
        expect(labels0.length).to.equal(0);

        const labels = await Label.findAll({ where: { articleId: article.id }, transaction });
        expect(labels.length).to.equal(1);
      });
    });

    it('uses the transaction when destroying the previous associations', async () => {
      const { Label, Article, transactionSequelize } = vars;

      const [article, t] = await Promise.all([
        Article.create(),
        transactionSequelize.startUnmanagedTransaction(),
      ]);

      try {
        await Label.create({ articleId: article.id });

        await article.setLabels(null, { destroyPrevious: true, transaction: t });
        expect(await Label.count({ transaction: null })).to.equal(1);
        expect(await Label.count({ transaction: t })).to.equal(0);
      } finally {
        await t.rollback();
      }
    });

    it('uses the transaction when unsetting the previous associations', async () => {
      const { Label, Article, transactionSequelize } = vars;

      const [article, t] = await Promise.all([
        Article.create(),
        transactionSequelize.startUnmanagedTransaction(),
      ]);

      try {
        await Label.create({ articleId: article.id });

        await article.setLabels(null, { transaction: t });
        expect(
          (await Label.findOne({ rejectOnEmpty: true, transaction: null })).articleId,
        ).to.equal(article.id);
        expect((await Label.findOne({ rejectOnEmpty: true, transaction: t })).articleId).to.equal(
          null,
        );
      } finally {
        await t.rollback();
      }
    });
  });

  describe('removeAssociations', () => {
    it('uses the transaction when updating the foreign key', async () => {
      const { Label, Article, transactionSequelize } = vars;

      const [article, t] = await Promise.all([
        Article.create(),
        transactionSequelize.startUnmanagedTransaction(),
      ]);

      try {
        const label = await Label.create({ articleId: article.id });

        await article.removeLabels([label], { transaction: t });
        expect(
          (await Label.findOne({ rejectOnEmpty: true, transaction: null })).articleId,
        ).to.equal(article.id);
        expect((await Label.findOne({ rejectOnEmpty: true, transaction: t })).articleId).to.equal(
          null,
        );
      } finally {
        await t.rollback();
      }
    });

    it('uses the transaction when deleting the target models', async () => {
      const { Label, Article, transactionSequelize } = vars;

      const [article, t] = await Promise.all([
        Article.create(),
        transactionSequelize.startUnmanagedTransaction(),
      ]);

      try {
        const label = await Label.create({ articleId: article.id });

        await article.removeLabels([label], { destroy: true, transaction: t });
        expect(await Label.count({ transaction: null })).to.equal(1);
        expect(await Label.count({ transaction: t })).to.equal(0);
      } finally {
        await t.rollback();
      }
    });
  });
});

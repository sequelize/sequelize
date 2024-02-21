import type {
  CreationOptional,
  HasOneSetAssociationMixin,
  InferAttributes,
  InferCreationAttributes,
} from '@sequelize/core';
import { DataTypes, Model } from '@sequelize/core';
import { AllowNull, Attribute, HasOne, NotNull } from '@sequelize/core/decorators-legacy';
import { expect } from 'chai';
import {
  beforeAll2,
  createMultiTransactionalTestSequelizeInstance,
  sequelize,
  setResetMode,
} from '../support';

const dialect = sequelize.dialect;

describe('hasOne Mixins', () => {
  setResetMode('destroy');

  const vars = beforeAll2(async () => {
    class Article extends Model<InferAttributes<Article>, InferCreationAttributes<Article>> {
      declare id: CreationOptional<number>;

      @HasOne(() => Label, 'articleId')
      declare label?: Label;

      declare setLabel: HasOneSetAssociationMixin<Label, Label['id']>;

      @HasOne(() => NonNullLabel, 'articleId')
      declare nonNullLabel?: NonNullLabel;

      declare setNonNullLabel: HasOneSetAssociationMixin<NonNullLabel, NonNullLabel['id']>;
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

  describe('setAssociation', () => {
    it('associates target model to the source model', async () => {
      const { Label, Article } = vars;

      const [article, label] = await Promise.all([Article.create(), Label.create()]);

      // TODO: this should be null - https://github.com/sequelize/sequelize/issues/14671
      expect(label.articleId).to.beNullish();

      await article.setLabel(label);
      await label.reload();

      expect(label.articleId).to.equal(article.id);
    });

    it('unlinks the previous association', async () => {
      const { Label, Article } = vars;

      const article = await Article.create();
      const label1 = await Label.create({ articleId: article.id });
      const label2 = await Label.create();

      expect(label1.articleId).to.equal(article.id);
      // TODO: this should be null - https://github.com/sequelize/sequelize/issues/14671
      expect(label2.articleId).to.beNullish();

      await article.setLabel(label2);
      await Promise.all([label1.reload(), label2.reload()]);

      expect(label1.articleId).to.equal(null);
      expect(label2.articleId).to.equal(article.id);
    });

    it('clears associations when the parameter is null', async () => {
      const { Label, Article } = vars;

      const article = await Article.create();
      const label = await Label.create({ articleId: article.id });

      expect(label.articleId).to.equal(article.id);

      await article.setLabel(null);
      await label.reload();

      expect(label.articleId).to.equal(null);
    });

    it('destroys the previous associations if `destroyPrevious` is true', async () => {
      const { Label, Article } = vars;

      const article = await Article.create();
      await Label.create({ articleId: article.id });

      await article.setLabel(null, { destroyPrevious: true });

      expect(await Label.count()).to.equal(0);
    });

    it('destroys the previous associations if the foreign key is not nullable', async () => {
      const { NonNullLabel, Article } = vars;

      const article = await Article.create();
      await NonNullLabel.create({ articleId: article.id });

      await article.setNonNullLabel(null);

      expect(await NonNullLabel.count()).to.equal(0);
    });

    it('supports passing the primary key instead of an object', async () => {
      const { Label, Article } = vars;

      const [article, label] = await Promise.all([Article.create(), Label.create()]);

      await article.setLabel(label.id);
      await label.reload();
      expect(label.articleId).to.equal(article.id);
    });

    it('supports setting same association twice', async () => {
      const { Label, Article } = vars;

      const [article, label] = await Promise.all([Article.create(), Label.create()]);

      await article.setLabel(label);
      await article.setLabel(label);

      await label.reload();

      expect(label.articleId).to.equal(article.id);
    });
  });
});

describe('hasOne Mixins + transaction', () => {
  if (!dialect.supports.transactions) {
    return;
  }

  setResetMode('destroy');

  const vars = beforeAll2(async () => {
    class Article extends Model<InferAttributes<Article>, InferCreationAttributes<Article>> {
      declare id: CreationOptional<number>;

      @HasOne(() => Label, 'articleId')
      declare label?: Label;

      declare setLabel: HasOneSetAssociationMixin<Label, Label['id']>;
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
        await article.setLabel(label, { transaction });
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

      await Label.create({ articleId: article.id });

      await article.setLabel(null, { destroyPrevious: true, transaction: t });
      expect(await Label.count({ transaction: null })).to.equal(1);
      expect(await Label.count({ transaction: t })).to.equal(0);

      await t.rollback();
    });

    it('uses the transaction when unsetting the previous associations', async () => {
      const { Label, Article, transactionSequelize } = vars;

      const [article, t] = await Promise.all([
        Article.create(),
        transactionSequelize.startUnmanagedTransaction(),
      ]);

      await Label.create({ articleId: article.id });

      await article.setLabel(null, { transaction: t });
      expect((await Label.findOne({ rejectOnEmpty: true, transaction: null })).articleId).to.equal(
        article.id,
      );
      expect((await Label.findOne({ rejectOnEmpty: true, transaction: t })).articleId).to.equal(
        null,
      );

      await t.rollback();
    });
  });
});

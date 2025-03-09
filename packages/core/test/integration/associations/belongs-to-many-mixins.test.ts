import type {
  BelongsToManyAddAssociationsMixin,
  BelongsToManyCountAssociationsMixin,
  BelongsToManyCreateAssociationMixin,
  BelongsToManyGetAssociationsMixin,
  BelongsToManyHasAssociationsMixin,
  BelongsToManyRemoveAssociationsMixin,
  BelongsToManySetAssociationsMixin,
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
} from '@sequelize/core';
import { Model } from '@sequelize/core';
import { BelongsToMany } from '@sequelize/core/decorators-legacy';
import { expect } from 'chai';
import { beforeAll2, sequelize, setResetMode } from '../support';

describe('belongsToMany Mixins', () => {
  setResetMode('destroy');

  const vars = beforeAll2(async () => {
    class Article extends Model<InferAttributes<Article>, InferCreationAttributes<Article>> {
      declare id: CreationOptional<number>;

      @BelongsToMany(() => User, { through: 'UserArticle' })
      declare authors?: User[];

      declare getAuthors: BelongsToManyGetAssociationsMixin<User>;
      declare setAuthors: BelongsToManySetAssociationsMixin<User, User['id']>;
      declare addAuthors: BelongsToManyAddAssociationsMixin<User, User['id']>;
      declare removeAuthors: BelongsToManyRemoveAssociationsMixin<User, User['id']>;
      declare createAuthor: BelongsToManyCreateAssociationMixin<User>;
      declare hasAuthors: BelongsToManyHasAssociationsMixin<User, User['id']>;
      declare countAuthors: BelongsToManyCountAssociationsMixin<User>;
    }

    class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
      declare id: CreationOptional<number>;
    }

    sequelize.addModels([Article, User]);
    await sequelize.sync({ force: true });

    return { Article, User };
  });

  describe('setAssociations', () => {
    it('associates target models to the source model', async () => {
      const { User, Article } = vars;

      const [article, user] = await Promise.all([Article.create(), User.create()]);

      expect(await article.getAuthors()).to.be.empty;
      expect(article.id).to.be.a('number');
      expect(user.id).to.be.a('number');

      await article.setAuthors([user]);

      expect(await article.getAuthors()).to.have.length(1);
    });

    it('supports any iterable', async () => {
      const { User, Article } = vars;

      const [article, user] = await Promise.all([Article.create(), User.create()]);

      expect(await article.getAuthors()).to.be.empty;

      await article.setAuthors(new Set([user]));

      expect(await article.getAuthors()).to.have.length(1);
    });

    it('unlinks the previous associations', async () => {
      const { User, Article } = vars;

      const [article, user1, user2] = await Promise.all([
        Article.create(),
        User.create(),
        User.create(),
      ]);

      expect(await article.getAuthors()).to.be.empty;

      await article.setAuthors([user1]);

      expect(await article.getAuthors()).to.have.length(1);

      await article.setAuthors([user2]);

      expect(await article.getAuthors()).to.have.length(1);
      expect(await article.hasAuthors([user2])).to.be.true;
    });

    it('clears associations when the parameter is null', async () => {
      const { User, Article } = vars;

      const [article, user] = await Promise.all([Article.create(), User.create()]);

      await article.setAuthors([user]);

      expect(await article.getAuthors()).to.have.length(1);

      await article.setAuthors(null);

      expect(await article.getAuthors()).to.be.empty;
    });

    it('supports passing the primary key instead of an object', async () => {
      const { User, Article } = vars;

      const [article, user] = await Promise.all([Article.create(), User.create()]);

      expect(await article.getAuthors()).to.be.empty;

      await article.setAuthors([user.id]);

      expect(await article.getAuthors()).to.have.length(1);
    });
  });

  describe('addAssociations', () => {
    it('associates target models to the source model', async () => {
      const { User, Article } = vars;

      const [article, user] = await Promise.all([Article.create(), User.create()]);

      expect(await article.getAuthors()).to.be.empty;

      await article.addAuthors([user]);

      expect(await article.getAuthors()).to.have.length(1);
    });

    it('supports any iterable', async () => {
      const { User, Article } = vars;

      const [article, user] = await Promise.all([Article.create(), User.create()]);

      expect(await article.getAuthors()).to.be.empty;

      await article.addAuthors(new Set([user]));

      expect(await article.getAuthors()).to.have.length(1);
    });

    it('supports passing the primary key instead of an object', async () => {
      const { User, Article } = vars;

      const [article, user] = await Promise.all([Article.create(), User.create()]);

      expect(await article.getAuthors()).to.be.empty;

      await article.addAuthors([user.id]);

      expect(await article.getAuthors()).to.have.length(1);
    });
  });

  describe('removeAssociations', () => {
    it('unlinks the target models from the source model', async () => {
      const { User, Article } = vars;

      const [article, user1, user2] = await Promise.all([
        Article.create(),
        User.create(),
        User.create(),
      ]);

      await article.setAuthors([user1, user2]);

      expect(await article.getAuthors()).to.have.length(2);

      await article.removeAuthors([user1]);

      expect(await article.getAuthors()).to.have.length(1);
      expect(await article.hasAuthors([user1])).to.be.false;
    });

    it('supports any iterable', async () => {
      const { User, Article } = vars;

      const [article, user] = await Promise.all([Article.create(), User.create()]);

      await article.setAuthors([user]);
      await article.removeAuthors(new Set([user]));

      expect(await article.getAuthors()).to.have.length(0);
    });

    it('supports passing the primary key instead of an object', async () => {
      const { User, Article } = vars;

      const [article, user] = await Promise.all([Article.create(), User.create()]);

      await article.setAuthors([user]);
      await article.removeAuthors([user.id]);

      expect(await article.getAuthors()).to.have.length(0);
    });
  });

  describe('hasAssociations', () => {
    it('returns true if the target model is associated to the source model', async () => {
      const { User, Article } = vars;

      const [article, user1, user2] = await Promise.all([
        Article.create(),
        User.create(),
        User.create(),
      ]);

      await article.setAuthors([user1]);

      expect(await article.hasAuthors([user1])).to.be.true;
      expect(await article.hasAuthors([user2])).to.be.false;
      expect(await article.hasAuthors([user1, user2])).to.be.false;
    });

    it('supports any iterable', async () => {
      const { User, Article } = vars;

      const [article, user] = await Promise.all([Article.create(), User.create()]);

      await article.setAuthors([user]);

      expect(await article.hasAuthors(new Set([user]))).to.be.true;
    });

    it('supports passing the primary key instead of an object', async () => {
      const { User, Article } = vars;

      const [article, user] = await Promise.all([Article.create(), User.create()]);

      await article.setAuthors([user]);

      expect(await article.hasAuthors([user.id])).to.be.true;
    });
  });
});

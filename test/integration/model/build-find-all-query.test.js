import * as chai from 'chai';
import Support from '../support.js';
import DataTypes from '../../../lib/data-types.js';

const expect = chai.expect;

const Op = Support.Sequelize.Op;

/**
 * `buildFindAllQuery` exists so callers can obtain the SQL for a find without executing it. It
 * shares its option normalization with `findAll` (`_prepareFindOptions`, `_conformFindOptions`,
 * `_finalizeFindOptions`), and these tests are what hold the two together: if the shared steps
 * stop being shared, the SQL will diverge and the equality assertions below will fail.
 */
describe(Support.getTestDialectTeaser('Model'), () => {
  describe('buildFindAllQuery', () => {
    beforeEach(async function () {
      this.User = this.sequelize.define('BfqUser', {
        name: DataTypes.STRING,
        age: DataTypes.INTEGER,
        active: DataTypes.BOOLEAN
      });
      this.Post = this.sequelize.define('BfqPost', { title: DataTypes.STRING, n: DataTypes.INTEGER });
      this.Tag = this.sequelize.define('BfqTag', { label: DataTypes.STRING });

      this.User.hasMany(this.Post);
      this.Post.belongsTo(this.User);
      this.Post.belongsToMany(this.Tag, { through: 'BfqPostTag' });
      this.Tag.belongsToMany(this.Post, { through: 'BfqPostTag' });

      await this.sequelize.sync({ force: true });
    });

    /** Runs findAll, capturing the SQL it actually executes. */
    async function executedSql(Model, options) {
      let sql = null;
      await Model.findAll({
        ...options,
        logging: (statement) => {
          if (sql === null) {
            sql = statement;
          }
        }
      });
      return sql.replace(/^Executing \(default\): /, '');
    }

    function itMatches(label, build) {
      it(`matches findAll for ${label}`, async function () {
        const [Model, options] = build.call(this);
        expect(Model.buildFindAllQuery(options)).to.equal(await executedSql(Model, options));
      });
    }

    itMatches('no options', function () {
      return [this.User, {}];
    });
    itMatches('a where clause', function () {
      return [this.User, { where: { id: 1 } }];
    });
    itMatches('an operator in where', function () {
      return [this.User, { where: { age: { [Op.gt]: 18 } } }];
    });
    itMatches('an attribute subset', function () {
      return [this.User, { attributes: ['name'] }];
    });
    itMatches('order, limit and offset', function () {
      return [this.User, { where: { active: true }, order: [['name', 'DESC']], limit: 5, offset: 10 }];
    });
    itMatches('a grouped aggregate', function () {
      return [
        this.User,
        {
          attributes: ['age', [this.sequelize.fn('COUNT', this.sequelize.col('id')), 'c']],
          group: ['age']
        }
      ];
    });
    itMatches('a hasMany include', function () {
      return [this.User, { include: [this.Post] }];
    });
    itMatches('a belongsTo include', function () {
      return [this.Post, { include: [this.User] }];
    });
    itMatches('an include with an attribute subset', function () {
      return [this.User, { attributes: ['name'], include: [this.Post] }];
    });
    itMatches('a nested include', function () {
      return [this.User, { include: [{ model: this.Post, include: [this.Tag] }] }];
    });
    // `include: all` is only expanded by `_expandIncludeAll`, so this is the case that fails if
    // `buildFindAllQuery` ever stops sharing the conform step with `findAll`.
    itMatches('include: all', function () {
      return [this.User, { include: [{ all: true }] }];
    });
    itMatches('include: all, nested', function () {
      return [this.User, { include: [{ all: true, nested: true }] }];
    });
    itMatches('an include with where and order', function () {
      return [this.User, { where: { active: true }, include: [this.Post], order: ['id'] }];
    });
    itMatches('an include with a limit', function () {
      return [this.User, { include: [this.Post], limit: 3 }];
    });
    itMatches('paranoid disabled', function () {
      return [this.User, { paranoid: false }];
    });
    itMatches('raw', function () {
      return [this.User, { raw: true, where: { id: 2 } }];
    });
    itMatches('a row lock', function () {
      return [this.User, { where: { id: 1 }, lock: true }];
    });

    it('does not mutate the options it is given', function () {
      const options = { where: { id: 1 }, attributes: ['name'] };
      const snapshot = JSON.stringify(options);

      this.User.buildFindAllQuery(options);

      expect(JSON.stringify(options)).to.equal(snapshot);
    });

    it('runs no hooks and issues no query', async function () {
      const fired = [];
      for (const name of ['beforeFind', 'beforeFindAfterExpandIncludeAll', 'beforeFindAfterOptions', 'afterFind']) {
        this.User.addHook(name, () => fired.push(name));
      }

      let queried = false;
      this.User.buildFindAllQuery({ logging: () => (queried = true) });

      expect(fired, 'no hooks should fire').to.deep.equal([]);
      expect(queried, 'no query should be issued').to.be.false;
    });

    it('rejects a non-object argument like findAll does', function () {
      expect(() => this.User.buildFindAllQuery(1)).to.throw(/must be an options object/);
    });

    it('rejects a malformed attributes option like findAll does', function () {
      expect(() => this.User.buildFindAllQuery({ attributes: 'name' })).to.throw(/attributes option must be an array/);
    });

    describe('findAll still drives its hooks around the shared steps', () => {
      it('fires the find hooks in order', async function () {
        const fired = [];
        for (const name of ['beforeFind', 'beforeFindAfterExpandIncludeAll', 'beforeFindAfterOptions', 'afterFind']) {
          this.User.addHook(name, () => fired.push(name));
        }

        await this.User.findAll();

        expect(fired).to.deep.equal([
          'beforeFind',
          'beforeFindAfterExpandIncludeAll',
          'beforeFindAfterOptions',
          'afterFind'
        ]);
      });

      it('applies a where set by beforeFind', async function () {
        await this.User.create({ name: 'kept' });
        this.User.addHook('beforeFind', (options) => {
          options.where = { name: 'absent' };
        });

        expect(await this.User.findAll()).to.have.length(0);
      });

      it('applies an attribute list set by beforeFindAfterOptions', async function () {
        await this.User.create({ name: 'a', age: 3 });
        this.User.addHook('beforeFindAfterOptions', (options) => {
          options.attributes = ['name'];
        });

        const [user] = await this.User.findAll();
        expect(Object.keys(user.dataValues)).to.deep.equal(['name']);
      });

      it('skips the hooks when hooks is false', async function () {
        const fired = [];
        this.User.addHook('beforeFind', () => fired.push('beforeFind'));

        await this.User.findAll({ hooks: false });

        expect(fired).to.deep.equal([]);
      });
    });
  });
});

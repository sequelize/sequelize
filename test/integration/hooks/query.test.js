'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require(__dirname + '/../support'),
  DataTypes = require(__dirname + '/../../../lib/data-types'),
  sinon = require('sinon');

describe.only(Support.getTestDialectTeaser('Hooks'), () => {
  beforeEach(function() {
    this.User = this.sequelize.define('User', {
      username: {
        type: DataTypes.STRING,
        allowNull: false
      },
      mood: {
        type: DataTypes.ENUM,
        values: ['happy', 'sad', 'neutral']
      }
    });
    return this.sequelize.sync({ force: true });
  });

  describe('query hooks', () => {
    it('should run beforeQuery and afterQuery hooks', function() {
      const beforeHook = sinon.spy();
      const afterHook = sinon.spy();
      this.sequelize.addHook('beforeQuery', beforeHook);
      this.sequelize.addHook('afterQuery', afterHook);

      return this.User.create({username: 'Toni', mood: 'happy'}).then(() => {
        expect(beforeHook).to.have.been.calledOnce;
        expect(afterHook).to.have.been.calledOnce;
        const sql = beforeHook.firstCall.args[0];
        expect(sql).to.contain('INSERT INTO `Users` (`id`,`username`,`mood`,`createdAt`,`updatedAt`) VALUES (DEFAULT,\'Toni\',\'happy\',');

        expect(afterHook.firstCall.args[0]).to.equal(sql);
        const meta = afterHook.firstCall.args[1];
        expect(meta.results[0].isNewRecord).to.equal(false);
        expect(meta.error).to.equal(null);
        expect(meta.duration).to.be.a('number');
      });
    });

    it('should work on ContextModel', function() {
      let index = 0;
      class Context {
        constructor() {
          this.value = 'bar';
          this.index = index++;
        }
      }
      const ctx = new Context();
      const ContextUser = this.User.contextify(ctx);

      const beforeHook = sinon.spy();
      const afterHook = sinon.spy();
      this.sequelize.addHook('beforeQuery', beforeHook);
      this.sequelize.addHook('afterQuery', afterHook);

      return ContextUser.create({username: 'Toni2', mood: 'happy'}).then(() => {
        expect(beforeHook).to.have.been.calledOnce;
        expect(afterHook).to.have.been.calledOnce;
        const sql = beforeHook.firstCall.args[0];
        expect(sql).to.contain('INSERT INTO `Users` (`id`,`username`,`mood`,`createdAt`,`updatedAt`) VALUES (DEFAULT,\'Toni2\',\'happy\',');
        const options1 = beforeHook.firstCall.args[1];
        expect(options1.model.isContextModel).to.equal(true);
        expect(options1.model.ctx).to.equal(ctx);
        expect(options1.model.ctx.value).to.equal('bar');

        expect(afterHook.firstCall.args[0]).to.equal(sql);
        const meta = afterHook.firstCall.args[1];
        expect(meta.results[0].isNewRecord).to.equal(false);
        expect(meta.error).to.equal(null);
        expect(meta.duration).to.be.a('number');
        const options2 = afterHook.firstCall.args[2];
        expect(options2.model.isContextModel).to.equal(true);
        expect(options2.model.ctx).to.equal(ctx);
        expect(options2.model.ctx.value).to.equal('bar');
      });
    });

    it('should work on raw query', function() {
      let index = 0;
      class Context {
        constructor() {
          this.value = 'bar';
          this.index = index++;
        }
      }
      const ctx = new Context();
      const beforeHook = sinon.spy();
      const afterHook = sinon.spy();
      this.sequelize.addHook('beforeQuery', beforeHook);
      this.sequelize.addHook('afterQuery', afterHook);

      // add tracing ctx on options argument
      return this.sequelize.query('select now() as currentTime;', { ctx }).then(() => {
        expect(beforeHook).to.have.been.calledOnce;
        expect(afterHook).to.have.been.calledOnce;
        const sql = beforeHook.firstCall.args[0];
        expect(sql).to.contain('select now() as currentTime;');
        const options1 = beforeHook.firstCall.args[1];
        expect(options1.model).to.equal(undefined);
        expect(options1.ctx).to.equal(ctx);
        expect(options1.ctx.value).to.equal('bar');

        expect(afterHook.firstCall.args[0]).to.equal(sql);
        const meta = afterHook.firstCall.args[1];
        expect(meta.results).not.to.equal(null);
        expect(meta.error).to.equal(null);
        expect(meta.duration).to.be.a('number');
        const options2 = afterHook.firstCall.args[2];
        expect(options2.model).to.equal(undefined);
        expect(options2.ctx).to.equal(ctx);
        expect(options2.ctx.value).to.equal('bar');
      });
    });

    it('should still run hooks on query error', function() {
      let index = 0;
      class Context {
        constructor() {
          this.value = 'bar';
          this.index = index++;
        }
      }
      const ctx = new Context();
      const beforeHook = sinon.spy();
      const afterHook = sinon.spy();
      this.sequelize.addHook('beforeQuery', beforeHook);
      this.sequelize.addHook('afterQuery', afterHook);

      // add tracing ctx on options argument
      return expect(this.sequelize.query('select nowNotExists() as currentTime;', { ctx })).to.be.rejected.then(() => {
        expect(beforeHook).to.have.been.calledOnce;
        expect(afterHook).to.have.been.calledOnce;
        const sql = beforeHook.firstCall.args[0];
        expect(sql).to.contain('select nowNotExists() as currentTime;');
        const options1 = beforeHook.firstCall.args[1];
        expect(options1.model).to.equal(undefined);
        expect(options1.ctx).to.equal(ctx);
        expect(options1.ctx.value).to.equal('bar');

        expect(afterHook.firstCall.args[0]).to.equal(sql);
        const meta = afterHook.firstCall.args[1];
        expect(meta.results).to.equal(null);
        expect(meta.error.name).to.equal('SequelizeDatabaseError');
        expect(meta.duration).to.be.a('number');
        const options2 = afterHook.firstCall.args[2];
        expect(options2.model).to.equal(undefined);
        expect(options2.ctx).to.equal(ctx);
        expect(options2.ctx.value).to.equal('bar');
      });
    });
  });
});

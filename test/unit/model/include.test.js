'use strict';

/* jshint -W030 */
var chai = require('chai')
  , expect = chai.expect
  , Support   = require(__dirname + '/../support')
  , Sequelize = require(__dirname + '/../../../index')
  , current   = Support.sequelize;

describe(Support.getTestDialectTeaser('Model'), function() {
  describe.only('$validateIncludedElements', function () {
    beforeEach(function () {
      this.User = this.sequelize.define('User');
      this.Task = this.sequelize.define('Task', {
        title: Sequelize.STRING
      });
      this.Company = this.sequelize.define('Company', {
        name: Sequelize.STRING
      });

      this.User.Tasks = this.User.hasMany(this.Task);
      this.User.Company = this.User.belongsTo(this.Company);
      this.Company.Employees = this.Company.hasMany(this.User);
    });

    describe('duplicating', function () {
      it('should tag a hasMany association as duplicating: true if undefined', function () {
        var options = Sequelize.Model.$validateIncludedElements({
          model: this.User,
          include: [
            this.User.Tasks
          ]
        });

        expect(options.include[0].duplicating).to.equal(true);
      });

      it('should respect include.duplicating for a hasMany', function () {
        var options = Sequelize.Model.$validateIncludedElements({
          model: this.User,
          include: [
            {association: this.User.Tasks, duplicating: false}
          ]
        });

        expect(options.include[0].duplicating).to.equal(false);
      });
    });

    describe('subQuery', function () {
      it('should be true if theres a duplicating association', function () {
        var options = Sequelize.Model.$validateIncludedElements({
          model: this.User,
          include: [
            {association: this.User.Tasks}
          ],
          limit: 3
        });

        expect(options.subQuery).to.equal(true);
      });

      it('should be true if theres a nested duplicating association', function () {
        var options = Sequelize.Model.$validateIncludedElements({
          model: this.User,
          include: [
            {association: this.User.Company, include: [
              this.Company.Employees
            ]}
          ],
          limit: 3
        });

        expect(options.subQuery).to.equal(true);
      });
    });

    describe('subQueryFilter', function () {
      it('should tag a required hasMany association', function () {
        var options = Sequelize.Model.$validateIncludedElements({
          model: this.User,
          include: [
            {association: this.User.Tasks, required: true}
          ],
          limit: 3
        });

        expect(options.subQuery).to.equal(true);
        expect(options.include[0].subQueryFilter).to.equal(true);
      });

      it('should not tag a required hasMany association with duplicating false', function () {
        var options = Sequelize.Model.$validateIncludedElements({
          model: this.User,
          include: [
            {association: this.User.Tasks, required: true, duplicating: false}
          ],
          limit: 3
        });

        expect(options.subQuery).to.equal(false);
        expect(options.include[0].subQueryFilter).to.equal(false);
      });

      it('should tag a hasMany association with where', function () {
        var options = Sequelize.Model.$validateIncludedElements({
          model: this.User,
          include: [
            {association: this.User.Tasks, where: {title: Math.random().toString()}}
          ],
          limit: 3
        });

        expect(options.subQuery).to.equal(true);
        expect(options.include[0].subQueryFilter).to.equal(true);
      });

      it('should not tag a hasMany association with where and duplicating false', function () {
        var options = Sequelize.Model.$validateIncludedElements({
          model: this.User,
          include: [
            {association: this.User.Tasks, where: {title: Math.random().toString()}, duplicating: false}
          ],
          limit: 3
        });

        expect(options.subQuery).to.equal(false);
        expect(options.include[0].subQueryFilter).to.equal(false);
      });
    });

    describe('subQueryFull', function () {
      it('should tag a required belongsTo alongside a duplicating association', function () {
        var options = Sequelize.Model.$validateIncludedElements({
          model: this.User,
          include: [
            {association: this.User.Company, required: true},
            {association: this.User.Tasks}
          ],
          limit: 3
        });

        expect(options.subQuery).to.equal(true);
        expect(options.include[0].subQueryFull).to.equal(true);
      });

      it('should not tag a required belongsTo alongside a duplicating association with duplicating false', function () {
        var options = Sequelize.Model.$validateIncludedElements({
          model: this.User,
          include: [
            {association: this.User.Company, required: true},
            {association: this.User.Tasks, duplicating: false}
          ],
          limit: 3
        });

        expect(options.subQuery).to.equal(false);
        expect(options.include[0].subQueryFull).to.equal(false);
      });

      it('should tag a belongsTo association with where alongside a duplicating association', function () {
        var options = Sequelize.Model.$validateIncludedElements({
          model: this.User,
          include: [
            {association: this.User.Company, where: {name: Math.random().toString()}},
            {association: this.User.Tasks}
          ],
          limit: 3
        });

        expect(options.subQuery).to.equal(true);
        expect(options.include[0].subQueryFull).to.equal(true);
      });

      it('should tag a belongsTo association with where alongside a duplicating association with duplicating false', function () {
        var options = Sequelize.Model.$validateIncludedElements({
          model: this.User,
          include: [
            {association: this.User.Company, where: {name: Math.random().toString()}},
            {association: this.User.Tasks, duplicating: false}
          ],
          limit: 3
        });

        expect(options.subQuery).to.equal(false);
        expect(options.include[0].subQueryFull).to.equal(false);
      });
    });    
  });
});
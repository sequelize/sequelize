'use strict';

/* jshint -W030 */
var chai = require('chai')
  , expect = chai.expect
  , Support   = require(__dirname + '/../support')
  , Sequelize = require(__dirname + '/../../../index')
  , current   = Support.sequelize;

describe(Support.getTestDialectTeaser('Model'), function() {
  describe('all', function (){

    var Referral = current.define('referal');

    Referral.belongsTo(Referral);

    it('can expand nested self-reference', function () {
      var options = { include: [{ all: true, nested: true }] };

      current.Model.$expandIncludeAll.call(Referral, options);

      expect(options.include).to.deep.equal([
        { model: Referral }
      ]);
    });
  });

  describe('$validateIncludedElements', function () {
    beforeEach(function () {
      this.User = this.sequelize.define('User');
      this.Task = this.sequelize.define('Task', {
        title: Sequelize.STRING
      });
      this.Company = this.sequelize.define('Company', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          field: 'field_id'
        },
        name: Sequelize.STRING
      });

      this.User.Tasks = this.User.hasMany(this.Task);
      this.User.Company = this.User.belongsTo(this.Company);
      this.Company.Employees = this.Company.hasMany(this.User);
      this.Company.Owner = this.Company.belongsTo(this.User, {as: 'Owner', foreignKey: 'ownerId'});
    });

    describe('attributes', function () {
      it('should not inject the aliassed PK again, if its already there', function () {
        var options = Sequelize.Model.$validateIncludedElements({
          model: this.User,
          include: [
            {
              model: this.Company,
              attributes: ['name']
            }
          ]
        });

        expect(options.include[0].attributes).to.deep.equal([['field_id', 'id'], 'name']);

        options = Sequelize.Model.$validateIncludedElements(options);

        // Calling validate again shouldn't add the pk again
        expect(options.include[0].attributes).to.deep.equal([['field_id', 'id'], 'name']);
      });

      describe('include / exclude', function () {
        it('allows me to include additional attributes', function () {
          var options = Sequelize.Model.$validateIncludedElements({
            model: this.User,
            include: [
              {
                model: this.Company,
                attributes: {
                  include: ['foobar']
                }
              }
            ]
          });

          expect(options.include[0].attributes).to.deep.equal([
            ['field_id', 'id'],
            'name',
            'createdAt',
            'updatedAt',
            'ownerId',
            'foobar'
          ]);
        });

        it('allows me to exclude attributes', function () {
          var options = Sequelize.Model.$validateIncludedElements({
            model: this.User,
            include: [
              {
                model: this.Company,
                attributes: {
                  exclude: ['name']
                }
              }
            ]
          });

          expect(options.include[0].attributes).to.deep.equal([
            ['field_id', 'id'],
            'createdAt',
            'updatedAt',
            'ownerId'
          ]);
        });

        it('include takes precendence over exclude', function () {
          var options = Sequelize.Model.$validateIncludedElements({
            model: this.User,
            include: [
              {
                model: this.Company,
                attributes: {
                  exclude: ['name'],
                  include: ['name']
                }
              }
            ]
          });

          expect(options.include[0].attributes).to.deep.equal([
            ['field_id', 'id'],
            'createdAt',
            'updatedAt',
            'ownerId',
            'name'
          ]);
        });
      });
    });

    describe('scope', function () {
      beforeEach(function () {
        this.Project = this.sequelize.define('project', {
          bar: {
            type: Sequelize.STRING,
            field: 'foo'
          }
        }, {
          defaultScope: {
            where: {
              active: true
            }
          }, scopes: {
            this: {
              where: { this: true}
            },
            that: {
              where: { that: false },
              limit: 12
            },
            attr: {
              attributes: ['baz']
            },
            foobar: {
              where: {
                bar: 42
              }
            }
          }
        });

        this.User.hasMany(this.Project);

        this.User.hasMany(this.Project.scope('this'), { as: 'thisProject' });
      });

      it('adds the default scope to where', function () {
        var options = Sequelize.Model.$validateIncludedElements({
          model: this.User,
          include: [{ model: this.Project }]
        });

        expect(options.include[0]).to.have.property('where').which.deep.equals({ active: true });
      });

      it('adds the where from a scoped model', function () {
        var options = Sequelize.Model.$validateIncludedElements({
          model: this.User,
          include: [{ model: this.Project.scope('that') }]
        });

        expect(options.include[0]).to.have.property('where').which.deep.equals({ that: false });
        expect(options.include[0]).to.have.property('limit').which.equals(12);
      });

      it('adds the attributes from a scoped model', function () {
        var options = Sequelize.Model.$validateIncludedElements({
          model: this.User,
          include: [{ model: this.Project.scope('attr') }]
        });

        expect(options.include[0]).to.have.property('attributes').which.deep.equals(['baz']);
      });

      it('merges where with the where from a scoped model', function () {
        var options = Sequelize.Model.$validateIncludedElements({
          model: this.User,
          include: [{ where: { active: false }, model: this.Project.scope('that') }]
        });

        expect(options.include[0]).to.have.property('where').which.deep.equals({ active: false, that: false });
      });

      it('add the where from a scoped associated model', function () {
        var options = Sequelize.Model.$validateIncludedElements({
          model: this.User,
          include: [{ model: this.Project, as: 'thisProject' }]
        });

        expect(options.include[0]).to.have.property('where').which.deep.equals({ this: true });
      });

      it('handles a scope with an aliased column (.field)', function () {
        var options = Sequelize.Model.$validateIncludedElements({
          model: this.User,
          include: [{ model: this.Project.scope('foobar') }]
        });

        expect(options.include[0]).to.have.property('where').which.deep.equals({ foo: 42 });
      });
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

      it('should be false if theres a duplicating association but no limit', function () {
        var options = Sequelize.Model.$validateIncludedElements({
          model: this.User,
          include: [
            {association: this.User.Tasks}
          ],
          limit: null
        });

        expect(options.subQuery).to.equal(false);
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

      it('should be false if theres a nested duplicating association but no limit', function () {
        var options = Sequelize.Model.$validateIncludedElements({
          model: this.User,
          include: [
            {association: this.User.Company, include: [
              this.Company.Employees
            ]}
          ],
          limit: null
        });

        expect(options.subQuery).to.equal(false);
      });

      it('should tag a required hasMany association', function () {
        var options = Sequelize.Model.$validateIncludedElements({
          model: this.User,
          include: [
            {association: this.User.Tasks, required: true}
          ],
          limit: 3
        });

        expect(options.subQuery).to.equal(true);
        expect(options.include[0].subQuery).to.equal(false);
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
        expect(options.include[0].subQuery).to.equal(false);
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
        expect(options.include[0].subQuery).to.equal(false);
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
        expect(options.include[0].subQuery).to.equal(false);
        expect(options.include[0].subQueryFilter).to.equal(false);
      });

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
        expect(options.include[0].subQuery).to.equal(true);
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
        expect(options.include[0].subQuery).to.equal(false);
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
        expect(options.include[0].subQuery).to.equal(true);
      });

      it('should tag a required belongsTo association alongside a duplicating association with a nested belongsTo', function () {
        var options = Sequelize.Model.$validateIncludedElements({
          model: this.User,
          include: [
            {association: this.User.Company, required: true, include: [
              this.Company.Owner
            ]},
            this.User.Tasks
          ],
          limit: 3
        });

        expect(options.subQuery).to.equal(true);
        expect(options.include[0].subQuery).to.equal(true);
        expect(options.include[0].include[0].subQuery).to.equal(false);
        expect(options.include[0].include[0].parent.subQuery).to.equal(true);
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
        expect(options.include[0].subQuery).to.equal(false);
      });
    });
  });
});

/* jshint camelcase: false, expr: true */
var chai      = require('chai')
  , expect    = chai.expect
  , Support   = require(__dirname + '/../support')
  , DataTypes = require(__dirname + "/../../lib/data-types")
  , _ = require('lodash')

chai.config.includeStack = true

describe(Support.getTestDialectTeaser("Self"), function() {
  it('supports freezeTableName', function (done) {
    var Group = this.sequelize.define('Group', {

    }, {
      tableName: 'user_group',
      timestamps: false,
      underscored: true,
      freezeTableName: true
    });

    Group.belongsTo(Group, { as: 'Parent', foreignKey: 'parent_id' });
    Group.sync({force: true}).done(function (err) {
      expect(err).not.to.be.ok
      Group.findAll({
        include: [{
          model: Group,
          as: 'Parent'
        }]
      }).done(function (err) {
        expect(err).not.to.be.ok
        done()
      })
    })
  })

  it('can handle n:m associations', function(done) {
    var Person = this.sequelize.define('Person', { name: DataTypes.STRING });
    var Family = this.sequelize.define('Family', {
      preexisting_child: {
        type: DataTypes.INTEGER,
        primaryKey: true
      },
      preexisting_parent: {
        type: DataTypes.INTEGER,
        primaryKey: true
      }
    }, { timestamps: false });

    Person.hasMany(Person, { as: 'Parents', through: Family, foreignKey: 'preexisting_child' });
    Person.hasMany(Person, { as: 'Children', through: Family, foreignKey: 'preexisting_parent' });

    var foreignIdentifiers = _.map(_.values(Person.associations), 'foreignIdentifier')
    var rawAttributes = _.keys(Family.rawAttributes)

    expect(foreignIdentifiers.length).to.equal(2)
    expect(rawAttributes.length).to.equal(2)

    expect(foreignIdentifiers).to.have.members([ 'preexisting_parent', 'preexisting_child' ]);
    expect(rawAttributes).to.have.members([ 'preexisting_parent', 'preexisting_child' ]);

    this.sequelize.sync({ force: true }).complete(function() {
      Person.create({ name: 'Mary' }).complete(function(err, mary) {
        expect(err).to.not.be.ok
        Person.create({ name: 'John' }).complete(function(err, john) {
          expect(err).to.not.be.ok
          Person.create({ name: 'Chris' }).complete(function(err, chris) {
            expect(err).to.not.be.ok
            mary.setParents([john, chris]).on('sql', function(sql) {
              if (sql.match(/INSERT/)) {
                expect(sql).to.have.string('preexisting_child');
                expect(sql).to.have.string('preexisting_parent');
              }
            }).complete(function(err) {
              expect(err).to.not.be.ok
              john.getChildren().on('sql', function(sql) {
                var whereClause = sql.split('WHERE')[1]; // look only in the whereClause
                expect(whereClause).to.have.string('preexisting_child');
                expect(whereClause).to.have.string('preexisting_parent');
              }).complete(function(err, children) {
                expect(_.map(children, 'id')).to.have.members([mary.id]);
                done()
              })
            })
          })
        })
      })
    })
  })
})
'use strict';

/* jshint -W030 */
var chai = require('chai')
  , expect = chai.expect
  , Support = require(__dirname + '/../support')
  , DataTypes = require(__dirname + '/../../../lib/data-types')
  , Sequelize = require(__dirname + '/../../../index')
  , Promise = Sequelize.Promise
  , _ = require('lodash');

chai.config.includeStack = true;

describe(Support.getTestDialectTeaser('Self'), function() {
  it('supports freezeTableName', function() {
    var Group = this.sequelize.define('Group', {}, {
      tableName: 'user_group',
      timestamps: false,
      underscored: true,
      freezeTableName: true
    });

    Group.belongsTo(Group, { as: 'Parent', foreignKey: 'parent_id' });
    return Group.sync({force: true}).then(function() {
      return Group.findAll({
        include: [{
          model: Group,
          as: 'Parent'
        }]
      });
    });
  });

  it('can handle 1:m associations', function() {
    var Person = this.sequelize.define('Person', { name: DataTypes.STRING });

    Person.hasMany(Person, { as: 'Children', foreignKey: 'parent_id'});

    expect(Person.rawAttributes.parent_id).to.be.ok;

    return this.sequelize.sync({force: true}).then(function() {
      return Promise.all([
        Person.create({ name: 'Mary' }),
        Person.create({ name: 'John' }),
        Person.create({ name: 'Chris' })
      ]);
    }).spread(function(mary, john, chris) {
      return mary.setChildren([john, chris]);
    });
  });

  it('can handle n:m associations', function() {
    var self = this;

    var Person = this.sequelize.define('Person', { name: DataTypes.STRING });

    Person.hasMany(Person, { as: 'Parents', through: 'Family' });
    Person.hasMany(Person, { as: 'Childs', through: 'Family' });

    var foreignIdentifiers = _.map(_.values(Person.associations), 'foreignIdentifier');
    var rawAttributes = _.keys(this.sequelize.models.Family.rawAttributes);

    expect(foreignIdentifiers.length).to.equal(2);
    expect(rawAttributes.length).to.equal(4);

    expect(foreignIdentifiers).to.have.members(['PersonId', 'ChildId']);
    expect(rawAttributes).to.have.members(['createdAt', 'updatedAt', 'PersonId', 'ChildId']);

    return this.sequelize.sync({ force: true }).then(function() {
      return self.sequelize.Promise.all([
        Person.create({ name: 'Mary' }),
        Person.create({ name: 'John' }),
        Person.create({ name: 'Chris' })
      ]).spread(function(mary, john, chris) {
        return mary.setParents([john]).then(function() {
          return chris.addParent(john);
        }).then(function() {
          return john.getChilds();
        }).then(function(children) {
          expect(_.map(children, 'id')).to.have.members([mary.id, chris.id]);
        });
      });
    });
  });

  it('can handle n:m associations with pre-defined through table', function() {
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

    var foreignIdentifiers = _.map(_.values(Person.associations), 'foreignIdentifier');
    var rawAttributes = _.keys(Family.rawAttributes);

    expect(foreignIdentifiers.length).to.equal(2);
    expect(rawAttributes.length).to.equal(2);

    expect(foreignIdentifiers).to.have.members(['preexisting_parent', 'preexisting_child']);
    expect(rawAttributes).to.have.members(['preexisting_parent', 'preexisting_child']);

    var count = 0;
    return this.sequelize.sync({ force: true }).bind(this).then(function() {
      return Promise.all([
        Person.create({ name: 'Mary' }),
        Person.create({ name: 'John' }),
        Person.create({ name: 'Chris' })
      ]);
    }).spread(function(mary, john, chris) {
      this.mary = mary;
      this.chris = chris;
      this.john = john;
      return mary.setParents([john], {
        logging: function(sql) {
          if (sql.match(/INSERT/)) {
            count++;
            expect(sql).to.have.string('preexisting_child');
            expect(sql).to.have.string('preexisting_parent');
          }
        }
      });
    }).then(function() {
      return this.mary.addParent(this.chris, {
        logging: function(sql) {
          if (sql.match(/INSERT/)) {
              count++;
              expect(sql).to.have.string('preexisting_child');
              expect(sql).to.have.string('preexisting_parent');
          }
        }
      });
    }).then(function() {
      return this.john.getChildren(undefined, {
        logging: function(sql) {
          count++;
          var whereClause = sql.split('FROM')[1]; // look only in the whereClause
          expect(whereClause).to.have.string('preexisting_child');
          expect(whereClause).to.have.string('preexisting_parent');
        }
      });
    }).then(function(children) {
      expect(count).to.be.equal(3);
      expect(_.map(children, 'id')).to.have.members([this.mary.id]);
    });
  });
});

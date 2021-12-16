'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require('../support'),
  DataTypes = require('sequelize/lib/data-types');

describe(Support.getTestDialectTeaser('Self'), () => {
  it('supports freezeTableName', async function() {
    const Group = this.sequelize.define('Group', {}, {
      tableName: 'user_group',
      timestamps: false,
      underscored: true,
      freezeTableName: true
    });

    Group.belongsTo(Group, { as: 'Parent', foreignKey: 'parent_id' });
    await Group.sync({ force: true });

    await Group.findAll({
      include: [{
        model: Group,
        as: 'Parent'
      }]
    });
  });

  it('can handle 1:m associations', async function() {
    const Person = this.sequelize.define('Person', { name: DataTypes.STRING });

    Person.hasMany(Person, { as: 'Children', foreignKey: 'parent_id' });

    expect(Person.rawAttributes.parent_id).to.be.ok;

    await this.sequelize.sync({ force: true });

    const [mary, john, chris] = await Promise.all([
      Person.create({ name: 'Mary' }),
      Person.create({ name: 'John' }),
      Person.create({ name: 'Chris' })
    ]);

    await mary.setChildren([john, chris]);
  });

  it('can handle n:m associations', async function() {
    const Person = this.sequelize.define('Person', { name: DataTypes.STRING });

    Person.belongsToMany(Person, { as: 'Parents', through: 'Family', foreignKey: 'ChildId', otherKey: 'PersonId' });
    Person.belongsToMany(Person, { as: 'Childs', through: 'Family', foreignKey: 'PersonId', otherKey: 'ChildId' });

    const foreignIdentifiers = Object.values(Person.associations).map(v => v.foreignIdentifier);
    const rawAttributes = Object.keys(this.sequelize.models.Family.rawAttributes);

    expect(foreignIdentifiers.length).to.equal(2);
    expect(rawAttributes.length).to.equal(4);

    expect(foreignIdentifiers).to.have.members(['PersonId', 'ChildId']);
    expect(rawAttributes).to.have.members(['createdAt', 'updatedAt', 'PersonId', 'ChildId']);

    await this.sequelize.sync({ force: true });

    const [mary, john, chris] = await Promise.all([
      Person.create({ name: 'Mary' }),
      Person.create({ name: 'John' }),
      Person.create({ name: 'Chris' })
    ]);

    await mary.setParents([john]);
    await chris.addParent(john);
    const children = await john.getChilds();
    expect(children.map(v => v.id)).to.have.members([mary.id, chris.id]);
  });

  it('can handle n:m associations with pre-defined through table', async function() {
    const Person = this.sequelize.define('Person', { name: DataTypes.STRING });
    const Family = this.sequelize.define('Family', {
      preexisting_child: {
        type: DataTypes.INTEGER,
        primaryKey: true
      },
      preexisting_parent: {
        type: DataTypes.INTEGER,
        primaryKey: true
      }
    }, { timestamps: false });

    Person.belongsToMany(Person, { as: 'Parents', through: Family, foreignKey: 'preexisting_child', otherKey: 'preexisting_parent' });
    Person.belongsToMany(Person, { as: 'Children', through: Family, foreignKey: 'preexisting_parent', otherKey: 'preexisting_child' });

    const foreignIdentifiers = Object.values(Person.associations).map(v => v.foreignIdentifier);
    const rawAttributes = Object.keys(Family.rawAttributes);

    expect(foreignIdentifiers.length).to.equal(2);
    expect(rawAttributes.length).to.equal(2);

    expect(foreignIdentifiers).to.have.members(['preexisting_parent', 'preexisting_child']);
    expect(rawAttributes).to.have.members(['preexisting_parent', 'preexisting_child']);

    let count = 0;
    await this.sequelize.sync({ force: true });

    const [mary, john, chris] = await Promise.all([
      Person.create({ name: 'Mary' }),
      Person.create({ name: 'John' }),
      Person.create({ name: 'Chris' })
    ]);

    this.mary = mary;
    this.chris = chris;
    this.john = john;

    await mary.setParents([john], {
      logging(sql) {
        if (sql.match(/INSERT/)) {
          count++;
          expect(sql).to.have.string('preexisting_child');
          expect(sql).to.have.string('preexisting_parent');
        }
      }
    });

    await this.mary.addParent(this.chris, {
      logging(sql) {
        if (sql.match(/INSERT/)) {
          count++;
          expect(sql).to.have.string('preexisting_child');
          expect(sql).to.have.string('preexisting_parent');
        }
      }
    });

    const children = await this.john.getChildren({
      logging(sql) {
        count++;
        const whereClause = sql.split('FROM')[1];
        // look only in the whereClause
        expect(whereClause).to.have.string('preexisting_child');
        expect(whereClause).to.have.string('preexisting_parent');
      }
    });

    expect(count).to.be.equal(3);
    expect(children.map(v => v.id)).to.have.members([this.mary.id]);
  });
});

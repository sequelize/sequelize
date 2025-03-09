'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../support');
const { DataTypes } = require('@sequelize/core');

describe(Support.getTestDialectTeaser('Self'), () => {
  it('supports freezeTableName', async function () {
    const Group = this.sequelize.define(
      'Group',
      {},
      {
        tableName: 'user_group',
        timestamps: false,
        underscored: true,
        freezeTableName: true,
      },
    );

    Group.belongsTo(Group, { as: 'Parent', foreignKey: 'parent_id' });
    await Group.sync({ force: true });

    await Group.findAll({
      include: [
        {
          model: Group,
          as: 'Parent',
        },
      ],
    });
  });

  it('can handle 1:m associations', async function () {
    const Person = this.sequelize.define('Person', { name: DataTypes.STRING });

    Person.hasMany(Person, { as: 'children', foreignKey: 'parent_id', inverse: { as: 'parent' } });

    expect(Person.getAttributes().parent_id).to.be.ok;

    await this.sequelize.sync({ force: true });

    const [mary, john, chris] = await Promise.all([
      Person.create({ name: 'Mary' }),
      Person.create({ name: 'John' }),
      Person.create({ name: 'Chris' }),
    ]);

    await mary.setChildren([john, chris]);
  });

  it('can handle n:m associations', async function () {
    const Person = this.sequelize.define('Person', { name: DataTypes.STRING });

    Person.belongsToMany(Person, {
      as: 'Parents',
      through: 'Family',
      foreignKey: 'ChildId',
      otherKey: 'PersonId',
      inverse: { as: 'Childs' },
    });

    expect(Person.associations.Parents.otherKey).to.eq('PersonId');
    expect(Person.associations.Childs.otherKey).to.eq('ChildId');

    const rawAttributes = Object.keys(this.sequelize.models.get('Family').getAttributes());
    expect(rawAttributes).to.have.members(['createdAt', 'updatedAt', 'PersonId', 'ChildId']);
    expect(rawAttributes.length).to.equal(4);

    await this.sequelize.sync({ force: true });

    const [mary, john, chris] = await Promise.all([
      Person.create({ name: 'Mary' }),
      Person.create({ name: 'John' }),
      Person.create({ name: 'Chris' }),
    ]);

    await mary.setParents([john]);
    await chris.addParent(john);
    const children = await john.getChilds();
    expect(children.map(v => v.id)).to.have.members([mary.id, chris.id]);
  });

  it('can handle n:m associations with pre-defined through table', async function () {
    const Person = this.sequelize.define('Person', { name: DataTypes.STRING });
    const Family = this.sequelize.define(
      'Family',
      {
        preexisting_child: {
          type: DataTypes.INTEGER,
          primaryKey: true,
        },
        preexisting_parent: {
          type: DataTypes.INTEGER,
          primaryKey: true,
        },
      },
      { timestamps: false },
    );

    Person.belongsToMany(Person, {
      as: 'Parents',
      through: Family,
      foreignKey: 'preexisting_child',
      otherKey: 'preexisting_parent',
      inverse: { as: 'Children' },
    });

    expect(Person.associations.Parents.otherKey).to.eq('preexisting_parent');
    expect(Person.associations.Children.otherKey).to.eq('preexisting_child');

    const rawAttributes = Object.keys(Family.getAttributes());
    expect(rawAttributes).to.have.members(['preexisting_parent', 'preexisting_child']);
    expect(rawAttributes.length).to.equal(2);

    let count = 0;
    await this.sequelize.sync({ force: true });

    const [mary, john, chris] = await Promise.all([
      Person.create({ name: 'Mary' }),
      Person.create({ name: 'John' }),
      Person.create({ name: 'Chris' }),
    ]);

    this.mary = mary;
    this.chris = chris;
    this.john = john;

    await mary.setParents([john], {
      logging(sql) {
        if (/INSERT/.test(sql)) {
          count++;
          expect(sql).to.have.string('preexisting_child');
          expect(sql).to.have.string('preexisting_parent');
        }
      },
    });

    await this.mary.addParent(this.chris, {
      logging(sql) {
        if (/INSERT/.test(sql)) {
          count++;
          expect(sql).to.have.string('preexisting_child');
          expect(sql).to.have.string('preexisting_parent');
        }
      },
    });

    const children = await this.john.getChildren({
      logging(sql) {
        count++;
        const whereClause = sql.split('FROM')[1];
        // look only in the whereClause
        expect(whereClause).to.have.string('preexisting_child');
        expect(whereClause).to.have.string('preexisting_parent');
      },
    });

    expect(count).to.equal(3);
    expect(children.map(v => v.id)).to.have.members([this.mary.id]);
  });
});

import type { InferAttributes, InferCreationAttributes } from '@sequelize/core';
import { DataTypes, Model, Op, sql } from '@sequelize/core';
import { expect } from 'chai';
import { beforeAll2, sequelize, setResetMode } from '../../support';

/**
 * Attribute names accept any character that is not reserved by the attribute syntax
 * ($ . : [ ] and control characters), because they are always quoted in the generated SQL.
 * These tests verify that such attributes can be created, synced and queried against a real database.
 *
 * Not tested here: NUL (rejected by every database) and astral-plane characters such as emojis
 * (rejected by mariadb in identifiers).
 */
describe('Model attributes with special characters in their name', () => {
  setResetMode('none');

  const vars = beforeAll2(async () => {
    class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
      declare 'first-name': string;
      declare 'café': number;
      declare 'a b': number;
      declare 'a"b': number;
      declare 'a`b': number;
      declare "a'b": number;
      declare '名前': string;
      declare 'a;b': number;
      declare 'a--b': number;
      declare mapped: number;
    }

    User.init(
      {
        'first-name': DataTypes.STRING,
        café: DataTypes.INTEGER,
        'a b': DataTypes.INTEGER,
        'a"b': DataTypes.INTEGER,
        'a`b': DataTypes.INTEGER,
        "a'b": DataTypes.INTEGER,
        名前: DataTypes.STRING,
        'a;b': DataTypes.INTEGER,
        'a--b': DataTypes.INTEGER,
        // the column name of an attribute can use any character, even the ones reserved for attribute names
        mapped: { type: DataTypes.INTEGER, columnName: '$a.b::c[0]$' },
      },
      { sequelize, timestamps: false },
    );

    await User.sync({ force: true });

    const user = await User.create({
      'first-name': 'John',
      café: 1,
      'a b': 2,
      'a"b': 3,
      'a`b': 4,
      "a'b": 5,
      名前: 'ジョン',
      'a;b': 6,
      'a--b': 7,
      mapped: 8,
    });

    // a second row, to make sure the WHERE clauses filter
    await User.create({
      'first-name': 'Jane',
      café: 10,
      'a b': 20,
      'a"b': 30,
      'a`b': 40,
      "a'b": 50,
      名前: 'ジェーン',
      'a;b': 60,
      'a--b': 70,
      mapped: 80,
    });

    return { User, user };
  });

  const attributes: Array<{ attribute: string; value: string | number }> = [
    { attribute: 'first-name', value: 'John' },
    { attribute: 'café', value: 1 },
    { attribute: 'a b', value: 2 },
    { attribute: 'a"b', value: 3 },
    { attribute: 'a`b', value: 4 },
    { attribute: "a'b", value: 5 },
    { attribute: '名前', value: 'ジョン' },
    { attribute: 'a;b', value: 6 },
    { attribute: 'a--b', value: 7 },
    { attribute: 'mapped', value: 8 },
  ];

  for (const { attribute, value } of attributes) {
    it(`queries the attribute ${JSON.stringify(attribute)} through a WHERE POJO`, async () => {
      const users = await vars.User.findAll({ where: { [attribute]: value } });

      expect(users).to.have.length(1);
      expect(users[0].get(attribute)).to.equal(value);
      expect(users[0].get('first-name')).to.equal('John');
    });

    it(`queries the attribute ${JSON.stringify(attribute)} through an operator`, async () => {
      const users = await vars.User.findAll({ where: { [attribute]: { [Op.ne]: value } } });

      expect(users).to.have.length(1);
      expect(users[0].get('first-name')).to.equal('Jane');
    });

    it(`queries the attribute ${JSON.stringify(attribute)} through sql.attribute`, async () => {
      const users = await vars.User.findAll({
        where: sql.where(sql.attribute(attribute), value),
      });

      expect(users).to.have.length(1);
      expect(users[0].get(attribute)).to.equal(value);
      expect(users[0].get('first-name')).to.equal('John');
    });

    it(`selects the attribute ${JSON.stringify(attribute)} through sql.attribute`, async () => {
      const user = await vars.User.findOne({
        attributes: [[sql.attribute(attribute), 'aliased']],
        where: { 'first-name': 'John' },
        rejectOnEmpty: true,
      });

      // @ts-expect-error -- typings are not currently designed to handle custom attributes
      const aliased: unknown = user.getDataValue('aliased');

      expect(aliased).to.equal(value);
    });
  }

  it('queries several special attributes at once', async () => {
    const users = await vars.User.findAll({
      where: {
        [Op.or]: [{ 'a"b': 3 }, { 'a`b': 40 }],
        'first-name': { [Op.ne]: 'nobody' },
      },
      order: [['café', 'ASC']],
    });

    expect(users.map(user => user.get('first-name'))).to.deep.equal(['John', 'Jane']);
  });

  it('updates & counts using special attributes', async () => {
    const count = await vars.User.count({ where: { 'a b': 2 } });
    expect(count).to.equal(1);

    await vars.User.update({ 'a b': 200 }, { where: { 'first-name': 'John' } });

    expect(await vars.User.count({ where: { 'a b': 2 } })).to.equal(0);
    expect(await vars.User.count({ where: { 'a b': 200 } })).to.equal(1);

    await vars.User.update({ 'a b': 2 }, { where: { 'first-name': 'John' } });
  });

  describe('reserved characters', () => {
    const reservedNames: Array<{ name: string; reason: string }> = [
      { name: '$attribute', reason: '$' },
      { name: 'attribute$', reason: 'trailing $' },
      { name: 'my$attribute', reason: '$ in the middle' },
      { name: 'my.attribute', reason: '.' },
      { name: 'my:attribute', reason: ':' },
      { name: 'my::attribute', reason: '::' },
      { name: 'my[attribute', reason: '[' },
      { name: 'my]attribute', reason: ']' },
      { name: 'my\nattribute', reason: 'newline' },
      { name: 'my\tattribute', reason: 'tab' },
      { name: 'my\u0000attribute', reason: 'NUL' },
    ];

    for (const { name, reason } of reservedNames) {
      it(`rejects an attribute named ${JSON.stringify(name)} (${reason})`, () => {
        expect(() => {
          sequelize.define('ReservedAttribute', {
            [name]: DataTypes.INTEGER,
          });
        }).to.throw(/reserved syntax used to reference attributes in queries/);
      });
    }

    it('rejects an attribute name containing "->"', () => {
      expect(() => {
        sequelize.define('ReservedAttribute', {
          'my->attribute': DataTypes.INTEGER,
        });
      }).to.throw(/cannot include the character sequence "->"/);
    });
  });
});

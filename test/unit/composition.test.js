'use strict';

const Support = require('../support');
const { expect } = require('chai');
const Sequelize = Support.Sequelize;
const expectsql = Support.expectsql;

const {
  Slot,
  Placeholder,
  Composition,
  CompositionGroup
} = require('../../lib/dialects/abstract/query-generator/composition');

const {
  QueryProto,
  SelectProto,
  InsertProto,
  UpdateProto
} = require('../../lib/dialects/abstract/query-generator/query-proto');

describe('Composition', () => {

  it('validates input', () => {
    expect(() => new Composition('foo ', new Slot(new Date(), { type: Sequelize.DATE }), ' bar')).to.not.throw();
    expect(() => new Composition('bar', new Placeholder())).to.not.throw();
    expect(() => new Composition('numbers not allowed', 8008)).to.throw('Invalid query item').with.property('item', 8008);
    const date = new Date(Date.UTC(2000, 0, 1));
    expect(() => new Composition('Only allows strings, slots and placholders', date))
      .to.throw('Invalid query item').with.property('item', date);
    const object = {};
    expect(() => new Composition('Otherwise, throw', object)).to.throw('Invalid query item').with.property('item', object);
    const array = [];
    expect(() => new Composition('bad', array)).to.throw('Invalid query item').with.property('item', array);
  });

  it('should have *set* method', () => {
    const items = ['foo ', new Slot(5), ' bar'];

    const compositionEmpty = new Composition();
    expect(compositionEmpty.set(...items)).to.deep.equal(new Composition(...items));

    // *set* cleans previous values
    const composition = new Composition('start ');
    expect(composition.set(...items)).to.deep.equal(new Composition(...items));

    // *set* modifies instace without need to reassign
    expect(composition).to.deep.equal(new Composition(...items));

    // *set* returns same object
    expect(composition).to.equal(composition.set(...items));
  });

  it('should have *add* method', () => {
    const items = ['foo ', new Slot(5), ' bar'];

    const compositionEmpty = new Composition();
    expect(compositionEmpty.add(...items)).to.deep.equal(new Composition(...items));

    // *add* puts items towards the end
    const composition = new Composition('start ');
    expect(composition.add(...items).items).to.deep.equal(['start ', ...items]);

    // *add* modifies instace without need to reassign
    expect(composition.items).to.deep.equal(['start ', ...items]);

    // *add* returns same object
    expect(composition).to.equal(composition.add(...items));
  });

  it('should have *prepend* method', () => {
    const items = ['foo ', new Slot(5), ' bar'];

    const compositionEmpty = new Composition();
    expect(compositionEmpty.prepend(...items)).to.deep.equal(new Composition(...items));

    // *prepend* puts items towards the beginning
    const composition = new Composition(' end');
    expect(composition.prepend(...items).items).to.deep.equal([...items, ' end']);

    // *prepend* modifies instace without need to reassign
    expect(composition.items).to.deep.equal([...items, ' end']);

    // *prepend* returns same object
    expect(composition).to.equal(composition.prepend(...items));
  });

  it('should have *clone* method', () => {
    const items = ['foo ', new Slot(5), ' bar'];
    const originalComposition = new Composition(...items);

    // *clone* should return a different object
    expect(originalComposition.clone()).to.not.equal(originalComposition);

    // But the returned object must have the same items
    expect(originalComposition.clone().items).to.deep.equal(items);
  });

  it('should have *from* method', () => {
    const items = ['foo ', new Slot(5), ' bar'];
    const composition = Composition.from(items);

    expect(composition.items).to.deep.equal(['foo ', new Slot(5), ' bar']);

    // *from* should create a *Composition* instance
    expect(composition instanceof Composition).to.be.ok;
  });

});

describe('Composition Group', () => {

  it('accepts composition elements', () => {
    expect(() => new CompositionGroup('foo ',  new Slot(5),
      ' bar', new Composition())).to.not.throw();
    // validation is done when using method toComposiiton()
  });

  it('should have *add* method', () => {
    const compositions = ['foo ', new Slot(5), ' bar', new Composition()];

    const groupEmpty = new CompositionGroup();
    expect(groupEmpty.add(...compositions)).to.deep.equal(CompositionGroup.from(compositions));

    // *add* puts compositions towards the end
    const group = new CompositionGroup('start ');
    expect(group.add(...compositions)).to.deep.equal(new CompositionGroup('start ', ...compositions));

    // *add* modifies instace without need to reassign
    expect(group).to.deep.equal(new CompositionGroup('start ', ...compositions));

    // *add* returns same object
    expect(group).to.equal(group.add(...compositions));
  });

  it('should have *space* method', () => {
    const compositions = ['foo ', new Slot(5), ' bar', new Composition()];

    const group = CompositionGroup.from(compositions);
    expect(group.space(', ').compositions).to.deep.equal(['foo ', ', ',
      new Slot(5), ', ', ' bar', ', ', new Composition()]);

    // *space* modifies instace without need to reassign
    expect(group.compositions).to.deep.equal(['foo ', ', ',
      new Slot(5), ', ', ' bar', ', ', new Composition()]);

    // *space* returns same object
    const group2 = CompositionGroup.from(compositions);
    expect(group2).to.equal(group2.space(', '));
  });

  it('should have *merge* method', () => {
    const group1 = new CompositionGroup('foo ', new Slot(5), ' bar');
    const group2 = new CompositionGroup(new Composition('oof', new Slot(5), 'rab'));

    expect(group1.merge(group2).compositions).to.deep.equal(['foo ',
      new Slot(5), ' bar', new Composition('oof',
        new Slot(5), 'rab')]);

    // *merge* should return same object
    expect(group1.merge(group2)).to.equal(group1);
    expect(group1.merge(group2)).to.not.equal(group2);
  });

  it('should have *slice* method', () => {
    const group = new CompositionGroup('foo ', new Slot(5), ' bar',
      new Composition('oof', new Slot(5), 'rab'), 'end');

    expect(group.slice(1, 3).compositions).to.deep.equal([new Slot(5), ' bar']);

    // *slice* should return a different object
    expect(group.slice()).to.not.equal(group);
  });

  it('should have *toComposition* method', () => {
    const group = new CompositionGroup('foo ', new Slot(5),
      new Composition('oof', 'rab'), ' bar');

    expect(group.toComposition() instanceof Composition).to.be.ok;

    expect(group.toComposition().items).to.deep.equal(['foo ', new Slot(5),
      'oof', 'rab', ' bar']);

  });

  it('should have *from* method', () => {
    const compositions = ['foo ', new Slot(5), ' bar',
      new Composition('oof', new Slot(5), 'rab')];
    const group = CompositionGroup.from(compositions);

    expect(group.compositions).to.deep.equal([
      'foo ', new Slot(5), ' bar', new Composition('oof', new Slot(5), 'rab')
    ]);

    // *from* should create a *CompositionGroup* instance
    expect(group instanceof CompositionGroup).to.be.ok;
  });

});

describe('Query proto', () => {

  const partNames = ['foo', 'bar'];
  class TestProto extends QueryProto {
    static get partNames() { return partNames; }
  }

  it('constructor should accept QueryProto instances or similar objects', () => {
    const similar = { foo: new Composition('abc'), extrange: new Composition('def') };
    const testProto = new TestProto(similar);
    const otherTestProto = new TestProto(testProto);

    // *foo* should have been copied, but not *extrange*
    expect(testProto).to.deep.equal({ foo: { items: ['abc'] }, bar: { items: [] } });
    expect(otherTestProto).to.deep.equal({ foo: { items: ['abc'] }, bar: { items: [] } });

    // deep copy of instance up to Composition level
    expect(testProto !== otherTestProto).to.be.ok;
    expect(testProto.foo !== otherTestProto.foo).to.be.ok;
  });

  it('should have *set* method', () => {
    const originalTestProto = new TestProto();
    const testProto = new TestProto();

    originalTestProto.foo.add('abc', new Slot(5));
    originalTestProto.bar.add('def');

    testProto.foo.add('bar');

    // *set* cleans previous values
    expect(testProto.set(originalTestProto)).to.deep.equal({
      foo: { items: ['abc', new Slot(5)] },
      bar: { items: ['def'] }
    });

    // *set* modifies instace without need to reassign
    expect(testProto).to.deep.equal({
      foo: { items: ['abc', new Slot(5)] },
      bar: { items: ['def'] }
    });

    // *set* returns same object
    expect(testProto).to.equal(testProto.set(originalTestProto));
  });

  it('should have *clone* method', () => {
    const testProto = new TestProto();

    testProto.foo.add('abc', new Slot(5));
    testProto.bar.add('def');

    // *clone* should return a different object
    expect(testProto.clone()).to.not.equal(testProto);

    // But the returned object must have the same items
    expect(testProto.clone()).to.deep.equal({
      foo: { items: ['abc', new Slot(5)] },
      bar: { items: ['def'] }
    });
  });

  it('should error if subclasses do not implement toComposition method', () => {
    const testProto = new TestProto();
    testProto.foo.add('abc');

    expect(() => testProto.toComposition()).to.throw('Class TestProto has not implemented toComposition method');
  });
});

describe('Select proto', () => {

  it('should implement toComposition method', () => {
    const selectProto = new SelectProto({
      attributes: new Composition('SUM("apples") AS "totalApples", "color"'),
      from: new Composition('"mytable"'),
      join: new Composition('INNER JOIN "childtable"'),
      where: new Composition('"color" IN (', new Slot('green'), ', ', new Slot('red'), ')'),
      group: new Composition('"color"'),
      having: new Composition('"totalApples" > ', new Slot(5)),
      order: new Composition('"totalApples" DESC'),
      page: new Composition('LIMIT ', new Slot(10), ' OFFSET ', new Slot(10)),
      lock: new Composition('FOR UPDATE')
    });

    expectsql(selectProto.toComposition(), {
      query: {
        default: 'SELECT SUM("apples") AS "totalApples", "color" FROM "mytable" INNER JOIN "childtable" WHERE "color" IN ($1, $2) GROUP BY "color" HAVING "totalApples" > $3 ORDER BY "totalApples" DESC LIMIT $4 OFFSET $5 FOR UPDATE;'
      },
      bind: {
        default: ['green', 'red', 5, 10, 10]
      }
    });
  });

  it('toComposition() should require from clause', () => {
    expect(() => new SelectProto().toComposition()).to.throw('Missing FROM clause in select proto query');
    expect(() => new SelectProto({ from: new Composition('"mytable"') }).toComposition()).not.to.throw();
  });

  it('should use \'*\' if values are missing', () => {
    const selectProto = new SelectProto({ from: new Composition('"mytable"') });

    expectsql(selectProto.toComposition(), {
      query: {
        default: 'SELECT * FROM "mytable";'
      },
      bind: {
        default: []
      }
    });
  });
});

describe('Insert proto', () => {

  it('should implement toComposition method', () => {
    const insertProto = new InsertProto({
      preQuery: new Composition('set "foo" = \'bar\'; '),
      flags: new Composition('IGNORE'),
      table: new Composition('"mytable"'),
      attributes: new Composition('"apples", "color"'),
      output: new Composition('OUTPUT *'),
      values: new Composition('SELECT ', new Slot(5), ', ', new Slot('green')),
      onConflict: new Composition('ON CONFLICT DO NOTHING'),
      return: new Composition('RETURNING *'),
      postQuery: new Composition('; set "foo" = \'foo\'')
    });

    expectsql(insertProto.toComposition(), {
      query: {
        default: 'set "foo" = \'bar\'; INSERT IGNORE INTO "mytable" ("apples", "color") OUTPUT * SELECT $1, $2 ON CONFLICT DO NOTHING RETURNING *; set "foo" = \'foo\';'
      },
      bind: {
        default: [5, 'green']
      }
    });
  });

  it('toComposition() should require a table', () => {
    expect(() => new InsertProto({ values: new Composition('1') }).toComposition()).to.throw('Missing table in INSERT query');
    expect(() => new InsertProto({ table: new Composition('"mytable"'), values: new Composition('1') }).toComposition()).not.to.throw();
  });

  it('toComposition() should require values', () => {
    expect(() => new InsertProto({ table: new Composition('"mytable"') }).toComposition()).to.throw('Missing values in INSERT query');
    expect(() => new InsertProto({ table: new Composition('"mytable"'), values: new Composition('1') }).toComposition()).not.to.throw();
  });
});

describe('Update proto', () => {

  it('should implement toComposition method', () => {
    const updateProto = new UpdateProto({
      preQuery: new Composition('set "foo" = \'bar\'; '),
      flags: new Composition('IGNORE'),
      table: new Composition('"mytable"'),
      values: new Composition('"apples" = ', new Slot(5), ', "color" = ', new Slot('red')),
      output: new Composition('OUTPUT *'),
      where: new Composition('"id" = ', new Slot(21)),
      limit: new Composition('LIMIT ', new Slot(10)),
      return: new Composition('RETURNING *'),
      postQuery: new Composition('; set "foo" = \'foo\'')
    });

    expectsql(updateProto.toComposition(), {
      query: {
        default: 'set "foo" = \'bar\'; UPDATE IGNORE "mytable" SET "apples" = $1, "color" = $2 OUTPUT * WHERE "id" = $3 LIMIT $4 RETURNING *; set "foo" = \'foo\';'
      },
      bind: {
        default: [5, 'red', 21, 10]
      }
    });
  });

  it('toComposition() should require a table', () => {
    expect(() => new UpdateProto({ values: new Composition('1') }).toComposition()).to.throw('Missing table in UPDATE query');
    expect(() => new UpdateProto({ table: new Composition('"mytable"'), values: new Composition('1') }).toComposition()).not.to.throw();
  });

  it('toComposition() should require values', () => {
    expect(() => new UpdateProto({ table: new Composition('"mytable"') }).toComposition()).to.throw('Missing values in UPDATE query');
    expect(() => new UpdateProto({ table: new Composition('"mytable"'), values: new Composition('1') }).toComposition()).not.to.throw();
  });
});

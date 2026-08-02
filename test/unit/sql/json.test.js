import { expect } from 'chai';
import Support from '../support.js';
import DataTypes from '../../../lib/data-types.js';

const expectsql = Support.expectsql;
const Sequelize = Support.Sequelize;
const current = Support.sequelize;
const sql = current.dialect.QueryGenerator;

// Notice: [] will be replaced by dialect specific tick/quote character when there is not dialect specific expectation but only a default expectation
if (current.dialect.supports.JSON) {
  describe(Support.getTestDialectTeaser('SQL'), () => {
    describe('JSON', () => {
      describe('escape', () => {
        it('plain string', () => {
          expectsql(sql.escape('string', { type: new DataTypes.JSON() }), {
            default: '\'"string"\''
          });
        });

        it('plain int', () => {
          expectsql(sql.escape(0, { type: new DataTypes.JSON() }), {
            default: "'0'"
          });
          expectsql(sql.escape(123, { type: new DataTypes.JSON() }), {
            default: "'123'"
          });
        });

        it('boolean', () => {
          expectsql(sql.escape(true, { type: new DataTypes.JSON() }), {
            default: "'true'"
          });
          expectsql(sql.escape(false, { type: new DataTypes.JSON() }), {
            default: "'false'"
          });
        });

        it('NULL', () => {
          expectsql(sql.escape(null, { type: new DataTypes.JSON() }), {
            default: 'NULL'
          });
        });

        it('nested object', () => {
          expectsql(
            sql.escape({ some: 'nested', more: { nested: true }, answer: 42 }, { type: new DataTypes.JSON() }),
            {
              default: '\'{"some":"nested","more":{"nested":true},"answer":42}\''
            }
          );
        });

        if (current.dialect.supports.ARRAY) {
          it('array of JSON', () => {
            expectsql(
              sql.escape([{ some: 'nested', more: { nested: true }, answer: 42 }, 43, 'joe'], {
                type: DataTypes.ARRAY(DataTypes.JSON)
              }),
              {
                postgres: 'ARRAY[\'{"some":"nested","more":{"nested":true},"answer":42}\',\'43\',\'"joe"\']::JSON[]'
              }
            );
          });

          if (current.dialect.supports.JSONB) {
            it('array of JSONB', () => {
              expectsql(
                sql.escape([{ some: 'nested', more: { nested: true }, answer: 42 }, 43, 'joe'], {
                  type: DataTypes.ARRAY(DataTypes.JSONB)
                }),
                {
                  postgres: 'ARRAY[\'{"some":"nested","more":{"nested":true},"answer":42}\',\'43\',\'"joe"\']::JSONB[]'
                }
              );
            });
          }
        }
      });

      describe('path extraction', () => {
        it('condition object', () => {
          expectsql(sql.whereItemQuery(undefined, Sequelize.json({ id: 1 })), {
            postgres: "(\"id\"#>>'{}') = '1'"
          });
        });

        it('nested condition object', () => {
          expectsql(sql.whereItemQuery(undefined, Sequelize.json({ profile: { id: 1 } })), {
            postgres: "(\"profile\"#>>'{id}') = '1'"
          });
        });

        it('multiple condition object', () => {
          expectsql(
            sql.whereItemQuery(undefined, Sequelize.json({ property: { value: 1 }, another: { value: 'string' } })),
            {
              postgres: "(\"property\"#>>'{value}') = '1' AND (\"another\"#>>'{value}') = 'string'"
            }
          );
        });

        it('dot notation', () => {
          expectsql(sql.whereItemQuery(Sequelize.json('profile.id'), '1'), {
            postgres: "(\"profile\"#>>'{id}') = '1'"
          });
        });

        it('column named "json"', () => {
          expectsql(sql.whereItemQuery(Sequelize.json('json'), '{}'), {
            postgres: "(\"json\"#>>'{}') = '{}'"
          });
        });

        describe('dotted key on a JSON model attribute', () => {
          const User = current.define('User', { meta: DataTypes.JSONB });

          it('single segment', () => {
            expectsql(sql.whereItemQuery('meta.city', 'Copenhagen', { model: User }), {
              postgres: "(\"meta\"#>>'{city}') = 'Copenhagen'"
            });
          });

          it('multiple segments', () => {
            expectsql(sql.whereItemQuery('meta.address.city', 'Copenhagen', { model: User }), {
              postgres: "(\"meta\"#>>'{address,city}') = 'Copenhagen'"
            });
          });

          it('numeric segment stays a path element rather than becoming an array', () => {
            expectsql(sql.whereItemQuery('meta.items.0.name', 'x', { model: User }), {
              postgres: "(\"meta\"#>>'{items,0,name}') = 'x'"
            });
          });

          it('ignores a prototype-reaching segment', () => {
            expect(sql.whereItemQuery('meta.__proto__.x', 'x', { model: User })).to.equal('');
            expect({}.x).to.be.undefined;
          });
        });
      });

      describe('raw json query', () => {
        it('#>> operator', () => {
          expectsql(sql.whereItemQuery(Sequelize.json('("data"#>>\'{id}\')'), 'id'), {
            postgres: "(\"data\"#>>'{id}') = 'id'"
          });
        });

        it('json function', () => {
          expectsql(sql.handleSequelizeMethod(Sequelize.json('json(\'{"profile":{"name":"david"}}\')')), {
            default: 'json(\'{"profile":{"name":"david"}}\')'
          });
        });

        it('nested json functions', () => {
          expectsql(
            sql.handleSequelizeMethod(Sequelize.json('json_extract(json_object(\'{"profile":null}\'), "profile")')),
            {
              default: 'json_extract(json_object(\'{"profile":null}\'), "profile")'
            }
          );
        });

        it('escaped string argument', () => {
          expectsql(
            sql.handleSequelizeMethod(
              Sequelize.json('json(\'{"quote":{"single":"\'\'","double":""""},"parenthesis":"())("}\')')
            ),
            {
              default: 'json(\'{"quote":{"single":"\'\'","double":""""},"parenthesis":"())("}\')'
            }
          );
        });

        it('unbalnced statement', () => {
          expect(() => sql.handleSequelizeMethod(Sequelize.json('json())'))).to.throw();
          expect(() => sql.handleSequelizeMethod(Sequelize.json('json_extract(json()'))).to.throw();
        });

        it('separator injection', () => {
          expect(() => sql.handleSequelizeMethod(Sequelize.json('json(; DELETE YOLO INJECTIONS; -- )'))).to.throw();
          expect(() => sql.handleSequelizeMethod(Sequelize.json('json(); DELETE YOLO INJECTIONS; -- '))).to.throw();
        });
      });

      // CVE-2026-30951. A JSON path key may carry a `::cast`, and the cast used to be interpolated
      // into `CAST(... AS x)` unescaped -- so an attacker who controlled a key in an object reaching
      // `where` (e.g. `where: { metadata: req.body.filter }`) could append arbitrary SQL.
      describe('cast type in a JSON path key', () => {
        const Model = current.define('User', { metadata: new DataTypes.JSONB() }, { timestamps: false });
        const whereSql = (filter) => sql.selectQuery('Users', { where: { metadata: filter } }, Model);

        // Case list mirrors the upstream v6 regression test for this advisory.
        it('rejects SQL injection via the :: cast notation', () => {
          expect(() => whereSql({ 'role::text) OR 1=1--': 'x' })).to.throw(/Invalid cast type/);
        });

        it('rejects UNION-based injection via the :: cast notation', () => {
          expect(() => whereSql({ 'role::text) AND 0 UNION SELECT * FROM secrets--': 'x' })).to.throw(
            /Invalid cast type/
          );
        });

        it('rejects cast types with parentheses', () => {
          expect(() => whereSql({ 'role::text)': 'x' })).to.throw(/Invalid cast type/);
        });

        it('rejects cast types with semicolons', () => {
          expect(() => whereSql({ 'role::text; DROP TABLE users': 'x' })).to.throw(/Invalid cast type/);
        });

        it('rejects cast types with comment markers', () => {
          expect(() => whereSql({ 'role::text--': 'x' })).to.throw(/Invalid cast type/);
        });

        it('rejects an empty cast type', () => {
          expect(() => whereSql({ 'role::': 'x' })).to.throw(/Invalid cast type/);
        });

        it('rejects unknown cast types', () => {
          expect(() => whereSql({ 'role::foobar': 'x' })).to.throw(/Invalid cast type/);
        });

        it('rejects regardless of casing', () => {
          expect(() => whereSql({ 'role::TeXt) or 1=1--': 'x' })).to.throw(/Invalid cast type/);
        });

        it('rejects inside a nested path', () => {
          expect(() => whereSql({ a: { 'b::int) or 1=1--': 1 } })).to.throw(/Invalid cast type/);
        });

        it('still allows known cast types', () => {
          expectsql(whereSql({ 'role::text': 'admin' }), {
            postgres:
              'SELECT * FROM "Users" AS "User" WHERE CAST(("User"."metadata"#>>\'{role}\') AS TEXT) = \'admin\';'
          });
          expectsql(whereSql({ 'age::integer': 30 }), {
            postgres: 'SELECT * FROM "Users" AS "User" WHERE CAST(("User"."metadata"#>>\'{age}\') AS INTEGER) = 30;'
          });
        });

        it('still allows the casts inferred from the value type', () => {
          expectsql(whereSql({ age: 30 }), {
            postgres:
              'SELECT * FROM "Users" AS "User" WHERE CAST(("User"."metadata"#>>\'{age}\') AS DOUBLE PRECISION) = 30;'
          });
          expectsql(whereSql({ active: true }), {
            postgres:
              'SELECT * FROM "Users" AS "User" WHERE CAST(("User"."metadata"#>>\'{active}\') AS BOOLEAN) = true;'
          });
        });
      });
    });
  });
}

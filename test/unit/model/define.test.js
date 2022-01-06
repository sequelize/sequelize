'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require('../support'),
  DataTypes = require('sequelize/lib/data-types'),
  sinon = require('sinon'),
  current = Support.sequelize,
  dialect = Support.getTestDialect();

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('define', () => {
    it('should allow custom timestamps with underscored: true', () => {
      const Model = current.define('User', {}, {
        createdAt: 'createdAt',
        updatedAt: 'updatedAt',
        timestamps: true,
        underscored: true
      });

      expect(Model.rawAttributes).to.haveOwnProperty('createdAt');
      expect(Model.rawAttributes).to.haveOwnProperty('updatedAt');

      expect(Model._timestampAttributes.createdAt).to.equal('createdAt');
      expect(Model._timestampAttributes.updatedAt).to.equal('updatedAt');

      expect(Model.rawAttributes).not.to.have.property('created_at');
      expect(Model.rawAttributes).not.to.have.property('updated_at');
    });

    it('should throw when id is added but not marked as PK', () => {
      expect(() => {
        current.define('foo', {
          id: DataTypes.INTEGER
        });
      }).to.throw("A column called 'id' was added to the attributes of 'foos' but not marked with 'primaryKey: true'");

      expect(() => {
        current.define('bar', {
          id: {
            type: DataTypes.INTEGER
          }
        });
      }).to.throw("A column called 'id' was added to the attributes of 'bars' but not marked with 'primaryKey: true'");
    });

    it('should defend against null or undefined "unique" attributes', () => {
      expect(() => {
        current.define('baz', {
          foo: {
            type: DataTypes.STRING,
            unique: null
          },
          bar: {
            type: DataTypes.STRING,
            unique: undefined
          },
          bop: {
            type: DataTypes.DATE
          }
        });
      }).not.to.throw();
    });

    it('should throw for unknown data type', () => {
      expect(() => {
        current.define('bar', {
          name: {
            type: DataTypes.MY_UNKNOWN_TYPE
          }
        });
      }).to.throw('Unrecognized datatype for attribute "bar.name"');
    });

    it('should throw for notNull validator without allowNull', () => {
      expect(() => {
        current.define('user', {
          name: {
            type: DataTypes.STRING,
            allowNull: true,
            validate: {
              notNull: {
                msg: 'Please enter the name'
              }
            }
          }
        });
      }).to.throw('Invalid definition for "user.name", "notNull" validator is only allowed with "allowNull:false"');

      expect(() => {
        current.define('part', {
          name: {
            type: DataTypes.STRING,
            validate: {
              notNull: {
                msg: 'Please enter the part name'
              }
            }
          }
        });
      }).to.throw('Invalid definition for "part.name", "notNull" validator is only allowed with "allowNull:false"');
    });

    describe('datatype warnings', () => {
      beforeEach(() => {
        sinon.spy(console, 'warn');
      });

      afterEach(() => {
        console.warn.restore();
      });

      it('warn for unsupported INTEGER options', () => {
        current.define('A', {
          age: {
            type: DataTypes.TINYINT.UNSIGNED
          }
        });

        if (['postgres', 'sqlite', 'mssql', 'db2'].includes(dialect)) {
          expect(true).to.equal(console.warn.calledOnce);
          expect(console.warn.args[0][0]).to.contain("does not support 'TINYINT'");
        } else {
          expect(false).to.equal(console.warn.calledOnce);
        }
      });
    });
  });
});

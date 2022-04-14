'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../support');
const { DataTypes } = require('@sequelize/core');
const sinon = require('sinon');

const current = Support.sequelize;
const dialect = Support.getTestDialect();

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('define', () => {
    it('should allow custom timestamps with underscored: true', () => {
      const Model = current.define('User', {}, {
        createdAt: 'createdAt',
        updatedAt: 'updatedAt',
        timestamps: true,
        underscored: true,
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
          id: DataTypes.INTEGER,
        });
      }).to.throw('An attribute called \'id\' was defined in model \'foos\' but not marked as a primaryKey. This is likely to be an error, which can be fixed by setting its \'primaryKey\' option to true. If this is intended, explicitly set its \'primaryKey\' option to false');

      expect(() => {
        current.define('bar', {
          id: {
            type: DataTypes.INTEGER,
          },
        });
      }).to.throw('An attribute called \'id\' was defined in model \'bars\' but not marked as a primaryKey. This is likely to be an error, which can be fixed by setting its \'primaryKey\' option to true. If this is intended, explicitly set its \'primaryKey\' option to false');
    });

    it('should not add the default PK when noPrimaryKey is set to true', () => {
      const User = current.define('User', {}, {
        noPrimaryKey: true,
      });

      expect(Model.rawAttributes).not.to.have.property('id');
    });

    it('should allow model definition without PK with noPrimaryKey is set to true', () => {
      const Model = current.define('User', {}, {
        noPrimaryKey: true,
      });

      expect(Model.rawAttributes).not.to.have.property('id');
    });

    it('should add the default `id` field PK if noPrimary is not set and no PK has been defined manually', () => {
      const Model = current.define('User', {});

      expect(Model.rawAttributes).to.have.property('id');
    });

    it('should not add the default `id` field PK if PK has been defined manually', () => {
      const Model = current.define('User', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
        },
      });

      expect(Model.rawAttributes).to.have.property('id');
    });

    it('should support noPrimaryKey on Sequelize define attribute', () => {
      const sequelize = Support.createSequelizeInstance({
        define: {
          noPrimaryKey: true,
        },
      });

      const Model = sequelize.define('User', {});

      expect(Model.options.noPrimaryKey).to.equal(true);
    });

    it('should throw when the attribute name is ambiguous with $nested.attribute$ syntax', () => {
      expect(() => {
        current.define('foo', {
          $id: DataTypes.INTEGER,
        });
      }).to.throw('Name of attribute "$id" in model "foo" cannot start or end with "$" as "$attribute$" is reserved syntax used to reference nested columns in queries.');

      expect(() => {
        current.define('foo', {
          id$: DataTypes.INTEGER,
        });
      }).to.throw('Name of attribute "id$" in model "foo" cannot start or end with "$" as "$attribute$" is reserved syntax used to reference nested columns in queries.');
    });

    it('should throw when the attribute name is ambiguous with json.path syntax', () => {
      expect(() => {
        current.define('foo', {
          'my.attribute': DataTypes.INTEGER,
        });
      }).to.throw('Name of attribute "my.attribute" in model "foo" cannot include the character "." as it would be ambiguous with the syntax used to reference nested columns, and nested json keys, in queries.');
    });

    it('should throw when the attribute name is ambiguous with casting syntax', () => {
      expect(() => {
        current.define('foo', {
          'id::int': DataTypes.INTEGER,
        });
      }).to.throw('Name of attribute "id::int" in model "foo" cannot include the character sequence "::" as it is reserved syntax used to cast attributes in queries.');
    });

    it('should throw when the attribute name is ambiguous with nested-association syntax', () => {
      expect(() => {
        current.define('foo', {
          'my->attribute': DataTypes.INTEGER,
        });
      }).to.throw('Name of attribute "my->attribute" in model "foo" cannot include the character sequence "->" as it is reserved syntax used in SQL generated by Sequelize to target nested associations.');
    });

    it('should defend against null or undefined "unique" attributes', () => {
      expect(() => {
        current.define('baz', {
          foo: {
            type: DataTypes.STRING,
            unique: null,
          },
          bar: {
            type: DataTypes.STRING,
            unique: undefined,
          },
          bop: {
            type: DataTypes.DATE,
          },
        });
      }).not.to.throw();
    });

    it('should throw for unknown data type', () => {
      expect(() => {
        current.define('bar', {
          name: {
            type: DataTypes.MY_UNKNOWN_TYPE,
          },
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
                msg: 'Please enter the name',
              },
            },
          },
        });
      }).to.throw('Invalid definition for "user.name", "notNull" validator is only allowed with "allowNull:false"');

      expect(() => {
        current.define('part', {
          name: {
            type: DataTypes.STRING,
            validate: {
              notNull: {
                msg: 'Please enter the part name',
              },
            },
          },
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
            type: DataTypes.TINYINT.UNSIGNED,
          },
        });

        if (['postgres', 'sqlite', 'mssql', 'db2'].includes(dialect)) {
          expect(true).to.equal(console.warn.calledOnce);
          expect(console.warn.args[0][0]).to.contain('does not support \'TINYINT\'');
        } else {
          expect(false).to.equal(console.warn.calledOnce);
        }
      });
    });
  });
});

'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../../support');
const { DataTypes } = require('@sequelize/core');
const sinon = require('sinon');

const current = Support.sequelize;
const dialect = Support.getTestDialect();

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('define', () => {
    it('should allow custom timestamps with underscored: true', () => {
      const User = current.define('User', {}, {
        createdAt: 'createdAt',
        updatedAt: 'updatedAt',
        timestamps: true,
        underscored: true,
      });

      expect(User.getAttributes()).to.haveOwnProperty('createdAt');
      expect(User.getAttributes()).to.haveOwnProperty('updatedAt');

      expect(User.modelDefinition.timestampAttributeNames.createdAt).to.equal('createdAt');
      expect(User.modelDefinition.timestampAttributeNames.updatedAt).to.equal('updatedAt');

      expect(User.getAttributes()).not.to.have.property('created_at');
      expect(User.getAttributes()).not.to.have.property('updated_at');
    });

    it('should throw only when id is added but primaryKey is not set', () => {
      expect(() => {
        current.define('foo', {
          id: DataTypes.INTEGER,
        });
      }).to.throw('An attribute called \'id\' was defined in model \'foos\' but primaryKey is not set. This is likely to be an error, which can be fixed by setting its \'primaryKey\' option to true. If this is intended, explicitly set its \'primaryKey\' option to false');
    });

    it('allows creating an "id" field as the primary key', () => {
      const Bar = current.define('bar', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
        },
      });

      expect(Bar.getAttributes()).to.have.property('id');
      expect(Bar.getAttributes().id.primaryKey).to.equal(true);
    });

    it('allows creating an "id" field explicitly marked as non primary key', () => {
      const Baz = current.define('baz', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: false,
        },
      });

      expect(Baz.getAttributes()).to.have.property('id');
      expect(Baz.getAttributes().id.primaryKey).to.equal(false);
      expect(Baz.primaryKeys).to.deep.eq({});
    });

    it('should not add the default PK when noPrimaryKey is set to true', () => {
      const User = current.define('User', {}, {
        noPrimaryKey: true,
      });

      expect(User.getAttributes()).not.to.have.property('id');
    });

    it('should add the default `id` field PK if noPrimary is not set and no PK has been defined manually', () => {
      const User = current.define('User', {});

      expect(User.getAttributes()).to.have.property('id');
    });

    it('should not add the default `id` field PK if PK has been defined manually', () => {
      const User = current.define('User', {
        customId: {
          type: DataTypes.INTEGER,
          primaryKey: true,
        },
      });

      expect(User.getAttributes()).not.to.have.property('id');
    });

    it('should support noPrimaryKey on Sequelize define option', () => {
      const sequelize = Support.createSequelizeInstance({
        define: {
          noPrimaryKey: true,
        },
      });

      const User = sequelize.define('User', {});

      expect(User.options.noPrimaryKey).to.equal(true);
    });

    it('supports marking an attribute as unique', () => {
      const User = current.define('User', {
        firstName: {
          type: DataTypes.STRING,
          unique: true,
        },
      });

      expect(User.getIndexes()).to.deep.equal([{
        fields: ['firstName'],
        column: 'firstName',
        unique: true,
        name: 'users_first_name_unique',
      }]);
    });

    it('supports marking multiple attributes as composite unique', () => {
      const User = current.define('User', {
        firstName: {
          type: DataTypes.STRING,
          unique: 'firstName-lastName',
        },
        lastName: {
          type: DataTypes.STRING,
          unique: 'firstName-lastName',
        },
      });

      expect(User.getIndexes()).to.deep.equal([{
        fields: ['firstName', 'lastName'],
        column: 'firstName',
        unique: true,
        name: 'firstName-lastName',
      }]);
    });

    it('supports using the same attribute in multiple uniques', () => {
      const User = current.define('User', {
        firstName: {
          type: DataTypes.STRING,
          unique: [true, 'firstName-lastName', 'firstName-country'],
        },
        lastName: {
          type: DataTypes.STRING,
          unique: 'firstName-lastName',
        },
        country: {
          type: DataTypes.STRING,
          unique: 'firstName-country',
        },
      });

      expect(User.getIndexes()).to.deep.equal([
        {
          fields: ['firstName'],
          column: 'firstName',
          unique: true,
          name: 'users_first_name_unique',
        }, {
          fields: ['firstName', 'lastName'],
          column: 'firstName',
          unique: true,
          name: 'firstName-lastName',
        }, {
          fields: ['firstName', 'country'],
          column: 'firstName',
          unique: true,
          name: 'firstName-country',
        },
      ]);
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
      }).to.throw('Attribute "bar.name" does not specify its DataType.');
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
      }).to.throwWithCause(`"notNull" validator is only allowed with "allowNull:false"`);

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
      }).to.throwWithCause(`"notNull" validator is only allowed with "allowNull:false"`);
    });

    it('throws an error if 2 autoIncrements are passed', function () {
      expect(() => {
        this.sequelize.define('UserWithTwoAutoIncrements', {
          userid: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
          userscore: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        });
      }).to.throwWithCause(`Only one autoIncrement attribute is allowed per model, but both 'userscore' and 'userid' are marked as autoIncrement.`);
    });

    describe('datatype warnings', () => {
      beforeEach(() => {
        sinon.spy(console, 'warn');
      });

      afterEach(() => {
        console.warn.restore();
      });

      it('warns for unsupported FLOAT options', () => {
        // must use a new sequelize instance because warnings are only logged once per instance.
        const newSequelize = Support.createSequelizeInstance();

        newSequelize.define('A', {
          age: {
            type: DataTypes.FLOAT(10, 2),
          },
        });

        if (!['mysql', 'mariadb'].includes(dialect)) {
          expect(console.warn.called).to.eq(true, 'console.warn was not called');
          expect(console.warn.args[0][0]).to.contain(`does not support FLOAT with scale or precision specified. These options are ignored.`);
        } else {
          expect(console.warn.called).to.equal(false, 'console.warn was called but it should not have been');
        }
      });
    });
  });
});

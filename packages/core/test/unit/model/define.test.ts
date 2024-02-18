import { DataTypes } from '@sequelize/core';
import { expect } from 'chai';
import sinon from 'sinon';
import { beforeAll2, createSequelizeInstance, getTestDialect, sequelize } from '../../support';

const dialectName = getTestDialect();

describe('Model', () => {
  describe('define', () => {
    it('should allow custom timestamps with underscored: true', () => {
      const User = sequelize.define(
        'User',
        {},
        {
          createdAt: 'createdAt',
          updatedAt: 'updatedAt',
          timestamps: true,
          underscored: true,
        },
      );

      expect(User.getAttributes()).to.haveOwnProperty('createdAt');
      expect(User.getAttributes()).to.haveOwnProperty('updatedAt');

      expect(User.modelDefinition.timestampAttributeNames.createdAt).to.equal('createdAt');
      expect(User.modelDefinition.timestampAttributeNames.updatedAt).to.equal('updatedAt');

      expect(User.getAttributes()).not.to.have.property('created_at');
      expect(User.getAttributes()).not.to.have.property('updated_at');
    });

    it('should throw only when id is added but primaryKey is not set', () => {
      expect(() => {
        sequelize.define('foo', {
          id: DataTypes.INTEGER,
        });
      }).to.throw(
        "An attribute called 'id' was defined in model 'foos' but primaryKey is not set. This is likely to be an error, which can be fixed by setting its 'primaryKey' option to true. If this is intended, explicitly set its 'primaryKey' option to false",
      );
    });

    it('allows creating an "id" field as the primary key', () => {
      const Bar = sequelize.define('bar', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
        },
      });

      expect(Bar.getAttributes()).to.have.property('id');
      expect(Bar.getAttributes().id.primaryKey).to.equal(true);
    });

    it('allows creating an "id" field explicitly marked as non primary key', () => {
      const Baz = sequelize.define('baz', {
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
      const User = sequelize.define(
        'User',
        {},
        {
          noPrimaryKey: true,
        },
      );

      expect(User.getAttributes()).not.to.have.property('id');
    });

    it('should add the default `id` field PK if noPrimary is not set and no PK has been defined manually', () => {
      const User = sequelize.define('User', {});

      expect(User.getAttributes()).to.have.property('id');
    });

    it('should not add the default `id` field PK if PK has been defined manually', () => {
      const User = sequelize.define('User', {
        customId: {
          type: DataTypes.INTEGER,
          primaryKey: true,
        },
      });

      expect(User.getAttributes()).not.to.have.property('id');
    });

    it('should support noPrimaryKey on Sequelize define option', () => {
      const sequelizeNoPk = createSequelizeInstance({
        define: {
          noPrimaryKey: true,
        },
      });

      const User = sequelizeNoPk.define('User', {});

      expect(User.options.noPrimaryKey).to.equal(true);
    });

    it('supports marking an attribute as unique', () => {
      const User = sequelize.define('User', {
        firstName: {
          type: DataTypes.STRING,
          unique: true,
        },
      });

      expect(User.getIndexes()).to.deep.equal([
        {
          fields: ['firstName'],
          column: 'firstName',
          unique: true,
          name: 'users_first_name_unique',
        },
      ]);
    });

    it('supports marking multiple attributes as composite unique', () => {
      const User = sequelize.define('User', {
        firstName: {
          type: DataTypes.STRING,
          unique: 'firstName-lastName',
        },
        lastName: {
          type: DataTypes.STRING,
          unique: 'firstName-lastName',
        },
      });

      expect(User.getIndexes()).to.deep.equal([
        {
          fields: ['firstName', 'lastName'],
          column: 'firstName',
          unique: true,
          name: 'firstName-lastName',
        },
      ]);
    });

    it('supports using the same attribute in multiple uniques', () => {
      const User = sequelize.define('User', {
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
        },
        {
          fields: ['firstName', 'lastName'],
          column: 'firstName',
          unique: true,
          name: 'firstName-lastName',
        },
        {
          fields: ['firstName', 'country'],
          column: 'firstName',
          unique: true,
          name: 'firstName-country',
        },
      ]);
    });

    it('should throw when the attribute name is ambiguous with $nested.attribute$ syntax', () => {
      expect(() => {
        sequelize.define('foo', {
          $id: DataTypes.INTEGER,
        });
      }).to.throw(
        'Name of attribute "$id" in model "foo" cannot start or end with "$" as "$attribute$" is reserved syntax used to reference nested columns in queries.',
      );

      expect(() => {
        sequelize.define('foo', {
          id$: DataTypes.INTEGER,
        });
      }).to.throw(
        'Name of attribute "id$" in model "foo" cannot start or end with "$" as "$attribute$" is reserved syntax used to reference nested columns in queries.',
      );
    });

    it('should throw when the attribute name is ambiguous with json.path syntax', () => {
      expect(() => {
        sequelize.define('foo', {
          'my.attribute': DataTypes.INTEGER,
        });
      }).to.throw(
        'Name of attribute "my.attribute" in model "foo" cannot include the character "." as it would be ambiguous with the syntax used to reference nested columns, and nested json keys, in queries.',
      );
    });

    it('should throw when the attribute name is ambiguous with casting syntax', () => {
      expect(() => {
        sequelize.define('foo', {
          'id::int': DataTypes.INTEGER,
        });
      }).to.throw(
        'Name of attribute "id::int" in model "foo" cannot include the character sequence "::" as it is reserved syntax used to cast attributes in queries.',
      );
    });

    it('should throw when the attribute name is ambiguous with nested-association syntax', () => {
      expect(() => {
        sequelize.define('foo', {
          'my->attribute': DataTypes.INTEGER,
        });
      }).to.throw(
        'Name of attribute "my->attribute" in model "foo" cannot include the character sequence "->" as it is reserved syntax used in SQL generated by Sequelize to target nested associations.',
      );
    });

    it('should defend against null or undefined "unique" attributes', () => {
      expect(() => {
        sequelize.define('baz', {
          foo: {
            type: DataTypes.STRING,
            // @ts-expect-error -- we're testing that it defends against this
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
        sequelize.define('bar', {
          name: {
            // @ts-expect-error -- we're testing that this throws
            type: DataTypes.MY_UNKNOWN_TYPE,
          },
        });
      }).to.throw('Attribute "bar.name" does not specify its DataType.');
    });

    it('should throw for notNull validator without allowNull', () => {
      expect(() => {
        sequelize.define('user', {
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
        sequelize.define('part', {
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

    it('throws an error if 2 autoIncrements are passed', () => {
      expect(() => {
        sequelize.define('UserWithTwoAutoIncrements', {
          userid: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
          userscore: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        });
      }).to.throwWithCause(
        `Only one autoIncrement attribute is allowed per model, but both 'userscore' and 'userid' are marked as autoIncrement.`,
      );
    });

    it('should set the schema to the global value unless another value is provided', () => {
      const sequelizeSchema = createSequelizeInstance({
        define: {
          schema: 'mySchema',
        },
      });

      const Model1 = sequelizeSchema.define('Model1');
      expect(Model1.modelDefinition.table.schema).to.equal('mySchema');

      const Model2 = sequelizeSchema.define('Model2', {}, { schema: undefined });
      expect(Model2.modelDefinition.table.schema).to.equal('mySchema');

      const Model3 = sequelizeSchema.define('Model3', {}, { schema: 'other_schema' });
      expect(Model3.modelDefinition.table.schema).to.equal('other_schema');
    });

    describe('datatype warnings', () => {
      beforeEach(() => {
        sinon.spy(console, 'warn');
      });

      afterEach(() => {
        // @ts-expect-error -- only used in testing
        console.warn.restore();
      });

      it('warns for unsupported FLOAT options', () => {
        // must use a new sequelize instance because warnings are only logged once per instance.
        const newSequelize = createSequelizeInstance();

        newSequelize.define('A', {
          age: {
            type: DataTypes.FLOAT(10, 2),
          },
        });

        if (!['mysql', 'mariadb'].includes(dialectName)) {
          // @ts-expect-error -- only used in testing
          expect(console.warn.called).to.eq(true, 'console.warn was not called');

          // @ts-expect-error -- only used in testing
          const warnings = console.warn.args.map(args => args[0]);
          expect(
            warnings.some((msg: string) =>
              msg.includes(
                `does not support FLOAT with scale or precision specified. These options are ignored.`,
              ),
            ),
          ).to.eq(true, 'warning was not logged');
        } else {
          // @ts-expect-error -- only used in testing
          expect(console.warn.called).to.equal(
            false,
            'console.warn was called but it should not have been',
          );
        }
      });
    });

    describe('with defaultTimestampPrecision', () => {
      describe('not specified', () => {
        it('should add the automatic timestamp columns with the default precision of 6', async () => {
          const newSequelize = createSequelizeInstance();
          const MyModel = newSequelize.define('MyModel', {}, { paranoid: true });

          const { physicalAttributes } = MyModel.modelDefinition;
          expect(physicalAttributes.get('createdAt')).to.have.nested.property(
            'type.options.precision',
            6,
          );
          expect(physicalAttributes.get('updatedAt')).to.have.nested.property(
            'type.options.precision',
            6,
          );
          expect(physicalAttributes.get('deletedAt')).to.have.nested.property(
            'type.options.precision',
            6,
          );
        });
      });

      describe('set to a number', () => {
        it('should add the automatic timestamp columns with the specified precision', async () => {
          const newSequelize = createSequelizeInstance({
            defaultTimestampPrecision: 4,
          });
          const MyModel = newSequelize.define('MyModel', {}, { paranoid: true });

          const { physicalAttributes } = MyModel.modelDefinition;
          expect(physicalAttributes.get('createdAt')).to.have.nested.property(
            'type.options.precision',
            4,
          );
          expect(physicalAttributes.get('updatedAt')).to.have.nested.property(
            'type.options.precision',
            4,
          );
          expect(physicalAttributes.get('deletedAt')).to.have.nested.property(
            'type.options.precision',
            4,
          );
        });
      });

      describe('set to null', () => {
        it('should add the automatic timestamp columns with no specified precision', async () => {
          const newSequelize = createSequelizeInstance({
            defaultTimestampPrecision: null,
          });
          const MyModel = newSequelize.define('MyModel', {}, { paranoid: true });

          const { physicalAttributes } = MyModel.modelDefinition;
          expect(physicalAttributes.get('createdAt')).to.have.nested.property(
            'type.options.precision',
            undefined,
          );
          expect(physicalAttributes.get('updatedAt')).to.have.nested.property(
            'type.options.precision',
            undefined,
          );
          expect(physicalAttributes.get('deletedAt')).to.have.nested.property(
            'type.options.precision',
            undefined,
          );
        });
      });
    });
  });

  describe('afterDefine / beforeDefine', () => {
    const vars = beforeAll2(() => {
      sequelize.hooks.addListener('beforeDefine', (attributes, options) => {
        options.modelName = 'bar';
        options.name!.plural = 'barrs';
        attributes.type = DataTypes.STRING;
      });

      sequelize.hooks.addListener('afterDefine', factory => {
        factory.options.name.singular = 'barr';
      });

      const TestModel = sequelize.define('foo', { name: DataTypes.STRING });

      return { TestModel };
    });

    it('beforeDefine hook can change model name', () => {
      const { TestModel } = vars;
      expect(TestModel.name).to.equal('bar');
    });

    it('beforeDefine hook can alter options', () => {
      const { TestModel } = vars;
      expect(TestModel.options.name.plural).to.equal('barrs');
    });

    it('beforeDefine hook can alter attributes', () => {
      const { TestModel } = vars;
      expect(TestModel.getAttributes().type).to.be.ok;
    });

    it('afterDefine hook can alter options', () => {
      const { TestModel } = vars;
      expect(TestModel.options.name.singular).to.equal('barr');
    });

    after(() => {
      sequelize.hooks.removeAllListeners();
    });
  });
});

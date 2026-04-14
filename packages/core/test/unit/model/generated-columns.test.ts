import { DataTypes, sql } from '@sequelize/core';
import { expect } from 'chai';
import { getTestDialect, getTestDialectClass, sequelize } from '../../support';

const dialectName = getTestDialect();
const generatedColumnSupport = sequelize.dialect.supports.generatedColumns;
const supportedGeneratedColumnMode = generatedColumnSupport.stored ? 'STORED' : 'VIRTUAL';

describe('Model - Generated Columns (unit)', () => {
  describe('validation', () => {
    it('rejects generatedAs without a type', () => {
      expect(() => {
        sequelize.define('Test', {
          fullName: {
            // @ts-expect-error -- testing missing type
            generatedAs: sql.literal("first_name || ' ' || last_name"),
            generatedColumn: 'STORED',
          },
        });
      }).to.throw();
    });

    it('rejects generatedAs with a defaultValue', () => {
      expect(() => {
        sequelize.define('Test', {
          fullName: {
            type: DataTypes.STRING,
            defaultValue: 'hello',
            generatedAs: sql.literal("first_name || ' ' || last_name"),
            generatedColumn: 'STORED',
          },
        });
      }).to.throw(/cannot have a defaultValue/i);
    });

    it('rejects generatedAs with autoIncrement', () => {
      expect(() => {
        sequelize.define('Test', {
          counter: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            generatedAs: sql.literal('id + 1'),
            generatedColumn: 'STORED',
          },
        });
      }).to.throw(/cannot be autoIncrement/i);
    });

    it('rejects generatedAs with a raw string (must use sql.literal)', () => {
      expect(() => {
        sequelize.define('Test', {
          fullName: {
            type: DataTypes.STRING,
            // @ts-expect-error -- testing that raw strings are rejected
            generatedAs: "first_name || ' ' || last_name",
            generatedColumn: 'STORED',
          },
        });
      }).to.throw(/generatedAs.*Sequelize SQL expression/i);
    });

    it('rejects generatedColumn without generatedAs', () => {
      expect(() => {
        sequelize.define('Test', {
          value: {
            type: DataTypes.INTEGER,
            generatedColumn: 'VIRTUAL',
          },
        });
      }).to.throw(/requires "generatedAs"/i);
    });

    it('rejects an invalid generatedColumn mode at runtime', () => {
      expect(() => {
        sequelize.define('Test', {
          value: {
            type: DataTypes.INTEGER,
            generatedAs: sql.literal('1'),
            generatedColumn: 'INVALID' as any,
          },
        });
      }).to.throw(/must be either "STORED" or "VIRTUAL"/i);
    });

    if (!generatedColumnSupport.stored && !generatedColumnSupport.virtual) {
      it('rejects generatedAs on dialects that do not support generated columns', () => {
        expect(() => {
          sequelize.define('Test', {
            fullName: {
              type: DataTypes.STRING,
              generatedAs: sql.literal("first_name || ' ' || last_name"),
              generatedColumn: 'STORED',
            },
          });
        }).to.throw(/does not support generated columns/i);
      });
    }

    if (
      (generatedColumnSupport.stored || generatedColumnSupport.virtual) &&
      !generatedColumnSupport.virtual
    ) {
      it('rejects VIRTUAL generated columns on dialects that only support STORED', () => {
        expect(() => {
          sequelize.define('Test', {
            fullName: {
              type: DataTypes.STRING,
              generatedAs: sql.literal("first_name || ' ' || last_name"),
              generatedColumn: 'VIRTUAL',
            },
          });
        }).to.throw(/does not support VIRTUAL generated columns/i);
      });
    }
  });

  describe('feature flags', () => {
    it('has generatedColumns support flags on the dialect', () => {
      const DialectClass = getTestDialectClass();
      const supports = DialectClass.supports;

      expect(supports).to.have.property('generatedColumns');
      expect(supports.generatedColumns).to.have.property('stored');
      expect(supports.generatedColumns).to.have.property('virtual');

      // Verify the flags are boolean
      expect(supports.generatedColumns.stored).to.be.a('boolean');
      expect(supports.generatedColumns.virtual).to.be.a('boolean');
    });

    // Per-dialect flag verification
    if (dialectName === 'postgres') {
      it('postgres supports STORED but not VIRTUAL generated columns', () => {
        expect(sequelize.dialect.supports.generatedColumns.stored).to.equal(true);
        expect(sequelize.dialect.supports.generatedColumns.virtual).to.equal(false);
      });
    }

    if (dialectName === 'mysql') {
      it('mysql supports both STORED and VIRTUAL generated columns', () => {
        expect(sequelize.dialect.supports.generatedColumns.stored).to.equal(true);
        expect(sequelize.dialect.supports.generatedColumns.virtual).to.equal(true);
      });
    }

    if (dialectName === 'mariadb') {
      it('mariadb supports both STORED and VIRTUAL generated columns', () => {
        expect(sequelize.dialect.supports.generatedColumns.stored).to.equal(true);
        expect(sequelize.dialect.supports.generatedColumns.virtual).to.equal(true);
      });
    }

    if (dialectName === 'sqlite3') {
      it('sqlite3 supports both STORED and VIRTUAL generated columns', () => {
        expect(sequelize.dialect.supports.generatedColumns.stored).to.equal(true);
        expect(sequelize.dialect.supports.generatedColumns.virtual).to.equal(true);
      });
    }

    if (dialectName === 'mssql') {
      it('mssql supports both PERSISTED and non-persisted generated columns', () => {
        expect(sequelize.dialect.supports.generatedColumns.stored).to.equal(true);
        expect(sequelize.dialect.supports.generatedColumns.virtual).to.equal(true);
      });
    }

    if (dialectName === 'oracle') {
      it('oracle supports VIRTUAL but not STORED generated columns', () => {
        expect(sequelize.dialect.supports.generatedColumns.stored).to.equal(false);
        expect(sequelize.dialect.supports.generatedColumns.virtual).to.equal(true);
      });
    }

    if (dialectName === 'db2') {
      it('db2 supports STORED but not VIRTUAL generated columns', () => {
        expect(sequelize.dialect.supports.generatedColumns.stored).to.equal(true);
        expect(sequelize.dialect.supports.generatedColumns.virtual).to.equal(false);
      });
    }

    if (dialectName === 'ibmi') {
      it('ibmi supports STORED but not VIRTUAL generated columns', () => {
        expect(sequelize.dialect.supports.generatedColumns.stored).to.equal(true);
        expect(sequelize.dialect.supports.generatedColumns.virtual).to.equal(false);
      });
    }

    if (dialectName === 'snowflake') {
      it('snowflake does not support generated columns', () => {
        expect(sequelize.dialect.supports.generatedColumns.stored).to.equal(false);
        expect(sequelize.dialect.supports.generatedColumns.virtual).to.equal(false);
      });
    }
  });

  describe('model definition metadata', () => {
    if (!generatedColumnSupport.stored && !generatedColumnSupport.virtual) {
      return;
    }

    it('adds generated columns to readOnlyAttributeNames', () => {
      const TestModel = sequelize.define('Test', {
        firstName: DataTypes.STRING,
        lastName: DataTypes.STRING,
        fullName: {
          type: DataTypes.STRING,
          generatedAs: sql.literal('"firstName" || \' \' || "lastName"'),
          generatedColumn: supportedGeneratedColumnMode,
        },
      });

      expect(TestModel.modelDefinition.readOnlyAttributeNames.has('fullName')).to.equal(true);
      // source columns should NOT be read-only
      expect(TestModel.modelDefinition.readOnlyAttributeNames.has('firstName')).to.equal(false);
      expect(TestModel.modelDefinition.readOnlyAttributeNames.has('lastName')).to.equal(false);
    });

    it('tracks generated columns in generatedAttributeNames', () => {
      const TestModel = sequelize.define('Test', {
        firstName: DataTypes.STRING,
        lastName: DataTypes.STRING,
        fullName: {
          type: DataTypes.STRING,
          generatedAs: sql.literal('"firstName" || \' \' || "lastName"'),
          generatedColumn: supportedGeneratedColumnMode,
        },
      });

      expect(TestModel.modelDefinition.generatedAttributeNames.has('fullName')).to.equal(true);
      expect(TestModel.modelDefinition.generatedAttributeNames.has('firstName')).to.equal(false);
    });

    it('includes generated columns in physicalAttributes', () => {
      const TestModel = sequelize.define('Test', {
        firstName: DataTypes.STRING,
        lastName: DataTypes.STRING,
        fullName: {
          type: DataTypes.STRING,
          generatedAs: sql.literal('"firstName" || \' \' || "lastName"'),
          generatedColumn: supportedGeneratedColumnMode,
        },
      });

      const physicalAttrNames = new Set(TestModel.modelDefinition.physicalAttributes.keys());

      // Generated columns DO exist in the DB as physical columns
      expect(physicalAttrNames.has('fullName')).to.equal(true);
    });

    it('skips validation for generated values', async () => {
      const TestModel = sequelize.define('Test', {
        source: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        generated: {
          type: DataTypes.INTEGER,
          allowNull: false,
          generatedAs: sql.literal('1'),
          generatedColumn: supportedGeneratedColumnMode,
          validate: {
            mustNotRun() {
              throw new Error('generated validator ran');
            },
          },
        },
      });

      const instance = TestModel.build({ source: 1, generated: 123 });

      expect(instance.getDataValue('generated')).to.equal(undefined);
      await expect(instance.validate()).not.to.be.rejected;
    });

    if (generatedColumnSupport.stored) {
      it('defaults generatedColumn to STORED when only generatedAs is provided', () => {
        const TestModel = sequelize.define('Test', {
          firstName: DataTypes.STRING,
          total: {
            type: DataTypes.INTEGER,
            generatedAs: sql.literal('"firstName"'),
          },
        });

        const attrs = TestModel.getAttributes();
        expect(attrs.total.generatedColumn).to.equal('STORED');
      });
    }
  });

  describe('dialect SQL generation', () => {
    if (dialectName === 'mssql') {
      it('preserves constraints on PERSISTED generated columns', () => {
        const primaryKeyDefinition = sequelize.queryGenerator.attributeToSQL({
          type: sequelize.normalizeDataType(DataTypes.INTEGER),
          generatedAs: sql.literal('[source] + 1'),
          generatedColumn: 'STORED',
          primaryKey: true,
        });

        expect(primaryKeyDefinition).to.equal('AS ([source] + 1) PERSISTED PRIMARY KEY');

        const foreignKeyDefinition = sequelize.queryGenerator.attributeToSQL({
          type: sequelize.normalizeDataType(DataTypes.INTEGER),
          generatedAs: sql.literal('[source] + 1'),
          generatedColumn: 'STORED',
          references: { table: 'parents', key: 'id' },
          onDelete: 'CASCADE',
        });

        expect(foreignKeyDefinition).to.equal(
          'AS ([source] + 1) PERSISTED REFERENCES [parents] ([id]) ON DELETE CASCADE',
        );
      });
    }

    if (dialectName === 'oracle') {
      it('generates Oracle VIRTUAL column definitions', () => {
        const definition = sequelize.queryGenerator.attributeToSQL(
          {
            type: sequelize.normalizeDataType(DataTypes.INTEGER),
            generatedAs: sql.literal('"source" + 1'),
            generatedColumn: 'VIRTUAL',
          },
          { attributeName: 'generated' },
        );

        expect(definition).to.equal('INTEGER GENERATED ALWAYS AS ("source" + 1) VIRTUAL');
      });
    }

    if (dialectName === 'sqlite3') {
      it('rejects generated columns as primary keys', () => {
        expect(() =>
          sequelize.queryGenerator.attributesToSQL({
            generated: {
              type: sequelize.normalizeDataType(DataTypes.INTEGER),
              generatedAs: sql.literal('1'),
              generatedColumn: 'STORED',
              primaryKey: true,
            },
          }),
        ).to.throw(/does not support generated columns as primary keys/i);
      });
    }
  });
});

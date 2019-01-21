'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require('./support'),
  DataTypes = require('../../lib/data-types'),
  sequelize = Support.sequelize,
  dialect = Support.getTestDialect();

describe(Support.getTestDialectTeaser('DataTypes'), () => {

  function getInstance(Model) {
    return sequelize.sync({ force: true })
      .then(() => Model.create())
      .then(record => Model.findOne({ where: { id: record.id } }));
  }

  describe('should encode and fetch column default values', () => {

    it('string family', () => {
      const Model = sequelize.define('Defaults', {
        string: {
          type: DataTypes.STRING,
          defaultValue: 'abc\'"\n\r\b\t\\\x1a'
        },
        char: {
          type: DataTypes.CHAR(11),
          defaultValue: 'abc\'"\n\r\b\t\\\x1a'
        },
        text: {
          type: DataTypes.TEXT,
          defaultValue: 'abc\'"\n\r\b\t\\\x1a'
        }
      });

      return getInstance(Model).then(instance => {
        expect(instance.string).to.equal('abc\'"\n\r\b\t\\\x1a');
        expect(instance.char).to.equal('abc\'"\n\r\b\t\\\x1a');
        expect(instance.text).to.equal('abc\'"\n\r\b\t\\\x1a');
      });
    });

    it('integer family', () => {
      const Model = sequelize.define('Defaults', {
        integer: {
          type: DataTypes.INTEGER,
          defaultValue: 1
        },
        smallint: {
          type: DataTypes.SMALLINT,
          defaultValue: 1
        },
        bigint: {
          type: DataTypes.BIGINT,
          defaultValue: 1
        }
      });

      return getInstance(Model).then(instance => {
        expect(instance.integer).to.equal(1);
        expect(instance.smallint).to.equal(1);

        let expectedBigint = 1;
        if (dialect === 'postgres' || dialect === 'mssql') expectedBigint = '1';
        expect(instance.bigint).to.equal(expectedBigint);
      });
    });

    it('float family', () => {
      const Model = sequelize.define('Defaults', {
        float: {
          type: DataTypes.FLOAT,
          defaultValue: 1.1
        },
        real: {
          type: DataTypes.REAL,
          defaultValue: 1.1
        },
        double: {
          type: DataTypes.DOUBLE,
          defaultValue: 1.1
        }
      });

      return getInstance(Model).then(instance => {
        if (dialect === 'mssql') {
          expect(Math.abs(instance.float - 1.1) < 0.000001).to.be.ok;
          expect(Math.abs(instance.real - 1.1) < 0.000001).to.be.ok;
          expect(Math.abs(instance.double - 1.1) < 0.000001).to.be.ok;
        } else {
          expect(instance.float).to.equal(1.1);
          expect(instance.real).to.equal(1.1);
          expect(instance.double).to.equal(1.1);
        }
      });
    });

    it('decimal', () => {
      const Model = sequelize.define('Defaults', {
        decimal: {
          type: DataTypes.DECIMAL(4, 1),
          defaultValue: 1.1
        }
      });

      return getInstance(Model).then(instance => {
        let expected = 1.1;
        if (dialect === 'postgres') expected = '1.1';
        expect(instance.decimal).to.equal(expected);
      });
    });

    it('boolean', () => {
      const Model = sequelize.define('Defaults', {
        boolean: {
          type: DataTypes.BOOLEAN,
          defaultValue: true
        }
      });

      return getInstance(Model).then(instance => {
        expect(instance.boolean).to.equal(true);
      });
    });

    it('time', () => {
      const Model = sequelize.define('Defaults', {
        time: {
          type: DataTypes.TIME,
          defaultValue: '08:15:00'
        }
      });

      return getInstance(Model).then(instance => {
        if (dialect === 'mssql') {
          expect(instance.time.getTime()).to.equal(Date.UTC(1970, 0, 1, 8, 15));
        } else {
          expect(instance.time).to.equal('08:15:00');
        }
      });
    });

    it('date', () => {
      const Model = sequelize.define('Defaults', {
        date: {
          type: DataTypes.DATE,
          defaultValue: new Date(Date.UTC(2000, 0, 1))
        }
      });

      return getInstance(Model).then(instance => {
        expect(instance.date.getTime()).to.equal(Date.UTC(2000, 0, 1));
      });
    });

    it('dateonly', () => {
      const Model = sequelize.define('Defaults', {
        dateonly: {
          type: DataTypes.DATEONLY,
          defaultValue: '2000-01-01'
        }
      });

      return getInstance(Model).then(instance => {
        expect(instance.dateonly).to.equal('2000-01-01');
      });
    });

    it('blob', () => {
      const Model = sequelize.define('Defaults', {
        blob: {
          type: DataTypes.BLOB,
          defaultValue: Buffer.from('Sequelize')
        }
      });

      return getInstance(Model).then(instance => {
        expect(Buffer.from('Sequelize').equals(instance.blob)).to.be.ok;
      });
    });

    it('uuid', () => {
      const Model = sequelize.define('Defaults', {
        uuid: {
          type: DataTypes.UUID,
          defaultValue: '00000000-0000-0000-0000-000000000000'
        }
      });

      return getInstance(Model).then(instance => {
        expect(instance.uuid).to.equal('00000000-0000-0000-0000-000000000000');
      });
    });

    it('enum', () => {
      const Model = sequelize.define('Defaults', {
        enum: {
          type: DataTypes.ENUM('foo', 'bar'),
          defaultValue: 'foo'
        }
      });

      return getInstance(Model).then(instance => {
        expect(instance.enum).to.equal('foo');
      });
    });

    if (dialect !== 'mssql') {
      it('json', () => {
        const Model = sequelize.define('Defaults', {
          json: {
            type: DataTypes.JSON,
            defaultValue: { foo: 'bar' }
          }
        });

        return getInstance(Model).then(instance => {
          expect(instance.json).to.deep.equal({ foo: 'bar' });
        });
      });
    }

    if (dialect !== 'postgres') {
      it('tinyint', () => {
        const Model = sequelize.define('Defaults', {
          tinyint: {
            type: DataTypes.TINYINT,
            defaultValue: 1
          }
        });

        return getInstance(Model).then(instance => {
          expect(instance.tinyint).to.equal(1);
        });
      });
    }

    if (['mysql', 'mariadb', 'sqlite'].includes(dialect)) {
      it('mediumint', () => {
        const Model = sequelize.define('Defaults', {
          mediumint: {
            type: DataTypes.MEDIUMINT,
            defaultValue: 1
          }
        });

        return getInstance(Model).then(instance => {
          expect(instance.mediumint).to.equal(1);
        });
      });
    }

    if (['postgres', 'mysql', 'mariadb'].includes(dialect)) {
      it('geometry', () => {
        const Model = sequelize.define('Defaults', {
          geometry: {
            type: DataTypes.GEOMETRY,
            defaultValue: { type: 'Point', coordinates: [1.234, -4.321] }
          }
        });

        return getInstance(Model).then(instance => {
          expect(instance.geometry).to.deep.equal({ type: 'Point', coordinates: [1.234, -4.321] });
        });
      });
    }

    if (dialect === 'postgres') {
      it('citext', () => {
        const Model = sequelize.define('Defaults', {
          citext: {
            type: DataTypes.CITEXT,
            defaultValue: 'abc\'"\n\r\b\t\\\x1a'
          }
        });

        return getInstance(Model).then(instance => {
          expect(instance.citext).to.deep.equal('abc\'"\n\r\b\t\\\x1a');
        });
      });

      it('hstore', () => {
        const Model = sequelize.define('Defaults', {
          hstore: {
            type: DataTypes.HSTORE,
            defaultValue: { foo: 'bar\'"\n\r\b\t\\\x1a' }
          }
        });

        return getInstance(Model).then(instance => {
          expect(instance.hstore).to.deep.equal({ foo: 'bar\'"\n\r\b\t\\\x1a' });
        });
      });

      it('jsonb', () => {
        const Model = sequelize.define('Defaults', {
          jsonb: {
            type: DataTypes.JSONB,
            defaultValue: { foo: 'bar\'"\n\r\b\t\\\x1a' }
          }
        });

        return getInstance(Model).then(instance => {
          expect(instance.jsonb).to.deep.equal({ foo: 'bar\'"\n\r\b\t\\\x1a' });
        });
      });

      it('range', () => {
        const Model = sequelize.define('Defaults', {
          range: {
            type: DataTypes.RANGE(DataTypes.INTEGER),
            defaultValue: [{ value: 0, inclusive: true }, { value: 3, inclusive: false }]
          }
        });

        return getInstance(Model).then(instance => {
          expect(instance.range).to.deep.equal([{ value: 0, inclusive: true }, { value: 3, inclusive: false }]);
        });
      });

      it('array', () => {
        const Model = sequelize.define('Defaults', {
          array: {
            type: DataTypes.ARRAY(DataTypes.INTEGER),
            defaultValue: [1, 2, 3] 
          }
        });

        return getInstance(Model).then(instance => {
          expect(instance.array).to.deep.equal([1, 2, 3]);
        });
      });

      it('geography', () => {
        const Model = sequelize.define('Defaults', {
          geography: {
            type: DataTypes.GEOGRAPHY,
            defaultValue: { type: 'Point', coordinates: [1.234, -4.321] }
          }
        });

        return getInstance(Model).then(instance => {
          expect(instance.geography).to.deep.equal({ type: 'Point', coordinates: [1.234, -4.321] });
        });
      });

      it('cidr and inet', () => {
        const Model = sequelize.define('Defaults', {
          cidr: {
            type: DataTypes.CIDR,
            defaultValue: '192.168.100.128/25'
          },
          inet: {
            type: DataTypes.INET,
            defaultValue: '192.168.100.128/25'
          }
        });

        return getInstance(Model).then(instance => {
          expect(instance.cidr).to.deep.equal('192.168.100.128/25');
          expect(instance.inet).to.deep.equal('192.168.100.128/25');
        });
      });

      it('macaddr', () => {
        const Model = sequelize.define('Defaults', {
          macaddr: {
            type: DataTypes.MACADDR,
            defaultValue: '00:00:00:00:00:00'
          }
        });

        return getInstance(Model).then(instance => {
          expect(instance.macaddr).to.deep.equal('00:00:00:00:00:00');
        });
      });
    }
  });
});

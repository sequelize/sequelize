'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../support');
const { DataTypes, Op } = require('@sequelize/core');

const current = Support.sequelize;
const dialect = current.dialect;
const invalidWhereError = new Error('Invalid value received for the "where" option.');

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('JSON', () => {
    if (!dialect.supports.dataTypes.JSON) {
      return;
    }

    beforeEach(async function () {
      this.Event = this.sequelize.define('Event', {
        data: {
          // TODO: JSON & JSONB tests should be split
          type: dialect.name === 'postgres' ? DataTypes.JSONB : DataTypes.JSON,
          field: 'event_data',
          // This is only available on JSONB
          index: dialect.name === 'postgres',
        },
        json: DataTypes.JSON,
      });

      await this.Event.sync({ force: true });
    });

    if (current.dialect.supports.lock) {
      it('findOrCreate supports transactions, json and locks', async function () {
        const transaction = await current.startUnmanagedTransaction();

        await this.Event.findOrCreate({
          where: {
            json: { 'some.input:unquote': 'Hello' },
          },
          defaults: {
            json: { some: { input: 'Hello' }, input: [1, 2, 3] },
            data: { some: { input: 'There' }, input: [4, 5, 6] },
          },
          transaction,
          lock: transaction.LOCK.UPDATE,
          logging: sql => {
            if (sql.includes('SELECT') && !sql.includes('CREATE')) {
              expect(sql.includes('FOR UPDATE')).to.be.true;
            }
          },
        });

        const count = await this.Event.count();
        expect(count).to.equal(0);
        await transaction.commit();
        const count0 = await this.Event.count();
        expect(count0).to.equal(1);
      });
    }

    describe('create', () => {
      it('should create an instance with JSON data', async function () {
        await this.Event.create({
          data: {
            name: {
              first: 'Homer',
              last: 'Simpson',
            },
            employment: 'Nuclear Safety Inspector',
          },
        });

        const events = await this.Event.findAll();
        const event = events[0];

        expect(event.get('data')).to.eql({
          name: {
            first: 'Homer',
            last: 'Simpson',
          },
          employment: 'Nuclear Safety Inspector',
        });
      });
    });

    describe('find', () => {
      if (!dialect.supports.jsonOperations) {
        return;
      }

      it('should be possible to query multiple nested values', async function () {
        try {
          await this.Event.create({
            data: {
              name: {
                first: 'Homer',
                last: 'Simpson',
              },
              employment: 'Nuclear Safety Inspector',
            },
          });

          await Promise.all([this.Event.create({
            data: {
              name: {
                first: 'Marge',
                last: 'Simpson',
              },
              employment: 'Housewife',
            },
          }), this.Event.create({
            data: {
              name: {
                first: 'Bart',
                last: 'Simpson',
              },
              employment: 'None',
            },
          })]);

          const events = await this.Event.findAll({
            where: {
              data: {
                name: {
                  last: 'Simpson',
                },
                employment: {
                  [Op.ne]: 'None',
                },
              },
            },
            order: [
              ['id', 'ASC'],
            ],
          });

          if (dialect.name === 'mssql') {
            expect.fail();
          } else {
            expect(events).to.have.length(2);

            expect(events[0].get('data')).to.eql({
              name: {
                first: 'Homer',
                last: 'Simpson',
              },
              employment: 'Nuclear Safety Inspector',
            });

            expect(events[1].get('data')).to.eql({
              name: {
                first: 'Marge',
                last: 'Simpson',
              },
              employment: 'Housewife',
            });
          }
        } catch (error) {
          if (dialect.name === 'mssql') {
            expect(Support.inlineErrorCause(error)).to.include(invalidWhereError.message);
          } else {
            throw error;
          }
        }
      });

      it('should be possible to query a nested value and order results', async function () {
        try {
          await this.Event.create({
            data: {
              name: {
                first: 'Homer',
                last: 'Simpson',
              },
              employment: 'Nuclear Safety Inspector',
            },
          });

          await Promise.all([this.Event.create({
            data: {
              name: {
                first: 'Marge',
                last: 'Simpson',
              },
              employment: 'Housewife',
            },
          }), this.Event.create({
            data: {
              name: {
                first: 'Bart',
                last: 'Simpson',
              },
              employment: 'None',
            },
          })]);

          const events = await this.Event.findAll({
            where: {
              data: {
                name: {
                  last: 'Simpson',
                },
              },
            },
            order: [
              ['data.name.first'],
            ],
          });

          if (dialect.name === 'mssql') {
            expect.fail();
          } else {
            expect(events.length).to.equal(3);

            expect(events[0].get('data')).to.eql({
              name: {
                first: 'Bart',
                last: 'Simpson',
              },
              employment: 'None',
            });

            expect(events[1].get('data')).to.eql({
              name: {
                first: 'Homer',
                last: 'Simpson',
              },
              employment: 'Nuclear Safety Inspector',
            });

            expect(events[2].get('data')).to.eql({
              name: {
                first: 'Marge',
                last: 'Simpson',
              },
              employment: 'Housewife',
            });
          }
        } catch (error) {
          if (dialect.name === 'mssql') {
            expect(Support.inlineErrorCause(error)).to.include(invalidWhereError.message);
          } else {
            throw error;
          }

        }
      });
    });

    describe('destroy', () => {
      if (!dialect.supports.jsonOperations) {
        return;
      }

      it('should be possible to destroy with where', async function () {
        try {
          const conditionSearch = {
            where: {
              data: {
                employment: 'Hacker',
              },
            },
          };

          await Promise.all([this.Event.create({
            data: {
              name: {
                first: 'Elliot',
                last: 'Alderson',
              },
              employment: 'Hacker',
            },
          }), this.Event.create({
            data: {
              name: {
                first: 'Christian',
                last: 'Slater',
              },
              employment: 'Hacker',
            },
          }), this.Event.create({
            data: {
              name: {
                first: ' Tyrell',
                last: 'Wellick',
              },
              employment: 'CTO',
            },
          })]);

          await expect(this.Event.findAll(conditionSearch)).to.eventually.have.length(2);

          if (dialect.name === 'mssql') {
            expect.fail();
          } else {
            await this.Event.destroy(conditionSearch);
            await expect(this.Event.findAll(conditionSearch)).to.eventually.have.length(0);
          }
        } catch (error) {
          if (dialect.name === 'mssql') {
            expect(Support.inlineErrorCause(error)).to.include(invalidWhereError.message);
          } else {
            throw error;
          }
        }
      });
    });

    describe('sql injection attacks', () => {
      beforeEach(async function () {
        this.Model = this.sequelize.define('Model', {
          data: DataTypes.JSON,
        });
        await this.sequelize.sync({ force: true });
      });

      if (dialect.supports.jsonOperations) {
        it('should query an instance with JSONB data and order while trying to inject', async function () {
          try {
            await this.Event.create({
              data: {
                name: {
                  first: 'Homer',
                  last: 'Simpson',
                },
                employment: 'Nuclear Safety Inspector',
              },
            });

            await Promise.all([this.Event.create({
              data: {
                name: {
                  first: 'Marge',
                  last: 'Simpson',
                },
                employment: 'Housewife',
              },
            }), this.Event.create({
              data: {
                name: {
                  first: 'Bart',
                  last: 'Simpson',
                },
                employment: 'None',
              },
            })]);

            const events = await this.Event.findAll({
              where: {
                data: {
                  name: {
                    last: 'Simpson',
                  },
                },
              },
              order: [
                ['data.name.first}\'); INSERT INJECTION HERE! SELECT (\''],
              ],
            });

            if (dialect.name === 'mssql') {
              expect.fail();
            } else {
              expect(events).to.be.ok;
              expect(events[0].get('data')).to.eql({
                name: {
                  first: 'Homer',
                  last: 'Simpson',
                },
                employment: 'Nuclear Safety Inspector',
              });
            }
          } catch (error) {
            if (dialect.name === 'mssql') {
              expect(Support.inlineErrorCause(error)).to.include(invalidWhereError.message);
            } else {
              throw error;
            }
          }
        });
      }
    });
  });
});

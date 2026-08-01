'use strict';

const chai = require('chai');
const expect = chai.expect;
const moment = require('moment');
const Support = require(__dirname + '/../../support');
const dialect = Support.getTestDialect();
const DataTypes = require(__dirname + '/../../../../lib/data-types');

describe('[POSTGRES Specific] Data Types', () => {
  // Reads the server's clock. Assertions about values the database generated (NOW() defaults) have
  // to be bounded by the server's own time rather than the client's, because the two clocks drift.
  function dbNow() {
    return Support.sequelize
      .query('SELECT NOW() AS now', {
        type: Support.sequelize.QueryTypes.SELECT,
        plain: true
      })
      .then((row) => row.now);
  }

  describe('DATE/DATEONLY Validate and Stringify', () => {
    const now = new Date();
    const nowString = now.toISOString();

    it('DATE should validate a Date as normal', () => {
      expect(DataTypes[dialect].DATE().validate(now)).to.equal(true);
      expect(DataTypes[dialect].DATE().validate(nowString)).to.equal(true);
    });

    it('DATE should validate Infinity/-Infinity as true', () => {
      expect(DataTypes[dialect].DATE().validate(Infinity)).to.equal(true);
      expect(DataTypes[dialect].DATE().validate(-Infinity)).to.equal(true);
    });

    it('DATE should stringify Infinity/-Infinity to infinity/-infinity', () => {
      expect(DataTypes[dialect].DATE().stringify(Infinity)).to.equal('Infinity');
      expect(DataTypes[dialect].DATE().stringify(-Infinity)).to.equal('-Infinity');
    });

    it('DATEONLY should stringify Infinity/-Infinity to infinity/-infinity', () => {
      expect(DataTypes[dialect].DATEONLY().stringify(Infinity)).to.equal('Infinity');
      expect(DataTypes[dialect].DATEONLY().stringify(-Infinity)).to.equal('-Infinity');
    });
  });

  describe('DATE/DATEONLY Sanitize', () => {
    const now = new Date();
    const nowString = now.toISOString();
    // DATEONLY._sanitize formats the value in local time, so derive the expected day the same way.
    // Deriving it from the UTC ISO string makes this assertion flaky across the midnight-UTC boundary.
    const nowDateOnly = moment(now).format('YYYY-MM-DD');

    it('DATE should sanitize a Date as normal', () => {
      expect(DataTypes[dialect].DATE()._sanitize(now)).to.equalTime(now);
      expect(DataTypes[dialect].DATE()._sanitize(nowString)).to.equalTime(now);
    });

    it('DATE should sanitize Infinity/-Infinity as Infinity/-Infinity', () => {
      expect(DataTypes[dialect].DATE()._sanitize(Infinity)).to.equal(Infinity);
      expect(DataTypes[dialect].DATE()._sanitize(-Infinity)).to.equal(-Infinity);
    });

    it('DATE should sanitize "Infinity"/"-Infinity" as Infinity/-Infinity', () => {
      expect(DataTypes[dialect].DATE()._sanitize('Infinity')).to.equal(Infinity);
      expect(DataTypes[dialect].DATE()._sanitize('-Infinity')).to.equal(-Infinity);
    });

    it('DATEONLY should sanitize a Date as normal', () => {
      expect(DataTypes[dialect].DATEONLY()._sanitize(now)).to.equal(nowDateOnly);
      expect(DataTypes[dialect].DATEONLY()._sanitize(nowString)).to.equal(nowDateOnly);
    });

    it('DATEONLY should sanitize Infinity/-Infinity as Infinity/-Infinity', () => {
      expect(DataTypes[dialect].DATEONLY()._sanitize(Infinity)).to.equal(Infinity);
      expect(DataTypes[dialect].DATEONLY()._sanitize(-Infinity)).to.equal(-Infinity);
    });

    it('DATEONLY should sanitize "Infinity"/"-Infinity" as Infinity/-Infinity', () => {
      expect(DataTypes[dialect].DATEONLY()._sanitize('Infinity')).to.equal(Infinity);
      expect(DataTypes[dialect].DATEONLY()._sanitize('-Infinity')).to.equal(-Infinity);
    });
  });

  describe('DATE SQL', () => {
    // create dummy user
    it('should be able to create and update records with Infinity/-Infinity', function () {
      this.sequelize.options.typeValidation = true;

      const date = new Date();
      const User = this.sequelize.define(
        'User',
        {
          username: this.sequelize.Sequelize.STRING,
          beforeTime: {
            type: this.sequelize.Sequelize.DATE,
            defaultValue: -Infinity
          },
          sometime: {
            type: this.sequelize.Sequelize.DATE,
            defaultValue: this.sequelize.fn('NOW')
          },
          anotherTime: {
            type: this.sequelize.Sequelize.DATE
          },
          afterTime: {
            type: this.sequelize.Sequelize.DATE,
            defaultValue: Infinity
          }
        },
        {
          timestamps: true
        }
      );

      // `sometime` is filled in by the database's NOW(), so the window it is checked against has to
      // come from the database's clock as well. The Postgres server and the node process do not
      // share a clock -- drift of tens of milliseconds is normal when the server runs in a VM or
      // container -- so a window built from client-side `new Date()` calls could exclude a
      // perfectly good server timestamp.
      let windowStart;

      return User.sync({
        force: true
      })
        .then(() => dbNow())
        .then((now) => {
          windowStart = now;

          return User.create(
            {
              username: 'bob',
              anotherTime: Infinity
            },
            {
              validate: true
            }
          );
        })
        .then((user) => dbNow().then((windowEnd) => ({ user, windowEnd })))
        .then(({ user, windowEnd }) => {
          expect(user.username).to.equal('bob');
          expect(user.beforeTime).to.equal(-Infinity);
          expect(user.sometime).to.be.withinTime(windowStart, windowEnd);
          expect(user.anotherTime).to.equal(Infinity);
          expect(user.afterTime).to.equal(Infinity);

          return user.update(
            {
              sometime: Infinity
            },
            {
              returning: true
            }
          );
        })
        .then((user) => {
          expect(user.sometime).to.equal(Infinity);

          return user.update({
            sometime: Infinity
          });
        })
        .then((user) => {
          expect(user.sometime).to.equal(Infinity);

          return dbNow().then((now) => {
            windowStart = now;

            return user.update(
              {
                sometime: this.sequelize.fn('NOW')
              },
              {
                returning: true
              }
            );
          });
        })
        .then((user) => dbNow().then((windowEnd) => ({ user, windowEnd })))
        .then(({ user, windowEnd }) => {
          expect(user.sometime).to.be.withinTime(windowStart, windowEnd);

          // find
          return User.findAll();
        })
        .then((users) => {
          expect(users[0].beforeTime).to.equal(-Infinity);
          expect(users[0].sometime).to.not.equal(Infinity);
          expect(users[0].afterTime).to.equal(Infinity);

          return users[0].update({
            sometime: date
          });
        })
        .then((user) => {
          expect(user.sometime).to.equalTime(date);

          return user.update({
            sometime: date
          });
        })
        .then((user) => {
          expect(user.sometime).to.equalTime(date);
        });
    });
  });

  describe('DATEONLY SQL', () => {
    // create dummy user
    it('should be able to create and update records with Infinity/-Infinity', function () {
      this.sequelize.options.typeValidation = true;

      const date = new Date();
      const User = this.sequelize.define(
        'User',
        {
          username: this.sequelize.Sequelize.STRING,
          beforeTime: {
            type: this.sequelize.Sequelize.DATEONLY,
            defaultValue: -Infinity
          },
          sometime: {
            type: this.sequelize.Sequelize.DATEONLY,
            defaultValue: this.sequelize.fn('NOW')
          },
          anotherTime: {
            type: this.sequelize.Sequelize.DATEONLY
          },
          afterTime: {
            type: this.sequelize.Sequelize.DATEONLY,
            defaultValue: Infinity
          }
        },
        {
          timestamps: true
        }
      );

      return User.sync({
        force: true
      })
        .then(() => {
          return User.create(
            {
              username: 'bob',
              anotherTime: Infinity
            },
            {
              validate: true
            }
          );
        })
        .then((user) => {
          expect(user.username).to.equal('bob');
          expect(user.beforeTime).to.equal(-Infinity);
          // `sometime` is populated by the DB's NOW() under the connection timezone (UTC by default),
          // so compare against the UTC day to avoid flakiness across the midnight-UTC boundary.
          expect(user.sometime).to.equal(moment.utc(date).format('YYYY-MM-DD'));
          expect(user.anotherTime).to.equal(Infinity);
          expect(user.afterTime).to.equal(Infinity);

          return user.update(
            {
              sometime: Infinity
            },
            {
              returning: true
            }
          );
        })
        .then((user) => {
          expect(user.sometime).to.equal(Infinity);

          return user.update({
            sometime: Infinity
          });
        })
        .then((user) => {
          expect(user.sometime).to.equal(Infinity);

          return user.update(
            {
              sometime: this.sequelize.fn('NOW')
            },
            {
              returning: true
            }
          );
        })
        .then((user) => {
          expect(user.sometime).to.not.equal(Infinity);
          // `sometime` is populated by the DB's NOW() under the connection timezone (UTC by default),
          // so compare against the UTC day to avoid flakiness across the midnight-UTC boundary.
          expect(user.sometime).to.equal(moment.utc(date).format('YYYY-MM-DD'));

          // find
          return User.findAll();
        })
        .then((users) => {
          expect(users[0].beforeTime).to.equal(-Infinity);
          expect(users[0].sometime).to.not.equal(Infinity);
          expect(users[0].afterTime).to.equal(Infinity);

          return users[0].update({
            sometime: '1969-07-20'
          });
        })
        .then((user) => {
          expect(user.sometime).to.equal('1969-07-20');

          return user.update({
            sometime: '1969-07-20'
          });
        })
        .then((user) => {
          expect(user.sometime).to.equal('1969-07-20');
        });
    });
  });
});

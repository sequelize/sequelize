'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require(__dirname + '/../../support'),
  Sequelize = Support.Sequelize,
  dialect = Support.getTestDialect();

if (dialect.match(/^postgres/)) {
  describe('[POSTGRES Specific] Regressions', () => {
    it('properly fetch OIDs after sync, #8749', function() {
      const User = this.sequelize.define('User', {
        active: Sequelize.BOOLEAN
      });

      /**
       * This Model is important, sync will try to fetch OIDs after each ENUM model sync
       * Having ENUM in this model will force OIDs re-fetch
       * We are testing that OID refresh keep base type intact
       */
      const Media = this.sequelize.define('Media', {
        type: Sequelize.ENUM([
          'image', 'video', 'audio'
        ])
      });

      User.hasMany(Media);
      Media.belongsTo(User);

      return this.sequelize
        .sync({ force: true })
        .then(() => User.create({ active: true }))
        .then(user => {
          expect(user.active).to.be.true;
          expect(user.get('active')).to.be.true;

          return User.findOne();
        })
        .then(user => {
          expect(user.active).to.be.true;
          expect(user.get('active')).to.be.true;

          return User.findOne({ raw: true });
        })
        .then(user => {
          expect(user.active).to.be.true;
        });
    });
  });
}

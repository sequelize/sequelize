'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require('../../support'),
  Sequelize = Support.Sequelize,
  dialect = Support.getTestDialect();

if (dialect.match(/^postgres/)) {
  describe('[POSTGRES Specific] Regressions', () => {
    it('properly fetch OIDs after sync, #8749', async function() {
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

      await this.sequelize.sync({ force: true });

      const user1 = await User.create({ active: true });
      expect(user1.active).to.be.true;
      expect(user1.get('active')).to.be.true;

      const user0 = await User.findOne();
      expect(user0.active).to.be.true;
      expect(user0.get('active')).to.be.true;

      const user = await User.findOne({ raw: true });
      expect(user.active).to.be.true;
    });
  });
}

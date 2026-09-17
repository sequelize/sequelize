import { isOffsetTimeZone } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/dayjs.js';
import { expect } from 'chai';

describe('isOffsetTimeZone', () => {
  for (const timeZone of ['+00:00', '+05:30', '-05:00']) {
    it(`returns true for ${timeZone}`, () => {
      expect(isOffsetTimeZone(timeZone)).to.equal(true);
    });
  }

  for (const timeZone of ['Europe/Amsterdam', 'UTC', 'Z', '+05', '+5:00', '+05:00 ']) {
    it(`returns false for ${JSON.stringify(timeZone)}`, () => {
      expect(isOffsetTimeZone(timeZone)).to.equal(false);
    });
  }
});

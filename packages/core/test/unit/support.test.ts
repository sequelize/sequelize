import { expect } from 'chai';
import { useProcessTimezone } from '../support';

describe('useProcessTimezone', () => {
  const originalTimezone = process.env.TZ;

  describe('within the block', () => {
    useProcessTimezone('Asia/Kolkata');

    it('sets the process time zone', () => {
      expect(process.env.TZ).to.equal('Asia/Kolkata');
      expect(new Date('2012-01-10T00:00:00Z').getTimezoneOffset()).to.equal(-330);
    });
  });

  describe('after the block', () => {
    it('restores the previous time zone', () => {
      expect(process.env.TZ).to.equal(originalTimezone);
    });
  });
});

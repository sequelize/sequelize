import * as chai from 'chai';
import * as Timezone from '../../../lib/utils/timezone.js';

const expect = chai.expect;

describe('Utils.Timezone', () => {
  describe('isIanaZone', () => {
    it('accepts IANA zone names', () => {
      for (const zone of ['UTC', 'CET', 'America/New_York', 'Asia/Kathmandu', 'Australia/Lord_Howe', 'Etc/GMT+5']) {
        expect(Timezone.isIanaZone(zone), zone).to.equal(true);
      }
    });

    it('rejects UTC offsets', () => {
      // Intl.DateTimeFormat resolves these as timeZone identifiers, so a bare
      // try/catch would misreport them. Postgres reads a bare offset under the
      // POSIX convention, so getting this wrong inverts the session timezone.
      for (const offset of ['+00:00', '+07:00', '-07:00', '+0530', '-0800', '+05']) {
        expect(Timezone.isIanaZone(offset), offset).to.equal(false);
      }
    });

    it('rejects junk and non-strings', () => {
      for (const value of ['Not/AZone', 'garbage', '', undefined, null, 7, {}]) {
        expect(Timezone.isIanaZone(value), String(value)).to.equal(false);
      }
    });
  });

  describe('parseOffsetMinutes', () => {
    it('parses the accepted offset spellings', () => {
      expect(Timezone.parseOffsetMinutes('+00:00')).to.equal(0);
      expect(Timezone.parseOffsetMinutes('-00:00')).to.equal(0);
      expect(Timezone.parseOffsetMinutes('+07:00')).to.equal(420);
      expect(Timezone.parseOffsetMinutes('-07:00')).to.equal(-420);
      expect(Timezone.parseOffsetMinutes('+05:30')).to.equal(330);
      expect(Timezone.parseOffsetMinutes('-03:30')).to.equal(-210);
      expect(Timezone.parseOffsetMinutes('+0530')).to.equal(330);
      expect(Timezone.parseOffsetMinutes('+05')).to.equal(300);
    });

    it('truncates the sub-minute seconds Intl reports for local mean times', () => {
      expect(Timezone.parseOffsetMinutes('-07:52:58')).to.equal(-472);
    });

    it('returns null for unparseable input', () => {
      for (const value of ['UTC', 'America/New_York', '07:00', '', 'garbage']) {
        expect(Timezone.parseOffsetMinutes(value), value).to.equal(null);
      }
    });
  });

  describe('zoneOffsetMinutes', () => {
    it('resolves fixed-offset zones', () => {
      const date = new Date('2015-01-20T00:00:00.000Z');

      expect(Timezone.zoneOffsetMinutes(date, 'UTC')).to.equal(0);
      expect(Timezone.zoneOffsetMinutes(date, 'CET')).to.equal(60);
      expect(Timezone.zoneOffsetMinutes(date, 'Asia/Kathmandu')).to.equal(345);
    });

    it('resolves the offset in force at the given instant', () => {
      expect(Timezone.zoneOffsetMinutes(new Date('2015-01-20T00:00:00.000Z'), 'America/New_York')).to.equal(-300);
      expect(Timezone.zoneOffsetMinutes(new Date('2015-07-20T00:00:00.000Z'), 'America/New_York')).to.equal(-240);
    });

    it('resolves either side of a DST transition', () => {
      expect(Timezone.zoneOffsetMinutes(new Date('2015-03-08T08:59:59.999Z'), 'America/Denver')).to.equal(-420);
      expect(Timezone.zoneOffsetMinutes(new Date('2015-03-08T09:00:00.000Z'), 'America/Denver')).to.equal(-360);
    });
  });

  describe('formatOffset', () => {
    it('formats minutes east of UTC', () => {
      expect(Timezone.formatOffset(0)).to.equal('+00:00');
      expect(Timezone.formatOffset(420)).to.equal('+07:00');
      expect(Timezone.formatOffset(-420)).to.equal('-07:00');
      expect(Timezone.formatOffset(330)).to.equal('+05:30');
      expect(Timezone.formatOffset(-210)).to.equal('-03:30');
      expect(Timezone.formatOffset(345)).to.equal('+05:45');
    });
  });

  describe('formatWithOffset', () => {
    it('renders the wall clock at the given offset', () => {
      const date = new Date('2015-01-20T00:00:00.000Z');

      expect(Timezone.formatWithOffset(date, 0)).to.equal('2015-01-20 00:00:00.000 +00:00');
      expect(Timezone.formatWithOffset(date, -420)).to.equal('2015-01-19 17:00:00.000 -07:00');
      expect(Timezone.formatWithOffset(date, 330)).to.equal('2015-01-20 05:30:00.000 +05:30');
    });

    it('pads every field', () => {
      expect(Timezone.formatWithOffset(new Date('2015-01-02T03:04:05.006Z'), 0)).to.equal(
        '2015-01-02 03:04:05.006 +00:00'
      );
    });
  });

  describe('toDate', () => {
    it('returns a Date untouched', () => {
      const date = new Date('2000-12-16T10:00:00.000Z');

      expect(Timezone.toDate(date)).to.equal(date);
    });

    it('reads a bare YYYY-MM-DD as local midnight', () => {
      // `new Date('2000-12-16')` reads it as UTC midnight, landing on a different
      // instant on any host west or east of UTC.
      expect(Timezone.toDate('2000-12-16').getTime()).to.equal(new Date(2000, 11, 16).getTime());
    });

    it('reads an offsetless datetime as local time', () => {
      expect(Timezone.toDate('2000-12-16T10:00:00').getTime()).to.equal(new Date(2000, 11, 16, 10).getTime());
    });

    it('honours an explicit offset', () => {
      expect(Timezone.toDate('2000-12-16T10:00:00Z').getTime()).to.equal(Date.parse('2000-12-16T10:00:00Z'));
    });

    it('accepts an epoch millisecond count', () => {
      expect(Timezone.toDate(1000000000000).getTime()).to.equal(1000000000000);
    });

    it('does not remap years 0-99 into the 1900s', () => {
      expect(Timezone.toDate('0075-06-15').getFullYear()).to.equal(75);
    });
  });

  describe('formatDateOnly', () => {
    it('passes a bare YYYY-MM-DD string through unshifted', () => {
      expect(Timezone.formatDateOnly('2011-10-31')).to.equal('2011-10-31');
    });

    it('reduces a Date to its local calendar day', () => {
      expect(Timezone.formatDateOnly(new Date(2011, 9, 31))).to.equal('2011-10-31');
      expect(Timezone.formatDateOnly(new Date(2011, 9, 31, 23, 59, 59))).to.equal('2011-10-31');
    });

    it('reduces a datetime string to its local calendar day', () => {
      expect(Timezone.formatDateOnly('2011-10-31T10:00:00')).to.equal('2011-10-31');
    });
  });
});

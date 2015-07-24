'use strict';

var chai    = require('chai')
  , expect  = chai.expect
  , Support = require(__dirname + '/../../support')
  , DataTypes = require(__dirname + '/../../../../lib/data-types')
  , dialect = Support.getTestDialect()
  , range   = require('../../../../lib/dialects/postgres/range');

if (dialect.match(/^postgres/)) {
  describe('[POSTGRES Specific] range datatype', function () {
    describe('stringify', function () {
      it('should handle empty objects correctly', function () {
        expect(range.stringify([])).to.equal('');
      });

      it('should return empty string when either of boundaries is null', function () {
        expect(range.stringify([null, 'test'])).to.equal('');
        expect(range.stringify([123, null])).to.equal('');
      });

      it('should return empty string when boundaries array of invalid size', function () {
        expect(range.stringify([1])).to.equal('');
        expect(range.stringify([1, 2, 3])).to.equal('');
      });

      it('should return empty string when non-array parameter is passed', function () {
        expect(range.stringify({})).to.equal('');
        expect(range.stringify('test')).to.equal('');
        expect(range.stringify(undefined)).to.equal('');
      });

      it('should handle array of objects with `inclusive` and `value` properties', function () {
        expect(range.stringify([{ inclusive: true, value: 0 }, { value: 1 }])).to.equal('[0,1)');
        expect(range.stringify([{ inclusive: true, value: 0 }, { inclusive: true, value: 1 }])).to.equal('[0,1]');
        expect(range.stringify([{ inclusive: false, value: 0 }, 1])).to.equal('(0,1)');
        expect(range.stringify([0, { inclusive: true, value: 1 }])).to.equal('(0,1]');
      });

      it('should handle inclusive property of input array properly', function () {
        var testRange = [1, 2];

        testRange.inclusive = [true, false];
        expect(range.stringify(testRange)).to.equal('[1,2)');

        testRange.inclusive = [false, true];
        expect(range.stringify(testRange)).to.equal('(1,2]');

        testRange.inclusive = [true, true];
        expect(range.stringify(testRange)).to.equal('[1,2]');

        testRange.inclusive = true;
        expect(range.stringify(testRange)).to.equal('[1,2]');

        testRange.inclusive = false;
        expect(range.stringify(testRange)).to.equal('(1,2)');
      });

      it('should handle date values', function () {
        var Range = new DataTypes.postgres.RANGE(DataTypes.DATE);
        expect(Range.stringify([new Date(Date.UTC(2000, 1, 1)),
                                new Date(Date.UTC(2000, 1, 2))], { timezone: '+02:00' })).to.equal('\'("2000-02-01 02:00:00.000 +02:00","2000-02-02 02:00:00.000 +02:00")\'');
      });
    });

    describe('parse', function () {
      it('should handle a null object correctly', function () {
        expect(range.parse(null)).to.equal(null);
      });

      it('should handle empty string correctly', function () {
        expect(range.parse('')).to.deep.equal('');
      });

      it('should return raw value if not range is returned', function () {
        expect(range.parse('some_non_array')).to.deep.equal('some_non_array');
      });
    });
    describe('stringify and parse', function () {
      it('should stringify then parse back the same structure', function () {
        var testRange = [5,10];
        testRange.inclusive = [true, true];

        var Range = new DataTypes.postgres.RANGE(DataTypes.INTEGER);

        var stringified = Range.stringify(testRange, {});
        stringified = stringified.substr(1, stringified.length - 2); // Remove the escaping ticks

        expect(DataTypes.postgres.RANGE.parse(stringified, 3904, function () { return DataTypes.postgres.INTEGER.parse; })).to.deep.equal(testRange);
      });
    });
  });
}

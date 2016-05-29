'use strict';

var chai    = require('chai')
  , expect  = chai.expect
  , Support = require(__dirname + '/../../support')
  , DataTypes = require(__dirname + '/../../../../lib/data-types')
  , dialect = Support.getTestDialect()
  , range   = require('../../../../lib/dialects/postgres/range')
  , _       = require('lodash');

if (dialect.match(/^postgres/)) {
  // Don't try to load pg until we know we're running on postgres.
  var pg = require('pg');

  describe('[POSTGRES Specific] range datatype', function () {
    describe('stringify', function () {
      it('should handle empty objects correctly', function () {
        expect(range.stringify([])).to.equal('empty');
      });

      it('should handle null as empty bound', function () {
        expect(range.stringify([null, 1])).to.equal('[,1)');
        expect(range.stringify([1, null])).to.equal('[1,)');
        expect(range.stringify([null, null])).to.equal('[,)');
      });

      it('should handle Infinity/-Infinity as infinity/-infinity bounds', function () {
        expect(range.stringify([Infinity, 1])).to.equal('[infinity,1)');
        expect(range.stringify([1, Infinity])).to.equal('[1,infinity)');
        expect(range.stringify([-Infinity, 1])).to.equal('[-infinity,1)');
        expect(range.stringify([1, -Infinity])).to.equal('[1,-infinity)');
        expect(range.stringify([-Infinity, Infinity])).to.equal('[-infinity,infinity)');
      });

      it('should throw error when array length is no 0 or 2', function () {
        expect(function () { range.stringify([1]); }).to.throw();
        expect(function () { range.stringify([1, 2, 3]); }).to.throw();
      });

      it('should throw error when non-array parameter is passed', function () {
        expect(function () { range.stringify({}); }).to.throw();
        expect(function () { range.stringify('test'); }).to.throw();
        expect(function () { range.stringify(undefined); }).to.throw();
      });

      it('should handle array of objects with `inclusive` and `value` properties', function () {
        expect(range.stringify([{ inclusive: true, value: 0 }, { value: 1 }])).to.equal('[0,1)');
        expect(range.stringify([{ inclusive: true, value: 0 }, { inclusive: true, value: 1 }])).to.equal('[0,1]');
        expect(range.stringify([{ inclusive: false, value: 0 }, 1])).to.equal('(0,1)');
        expect(range.stringify([0, { inclusive: true, value: 1 }])).to.equal('[0,1]');
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
                                new Date(Date.UTC(2000, 1, 2))], { timezone: '+02:00' })).to.equal('\'["2000-02-01 02:00:00.000 +02:00","2000-02-02 02:00:00.000 +02:00")\'');
      });
    });

    describe('parse', function () {
      it('should handle a null object correctly', function () {
        expect(range.parse(null)).to.equal(null);
      });

      it('should handle empty range string correctly', function () {
        expect(range.parse('empty')).to.deep.equal(_.extend([], { inclusive: [] }));
      });

      it('should handle empty bounds correctly', function () {
        expect(range.parse('(1,)', DataTypes.postgres.INTEGER.parse)).to.deep.equal(_.extend([1, null], { inclusive: [false, false] }));
        expect(range.parse('(,1)', DataTypes.postgres.INTEGER.parse)).to.deep.equal(_.extend([null, 1], { inclusive: [false, false] }));
        expect(range.parse('(,)', DataTypes.postgres.INTEGER.parse)).to.deep.equal(_.extend([null, null], { inclusive: [false, false] }));
      });

      it('should handle infinity/-infinity bounds correctly', function () {
        expect(range.parse('(infinity,1)', DataTypes.postgres.INTEGER.parse)).to.deep.equal(_.extend([Infinity, 1], { inclusive: [false, false] }));
        expect(range.parse('(1,infinity)',  DataTypes.postgres.INTEGER.parse)).to.deep.equal(_.extend([1, Infinity], { inclusive: [false, false] }));
        expect(range.parse('(-infinity,1)',  DataTypes.postgres.INTEGER.parse)).to.deep.equal(_.extend([-Infinity, 1], { inclusive: [false, false] }));
        expect(range.parse('(1,-infinity)',  DataTypes.postgres.INTEGER.parse)).to.deep.equal(_.extend([1, -Infinity], { inclusive: [false, false] }));
        expect(range.parse('(-infinity,infinity)',  DataTypes.postgres.INTEGER.parse)).to.deep.equal(_.extend([-Infinity, Infinity], { inclusive: [false, false] }));
      });

      it('should return raw value if not range is returned', function () {
        expect(range.parse('some_non_array')).to.deep.equal('some_non_array');
      });

      it('should handle native postgres timestamp format', function () {
        var tsOid = DataTypes.postgres.DATE.types.postgres.oids[0],
            parser = pg.types.getTypeParser(tsOid);
        expect(range.parse('(2016-01-01 08:00:00-04,)', parser)[0].toISOString()).to.equal('2016-01-01T12:00:00.000Z');
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

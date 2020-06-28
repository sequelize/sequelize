'use strict';

const chai = require('chai'),
  expect = chai.expect,
  QuoteHelper = require('../../../../lib/dialects/abstract/query-generator/helpers/quote');

describe('QuoteIdentifier', () => {
  it('unknown dialect', () => {
    expect(QuoteHelper.quoteIdentifier.bind(this, 'unknown', 'id', {})).to.throw(Error);
  });
});

import { expect } from 'chai';
import { parseHstore, stringifyHstore } from './hstore';

describe('stringifyHstore', () => {
  it('should handle empty objects correctly', () => {
    expect(stringifyHstore({})).to.equal('');
  });

  it('should handle null values correctly', () => {
    expect(stringifyHstore({ null: null })).to.equal('"null"=>NULL');
  });

  it('should handle null values correctly', () => {
    expect(stringifyHstore({ foo: null })).to.equal('"foo"=>NULL');
  });

  it('should handle empty string correctly', () => {
    expect(stringifyHstore({ foo: '' })).to.equal('"foo"=>""');
  });

  it('should handle a string with backslashes correctly', () => {
    expect(stringifyHstore({ foo: '\\' })).to.equal('"foo"=>"\\\\"');
  });

  it('should handle a string with double quotes correctly', () => {
    expect(stringifyHstore({ foo: '""a"' })).to.equal('"foo"=>"\\"\\"a\\""');
  });

  it('should handle a string with single quotes correctly', () => {
    expect(stringifyHstore({ foo: "''a'" })).to.equal("\"foo\"=>\"''''a''\"");
  });

  it('should handle simple objects correctly', () => {
    expect(stringifyHstore({ test: 'value' })).to.equal('"test"=>"value"');
  });
});

describe('parseHstore', () => {
  it('should handle empty string correctly', () => {
    expect(parseHstore('"foo"=>""')).to.deep.equal({ foo: '' });
  });

  it('should handle a string with double quotes correctly', () => {
    expect(parseHstore('"foo"=>"\\"\\"a\\""')).to.deep.equal({ foo: '""a"' });
  });

  it('should handle a string with single quotes correctly', () => {
    expect(parseHstore("\"foo\"=>\"''''a''\"")).to.deep.equal({ foo: "''a'" });
  });

  it('should handle a string with backslashes correctly', () => {
    expect(parseHstore('"foo"=>"\\\\"')).to.deep.equal({ foo: '\\' });
  });

  it('should handle empty objects correctly', () => {
    expect(parseHstore('')).to.deep.equal({});
  });

  it('should handle simple objects correctly', () => {
    expect(parseHstore('"test"=>"value"')).to.deep.equal({ test: 'value' });
  });

  // TODO: fork package and fix this
  it.skip('is not vulnerable to prototype injection', () => {
    const out = parseHstore('__proto__=>1');

    expect(Object.keys(out)).to.deep.equal(['__proto__']);
    // eslint-disable-next-line no-proto -- this is not the getter
    expect(out.__proto__).to.equal(1);
  });
});

describe('stringify and parse', () => {
  it('should stringify then parse back the same structure', () => {
    const testObj = {
      foo: 'bar',
      count: '1',
      emptyString: '',
      quotyString: '""',
      extraQuotyString: '"""a"""""',
      backslashes: '\\f023',
      moreBackslashes: '\\f\\0\\2\\1',
      backslashesAndQuotes: '\\"\\"uhoh"\\"',
      nully: null,
    };

    expect(parseHstore(stringifyHstore(testObj))).to.deep.equal(testObj);
    expect(parseHstore(stringifyHstore(parseHstore(stringifyHstore(testObj))))).to.deep.equal(
      testObj,
    );
  });
});

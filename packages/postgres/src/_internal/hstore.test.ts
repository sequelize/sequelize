import { expect } from 'chai';
import { parseHstore, stringifyHstore } from './hstore';

describe('stringifyHstore', () => {
  it('handles empty objects', () => {
    expect(stringifyHstore({})).to.equal('');
  });

  it('handles a simple key/value pair', () => {
    expect(stringifyHstore({ test: 'value' })).to.equal('"test"=>"value"');
  });

  it('handles multiple key/value pairs', () => {
    expect(stringifyHstore({ foo: 'oof', bar: 'rab', baz: 'zab' })).to.equal(
      '"foo"=>"oof","bar"=>"rab","baz"=>"zab"',
    );
  });

  it('handles null values', () => {
    expect(stringifyHstore({ foo: null })).to.equal('"foo"=>NULL');
  });

  it('handles a null string value (not the same as null)', () => {
    expect(stringifyHstore({ foo: 'null' })).to.equal('"foo"=>"null"');
  });

  it('handles empty string values', () => {
    expect(stringifyHstore({ foo: '' })).to.equal('"foo"=>""');
  });

  it('escapes double quotes in values', () => {
    expect(stringifyHstore({ foo: '"bar"' })).to.equal('"foo"=>"\\"bar\\""');
  });

  it('escapes double quotes in keys', () => {
    expect(stringifyHstore({ 'foo "quoted"': 'bar' })).to.equal('"foo \\"quoted\\""=>"bar"');
  });

  it('escapes single quotes in values', () => {
    expect(stringifyHstore({ foo: "it's" })).to.equal('"foo"=>"it\'\'s"');
  });

  it('escapes single quotes in keys', () => {
    expect(stringifyHstore({ "it's": 'bar' })).to.equal('"it\'\'s"=>"bar"');
  });

  it('escapes backslashes in values', () => {
    expect(stringifyHstore({ foo: '\\' })).to.equal('"foo"=>"\\\\"');
    expect(stringifyHstore({ foo: '\\f0123' })).to.equal('"foo"=>"\\\\f0123"');
  });

  it('escapes backslashes in keys', () => {
    expect(stringifyHstore({ '\\key': 'bar' })).to.equal('"\\\\key"=>"bar"');
  });

  it('handles values with colons', () => {
    expect(stringifyHstore({ foo: 'with:colon' })).to.equal('"foo"=>"with:colon"');
  });

  it('handles values with commas', () => {
    expect(stringifyHstore({ foo: 'bar,baz' })).to.equal('"foo"=>"bar,baz"');
  });

  it('handles values with newlines and carriage returns', () => {
    expect(stringifyHstore({ foo: 'line1\nline2', bar: 'a\rb' })).to.equal(
      '"foo"=>"line1\nline2","bar"=>"a\rb"',
    );
  });
});

describe('parseHstore', () => {
  it('handles an empty string', () => {
    expect(parseHstore('')).to.deep.equal({});
  });

  it('handles a simple key/value pair', () => {
    expect(parseHstore('"test"=>"value"')).to.deep.equal({ test: 'value' });
  });

  it('handles multiple key/value pairs', () => {
    expect(parseHstore('"foo"=>"oof","bar"=>"rab","baz"=>"zab"')).to.deep.equal({
      foo: 'oof',
      bar: 'rab',
      baz: 'zab',
    });
  });

  it('handles NULL values', () => {
    expect(parseHstore('"foo"=>"oof","bar"=>NULL,"baz"=>"zab"')).to.deep.equal({
      foo: 'oof',
      bar: null,
      baz: 'zab',
    });
  });

  it('handles empty string values', () => {
    expect(parseHstore('"foo"=>""')).to.deep.equal({ foo: '' });
  });

  it('unescapes double quotes in values', () => {
    expect(parseHstore('"foo"=>"\\"bar\\""')).to.deep.equal({ foo: '"bar"' });
  });

  it('unescapes single quotes in values', () => {
    expect(parseHstore('"foo"=>"it\'\'s"')).to.deep.equal({ foo: "it's" });
  });

  it('unescapes backslashes in values', () => {
    expect(parseHstore('"foo"=>"\\\\"')).to.deep.equal({ foo: '\\' });
    expect(parseHstore('"foo"=>"\\\\f0123"')).to.deep.equal({ foo: '\\f0123' });
  });

  it('handles values with commas', () => {
    expect(parseHstore('"foo"=>"bar,foo,bar"')).to.deep.equal({ foo: 'bar,foo,bar' });
  });

  it('handles values with colons', () => {
    expect(parseHstore('"foo"=>"with:colon"')).to.deep.equal({ foo: 'with:colon' });
  });

  it('handles values with newlines and carriage returns', () => {
    expect(parseHstore('"foo"=>"o\rof","bar"=>NULL,"baz"=>"z\nab"')).to.deep.equal({
      foo: 'o\rof',
      bar: null,
      baz: 'z\nab',
    });
  });

  it('handles values containing embedded JSON-like strings', () => {
    expect(parseHstore('"foo"=>"{\\"key\\":\\"value\\",\\"key2\\":\\"value\\"}"')).to.deep.equal({
      foo: '{"key":"value","key2":"value"}',
    });
  });

  it('handles a URL ending with a backslash', () => {
    expect(parseHstore('"url"=>"http://example.com\\\\","foo"=>"bar"')).to.deep.equal({
      url: 'http://example.com\\',
      foo: 'bar',
    });
  });

  it('is not vulnerable to prototype injection', () => {
    const out = parseHstore('"__proto__"=>"1"');

    // The result should have __proto__ as an own key, not pollute Object.prototype
    expect(Object.keys(out)).to.deep.equal(['__proto__']);
    // eslint-disable-next-line no-proto -- intentionally checking the own property, not the getter
    expect(out.__proto__).to.equal('1');
    // Object.prototype must not be polluted
    expect(({} as any).__proto__).to.equal(Object.prototype); // still the normal prototype chain
  });
});

describe('stringify and parse roundtrip', () => {
  it('roundtrips a complex object', () => {
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
      singleQuotes: "it's a test",
      newlines: 'line1\nline2',
    };

    expect(parseHstore(stringifyHstore(testObj))).to.deep.equal(testObj);
  });

  it('is idempotent across multiple roundtrips', () => {
    const testObj = { foo: 'bar', nully: null, special: '\\"\'' };
    const once = parseHstore(stringifyHstore(testObj));
    const twice = parseHstore(stringifyHstore(once));
    expect(twice).to.deep.equal(testObj);
  });
});

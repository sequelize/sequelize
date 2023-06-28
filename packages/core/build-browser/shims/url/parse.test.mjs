import chai from 'chai';
import parse from './parse.mjs';

const expect = chai.expect;

describe.only('parse', () => {
  it('should parse SQLite URL', () => {
    const url = parse('sqlite://:memory?a=b', true);

    expect(url).to.deep.equal({
      protocol: 'sqlite:',
      host: '',
      port: '',
      hostname: '',
      pathname: '/:memory',
      query: {
        a: 'b',
      },
    });
  });
});

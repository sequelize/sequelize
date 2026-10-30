import { expect } from 'chai';
import { getTimestamp } from './utils.js';

describe('getTimestamp', () => {
  const date = new Date(Date.UTC(2024, 0, 31, 13, 45, 6));

  it('supports the separated format', () => {
    expect(getTimestamp('separated', date)).to.equal('2024-01-31t13-45-06');
  });

  it('supports the compact format', () => {
    expect(getTimestamp('compact', date)).to.equal('20240131134506');
  });
});

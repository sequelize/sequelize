'use strict';

/**
 * Smoke test for UUID wrapper - verifies that the v1 and v4 fallback/native
 * generators function correctly and produce compliant formats.
 */

const { v1, v4 } = require('../../../lib/utils/uuid');
const { expect } = require('chai');

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UUID_V1_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-1[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('UUID Wrapper', () => {
  describe('v4', () => {
    it('returns a string', () => {
      expect(v4()).to.be.a('string');
    });

    it('matches UUID v4 format', () => {
      const id = v4();
      expect(id).to.match(UUID_V4_REGEX);
    });

    it('generates unique values', () => {
      const a = v4();
      const b = v4();
      expect(a).not.to.equal(b);
    });
  });

  describe('v1', () => {
    it('returns a string', () => {
      expect(v1()).to.be.a('string');
    });

    it('matches UUID v1 format', () => {
      const id = v1();
      expect(id).to.match(UUID_V1_REGEX);
    });

    it('generates unique values', () => {
      const a = v1();
      const b = v1();
      expect(a).not.to.equal(b);
    });
  });

  describe('Integration', () => {
    it('src/utils.js loads without error', () => {
      expect(() => {
        require('../../../lib/utils');
      }).not.to.throw();
    });
  });
});

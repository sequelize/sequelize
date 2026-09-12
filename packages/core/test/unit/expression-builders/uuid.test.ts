import { expect } from 'chai';
import sinon from 'sinon';
import { generateUuidV7 } from '../../../lib/expression-builders/uuid.js';

describe('generateUuidV7', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('uses the provided native fn when available', () => {
    const nativeUuidV7 = sinon.stub().returns('native-uuidv7');

    expect(generateUuidV7(nativeUuidV7)).to.equal('native-uuidv7');
    expect(nativeUuidV7.callCount).to.equal(1);
  });

  it('falls back to uuid.v7 when the native fn is unavailable', () => {
    const generatedUuidV7 = generateUuidV7(() => undefined);

    expect(generatedUuidV7).to.match(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });
});

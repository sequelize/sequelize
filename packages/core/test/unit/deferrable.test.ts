import { ConstraintChecking } from '@sequelize/core';
import { expect } from 'chai';

describe('ConstraintChecking', () => {
  for (const name of ['DEFERRED', 'IMMEDIATE'] as const) {
    describe(name, () => {
      const Checking = ConstraintChecking[name];

      it('is the same class on every access', () => {
        expect(ConstraintChecking[name]).to.equal(Checking);
      });

      it('extends ConstraintChecking', () => {
        expect(new Checking()).to.be.instanceOf(ConstraintChecking);
      });

      it('can be constructed without the "new" keyword', () => {
        expect(Checking()).to.be.instanceOf(Checking);
      });

      it('keeps its name', () => {
        expect(Checking.toString()).to.equal(name);
        expect(new Checking().toString()).to.equal(name);
      });

      it('defers all constraints by default', () => {
        expect(new Checking().constraints).to.deep.equal([]);
      });

      it('freezes a copy of the constraints it was given', () => {
        const constraints = ['a', 'b'];
        const checking = new Checking(constraints);

        constraints.push('c');

        expect(checking.constraints).to.deep.equal(['a', 'b']);
        expect(Object.isFrozen(checking.constraints)).to.equal(true);
      });

      it('is equal to another instance covering the same constraints', () => {
        expect(new Checking(['a']).isEqual(new Checking(['a']))).to.equal(true);
        expect(new Checking(['a']).isEqual(new Checking(['b']))).to.equal(false);
        expect(new Checking().isEqual(new Checking())).to.equal(true);
      });

      it('is not equal to a value of another type', () => {
        const other = name === 'DEFERRED' ? 'IMMEDIATE' : 'DEFERRED';

        expect(new Checking().isEqual(new ConstraintChecking[other]())).to.equal(false);
        expect(new Checking().isEqual(null)).to.equal(false);
      });
    });
  }

  it('has no usable implementation of its own', () => {
    expect(() => new ConstraintChecking().constraints).to.throw(
      'constraints getter implementation missing',
    );
    expect(() => new ConstraintChecking().isEqual(null)).to.throw('isEqual implementation missing');
  });
});

import * as chai from 'chai';
import { CLSContext, CLSNamespace, getClsTransactionFor } from '../../lib/cls.js';
import { delay } from '../../lib/utils/promise-helpers.js';
import Support from './support.js';
import { EventEmitter } from 'node:events';

const expect = chai.expect;

const Sequelize = Support.Sequelize;

describe('CLSContext', () => {
  it('returns undefined for an unset key', () => {
    expect(new CLSContext().get('transaction')).to.be.undefined;
  });

  it('walks up the parent chain', () => {
    const parent = new CLSContext();
    parent.values.set('transaction', 'outer');

    expect(new CLSContext(parent).get('transaction')).to.equal('outer');
  });

  it('shadows a parent value rather than overwriting it', () => {
    const parent = new CLSContext();
    parent.values.set('transaction', 'outer');

    const child = new CLSContext(parent);
    child.values.set('transaction', 'inner');

    expect(child.get('transaction')).to.equal('inner');
    expect(parent.get('transaction')).to.equal('outer');
  });

  it('reads a value stored as undefined rather than falling through to the parent', () => {
    const parent = new CLSContext();
    parent.values.set('transaction', 'outer');

    const child = new CLSContext(parent);
    child.values.set('transaction', undefined);

    expect(child.get('transaction')).to.be.undefined;
  });
});

describe('CLSNamespace', () => {
  let ns;

  beforeEach(() => {
    ns = new CLSNamespace();
  });

  describe('outside of a context', () => {
    it('has no active context', () => {
      expect(ns.active).to.be.null;
    });

    it('reads undefined', () => {
      expect(ns.get('transaction')).to.be.undefined;
    });

    it('throws on write, matching cls-hooked', () => {
      expect(() => ns.set('transaction', 'nope')).to.throw('ns.run() must be called first');
    });
  });

  describe('run', () => {
    it('returns the context it ran in, not the return value', () => {
      const returned = ns.run(() => 'ignored');

      expect(returned).to.be.an.instanceOf(CLSContext);
    });

    it('calls the function with the new context', () => {
      let received;

      const context = ns.run((ctx) => {
        received = ctx;
      });

      expect(received).to.equal(context);
    });

    it('makes the context active for the duration of the call', () => {
      const context = ns.run(() => {
        ns.set('transaction', 'inner');
        expect(ns.active).to.equal(ns._activeContext());
        expect(ns.get('transaction')).to.equal('inner');
      });

      expect(context.get('transaction')).to.equal('inner');
      expect(ns.active).to.be.null;
    });

    it('does not leak writes to the enclosing context', () => {
      ns.run(() => {
        ns.set('transaction', 'outer');

        ns.run(() => {
          ns.set('transaction', 'inner');
        });

        expect(ns.get('transaction')).to.equal('outer');
      });
    });

    it('inherits the enclosing context, so a nested run sees the ambient value', () => {
      ns.run(() => {
        ns.set('transaction', 'outer');

        ns.run(() => {
          expect(ns.get('transaction')).to.equal('outer');
        });
      });
    });

    it('sees a write made after an await in the same scope', async () => {
      await ns.runAndReturn(async () => {
        await delay(1);
        ns.set('transaction', 'late');
        await delay(1);

        expect(ns.get('transaction')).to.equal('late');
      });
    });
  });

  describe('runAndReturn', () => {
    it('returns the value of the function', () => {
      expect(ns.runAndReturn(() => 'value')).to.equal('value');
    });

    it('returns the promise of an async function', async () => {
      await expect(ns.runAndReturn(async () => 'value')).to.eventually.equal('value');
    });
  });

  describe('set', () => {
    it('returns the stored value', () => {
      ns.run(() => {
        expect(ns.set('transaction', 'value')).to.equal('value');
      });
    });
  });

  describe('createContext', () => {
    it('inherits from the active context', () => {
      ns.run(() => {
        ns.set('transaction', 'outer');

        expect(ns.createContext().get('transaction')).to.equal('outer');
      });
    });

    it('has no parent outside of a context', () => {
      expect(ns.createContext().parent).to.be.undefined;
    });
  });

  describe('concurrency', () => {
    it('keeps concurrent runs isolated across await boundaries', async () => {
      const task = (value, ms) =>
        ns.runAndReturn(async () => {
          ns.set('transaction', value);
          await delay(ms);
          const midway = ns.get('transaction');
          await delay(ms);

          return [midway, ns.get('transaction')];
        });

      // Deliberately different delays, so the two runs resume interleaved rather than in order.
      const [first, second] = await Promise.all([task('a', 20), task('b', 5)]);

      expect(first).to.deep.equal(['a', 'a']);
      expect(second).to.deep.equal(['b', 'b']);
    });

    it('does not leak a value to code awaiting alongside the run', async () => {
      let seenOutside;

      await Promise.all([
        ns.runAndReturn(async () => {
          ns.set('transaction', 'inner');
          await delay(10);
        }),
        delay(5).then(() => {
          seenOutside = ns.get('transaction');
        })
      ]);

      expect(seenOutside).to.be.undefined;
      expect(ns.get('transaction')).to.be.undefined;
    });

    it('does not leak a value out of a run that threw', async () => {
      await expect(
        ns.runAndReturn(async () => {
          ns.set('transaction', 'inner');
          throw new Error('boom');
        })
      ).to.be.rejectedWith('boom');

      expect(ns.get('transaction')).to.be.undefined;
      expect(ns.active).to.be.null;
    });
  });

  describe('propagation across non-promise async boundaries', () => {
    it('propagates through setTimeout', async () => {
      const seen = await new Promise((resolve) => {
        ns.run(() => {
          ns.set('transaction', 'inner');
          setTimeout(() => resolve(ns.get('transaction')), 1);
        });
      });

      expect(seen).to.equal('inner');
    });

    it('propagates through process.nextTick', async () => {
      const seen = await new Promise((resolve) => {
        ns.run(() => {
          ns.set('transaction', 'inner');
          process.nextTick(() => resolve(ns.get('transaction')));
        });
      });

      expect(seen).to.equal('inner');
    });
  });

  describe('bind', () => {
    it('runs the function in a context inheriting the one active at bind time', () => {
      let bound;

      ns.run(() => {
        ns.set('transaction', 'inner');
        bound = ns.bind(() => ns.get('transaction'));
      });

      expect(ns.get('transaction')).to.be.undefined;
      expect(bound()).to.equal('inner');
    });

    it('passes arguments through and does not leak to the caller', () => {
      let bound;

      ns.run(() => {
        ns.set('transaction', 'inner');
        bound = ns.bind((suffix) => ns.get('transaction') + suffix);
      });

      expect(bound('!')).to.equal('inner!');
      expect(ns.get('transaction')).to.be.undefined;
    });

    it('binds to an explicitly supplied context', () => {
      const context = ns.createContext();
      context.values.set('transaction', 'supplied');

      expect(ns.bind(() => ns.get('transaction'), context)()).to.equal('supplied');
    });

    it('carries context into an event listener registered inside a run', () => {
      const emitter = new EventEmitter();
      let seen;

      ns.run(() => {
        ns.set('transaction', 'inner');
        emitter.on(
          'done',
          ns.bind(() => (seen = ns.get('transaction')))
        );
      });

      emitter.emit('done');

      expect(seen).to.equal('inner');
    });
  });

  describe('_activeContext override', () => {
    // The documented way for a consumer to get `enter`/`exit` back, since the namespace
    // deliberately does not implement them.
    class HarnessNamespace extends CLSNamespace {
      _activeContext() {
        return super._activeContext() || this._entered;
      }

      enter(context) {
        this._entered = context;
      }

      exit(context) {
        if (this._entered === context) {
          this._entered = undefined;
        }
      }
    }

    it('supplies an ambient context for reads and writes outside any run', () => {
      const harness = new HarnessNamespace();
      const context = harness.createContext();

      harness.enter(context);
      harness.set('transaction', 'entered');

      expect(harness.get('transaction')).to.equal('entered');
      expect(harness.active).to.equal(context);

      harness.exit(context);

      expect(harness.get('transaction')).to.be.undefined;
      expect(harness.active).to.be.null;
    });

    it('lets a run shadow the entered context', () => {
      const harness = new HarnessNamespace();
      const context = harness.createContext();

      harness.enter(context);
      harness.set('transaction', 'entered');

      harness.run(() => {
        expect(harness.get('transaction')).to.equal('entered');
        harness.set('transaction', 'inner');
      });

      expect(harness.get('transaction')).to.equal('entered');
    });
  });
});

describe('Sequelize.createCLSNamespace', () => {
  it('returns a CLSNamespace', () => {
    expect(Sequelize.createCLSNamespace()).to.be.an.instanceOf(CLSNamespace);
  });

  it('defaults the name to sequelize', () => {
    expect(Sequelize.createCLSNamespace().name).to.equal('sequelize');
    expect(Sequelize.createCLSNamespace('other').name).to.equal('other');
  });
});

describe('Sequelize.useCLS', () => {
  let previous;

  beforeEach(() => {
    previous = Sequelize._cls;
    delete Sequelize._cls;
  });

  afterEach(() => {
    if (previous) {
      Sequelize._cls = previous;
    } else {
      delete Sequelize._cls;
    }
  });

  it('installs the namespace and returns Sequelize for chaining', () => {
    const ns = Sequelize.createCLSNamespace();

    expect(Sequelize.useCLS(ns)).to.equal(Sequelize);
    expect(Sequelize._cls).to.equal(ns);
  });

  it('rejects anything that is not namespace shaped', () => {
    for (const invalid of [undefined, null, 'sequelize', {}, { run() {} }, { bind() {} }]) {
      expect(() => Sequelize.useCLS(invalid)).to.throw('Must provide CLS namespace');
    }

    expect(Sequelize._cls).to.be.undefined;
  });

  it('accepts any duck-typed namespace, not just this one', () => {
    const ns = { bind() {}, run() {} };

    Sequelize.useCLS(ns);

    expect(Sequelize._cls).to.equal(ns);
  });

  describe('_clsRun', () => {
    it('runs the function normally with no namespace installed', () => {
      expect(Sequelize._clsRun(() => 'value')).to.equal('value');
    });

    it('returns the value from inside the context, not the context', () => {
      const ns = Sequelize.createCLSNamespace();
      Sequelize.useCLS(ns);

      expect(
        Sequelize._clsRun((context) => {
          ns.set('transaction', 'inner');

          return context.get('transaction');
        })
      ).to.equal('inner');

      expect(ns.get('transaction')).to.be.undefined;
    });
  });
});

describe('getClsTransactionFor', () => {
  let previous;
  let ns;
  let sequelize;

  beforeEach(() => {
    previous = Sequelize._cls;
    ns = Sequelize.createCLSNamespace();
    Sequelize.useCLS(ns);
    sequelize = Support.createSequelizeInstance();
  });

  afterEach(() => {
    if (previous) {
      Sequelize._cls = previous;
    } else {
      delete Sequelize._cls;
    }
  });

  it('returns undefined with no namespace installed', () => {
    delete Sequelize._cls;

    expect(getClsTransactionFor(sequelize)).to.be.undefined;
  });

  it('returns undefined outside of any context', () => {
    expect(getClsTransactionFor(sequelize)).to.be.undefined;
  });

  it('returns undefined when the context holds no transaction', () => {
    ns.run(() => {
      expect(getClsTransactionFor(sequelize)).to.be.undefined;
    });
  });

  it('returns a transaction belonging to the instance', () => {
    const transaction = { sequelize };

    ns.run(() => {
      ns.set('transaction', transaction);

      expect(getClsTransactionFor(sequelize)).to.equal(transaction);
    });
  });

  it('ignores a transaction belonging to another instance', () => {
    const other = Support.createSequelizeInstance();

    ns.run(() => {
      ns.set('transaction', { sequelize: other });

      expect(getClsTransactionFor(sequelize)).to.be.undefined;
      expect(ns.get('transaction')).to.not.be.undefined;
    });
  });
});

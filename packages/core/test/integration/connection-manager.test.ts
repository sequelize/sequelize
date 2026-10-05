import { expect } from 'chai';
import type { SinonFakeTimers } from 'sinon';
import { sequelize, useFakeTimers } from './support';

describe('ConnectionManager', () => {
  // pg-native's Client#end() calls the global setImmediate, so it never resolves under fake timers
  if (process.env.DIALECT === 'postgres-native') {
    return;
  }

  let clock: SinonFakeTimers | undefined;

  afterEach(() => {
    clock?.restore();
    clock = undefined;
  });

  it('connects and disconnects while fake timers are installed', async () => {
    const { connectionManager } = sequelize.dialect;
    const connectionOptions = sequelize.options.replication.write;

    clock = useFakeTimers();

    const connection = await connectionManager.connect(connectionOptions);
    expect(connectionManager.validate(connection)).to.equal(true);

    await connectionManager.disconnect(connection);
  });
});

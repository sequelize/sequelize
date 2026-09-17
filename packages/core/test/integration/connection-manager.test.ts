import { expect } from 'chai';
import type { SinonFakeTimers } from 'sinon';
import sinon from 'sinon';
import { sequelize } from './support';

describe('ConnectionManager', () => {
  let clock: SinonFakeTimers | undefined;

  afterEach(() => {
    clock?.restore();
    clock = undefined;
  });

  it('connects and disconnects while fake timers are installed', async () => {
    const { connectionManager } = sequelize.dialect;
    const connectionOptions = sequelize.options.replication.write;

    clock = sinon.useFakeTimers();

    const connection = await connectionManager.connect(connectionOptions);
    expect(connectionManager.validate(connection)).to.equal(true);

    await connectionManager.disconnect(connection);
  });
});

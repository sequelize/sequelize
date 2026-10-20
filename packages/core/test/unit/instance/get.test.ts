import { DataTypes } from '@sequelize/core';
import { expect } from 'chai';
import sinon from 'sinon';
import { beforeEach2, sequelize } from '../../support';

describe('Model#get', () => {
  const vars = beforeEach2(() => {
    const getSpy = sinon.spy();
    const User = sequelize.define('User', {
      name: {
        type: DataTypes.STRING,
        get: getSpy,
      },
    });

    return { getSpy, User };
  });

  it('invokes getter if raw: false', () => {
    vars.User.build().get('name');

    expect(vars.getSpy).to.have.been.called;
  });

  it('does not invoke getter if raw: true', () => {
    vars.User.build().get('name', { raw: true });

    expect(vars.getSpy).not.to.have.been.called;
  });
});

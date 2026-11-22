import { expect } from 'chai';
import sinon from 'sinon';
import { sequelize } from '../../support';

describe('QueryInterface#addIndex', () => {
  if (sequelize.dialect.name === 'snowflake') {
    return;
  }

  afterEach(() => {
    sinon.restore();
  });

  // TODO: rawTablename should be used to generate the index name ("custom_name_my_column"),
  //  but addIndex does not pass it to addIndexQuery correctly. See the TODO in QueryInterface#addIndex.
  //  These tests document the current behavior, update them once that is fixed.
  it('ignores rawTablename when generating the index name (attributes, options, rawTablename)', async () => {
    const stub = sinon.stub(sequelize, 'queryRaw').resolves([[], 0]);

    await sequelize.queryInterface.addIndex('myTable', ['myColumn'], {}, 'customName');

    expect(stub.callCount).to.equal(1);
    expect(stub.firstCall.args[0]).to.include('my_table_my_column');
    expect(stub.firstCall.args[0]).not.to.include('custom_name');
  });

  it('ignores rawTablename when generating the index name (options, rawTablename)', async () => {
    const stub = sinon.stub(sequelize, 'queryRaw').resolves([[], 0]);

    await sequelize.queryInterface.addIndex('myTable', { fields: ['myColumn'] }, 'customName');

    expect(stub.callCount).to.equal(1);
    expect(stub.firstCall.args[0]).to.include('my_table_my_column');
    expect(stub.firstCall.args[0]).not.to.include('custom_name');
  });

  it('uses rawTablename when calling addIndexQuery with it as the fourth argument', () => {
    const sql = sequelize.queryGenerator.addIndexQuery('myTable', ['myColumn'], {}, 'customName');

    expect(sql).to.include('custom_name_my_column');
  });
});

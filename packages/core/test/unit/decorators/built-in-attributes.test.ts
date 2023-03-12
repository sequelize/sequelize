import { expect } from 'chai';
import { Model } from '@sequelize/core';
import { CreatedAt, DeletedAt, UpdatedAt, Version } from '@sequelize/core/decorators-legacy';
import { sequelize } from '../../support';

describe('@CreatedAt', () => {
  it('marks a column as the createdAt attribute', () => {
    class Test extends Model {
      @CreatedAt
      declare customCreatedAt: Date;
    }

    sequelize.addModels([Test]);

    expect(Test.modelDefinition.timestampAttributeNames).to.deep.equal({
      createdAt: 'customCreatedAt',
      updatedAt: 'updatedAt',
    });
  });
});

describe('@UpdatedAt', () => {
  it('marks a column as the createdAt attribute', () => {
    class Test extends Model {
      @UpdatedAt
      declare customUpdatedAt: Date;
    }

    sequelize.addModels([Test]);

    expect(Test.modelDefinition.timestampAttributeNames).to.deep.equal({
      createdAt: 'createdAt',
      updatedAt: 'customUpdatedAt',
    });
  });
});

describe('@DeletedAt', () => {
  it('marks a column as the createdAt attribute', () => {
    class Test extends Model {
      @DeletedAt
      declare customDeletedAt: Date | null;
    }

    sequelize.addModels([Test]);

    expect(Test.modelDefinition.options.paranoid).to.be.true;
    expect(Test.modelDefinition.timestampAttributeNames).to.deep.equal({
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
      deletedAt: 'customDeletedAt',
    });
  });
});

describe('@Version', () => {
  it('marks a column as the createdAt attribute', () => {
    class Test extends Model {
      @Version
      declare customVersionAttribute: number;
    }

    sequelize.addModels([Test]);

    expect(Test.modelDefinition.versionAttributeName).to.equal('customVersionAttribute');
  });
});

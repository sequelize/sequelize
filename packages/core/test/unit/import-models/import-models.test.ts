import { expect } from 'chai';
import type { ModelStatic } from '@sequelize/core';
import { importModels } from '@sequelize/core';
// @ts-expect-error -- commonjs file
import Node from './models/node.abstract';
// @ts-expect-error -- commonjs file
import User from './models/user';

describe('importModels', () => {
  it('can import models using a single glob path', async () => {
    const models = await importModels(`${__dirname}/models/*.{ts,js}`);

    expect(models).to.have.length(2);
    expect(models[0]).to.eq(Node);
    expect(models[1]).to.eq(User);
  });

  it('can import models using multiple glob paths', async () => {
    const models = await importModels([`${__dirname}/models/node.abstract.js`, `${__dirname}/models/user.js`]);

    expect(models).to.have.length(2);
    expect(models[0]).to.eq(Node);
    expect(models[1]).to.eq(User);
  });

  it('can exclude results using the second parameter', async () => {
    const calls: Array<{ path: string, exportName: string, exportValue: ModelStatic }> = [];

    const models = await importModels([`${__dirname}/models/*.{ts,js}`], (path: string, exportName: string, exportValue: ModelStatic) => {
      calls.push({ path, exportName, exportValue });

      return false;
    });

    expect(models.length).to.eq(0);

    expect(calls[0].path.endsWith('test/unit/import-models/models/node.abstract.js'));
    expect(calls[0].exportName).to.eq('default');
    expect(calls[0].exportValue).to.eq(Node);

    expect(calls[1].exportValue).to.eq(User);
  });
});

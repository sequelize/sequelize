import type { ModelStatic } from '@sequelize/core';
import { importModels } from '@sequelize/core';
import { expect } from 'chai';
import glob from 'fast-glob';
// @ts-expect-error -- commonjs file
import { Bundler } from './models/bundler';
// @ts-expect-error -- commonjs file
import Node from './models/node.abstract';
// @ts-expect-error -- commonjs file
import User from './models/user';

describe('importModels', () => {
  const dirname = glob.convertPathToPattern(__dirname);

  it('can import models using a single glob path', async () => {
    const models = await importModels(`${dirname}/models/*.{ts,js}`);

    expect(models).to.have.length(3);
    expect(models[0]).to.eq(Bundler);
    expect(models[1]).to.eq(Node);
    expect(models[2]).to.eq(User);
  });

  it('can import models using multiple glob paths', async () => {
    const models = await importModels([
      `${dirname}/models/bundler.js`,
      `${dirname}/models/node.abstract.js`,
      `${dirname}/models/user.js`,
    ]);

    expect(models).to.have.length(3);
    expect(models[0]).to.eq(Bundler);
    expect(models[1]).to.eq(Node);
    expect(models[2]).to.eq(User);
  });

  it('can exclude results using the second parameter', async () => {
    const calls: Array<{ path: string; exportName: string; exportValue: ModelStatic }> = [];

    const models = await importModels(
      [`${dirname}/models/*.{ts,js}`],
      (path: string, exportName: string, exportValue: ModelStatic) => {
        calls.push({ path, exportName, exportValue });

        return false;
      },
    );

    expect(models.length).to.eq(0);

    expect(calls.some(c => c.exportValue === Bundler)).to.be.true;
    expect(calls.some(c => c.exportValue === User)).to.be.true;

    const nodeCall = calls.find(c => c.exportValue === Node);
    expect(nodeCall).to.exist;
    expect(nodeCall!.path.endsWith('test/unit/import-models/models/node.abstract.js')).to.be.true;
    expect(nodeCall!.exportName).to.eq('default');
  });
});

import { runCommand } from '@oclif/test';
import { fileUrlToDirname } from '@sequelize/utils/node';
import { expect } from 'chai';
import { join } from 'node:path';
import { resetMigrations } from '../../_internal/test-helpers.js';

const __dirname = fileUrlToDirname(import.meta.url);
const packageRoot = join(__dirname, '..', '..', '..');

const FIXTURES = [
  {
    name: '2024-01-01-create-users',
    up: 'CREATE TABLE users (id INTEGER PRIMARY KEY);',
    down: 'DROP TABLE users;',
  },
  {
    name: '2024-01-02-create-posts',
    up: 'CREATE TABLE posts (id INTEGER PRIMARY KEY);',
    down: 'DROP TABLE posts;',
  },
  {
    name: '2024-01-03-create-comments',
    up: 'CREATE TABLE comments (id INTEGER PRIMARY KEY);',
    down: 'DROP TABLE comments;',
  },
];

describe('migration:undo', function () {
  this.timeout(15_000);
  beforeEach(async () => resetMigrations(FIXTURES));

  it('reverts the last migration by default', async () => {
    await runCommand(['migration:run'], { root: packageRoot });
    const { stdout } = await runCommand(['migration:undo', '--json'], { root: packageRoot });
    const result = JSON.parse(stdout);
    expect(result.reverted).to.deep.equal(['2024-01-03-create-comments']);
  });

  it('respects --step', async () => {
    await runCommand(['migration:run'], { root: packageRoot });
    const { stdout } = await runCommand(['migration:undo', '--step=2', '--json'], {
      root: packageRoot,
    });
    const result = JSON.parse(stdout);
    expect(result.reverted).to.deep.equal([
      '2024-01-03-create-comments',
      '2024-01-02-create-posts',
    ]);
  });

  it('reverts all migrations with --all', async () => {
    await runCommand(['migration:run'], { root: packageRoot });
    const { stdout } = await runCommand(['migration:undo', '--all', '--json'], {
      root: packageRoot,
    });
    const result = JSON.parse(stdout);
    expect(result.reverted).to.deep.equal([
      '2024-01-03-create-comments',
      '2024-01-02-create-posts',
      '2024-01-01-create-users',
    ]);
  });

  it('reverts down to and including --to', async () => {
    await runCommand(['migration:run'], { root: packageRoot });
    const { stdout } = await runCommand(
      ['migration:undo', '--to=2024-01-02-create-posts', '--json'],
      { root: packageRoot },
    );
    const result = JSON.parse(stdout);
    expect(result.reverted).to.deep.equal([
      '2024-01-03-create-comments',
      '2024-01-02-create-posts',
    ]);
  });

  it('returns zero count when there are no executed migrations', async () => {
    const { stdout } = await runCommand(['migration:undo', '--json'], { root: packageRoot });
    const result = JSON.parse(stdout);
    expect(result.reverted).to.deep.equal([]);
  });
});

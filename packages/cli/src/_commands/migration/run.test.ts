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
const NAMES = FIXTURES.map(f => f.name);

describe('migration:run', function () {
  this.timeout(15_000);
  beforeEach(async () => resetMigrations(FIXTURES));

  it('runs all pending migrations and returns JSON', async () => {
    const { stdout } = await runCommand(['migration:run', '--json'], { root: packageRoot });
    const result = JSON.parse(stdout);
    expect(result.count).to.equal(3);
    expect(result.migrations).to.deep.equal(NAMES);
  });

  it('returns zero count when there are no pending migrations', async () => {
    await runCommand(['migration:run'], { root: packageRoot });
    const { stdout } = await runCommand(['migration:run', '--json'], { root: packageRoot });
    const result = JSON.parse(stdout);
    expect(result.count).to.equal(0);
    expect(result.migrations).to.deep.equal([]);
  });

  it('respects --step', async () => {
    const { stdout } = await runCommand(['migration:run', '--step=2', '--json'], {
      root: packageRoot,
    });
    const result = JSON.parse(stdout);
    expect(result.count).to.equal(2);
    expect(result.migrations).to.deep.equal(['2024-01-01-create-users', '2024-01-02-create-posts']);
  });

  it('respects --to', async () => {
    const { stdout } = await runCommand(
      ['migration:run', '--to=2024-01-02-create-posts', '--json'],
      { root: packageRoot },
    );
    const result = JSON.parse(stdout);
    expect(result.count).to.equal(2);
    expect(result.migrations).to.deep.equal(['2024-01-01-create-users', '2024-01-02-create-posts']);
  });
});

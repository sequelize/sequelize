import { runCommand } from '@oclif/test';
import { fileUrlToDirname } from '@sequelize/utils/node';
import { expect } from 'chai';
import { rm } from 'node:fs/promises';
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

describe('migration:status', function () {
  this.timeout(15_000);
  beforeEach(async () => resetMigrations(FIXTURES));

  it('shows all as pending before any run', async () => {
    const { stdout, stderr } = await runCommand(['migration:status', '--json'], {
      root: packageRoot,
    });

    expect(stderr).to.equal('');
    const result = JSON.parse(stdout);
    expect(result.migrated).to.deep.equal([]);
    expect(result.pending).to.deep.equal(NAMES);
  });

  it('shows all as migrated after a full run', async () => {
    await runCommand(['migration:run'], { root: packageRoot });
    const { stdout } = await runCommand(['migration:status', '--json'], { root: packageRoot });
    const result = JSON.parse(stdout);
    expect(result.migrated).to.deep.equal(NAMES);
    expect(result.pending).to.deep.equal([]);
  });

  it('correctly splits migrated and pending after a partial run', async () => {
    await runCommand(['migration:run', '--step=2'], { root: packageRoot });
    const { stdout } = await runCommand(['migration:status', '--json'], { root: packageRoot });
    const result = JSON.parse(stdout);
    expect(result.migrated).to.deep.equal(['2024-01-01-create-users', '2024-01-02-create-posts']);
    expect(result.pending).to.deep.equal(['2024-01-03-create-comments']);
  });
});

describe('migration:status (special cases)', function () {
  this.timeout(15_000);

  it('does not error on empty migration folder', async () => {
    await resetMigrations([]);

    const { stdout, stderr } = await runCommand(['migration:status', '--json'], {
      root: packageRoot,
    });

    expect(stderr).to.equal('');
    const result = JSON.parse(stdout);
    expect(result.migrated).to.deep.equal([]);
    expect(result.pending).to.deep.equal([]);
  });

  it('errors on missing migration folder', async () => {
    await rm(join(packageRoot, 'migrations'), { recursive: true, force: true });

    const { stdout, stderr } = await runCommand(['migration:status', '--json'], {
      root: packageRoot,
    });

    expect(stderr).to.equal('');
    const result = JSON.parse(stdout);
    expect(result.error.message).to.contain('Migration folder not found at path');
  });
});

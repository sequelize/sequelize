import { runCommand } from '@oclif/test';
import { fileUrlToDirname } from '@sequelize/utils/node';
import { expect } from 'chai';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { resetMigrations } from '../../_internal/test-helpers.js';

const __dirname = fileUrlToDirname(import.meta.url);
const packageRoot = join(__dirname, '..', '..', '..');

describe('migration:run', function () {
  this.timeout(15_000);

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

  beforeEach(async () => resetMigrations(FIXTURES));

  it('runs all pending migrations and returns JSON', async () => {
    const { stdout } = await runCommand(['migration:run', '--json'], { root: packageRoot });
    const result = JSON.parse(stdout);
    expect(result.migrated).to.deep.equal(NAMES);
  });

  it('returns zero count when there are no pending migrations', async () => {
    await runCommand(['migration:run'], { root: packageRoot });
    const { stdout } = await runCommand(['migration:run', '--json'], { root: packageRoot });
    const result = JSON.parse(stdout);
    expect(result.migrated).to.deep.equal([]);
  });

  it('respects --step', async () => {
    const { stdout } = await runCommand(['migration:run', '--step=2', '--json'], {
      root: packageRoot,
    });
    const result = JSON.parse(stdout);
    expect(result.migrated).to.deep.equal(['2024-01-01-create-users', '2024-01-02-create-posts']);
  });

  it('respects --to', async () => {
    const { stdout } = await runCommand(
      ['migration:run', '--to=2024-01-02-create-posts', '--json'],
      { root: packageRoot },
    );

    const result = JSON.parse(stdout);
    expect(result.migrated).to.deep.equal(['2024-01-01-create-users', '2024-01-02-create-posts']);
  });
});

describe('migration:run (special cases)', function () {
  this.timeout(15_000);

  it('runs JavaScript migrations whose filenames need URL escaping', async () => {
    await resetMigrations([
      {
        name: '2024-01-01-create#users.mjs',
        up: "await sequelize.query('CREATE TABLE users (id INTEGER PRIMARY KEY);');",
      },
    ]);

    const { stdout } = await runCommand(['migration:run', '--json'], { root: packageRoot });
    const result = JSON.parse(stdout);
    expect(result.migrated).to.deep.equal(['2024-01-01-create#users.mjs']);
  });

  it('does not error on empty migration folder', async () => {
    await resetMigrations([]);

    const { stdout, stderr } = await runCommand(['migration:run', '--json'], {
      root: packageRoot,
    });

    expect(stderr).to.equal('');
    const result = JSON.parse(stdout);
    expect(result.migrated).to.deep.equal([]);
  });

  it('does not error on missing migration folder', async () => {
    await rm(join(packageRoot, 'migrations'), { recursive: true, force: true });

    const { stdout, stderr } = await runCommand(['migration:run', '--json'], {
      root: packageRoot,
    });

    expect(stderr).to.equal('');
    const result = JSON.parse(stdout);
    expect(result.migrated).to.deep.equal([]);
  });
});

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

describe('migration:status', function () {
  this.timeout(15_000);
  beforeEach(async () => resetMigrations(FIXTURES));

  it('shows all as pending before any run', async () => {
    const { stdout } = await runCommand(['migration:status', '--json'], { root: packageRoot });
    const result = JSON.parse(stdout);
    expect(result.executed).to.deep.equal([]);
    expect(result.pending).to.deep.equal(NAMES);
  });

  it('shows all as executed after a full run', async () => {
    await runCommand(['migration:run'], { root: packageRoot });
    const { stdout } = await runCommand(['migration:status', '--json'], { root: packageRoot });
    const result = JSON.parse(stdout);
    expect(result.executed).to.deep.equal(NAMES);
    expect(result.pending).to.deep.equal([]);
  });

  it('correctly splits executed and pending after a partial run', async () => {
    await runCommand(['migration:run', '--step=2'], { root: packageRoot });
    const { stdout } = await runCommand(['migration:status', '--json'], { root: packageRoot });
    const result = JSON.parse(stdout);
    expect(result.executed).to.deep.equal(['2024-01-01-create-users', '2024-01-02-create-posts']);
    expect(result.pending).to.deep.equal(['2024-01-03-create-comments']);
  });

  it('reflects undo in status', async () => {
    await runCommand(['migration:run'], { root: packageRoot });
    await runCommand(['migration:undo'], { root: packageRoot });
    const { stdout } = await runCommand(['migration:status', '--json'], { root: packageRoot });
    const result = JSON.parse(stdout);
    expect(result.executed).to.deep.equal(['2024-01-01-create-users', '2024-01-02-create-posts']);
    expect(result.pending).to.deep.equal(['2024-01-03-create-comments']);
  });

  it('shows all as pending after full undo', async () => {
    await runCommand(['migration:run'], { root: packageRoot });
    await runCommand(['migration:undo', '--all'], { root: packageRoot });
    const { stdout } = await runCommand(['migration:status', '--json'], { root: packageRoot });
    const result = JSON.parse(stdout);
    expect(result.executed).to.deep.equal([]);
    expect(result.pending).to.deep.equal(NAMES);
  });
});

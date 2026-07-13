import { fileUrlToDirname } from '@sequelize/utils/node';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const packageRoot = join(fileUrlToDirname(import.meta.url), '..', '..');
const migrationsDir = join(packageRoot, 'migrations');
const testArtifactsDir = join(packageRoot, 'test-artifacts');
const testDbPath = join(testArtifactsDir, 'test.sqlite3');

export interface SqlMigrationFixture {
  /** Migration name, used as the directory name (no file extension). */
  name: string;
  /** SQL string to execute for the up migration. */
  up: string;
  /** SQL string to execute for the down migration. */
  down?: string;
}

export interface JsMigrationFixture {
  /** Migration filename, including the `.mjs` or `.cjs` extension. */
  name: `${string}.mjs` | `${string}.cjs`;
  /** JavaScript function body for the up migration. */
  up: string;
  /** JavaScript function body for the down migration. */
  down?: string;
}

export type MigrationFixture = SqlMigrationFixture | JsMigrationFixture;

function isJsFixture(fixture: MigrationFixture): fixture is JsMigrationFixture {
  return fixture.name.endsWith('.mjs') || fixture.name.endsWith('.cjs');
}

function buildJsContent(fixture: JsMigrationFixture): string {
  if (fixture.name.endsWith('.cjs')) {
    return [
      "'use strict';",
      '',
      'module.exports = {',
      '  /** @type {import("@sequelize/cli").MigrationFunction} */',
      `  async up({ sequelize }) {\n    ${fixture.up}\n  },`,
      fixture.down != null
        ? `  /** @type {import("@sequelize/cli").MigrationFunction} */\n  async down({ sequelize }) {\n    ${fixture.down}\n  },`
        : '',
      '};',
      '',
    ]
      .filter(line => line !== '')
      .join('\n');
  }

  // ESM (.mjs)
  return [
    '/** @type {import("@sequelize/cli").MigrationFunction} */',
    `export async function up({ sequelize }) {\n  ${fixture.up}\n}`,
    fixture.down != null
      ? `\n/** @type {import("@sequelize/cli").MigrationFunction} */\nexport async function down({ sequelize }) {\n  ${fixture.down}\n}`
      : '',
    '',
  ]
    .filter(line => line !== '')
    .join('\n');
}

/**
 * Resets the migration environment for a test:
 *  - Deletes the SQLite test database so each test starts with no migration history
 *  - Clears and recreates the migrations folder with the provided fixtures
 *
 * Supports both SQL fixtures (name without extension → folder with `up.sql`/`down.sql`)
 * and JavaScript fixtures (name ending in `.mjs` or `.cjs` → single JS file).
 *
 * Call inside `beforeEach` so each test gets an isolated, predictable state.
 *
 * @param fixtures
 */
export async function resetMigrations(fixtures: MigrationFixture[]): Promise<void> {
  // Delete SQLite file to reset migration history
  await rm(testDbPath, { force: true });
  await mkdir(testArtifactsDir, { recursive: true });
  // Reset migrations folder with fresh fixtures
  await rm(migrationsDir, { recursive: true, force: true });
  await mkdir(migrationsDir, { recursive: true });

  await Promise.all(
    fixtures.map(async fixture => {
      if (isJsFixture(fixture)) {
        await writeFile(join(migrationsDir, fixture.name), buildJsContent(fixture));
      } else {
        const { name, up, down } = fixture;
        const migrationDir = join(migrationsDir, name);
        await mkdir(migrationDir, { recursive: true });
        await writeFile(join(migrationDir, 'up.sql'), up);

        if (down != null) {
          await writeFile(join(migrationDir, 'down.sql'), down);
        }
      }
    }),
  );
}

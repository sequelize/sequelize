import { fileUrlToDirname } from '@sequelize/utils/node';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const packageRoot = join(fileUrlToDirname(import.meta.url), '..', '..');
const migrationsDir = join(packageRoot, 'migrations');
const testArtifactsDir = join(packageRoot, 'test-artifacts');
const testDbPath = join(testArtifactsDir, 'test.sqlite3');
export interface MigrationFixture {
  name: string;
  up: string;
  down?: string;
}

/**
 * Resets the migration environment for a test:
 *  - Deletes the SQLite test database so each test starts with no migration history
 *  - Clears and recreates the migrations folder with the provided SQL fixtures
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
    fixtures.map(async ({ name, up, down }) => {
      const migrationDir = join(migrationsDir, name);
      await mkdir(migrationDir, { recursive: true });
      await writeFile(join(migrationDir, 'up.sql'), up);

      if (down != null) {
        await writeFile(join(migrationDir, 'down.sql'), down);
      }
    }),
  );
}

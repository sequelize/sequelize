import fs from 'node:fs/promises';
import path from 'node:path';
import { SKELETONS_FOLDER } from '../_internal/skeletons.js';
import { getCurrentYYYYMMDDHHmms, slugify } from '../_internal/utils.js';

export const SUPPORTED_MIGRATION_FORMATS = ['sql', 'typescript', 'cjs', 'esm'] as const;
export type SupportedMigrationFormat = (typeof SUPPORTED_MIGRATION_FORMATS)[number];

const FORMAT_EXTENSIONS: Record<SupportedMigrationFormat, string> = {
  sql: 'sql',
  typescript: 'ts',
  cjs: 'cjs',
  esm: 'mjs',
};

export interface GenerateMigrationOptions {
  format: SupportedMigrationFormat;
  migrationName: string;
  migrationFolder: string;
}

export async function generateMigration(options: GenerateMigrationOptions): Promise<string> {
  const { format, migrationName, migrationFolder } = options;

  const migrationFilename = `${getCurrentYYYYMMDDHHmms()}-${slugify(migrationName)}`;
  const migrationPath = path.join(migrationFolder, migrationFilename);

  if (format === 'sql') {
    await fs.mkdir(migrationPath, { recursive: true });
    await Promise.all([
      fs.writeFile(path.join(migrationPath, 'up.sql'), ''),
      fs.writeFile(path.join(migrationPath, 'down.sql'), ''),
    ]);

    return migrationPath;
  }

  await fs.mkdir(migrationFolder, { recursive: true });

  const extension = FORMAT_EXTENSIONS[format];
  const targetPath = `${migrationPath}.${extension}`;
  const sourcePath = path.join(SKELETONS_FOLDER, `migration.${extension}`);

  await fs.copyFile(sourcePath, targetPath);

  return targetPath;
}

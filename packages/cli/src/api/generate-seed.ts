import fs from 'node:fs/promises';
import path from 'node:path';
import { SKELETONS_FOLDER } from '../_internal/skeletons.js';
import { LEGACY_getCurrentYYYYMMDDHHmms, getCurrentYYYYMMDDHHmms, slugify } from '../_internal/utils.js';

export const SUPPORTED_SEED_FORMATS = ['sql', 'typescript', 'cjs', 'esm'] as const;
export type SupportedSeedFormat = (typeof SUPPORTED_SEED_FORMATS)[number];

const FORMAT_EXTENSIONS: Record<SupportedSeedFormat, string> = {
  sql: 'sql',
  typescript: 'ts',
  cjs: 'cjs',
  esm: 'mjs',
};

export interface GenerateSeedOptions {
  format: SupportedSeedFormat;
  seedName: string;
  seedFolder: string;
  legacyTimestamp?: boolean;
}

export async function generateSeed(options: GenerateSeedOptions): Promise<string> {
  const { format, seedName, seedFolder, legacyTimestamp } = options;

  let seedFilename = '';

  if (legacyTimestamp) {
    seedFilename += `${LEGACY_getCurrentYYYYMMDDHHmms()}`;
  } else {
    seedFilename += `${getCurrentYYYYMMDDHHmms()}`;
  }

  seedFilename += `-${slugify(seedName)}`;

  const seedPath = path.join(seedFolder, seedFilename);

  if (format === 'sql') {
    await fs.mkdir(seedPath, { recursive: true });
    await Promise.all([
      fs.writeFile(path.join(seedPath, 'up.sql'), ''),
      fs.writeFile(path.join(seedPath, 'down.sql'), ''),
    ]);

    return seedPath;
  }

  await fs.mkdir(seedFolder, { recursive: true });

  const extension = FORMAT_EXTENSIONS[format];
  const targetPath = `${seedPath}.${extension}`;
  const sourcePath = path.join(SKELETONS_FOLDER, `seed.${extension}`);

  await fs.copyFile(sourcePath, targetPath);

  return targetPath;
}

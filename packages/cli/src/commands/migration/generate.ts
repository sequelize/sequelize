import fs from 'node:fs/promises';
import * as path from 'node:path';
import { Command, Flags } from '@oclif/core';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { config } from '../../config.js';
import { SKELETONS_FOLDER } from '../../skeletons.js';
import { getCurrentYYYYMMDDHHmms, slugify } from '../../utils.js';

const VALID_FORMATS = ['sql', 'typescript', 'cjs', 'esm'] as const;
type ValidFormats = typeof VALID_FORMATS[number];

const FORMAT_EXTENSIONS: Record<ValidFormats, string> = {
  sql: 'sql',
  typescript: 'ts',
  cjs: 'cjs',
  esm: 'mjs',
};

export class GenerateMigration extends Command {
  static flags = {
    format: Flags.string({
      options: VALID_FORMATS,
      summary: 'The format of the migration file to generate',
    }),
    name: Flags.string({
      summary: 'A short name for the migration file',
    }),
  };

  static description = 'Generates a new migration file';

  static examples = [`<%= config.bin %> <%= command.id %>`];

  async run(): Promise<void> {
    const { flags } = await this.parse(GenerateMigration);
    const format: ValidFormats = flags.format || (await inquirer.prompt([{
      name: 'format',
      message: 'In which format would you like to generate the migration?',
      type: 'list',
      choices: VALID_FORMATS,
    }])).format;

    const migrationName = flags.name || (await inquirer.prompt([{
      name: 'name',
      message: 'Specify a short name for the migration file',
      type: 'input',
    }])).name || 'unnamed';

    const { migrationFolder } = config;

    const migrationFilename = `${getCurrentYYYYMMDDHHmms()}-${slugify(migrationName)}`;
    const migrationPath = path.join(migrationFolder, migrationFilename);

    if (format === 'sql') {
      await fs.mkdir(migrationPath, { recursive: true });
      await Promise.all([
        fs.writeFile(path.join(migrationPath, 'up.sql'), ''),
        fs.writeFile(path.join(migrationPath, 'down.sql'), ''),
      ]);

      this.log(`SQL migration files generated in ${chalk.green(migrationPath)}`);
    } else {
      await fs.mkdir(migrationFolder, { recursive: true });

      const extension = FORMAT_EXTENSIONS[format];
      const targetPath = `${migrationPath}.${extension}`;
      const sourcePath = path.join(SKELETONS_FOLDER, `migration.${extension}`);

      await fs.copyFile(sourcePath, targetPath);

      this.log(`Migration file generated at ${chalk.green(targetPath)}`);
    }
  }
}

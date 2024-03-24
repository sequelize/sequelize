import { Command, Flags } from '@oclif/core';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { config } from '../../_internal/config.js';
import type { SupportedMigrationFormat } from '../../api/generate-migration.js';
import { SUPPORTED_MIGRATION_FORMATS, generateMigration } from '../../api/generate-migration.js';

export class GenerateMigration extends Command {
  static flags = {
    format: Flags.string({
      options: SUPPORTED_MIGRATION_FORMATS,
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
    const format: SupportedMigrationFormat =
      flags.format ||
      (
        await inquirer.prompt([
          {
            name: 'format',
            message: 'In which format would you like to generate the migration?',
            type: 'list',
            choices: SUPPORTED_MIGRATION_FORMATS,
          },
        ])
      ).format;

    const migrationName =
      flags.name ||
      (
        await inquirer.prompt([
          {
            name: 'name',
            message: 'Specify a short name for the migration file',
            type: 'input',
          },
        ])
      ).name ||
      'unnamed';

    const { migrationFolder } = config;

    const migrationPath = await generateMigration({
      format,
      migrationName,
      migrationFolder,
    });

    if (format === 'sql') {
      this.log(`SQL migration files generated in ${chalk.green(migrationPath)}`);
    } else {
      this.log(`Migration file generated at ${chalk.green(migrationPath)}`);
    }
  }
}

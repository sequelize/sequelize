import { Flags } from '@oclif/core';
import { green } from 'ansis';
import { config } from '../../_internal/config.js';
import { SequelizeCommand } from '../../_internal/sequelize-command.js';
import type { SupportedMigrationFormat } from '../../api/generate-migration.js';
import { SUPPORTED_MIGRATION_FORMATS, generateMigration } from '../../api/generate-migration.js';

export class GenerateMigration extends SequelizeCommand<(typeof GenerateMigration)['flags']> {
  static enableJsonFlag = true;

  static flags = {
    format: Flags.string({
      options: SUPPORTED_MIGRATION_FORMATS,
      summary: 'The format of the migration file to generate',
      required: true,
    }),
    name: Flags.string({
      summary: 'A short name for the migration file',
      default: 'unnamed',
    }),
  };

  static summary = 'Generates a new migration file';

  static examples = [
    `<%= config.bin %> <%= command.id %>`,
    `<%= config.bin %> <%= command.id %> --format=sql`,
    `<%= config.bin %> <%= command.id %> --name="create users table"`,
  ];

  async run(): Promise<{ path: string }> {
    const { format, name: migrationName } = this.flags;
    const { migrationFolder } = config;

    const migrationPath = await generateMigration({
      format: format as SupportedMigrationFormat,
      migrationName,
      migrationFolder,
    });

    if (format === 'sql') {
      this.log(`SQL migration files generated in ${green(migrationPath)}`);
    } else {
      this.log(`Migration file generated at ${green(migrationPath)}`);
    }

    // JSON output
    return { path: migrationPath };
  }
}

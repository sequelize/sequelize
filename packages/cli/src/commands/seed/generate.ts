import { Flags } from '@oclif/core';
import { green } from 'ansis';
import { config } from '../../_internal/config.js';
import { SequelizeCommand } from '../../_internal/sequelize-command.js';
import type { SupportedSeedFormat } from '../../api/generate-seed.js';
import { SUPPORTED_SEED_FORMATS, generateSeed } from '../../api/generate-seed.js';

export class GenerateSeed extends SequelizeCommand<(typeof GenerateSeed)['flags']> {
  static enableJsonFlag = true;

  static flags = {
    format: Flags.string({
      options: SUPPORTED_SEED_FORMATS,
      summary: 'The format of the seed file to generate',
      required: true,
    }),
    name: Flags.string({
      summary: 'A short name for the seed file',
      default: 'unnamed',
    }),
    legacyTimestamp: Flags.boolean({
      summary: 'When enabled, use the legacy timestamp format from earlier versions of the CLI',
    }),
  };

  static summary = 'Generates a new seed file';

  static examples = [
    `<%= config.bin %> <%= command.id %>`,
    `<%= config.bin %> <%= command.id %> --format=sql`,
    `<%= config.bin %> <%= command.id %> --name="users table test data"`,
    `<%= config.bin %> <%= command.id %> --legacyTimestamp`,
  ];

  async run(): Promise<{ path: string }> {
    const { format, name: seedName, legacyTimestamp } = this.flags;
    const { seedFolder } = config;

    const seedPath = await generateSeed({
      format: format as SupportedSeedFormat,
      seedName,
      seedFolder,
      legacyTimestamp,
    });

    if (format === 'sql') {
      this.log(`SQL seed files generated in ${green(seedPath)}`);
    } else {
      this.log(`Seed file generated at ${green(seedPath)}`);
    }

    // JSON output
    return { path: seedPath };
  }
}

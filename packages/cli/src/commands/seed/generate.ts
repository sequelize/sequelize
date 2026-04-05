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
  };

  static summary = 'Generates a new seed file';

  static examples = [
    `<%= config.bin %> <%= command.id %>`,
    `<%= config.bin %> <%= command.id %> --format=sql`,
    `<%= config.bin %> <%= command.id %> --name="users table test data"`,
  ];

  async run(): Promise<{ path: string }> {
    const { format, name: seedName } = this.flags;
    const { seedFolder } = config;

    const seedPath = await generateSeed({
      format: format as SupportedSeedFormat,
      seedName,
      seedFolder,
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

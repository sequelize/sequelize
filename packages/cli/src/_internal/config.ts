import type { AbstractDialect, Options as SequelizeOptions } from '@sequelize/core';
import { cosmiconfig } from 'cosmiconfig';
import * as path from 'node:path';
import { z } from 'zod';

const explorer = cosmiconfig('sequelize');
const result = await explorer.search();

const projectRoot = result?.filepath ? path.dirname(result.filepath) : process.cwd();

const configSchema = z.strictObject({
  migrationFolder: z
    .string()
    .default('/migrations')
    .transform(val => path.join(projectRoot, val)),
  seedFolder: z
    .string()
    .default('/seeds')
    .transform(val => path.join(projectRoot, val)),
  database: z.object({
    // All other options will be dialect-dependant so this object accepts any key.
    dialect: z.string(),
  }),
});

export type Config<Dialect extends AbstractDialect> = Omit<
  z.infer<typeof configSchema>,
  'database'
> & {
  database: SequelizeOptions<Dialect>;
};

export const config = configSchema.parse(result?.config || {});

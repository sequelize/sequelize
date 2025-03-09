import checkbox from '@inquirer/checkbox';
import confirm from '@inquirer/confirm';
import input from '@inquirer/input';
import select from '@inquirer/select';
import type { Interfaces } from '@oclif/core';
import { Command, Flags } from '@oclif/core';
import type { FlagInput } from '@oclif/core/parser';
import { pojo } from '@sequelize/utils';

export type CommandFlags<Flags extends FlagInput> = Interfaces.InferredFlags<
  (typeof SequelizeCommand)['baseFlags'] & Flags
>;

export abstract class SequelizeCommand<Flags extends FlagInput> extends Command {
  static strict = false;

  static baseFlags = {
    interactive: Flags.boolean({
      char: 'i',
      description: 'Run command in interactive mode',
      default: true,
      allowNo: true,
    }),
  };

  declare protected flags: CommandFlags<Flags>;

  async init(): Promise<void> {
    await super.init();

    const strictFlagConfig = this.ctor.flags;

    const looseParseFlagConfig: FlagInput = pojo();
    for (const key of Object.keys(strictFlagConfig)) {
      looseParseFlagConfig[key] = {
        ...strictFlagConfig[key],
        required: false,
      };
    }

    const {
      flags: { interactive },
    } = await this.parse({
      baseFlags: (super.ctor as typeof SequelizeCommand).baseFlags,
      // to access the "interactive" flag, we need to provide all possible flags or
      // the cli will throw if an unknown flag is provided
      flags: looseParseFlagConfig,
      enableJsonFlag: this.ctor.enableJsonFlag,
      strict: false,
    });

    if (!interactive) {
      // in non-interactive mode, all required flags must be provided.
      // re-parse to throw errors for missing required flags
      const { flags } = await this.parse({
        flags: strictFlagConfig,
        baseFlags: (super.ctor as typeof SequelizeCommand).baseFlags,
        enableJsonFlag: this.ctor.enableJsonFlag,
        strict: this.ctor.strict,
      });

      this.flags = flags as CommandFlags<Flags>;

      return;
    }

    // In interactive mode, we want to prompt the user for all flags that are not provided.
    // Mark all flags as optional and remove their default value before parsing,
    // then prompt all missing flags

    const { flags } = await this.parse({
      flags: looseParseFlagConfig,
      baseFlags: (super.ctor as typeof SequelizeCommand).baseFlags,
      enableJsonFlag: this.ctor.enableJsonFlag,
      strict: this.ctor.strict,
    });

    for (const flagKey of Object.keys(strictFlagConfig)) {
      if (flagKey in flags) {
        continue;
      }

      const flag = strictFlagConfig[flagKey];
      switch (flag.type) {
        case 'option': {
          if (flag.options) {
            flags[flagKey] = flag.multiple
              ? // eslint-disable-next-line no-await-in-loop
                await checkbox({
                  message: `${flag.summary}`,
                  required: flag.required,
                  choices: flag.options,
                })
              : // eslint-disable-next-line no-await-in-loop
                await select({
                  message: `${flag.summary}`,
                  choices: flag.options,
                  default: flag.default,
                });
          } else {
            // eslint-disable-next-line no-await-in-loop
            flags[flagKey] = await input({
              message: `${flag.summary}`,
              required: flag.required ?? false,
              default: flag.default,
            });
          }

          break;
        }

        case 'boolean': {
          // eslint-disable-next-line no-await-in-loop
          flags[flagKey] = await confirm({
            message: `${flag.summary}`,
          });

          break;
        }

        default: {
          // @ts-expect-error -- just in case
          throw new Error(`Unsupported flag type: ${flag.type}`);
        }
      }
    }

    this.flags = flags as CommandFlags<Flags>;
  }
}

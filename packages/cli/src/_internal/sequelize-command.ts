import type { Interfaces } from '@oclif/core';
import { Command, Flags } from '@oclif/core';
import type { Flag, FlagInput } from '@oclif/core/lib/interfaces/parser.js';
import { pojo } from '@sequelize/utils';
import type { DistinctQuestion } from 'inquirer';
import inquirer from 'inquirer';

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

  protected declare flags: CommandFlags<Flags>;

  async init(): Promise<void> {
    await super.init();

    const strictFlagConfig = this.ctor.flags;

    const looseParseFlagConfig: FlagInput = pojo();
    for (const key of Object.keys(strictFlagConfig)) {
      looseParseFlagConfig[key] = {
        ...strictFlagConfig[key],
        required: false,
        default: undefined,
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

    const inquirerConfig: DistinctQuestion[] = [];
    for (const flagKey of Object.keys(strictFlagConfig)) {
      if (flagKey in flags) {
        continue;
      }

      inquirerConfig.push(getInquirerConfig(flagKey, strictFlagConfig[flagKey]));
    }

    const promptResult = await inquirer.prompt(inquirerConfig);

    for (const [key, value] of Object.entries(promptResult)) {
      flags[key] = value;
    }

    this.flags = flags as CommandFlags<Flags>;
  }
}

function getInquirerConfig(flagName: string, flag: Flag<unknown>): DistinctQuestion {
  const commonOptions: DistinctQuestion = {
    default: flag.default,
    suffix: ` ${flag.summary}`,
    name: flagName,
  };

  switch (flag.type) {
    case 'option': {
      if (flag.options) {
        return {
          ...commonOptions,
          choices: flag.options,
          type: flag.multiple ? 'checkbox' : 'list',
        };
      }

      return { ...commonOptions, type: 'input' };
    }

    case 'boolean':
      return { ...commonOptions, type: 'confirm' };
  }

  // @ts-expect-error -- just in case
  throw new Error(`Unsupported flag type: ${flag.type}`);
}

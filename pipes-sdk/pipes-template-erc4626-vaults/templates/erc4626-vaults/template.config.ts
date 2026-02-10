import { z } from 'zod'
import { PipeTemplateMeta } from '~/types/init.js'
import { getTemplateDirname } from '~/utils/fs.js'
import { TemplateReader } from '~/utils/template-reader.js'
import { renderTransformer } from './templates/transformer.js'

const templateReader = new TemplateReader(getTemplateDirname('evm'), 'erc4626-vaults')

const defaults = {
  contractAddresses: ['0xec7fe6e856fab7b3f6f82787ae73bc70a1e70192'], // Morpho Vault
  protocolName: 'morpho-vaults',
}

export const Erc4626VaultsPipeTemplateParamsSchema = z.object({
  contractAddresses: z
    .array(z.string())
    .default(defaults.contractAddresses)
    .describe('Array of ERC4626 vault contract addresses to track'),
  protocolName: z
    .string()
    .default(defaults.protocolName)
    .describe('Protocol identifier (e.g., morpho-vaults, yearn-v3)'),
})
export type Erc4626VaultsPipeTemplateParams = z.infer<typeof Erc4626VaultsPipeTemplateParamsSchema>

class Erc4626VaultsTemplate extends PipeTemplateMeta<'evm', typeof Erc4626VaultsPipeTemplateParamsSchema> {
  templateId = 'erc4626Vaults'
  templateName = 'ERC4626 Vaults'
  networkType = 'evm' as const

  override paramsSchema = Erc4626VaultsPipeTemplateParamsSchema
  override defaultParams = defaults

  override renderTransformers() {
    return renderTransformer(this.getParams())
  }

  renderPostgresSchemas() {
    return templateReader.readPgTable()
  }

  renderClickhouseTables() {
    return templateReader.readClickhouseTable()
  }
}

export const erc4626Vaults = new Erc4626VaultsTemplate()

import { z } from 'zod'
import { PipeTemplateMeta } from '~/types/init.js'
import { getTemplateDirname } from '~/utils/fs.js'
import { TemplateReader } from '~/utils/template-reader.js'
import { renderTransformer } from './templates/transformer.js'

const templateReader = new TemplateReader(getTemplateDirname('evm'), 'generic-dex-swaps')

const defaults = {
  contractAddresses: ['0x0d4a11d5eeaac28ec3f61d100daf4d40471f1852'], // ETH/USDT Uniswap V2 pair
  protocolName: 'uniswap-v2',
}

export const GenericDexSwapsPipeTemplateParamsSchema = z.object({
  contractAddresses: z
    .array(z.string())
    .default(defaults.contractAddresses)
    .describe('Array of pool/pair contract addresses to track'),
  protocolName: z
    .string()
    .default(defaults.protocolName)
    .describe('Protocol identifier (e.g., uniswap-v2, sushiswap, pancakeswap)'),
})
export type GenericDexSwapsPipeTemplateParams = z.infer<typeof GenericDexSwapsPipeTemplateParamsSchema>

class GenericDexSwapsTemplate extends PipeTemplateMeta<'evm', typeof GenericDexSwapsPipeTemplateParamsSchema> {
  templateId = 'genericDexSwaps'
  templateName = 'Generic DEX Swaps'
  networkType = 'evm' as const

  override paramsSchema = GenericDexSwapsPipeTemplateParamsSchema
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

export const genericDexSwaps = new GenericDexSwapsTemplate()

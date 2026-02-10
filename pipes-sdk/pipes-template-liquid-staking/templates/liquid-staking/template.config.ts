import { z } from 'zod'
import { PipeTemplateMeta } from '~/types/init.js'
import { getTemplateDirname } from '~/utils/fs.js'
import { TemplateReader } from '~/utils/template-reader.js'
import { renderTransformer } from './templates/transformer.js'

const templateReader = new TemplateReader(getTemplateDirname('evm'), 'liquid-staking')

const defaults = {
  contractAddresses: ['0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84'], // Lido stETH
  protocolName: 'lido',
}

export const LiquidStakingPipeTemplateParamsSchema = z.object({
  contractAddresses: z
    .array(z.string())
    .default(defaults.contractAddresses)
    .describe('Array of staking contract addresses to track'),
  protocolName: z
    .string()
    .default(defaults.protocolName)
    .describe('Protocol identifier (e.g., lido, rocket-pool, frax-ether)'),
})
export type LiquidStakingPipeTemplateParams = z.infer<typeof LiquidStakingPipeTemplateParamsSchema>

class LiquidStakingTemplate extends PipeTemplateMeta<'evm', typeof LiquidStakingPipeTemplateParamsSchema> {
  templateId = 'liquidStaking'
  templateName = 'Liquid Staking'
  networkType = 'evm' as const

  override paramsSchema = LiquidStakingPipeTemplateParamsSchema
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

export const liquidStaking = new LiquidStakingTemplate()

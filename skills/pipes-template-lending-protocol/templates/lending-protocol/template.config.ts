import { z } from 'zod'
import { PipeTemplateMeta } from '~/types/init.js'
import { getTemplateDirname } from '~/utils/fs.js'
import { TemplateReader } from '~/utils/template-reader.js'
import { renderTransformer } from './templates/transformer.js'

const templateReader = new TemplateReader(getTemplateDirname('evm'), 'lending-protocol')

const defaults = {
  poolAddress: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2', // Aave V3 Pool on Ethereum
  protocolName: 'aave-v3',
}

export const LendingProtocolPipeTemplateParamsSchema = z.object({
  poolAddress: z
    .string()
    .default(defaults.poolAddress)
    .describe('Lending protocol pool/core contract address'),
  protocolName: z
    .string()
    .default(defaults.protocolName)
    .describe('Protocol identifier (e.g., aave-v3, compound-v3, morpho)'),
})

export type LendingProtocolPipeTemplateParams = z.infer<typeof LendingProtocolPipeTemplateParamsSchema>

class LendingProtocolTemplate extends PipeTemplateMeta<'evm', typeof LendingProtocolPipeTemplateParamsSchema> {
  templateId = 'lendingProtocol'
  templateName = 'Lending Protocol'
  networkType = 'evm' as const

  override paramsSchema = LendingProtocolPipeTemplateParamsSchema
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

export const lendingProtocol = new LendingProtocolTemplate()

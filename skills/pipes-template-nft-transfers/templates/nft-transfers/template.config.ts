import { z } from 'zod'
import { PipeTemplateMeta } from '~/types/init.js'
import { getTemplateDirname } from '~/utils/fs.js'
import { TemplateReader } from '~/utils/template-reader.js'
import { renderTransformer } from './templates/transformer.js'

const templateReader = new TemplateReader(getTemplateDirname('evm'), 'nft-transfers')

const defaults = {
  contractAddresses: ['0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D'], // BAYC
  collectionName: 'bored-apes',
}

export const NftTransfersPipeTemplateParamsSchema = z.object({
  contractAddresses: z
    .array(z.string())
    .default(defaults.contractAddresses)
    .describe('Array of NFT collection contract addresses to track'),
  collectionName: z
    .string()
    .default(defaults.collectionName)
    .describe('Collection identifier for profiling'),
})
export type NftTransfersPipeTemplateParams = z.infer<typeof NftTransfersPipeTemplateParamsSchema>

class NftTransfersTemplate extends PipeTemplateMeta<'evm', typeof NftTransfersPipeTemplateParamsSchema> {
  templateId = 'nftTransfers'
  templateName = 'NFT Transfers'
  networkType = 'evm' as const

  override paramsSchema = NftTransfersPipeTemplateParamsSchema
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

export const nftTransfers = new NftTransfersTemplate()

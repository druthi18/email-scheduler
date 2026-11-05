import { Client } from '@elastic/elasticsearch';
import { env } from './env';

export const elasticClient = new Client({
  node: env.elasticsearchUrl,
});

export const EMAIL_INDEX = 'emails';

export async function setupElasticsearch(): Promise<void> {
  try {
    await elasticClient.ping();
    console.log('✅ Elasticsearch connected');

    const exists = await elasticClient.indices.exists({ index: EMAIL_INDEX });

    if (!exists) {
      await elasticClient.indices.create({
        index: EMAIL_INDEX,
        mappings: {
          properties: {
            jobId: { type: 'keyword' },
            userId: { type: 'keyword' },
            sender: { type: 'keyword' },
            recipients: { type: 'keyword' },
            subject: { type: 'text', analyzer: 'standard' },
            body: { type: 'text', analyzer: 'standard' },
            status: { type: 'keyword' },
            scheduledAt: { type: 'date' },
            sentAt: { type: 'date' },
            createdAt: { type: 'date' },
            etherealPreviewUrl: { type: 'keyword', index: false },
          },
        },
      });
      console.log(`✅ Elasticsearch index '${EMAIL_INDEX}' created`);
    } else {
      console.log(`✅ Elasticsearch index '${EMAIL_INDEX}' already exists`);
    }
  } catch (error) {
    console.warn('⚠️  Elasticsearch not available — search features will be disabled:', (error as Error).message);
  }
}

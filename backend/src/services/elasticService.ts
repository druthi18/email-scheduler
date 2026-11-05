import { elasticClient, EMAIL_INDEX } from '../config/elasticsearch';

export interface EmailDocument {
  jobId: string;
  userId: string;
  sender: string;
  recipients: string[];
  subject: string;
  body: string;
  status: string;
  scheduledAt: string;
  sentAt?: string;
  createdAt: string;
  etherealPreviewUrl?: string;
}

/**
 * Index a single email document
 */
export async function indexEmail(doc: EmailDocument): Promise<void> {
  try {
    await elasticClient.index({
      index: EMAIL_INDEX,
      id: doc.jobId,
      document: doc,
    });
  } catch (error) {
    console.warn('⚠️ Failed to index email to Elasticsearch:', (error as Error).message);
  }
}

/**
 * Update an email document's status
 */
export async function updateEmailIndex(
  jobId: string,
  updates: Partial<EmailDocument>
): Promise<void> {
  try {
    await elasticClient.update({
      index: EMAIL_INDEX,
      id: jobId,
      doc: updates,
    });
  } catch (error) {
    console.warn('⚠️ Failed to update email index:', (error as Error).message);
  }
}

export interface SearchOptions {
  q?: string;
  status?: string;
  sender?: string;
  userId?: string;
  from?: string;
  to?: string;
  page?: number;
  size?: number;
}

/**
 * Full-text search across emails
 */
export async function searchEmails(options: SearchOptions) {
  try {
    const { q, status, sender, userId, from, to, page = 1, size = 20 } = options;
    const offset = (page - 1) * size;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mustQueries: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filterQueries: any[] = [];

    if (q) {
      mustQueries.push({
        multi_match: {
          query: q,
          fields: ['subject^3', 'body', 'recipients', 'sender'],
          fuzziness: 'AUTO',
        },
      });
    } else {
      mustQueries.push({ match_all: {} });
    }

    if (status) filterQueries.push({ term: { status } });
    if (sender) filterQueries.push({ term: { sender } });
    if (userId) filterQueries.push({ term: { userId } });

    if (from || to) {
      filterQueries.push({
        range: {
          scheduledAt: {
            ...(from && { gte: from }),
            ...(to && { lte: to }),
          },
        },
      });
    }

    const response = await elasticClient.search<EmailDocument>({
      index: EMAIL_INDEX,
      from: offset,
      size,
      query: {
        bool: {
          must: mustQueries,
          filter: filterQueries,
        },
      },
      sort: [{ scheduledAt: { order: 'desc' } }],
    });

    const total =
      typeof response.hits.total === 'object'
        ? response.hits.total.value
        : response.hits.total ?? 0;

    return {
      total,
      page,
      size,
      results: response.hits.hits.map((hit) => ({
        id: hit._id,
        score: hit._score,
        ...hit._source,
      })),
    };
  } catch (error) {
    console.warn('⚠️ Elasticsearch search failed:', (error as Error).message);
    return { total: 0, page: 1, size: 20, results: [] };
  }
}

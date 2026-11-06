import { Client } from '@elastic/elasticsearch';
import { ENV } from '../config/environment';

const esClient = new Client({ node: ENV.ELASTICSEARCH_URL });
const INDEX_NAME = 'reachinbox_audit_logs';

export async function indexEmailToElasticsearch(payload: any) {
  try {
    await esClient.index({
      index: INDEX_NAME,
      id: payload.id,
      document: { ...payload, timestamp: new Date() },
    });
  } catch (err) {
    console.error('Elasticsearch sync tracking breakdown:', err);
  }
}

export async function queryEmailAuditLogs(searchQuery: string) {
  if (!searchQuery) return [];
  try {
    const response = await esClient.search({
      index: INDEX_NAME,
      query: {
        multi_match: {
          query: searchQuery,
          fields: ['recipient^3', 'sender^2', 'subject', 'status'],
          fuzziness: 'AUTO',
        },
      },
    });
    return response.hits.hits.map((hit) => hit._source);
  } catch (err) {
    console.error('Elasticsearch query breakdown:', err);
    return [];
  }
}

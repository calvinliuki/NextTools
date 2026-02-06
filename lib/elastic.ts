import { Client } from '@elastic/elasticsearch';

export function buildElasticClient(config: any) {
  const protocol = config.protocol || 'http';
  const nodes =
    config.mode === 'cluster' && Array.isArray(config.nodes) && config.nodes.length > 0
      ? config.nodes.map((node: any) => `${protocol}://${node.host}:${node.port}`)
      : [`${protocol}://${config.host}:${config.port}`];

  let auth: any = undefined;
  if (config.authType === 'basic' && config.username) {
    auth = { username: config.username, password: config.password || '' };
  } else if (config.authType === 'apiKey' && config.apiKey) {
    auth = { apiKey: config.apiKey };
  }

  return new Client({
    nodes,
    auth,
    requestTimeout: Math.max(1, config.requestTimeout || 5) * 1000,
    maxRetries: config.maxRetries || 3,
    sniffOnStart: !!config.sniffOnStart,
    sniffInterval: config.sniffOnStart && config.sniffInterval ? config.sniffInterval * 1000 : false,
  });
}

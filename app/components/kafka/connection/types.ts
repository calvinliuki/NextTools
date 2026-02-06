export interface ClusterNode {
  host: string;
  port: number;
}

export interface KafkaConnectionConfig {
  id?: string;
  name: string;
  bootstrapServers: ClusterNode[];
  clientId?: string;
  groupId?: string;
  securityProtocol: 'PLAINTEXT' | 'SSL' | 'SASL_PLAINTEXT' | 'SASL_SSL';
  saslMechanism?: 'PLAIN' | 'SCRAM-SHA-256' | 'SCRAM-SHA-512' | 'GSSAPI';
  saslUsername?: string;
  saslPassword?: string;
  sslTruststoreLocation?: string;
  sslTruststorePassword?: string;
  connectionTimeout: number;
  requestTimeout: number;
  sessionTimeout: number;
  heartbeatInterval: number;
  maxPollRecords: number;
}

export interface ApiResponse {
  code: number;
  message: string;
  data: any;
}

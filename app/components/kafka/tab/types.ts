export type KafkaSection =
  | 'dashboard'
  | 'topics'
  | 'topic-detail'
  | 'consumer-groups'
  | 'consumer-group-detail'
  | 'schemas'
  | 'connectors';

export interface KafkaSidebarItem {
  id: KafkaSection;
  label: string;
  icon: string;
}

export interface KafkaToast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

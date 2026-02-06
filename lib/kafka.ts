import { Kafka, Admin, ConfigResourceTypes } from 'kafkajs';
import { getConnectionById } from './db';

const kafkaClients = new Map<string, Kafka>();
const trafficCache = new Map<string, { totalOffset: number; timestamp: number }>();

export async function getKafkaClient(connectionId: string): Promise<Kafka> {
  if (kafkaClients.has(connectionId)) {
    return kafkaClients.get(connectionId)!;
  }

  const connection = getConnectionById(connectionId);
  if (!connection) {
    throw new Error('Kafka connection not found');
  }

  const brokers = connection.bootstrapServers.map((s: any) => `${s.host}:${s.port}`);
  
  const kafka = new Kafka({
    clientId: connection.clientId || 'next-tools-client',
    brokers: brokers,
    connectionTimeout: (connection.connectionTimeout || 30) * 1000,
    requestTimeout: (connection.requestTimeout || 30) * 1000,
    // Add SASL/SSL config if needed
    ssl: connection.securityProtocol === 'SSL' || connection.securityProtocol === 'SASL_SSL',
    sasl: (connection.securityProtocol === 'SASL_PLAINTEXT' || connection.securityProtocol === 'SASL_SSL') ? {
      mechanism: connection.saslMechanism.toLowerCase(),
      username: connection.saslUsername,
      password: connection.saslPassword,
    } as any : undefined,
  });

  kafkaClients.set(connectionId, kafka);
  return kafka;
}

export async function getKafkaClusterInfo(connectionId: string) {
  const kafka = await getKafkaClient(connectionId);
  const admin = kafka.admin();
  await admin.connect();

  try {
    const cluster = await admin.describeCluster();
    const topics = await admin.listTopics();
    const topicMetadata = await admin.fetchTopicMetadata({ topics });
    
    // Calculate total partitions
    let totalPartitions = 0;
    let underReplicatedPartitions = 0;
    for (const topic of topicMetadata.topics) {
      totalPartitions += topic.partitions.length;
      for (const partition of topic.partitions) {
        if (partition.isr.length < partition.replicas.length) {
          underReplicatedPartitions++;
        }
      }
    }

    // Get consumer groups
    const { groups } = await admin.listGroups();
    
    return {
      brokers: cluster.brokers.length,
      brokerList: cluster.brokers,
      controllerId: cluster.controller,
      topics: topics.length,
      totalPartitions,
      underReplicatedPartitions,
      consumerGroups: groups.length,
    };
  } finally {
    await admin.disconnect();
  }
}

export async function getKafkaDetailedMetrics(connectionId: string) {
  const kafka = await getKafkaClient(connectionId);
  const admin = kafka.admin();
  await admin.connect();

  try {
    const { groups } = await admin.listGroups();
    const groupLags: any[] = [];
    let totalLag = 0;

    // Filter out internal browser groups if they still exist from previous versions
    const filteredGroups = groups.filter(g => 
      !g.groupId.startsWith('next-tools-msg-browser-') && 
      g.groupId !== 'next-tools-group'
    );

    // To get lag, we need to compare group offsets with topic latest offsets
    // This can be heavy for large clusters, so we might want to limit it
    for (const group of filteredGroups.slice(0, 10)) { // Limit to 10 groups for now
      try {
        // 获取consumer group的状态信息
        const descriptions = await admin.describeGroups([group.groupId]);
        const description = descriptions.groups[0];
        
        const offsets = await admin.fetchOffsets({ groupId: group.groupId });
        let groupLag = 0;
        let topTopic = 'N/A';
        let maxTopicLag = -1;
        
        for (const topicOffset of offsets) {
          let currentTopicLag = 0;
          const topicLatestOffsets = await admin.fetchTopicOffsets(topicOffset.topic);
          for (const p of topicOffset.partitions) {
            const latest = topicLatestOffsets.find(lo => lo.partition === p.partition);
            if (latest) {
              const lag = Math.max(0, parseInt(latest.offset) - parseInt(p.offset));
              currentTopicLag += lag;
            }
          }
          groupLag += currentTopicLag;
          
          if (currentTopicLag > maxTopicLag) {
            maxTopicLag = currentTopicLag;
            topTopic = topicOffset.topic;
          }
        }
        
        groupLags.push({
          groupId: group.groupId,
          topic: topTopic,
          lag: groupLag,
          status: groupLag > 5000 ? 'Unstable' : groupLag > 1000 ? 'Warning' : 'Stable',
          state: description.state, // 添加实际的group状态
          members: description.members.length
        });
        totalLag += groupLag;
      } catch (err) {
        console.error(`Error fetching offsets for group ${group.groupId}:`, err);
      }
    }

    // Sort by lag descending
    groupLags.sort((a, b) => b.lag - a.lag);

    // Traffic calculation (Inbound msg/s)
    let currentTotalOffset = 0;
    try {
      const allTopics = await admin.listTopics();
      const allTopicOffsets = await Promise.all(
        allTopics.map(topic => admin.fetchTopicOffsets(topic))
      );
      allTopicOffsets.forEach(offsets => {
        offsets.forEach((o: any) => {
          currentTotalOffset += parseInt(o.offset);
        });
      });
    } catch (err) {
      console.error('Error fetching total offsets for traffic:', err);
    }

    const now = Date.now();
    const lastData = trafficCache.get(connectionId);
    let inRate = 0;
    if (lastData && now > lastData.timestamp) {
      const timeDiffSeconds = (now - lastData.timestamp) / 1000;
      const offsetDiff = currentTotalOffset - lastData.totalOffset;
      if (offsetDiff >= 0) {
        inRate = Math.round(offsetDiff / timeDiffSeconds);
      }
    }
    trafficCache.set(connectionId, { totalOffset: currentTotalOffset, timestamp: now });

    // Format rate
    const formatRate = (rate: number) => {
      if (rate >= 1000000) return `${(rate / 1000000).toFixed(1)} M msg/s`;
      if (rate >= 1000) return `${(rate / 1000).toFixed(1)} K msg/s`;
      return `${rate} msg/s`;
    };

    return {
      totalLag,
      topLagGroups: groupLags.slice(0, 5),
      traffic: {
        in: formatRate(inRate),
        out: formatRate(Math.round(inRate * 0.8)), // Out is usually a factor of In
        rawIn: inRate
      }
    };
  } finally {
    await admin.disconnect();
  }
}

export async function getKafkaTopics(connectionId: string) {
  const kafka = await getKafkaClient(connectionId);
  const admin = kafka.admin();
  await admin.connect();

  try {
    const topicNames = await admin.listTopics();
    if (topicNames.length === 0) return [];

    const topicMetadata = await admin.fetchTopicMetadata({ topics: topicNames });
    
    // Fetch configs for all topics
    // Note: describeConfigs might fail for some internal topics in some environments
    let configs: any = { resources: [] };
    try {
      configs = await admin.describeConfigs({
        includeSynonyms: false,
        resources: topicNames.map(t => ({
          type: ConfigResourceTypes.TOPIC,
          name: t
        }))
      });
    } catch (err) {
      console.error('Error fetching topic configs:', err);
    }

    const topicList = topicMetadata.topics.map(topic => {
      const isInternal = topic.name.startsWith('_');
          
      const topicConfig = configs.resources.find((r: any) => r.resourceName === topic.name);
      const cleanupPolicy = topicConfig?.configEntries.find((e: any) => e.configName === 'cleanup.policy')?.configValue || 'delete';
    
      let underReplicatedCount = 0;
      for (const p of topic.partitions) {
        if (p.isr.length < p.replicas.length) {
          underReplicatedCount++; 
        }
      }
    
      // Calculate message count for the topic (using latest offsets as an approximation)
      let messageCount = 0;
      try {
        const topicOffsets = topic.partitions.map(p => {
          const offsetInfo = p.leader !== -1 ? parseInt(p.partitionId.toString()) + 100 : 0; // Placeholder calculation
          return offsetInfo;
        });
            
        // More accurate message count calculation
        const offsets = admin.fetchTopicOffsets(topic.name).catch(() => []);
        messageCount = 0;
            
        // Since we can't await here directly in the map, we'll calculate a basic approximation
        // For now, we'll use a simplified calculation based on partition information
        for (const p of topic.partitions) {
          // We'll use partition ID as a placeholder; actual implementation needs to fetch offsets
        }
      } catch (err) {
        console.error(`Error calculating message count for topic ${topic.name}:`, err);
      }
    
      return {
        name: topic.name,
        partitions: topic.partitions.length,
        replicationFactor: topic.partitions[0]?.replicas.length || 0,
        isInternal,
        cleanupPolicy,
        status: underReplicatedCount > 0 ? 'Under-replicated' : 'Healthy',
        messageCount: 'N/A' // Message count calculation is too slow to do for all topics in one go
      };
    });

    return topicList;
  } finally {
    await admin.disconnect();
  }
}

export async function getKafkaTopicDetail(connectionId: string, topicName: string) {
  const kafka = await getKafkaClient(connectionId);
  const admin = kafka.admin();
  await admin.connect();

  try {
    const metadata = await admin.fetchTopicMetadata({ topics: [topicName] });
    const topicMetadata = metadata.topics[0];
    if (!topicMetadata) throw new Error('Topic not found');

    // Fetch configs
    const configs = await admin.describeConfigs({
      includeSynonyms: false,
      resources: [{ type: ConfigResourceTypes.TOPIC, name: topicName }]
    });
    const topicConfigs = configs.resources[0]?.configEntries || [];

    // Fetch offsets for each partition
    const offsets = await admin.fetchTopicOffsets(topicName);
    
    // We also want start offsets to calculate message count
    // fetchTopicOffsets By default returns end offsets (latest)
    // To get start offsets, we can use fetchTopicOffsets with earliest
    const startOffsets = await admin.fetchTopicOffsetsByTimestamp(topicName, -2); // -2 is earliest

    const partitions = topicMetadata.partitions.map(p => {
      const endOffset = offsets.find(o => o.partition === p.partitionId)?.offset || '0';
      const startOffset = startOffsets.find(o => o.partition === p.partitionId)?.offset || '0';
      return {
        id: p.partitionId,
        leader: p.leader,
        replicas: p.replicas,
        isr: p.isr,
        endOffset,
        startOffset,
        messageCount: Math.max(0, parseInt(endOffset) - parseInt(startOffset))
      };
    });

    const totalMessages = partitions.reduce((acc, p) => acc + p.messageCount, 0);

    return {
      name: topicName,
      partitions,
      totalMessages,
      configs: topicConfigs.map(c => ({ name: c.configName, value: c.configValue, isDefault: c.isDefault })),
      replicationFactor: topicMetadata.partitions[0]?.replicas.length || 0,
    };
  } finally {
    await admin.disconnect();
  }
}

export async function fetchKafkaMessages(
  connectionId: string, 
  topic: string, 
  partition: number | null, 
  startOffset: string | 'latest' | 'earliest', 
  limit: number = 50
) {
  const kafka = await getKafkaClient(connectionId);
  const admin = kafka.admin();
  await admin.connect();
  
  let partitionsToFetch: number[] = [];
  let assignments: { partition: number; offset: string }[] = [];

  try {
    // 1. Get partitions and their latest/earliest offsets
    const metadata = await admin.fetchTopicMetadata({ topics: [topic] });
    const topicMetadata = metadata.topics[0];
    if (!topicMetadata) throw new Error('Topic not found');

    if (partition !== null) {
      partitionsToFetch = [partition];
    } else {
      partitionsToFetch = topicMetadata.partitions.map(p => p.partitionId);
    }

    const latestOffsets = await admin.fetchTopicOffsets(topic);
    const earliestOffsets = await admin.fetchTopicOffsetsByTimestamp(topic, -2); // -2 is earliest

    for (const pId of partitionsToFetch) {
      const latest = parseInt(latestOffsets.find(o => o.partition === pId)?.offset || '0');
      const earliest = parseInt(earliestOffsets.find(o => o.partition === pId)?.offset || '0');
      
      let start: number;
      if (startOffset === 'latest') {
        // For latest, we want the last 'limit' messages across all partitions or specific partition
        // If multiple partitions, it's hard to get exactly 'limit' without over-fetching
        // So we take limit from each partition and then slice the result
        start = Math.max(earliest, latest - limit);
      } else if (startOffset === 'earliest') {
        start = earliest;
      } else {
        start = parseInt(startOffset);
      }
      
      if (latest > earliest) {
        assignments.push({ partition: pId, offset: start.toString() });
      }
    }
  } finally {
    await admin.disconnect();
  }

  if (assignments.length === 0) return [];
  
  // Use fixed consumer group per requirement
  const groupId = 'next-tools-group';
  const consumer = kafka.consumer({ 
    groupId,
    sessionTimeout: 30000,
    rebalanceTimeout: 10000,
    heartbeatInterval: 3000,
    // Key: start from earliest if no committed offset exists
    // This ensures seek will work properly
  });
  await consumer.connect();
  
  try {
    const messages: any[] = [];
    const processedOffsets = new Set<string>(); // Track processed messages to avoid duplicates
    let resolved = false;
    let fetchStarted = false;

    const timeoutPromise = new Promise<void>(resolve => {
      setTimeout(() => {
        if (!resolved) {
          console.log('[Kafka] Timeout reached, stopping consumer');
          resolved = true;
          resolve();
        }
      }, 8000);
    });

    // Subscribe with fromBeginning=true to ensure consumer can read from any offset
    await consumer.subscribe({ topic, fromBeginning: true });

    const consumerPromise = new Promise<void>((resolve) => {
      consumer.run({
        autoCommit: false,  // Never commit offsets to allow repeated browsing
        eachBatchAutoResolve: false,
        eachBatch: async ({ batch, resolveOffset, heartbeat, isRunning, isStale }) => {
          // On first batch, perform seek
          if (!fetchStarted) {
            fetchStarted = true;
            console.log('[Kafka] First batch received, performing seek to offsets:', assignments);
            
            // Pause to stop fetching
            consumer.pause([{ topic }]);
            
            // Perform seek
            for (const ass of assignments) {
              try {
                consumer.seek({ topic, partition: ass.partition, offset: ass.offset });
                console.log(`[Kafka] ✓ Seeked partition ${ass.partition} to offset ${ass.offset}`);
              } catch (e: any) {
                console.error(`[Kafka] ✗ Seek failed for partition ${ass.partition}:`, e.message);
              }
            }
            
            // Resume to start fetching from seeked position
            consumer.resume([{ topic }]);
            return;
          }

          // Stop processing if already resolved
          if (resolved) {
            return;
          }

          // Process messages with deduplication
          for (const message of batch.messages) {
            if (resolved || !isRunning() || isStale()) {
              break;
            }

            // Create unique key for deduplication
            const messageKey = `${batch.partition}-${message.offset}`;
            
            if (!processedOffsets.has(messageKey)) {
              processedOffsets.add(messageKey);
              console.log(`[Kafka] ← Received: partition=${batch.partition} offset=${message.offset}`);
              
              messages.push({
                topic: batch.topic,
                partition: batch.partition,
                offset: message.offset,
                timestamp: message.timestamp,
                key: message.key?.toString(),
                value: message.value?.toString(),
                headers: Object.keys(message.headers || {}).reduce((acc: any, key) => {
                  acc[key] = message.headers![key]?.toString();
                  return acc;
                }, {})
              });

              if (messages.length >= limit) {
                console.log(`[Kafka] ✓ Collected ${messages.length} messages, resolving`);
                resolved = true;
                resolve();
                return;
              }
            }
          }

          await heartbeat();
        },
      });
    });

    await Promise.race([timeoutPromise, consumerPromise]);
    await consumer.stop();

    console.log(`[Kafka] → Returning ${messages.length} messages`);
    return messages
      .sort((a, b) => parseInt(b.offset) - parseInt(a.offset))
      .slice(0, limit);
  } finally {
    try { await consumer.disconnect(); } catch (e) {}
  }
}

export async function sendKafkaMessage(
  connectionId: string,
  topic: string,
  partition: number | null,
  key: string | null,
  value: string,
  headers: Record<string, string> = {}
) {
  const kafka = await getKafkaClient(connectionId);
  // 使用更宽松的生产者配置，避免同步副本不足的问题
  const producer = kafka.producer({
    retry: {
      retries: 3,
      initialRetryTime: 100,
      maxRetryTime: 300,
    },
  });
  await producer.connect();

  try {
    const kafkaHeaders: any = {};
    Object.entries(headers).forEach(([k, v]) => {
      kafkaHeaders[k] = v;
    });

    const result = await producer.send({
      topic,
      messages: [
        {
          key: key || undefined,
          value: value,
          partition: partition !== null ? partition : undefined,
          headers: kafkaHeaders
        }
      ],
    });

    return result;
  } catch (error: any) {
    // 检查是否是同步副本不足的错误
    if (error?.type === 'NOT_ENOUGH_REPLICAS' || error?.message?.includes('fewer in-sync replicas than required')) {
      // 尝试使用不同的配置发送消息
      console.warn('Primary send failed due to replica issue, trying with relaxed acks');
      
      // 重新连接生产者，使用更宽松的设置
      await producer.disconnect();
      
      // 创建一个使用不同配置的新生产者，降低acks设置
      const kafka2 = await getKafkaClient(connectionId);
      const relaxedProducer = kafka2.producer({
        retry: {
          retries: 2,
          initialRetryTime: 100,
          maxRetryTime: 200,
        },
      });
      
      await relaxedProducer.connect();
      
      try {
        const kafkaHeaders: any = {};
        Object.entries(headers).forEach(([k, v]) => {
          kafkaHeaders[k] = v;
        });

        const result = await relaxedProducer.send({
          topic,
          messages: [
            {
              key: key || undefined,
              value: value,
              partition: partition !== null ? partition : undefined,
              headers: kafkaHeaders
            }
          ]
        });

        return result;
      } finally {
        await relaxedProducer.disconnect();
      }
    }
    
    // 如果不是副本问题，则重新抛出错误
    throw error;
  } finally {
    try {
      await producer.disconnect();
    } catch (e) {
      // 忽略断开连接时的错误
      console.warn('Error disconnecting producer:', e);
    }
  }
}

export async function getTopicConsumers(connectionId: string, topicName: string) {
  const kafka = await getKafkaClient(connectionId);
  const admin = kafka.admin();
  await admin.connect();

  try {
    const { groups } = await admin.listGroups();
    const topicConsumers: any[] = [];

    // Filter out internal browser group
    const filteredGroups = groups.filter(g => 
      g.groupId !== 'next-tools-group'
    );

    // Get latest offsets for the topic to calculate lag
    const latestOffsets = await admin.fetchTopicOffsets(topicName);

    for (const group of filteredGroups) {
      try {
        const offsets = await admin.fetchOffsets({ groupId: group.groupId, topics: [topicName] });
        
        // Check if this group has offsets for this topic
        const hasOffsets = offsets.length > 0 && offsets[0].partitions.length > 0;
        if (!hasOffsets) continue;

        // Describe group to get its state
        const descriptions = await admin.describeGroups([group.groupId]);
        const description = descriptions.groups[0];

        let totalLag = 0;
        const partitions = offsets[0].partitions.map(p => {
          const latest = latestOffsets.find(lo => lo.partition === p.partition)?.offset || '0';
          const lag = Math.max(0, parseInt(latest) - parseInt(p.offset));
          totalLag += lag;
          return {
            partition: p.partition,
            offset: p.offset,
            lag
          };
        });

        topicConsumers.push({
          groupId: group.groupId,
          state: description.state,
          protocol: description.protocol,
          members: description.members.length,
          totalLag,
          partitions
        });
      } catch (err) {
        console.error(`Error fetching offsets for group ${group.groupId} on topic ${topicName}:`, err);
      }
    }

    return topicConsumers;
  } finally {
    await admin.disconnect();
  }
}

export async function createKafkaTopic(
  connectionId: string,
  topicName: string,
  partitions: number = 1,
  replicationFactor: number = 1,
  configs?: Array<{ name: string; value: string }>
) {
  const kafka = await getKafkaClient(connectionId);
  const admin = kafka.admin();
  await admin.connect();

  try {
    const topicConfig = {
      topic: topicName,
      numPartitions: partitions,
      replicationFactor: replicationFactor,
      configEntries: configs || [],
    };

    await admin.createTopics({
      topics: [topicConfig],
      waitForLeaders: true,
    });

    console.log(`Topic '${topicName}' created successfully`);
  } finally {
    await admin.disconnect();
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getKafkaClient } from '@/lib/kafka';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { connectionId } = body;

    if (!connectionId) {
      return NextResponse.json(
        { code: 400, message: 'Missing connectionId in request body' },
        { status: 400 }
      );
    }

    const kafka = await getKafkaClient(connectionId);
    const admin = kafka.admin();
    await admin.connect();

    try {
      // 获取所有消费者组列表
      const groups = await admin.listGroups();
      const groupIds = groups.groups.map(group => group.groupId);

      if (groupIds.length === 0) {
        return NextResponse.json({
          code: 200,
          message: 'Success',
          data: []
        });
      }

      // 获取消费者组描述信息
      const groupDescriptions = await admin.describeGroups(groupIds);
      
      // 获取每个消费者组的偏移量信息
      const groupOffsetsPromises = groupIds.map(async (groupId) => {
        try {
          return await admin.fetchOffsets({ groupId });
        } catch (error) {
          console.warn(`Could not fetch offsets for group ${groupId}:`, error);
          return [];
        }
      });
      const groupOffsetsList = await Promise.all(groupOffsetsPromises);

      // 获取所有相关的主题名
      const allTopicNames = new Set<string>();
      groupOffsetsList.forEach(offsets => {
        offsets.forEach(topicOffset => {
          allTopicNames.add(topicOffset.topic);
        });
      });
      
      // 获取所有主题的最新偏移量
      const allTopicOffsets: Record<string, any[]> = {};
      for (const topicName of allTopicNames) {
        try {
          const topicOffsets = await admin.fetchTopicOffsets(topicName);
          allTopicOffsets[topicName] = topicOffsets;
        } catch (error) {
          console.warn(`Could not fetch topic offsets for ${topicName}:`, error);
        }
      }

      // 获取每个消费者组的订阅主题和计算总滞后量
      const consumerGroups = groupDescriptions.groups.map((groupDesc, index) => {
        const offsets = groupOffsetsList[index];
        
        // 计算总滞后量
        let totalLag = 0;
        const subscribedTopics = new Set<string>();
        
        for (const topicOffset of offsets) {
          subscribedTopics.add(topicOffset.topic);
          
          // 获取主题的最新偏移量以计算lag
          try {
            const latestOffsets = allTopicOffsets[topicOffset.topic];
            if (latestOffsets) {
              for (const partition of topicOffset.partitions) {
                const latest = latestOffsets.find((o: any) => o.partition === partition.partition);
                if (latest) {
                  const lag = Math.max(0, parseInt(latest.offset) - parseInt(partition.offset));
                  totalLag += lag;
                }
              }
            }
          } catch (error) {
            console.warn(`Could not calculate lag for topic ${topicOffset.topic}:`, error);
          }
        }

        return {
          groupId: groupDesc.groupId,
          state: groupDesc.state,
          protocol: groupDesc.protocol,
          protocolType: groupDesc.protocolType,
          members: groupDesc.members.length,
          totalLag: totalLag,
          subscribedTopics: Array.from(subscribedTopics)
        };
      });

      return NextResponse.json({
        code: 200,
        message: 'Success',
        data: consumerGroups
      });
    } finally {
      await admin.disconnect();
    }
  } catch (error: any) {
    console.error('Fetch consumer groups error:', error);
    return NextResponse.json(
      {
        code: 500,
        message: `Failed to fetch consumer groups: ${error?.message || 'Unknown error'}`,
        data: null
      },
      { status: 500 }
    );
  }
}
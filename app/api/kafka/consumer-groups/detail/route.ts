import { NextRequest, NextResponse } from 'next/server';
import { getKafkaClient } from '@/lib/kafka';
import { MemberAssignment } from 'kafkajs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { connectionId, groupId } = body;

    if (!connectionId) {
      return NextResponse.json(
        { code: 400, message: 'Missing connectionId in request body' },
        { status: 400 }
      );
    }

    if (!groupId) {
      return NextResponse.json(
        { code: 400, message: 'Missing groupId in request body' },
        { status: 400 }
      );
    }

    const kafka = await getKafkaClient(connectionId);
    const admin = kafka.admin();
    await admin.connect();

    try {
      // 获取消费者组描述信息
      const groupDescriptions = await admin.describeGroups([groupId]);
      const groupDescription = groupDescriptions.groups[0];

      // 获取消费者组的偏移量信息
      const groupOffsets = await admin.fetchOffsets({ groupId });
      
      // 获取主题的最新偏移量以计算lag
      const topicOffsetsPromises = groupOffsets.map(async (topicOffset) => {
        const latestOffsets = await admin.fetchTopicOffsets(topicOffset.topic);
        return { topic: topicOffset.topic, latestOffsets };
      });
      const topicOffsetsResults = await Promise.all(topicOffsetsPromises);

      // 计算总滞后量
      let totalLag = 0;
      const lagDetails = [];

      for (const topicOffset of groupOffsets) {
        const topicLatest = topicOffsetsResults.find(t => t.topic === topicOffset.topic);
        if (topicLatest) {
          for (const partition of topicOffset.partitions) {
            const latest = topicLatest.latestOffsets.find(o => o.partition === partition.partition);
            if (latest) {
              const lag = Math.max(0, parseInt(latest.offset) - parseInt(partition.offset));
              totalLag += lag;
              lagDetails.push({
                topic: topicOffset.topic,
                partition: partition.partition,
                offset: partition.offset,
                lag: lag
              });
            }
          }
        }
      }

      // 解析成员分配信息
      console.log('Group members:', JSON.stringify(groupDescription.members, null, 2));

      // 构建响应数据
      const result = {
        groupId: groupDescription.groupId,
        state: groupDescription.state,
        protocol: groupDescription.protocol,
        protocolType: groupDescription.protocolType,
        members: groupDescription.members.length,
        totalLag,
        lagDetails,
        assignments: groupDescription.members.map((member: any) => {
          let assignments: any[] = [];
          
          try {
            // 使用groupOffsets来构建所有主题和分区的列表
            // 如果group只有一个消费者，那么所有分区都分配给它
            if (groupDescription.members.length === 1) {
              const topicPartitionsMap = new Map<string, number[]>();
              
              for (const topicOffset of groupOffsets) {
                const partitions = topicOffset.partitions.map(p => p.partition);
                topicPartitionsMap.set(topicOffset.topic, partitions);
              }
              
              assignments = Array.from(topicPartitionsMap.entries()).map(([topic, partitions]) => ({
                topic,
                partitions
              }));
            } else {
              // 对于多个成员，需要从 memberAssignment 中解析
              // 暂时返回空数组，因为需要更复杂的解析逻辑
              console.log('Member assignment buffer:', member.memberAssignment);
            }
          } catch (err) {
            console.error('Error parsing member assignment:', err);
          }
          
          return {
            memberId: member.memberId,
            clientId: member.clientId,
            host: (member as any).clientHost || 'N/A',
            assignments
          };
        })
      };

      return NextResponse.json({
        code: 200,
        message: 'Success',
        data: result
      });
    } finally {
      await admin.disconnect();
    }
  } catch (error: any) {
    console.error('Fetch consumer group detail error:', error);
    return NextResponse.json(
      {
        code: 500,
        message: `Failed to fetch consumer group detail: ${error?.message || 'Unknown error'}`,
        data: null
      },
      { status: 500 }
    );
  }
}
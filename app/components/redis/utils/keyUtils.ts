/**
 * Redis Key 工具函数
 */

export interface ParsedKey {
  connectionId: string;
  dbIndex: number;
  actualKey: string;
}

/**
 * 解析fullKey格式为三个独立部分
 * fullKey格式: connectionId-dbIndex-actualKey
 * connectionId格式: redis_${timestamp}_${random}（不包含dash）
 * 由于actualKey可能包含dash，需要从后往前逐个检查dash
 */
export function parseFullKey(fullKey: string): ParsedKey {
  // 从后往前查找dash，需要找到dbIndex后的dash
  // 因为dbIndex是数字（0-15），我们可以通过正则匹配来定位
  // 最长匹配策略：找到最后一个"-数字-"的模式
  let connectionId = '';
  let dbIndex = -1;
  let actualKey = '';

  // 尝试从后往前找到正确的分割点
  // 遍历可能的dbIndex位置（最多从倒数第二个字符开始）
  for (let i = fullKey.length - 1; i >= 0; i--) {
    if (fullKey[i] === '-') {
      const potentialActualKey = fullKey.substring(i + 1);
      const rest = fullKey.substring(0, i);
      
      // 再找rest中的最后一个dash
      const lastDashInRest = rest.lastIndexOf('-');
      if (lastDashInRest >= 0) {
        const potentialDbIndexStr = rest.substring(lastDashInRest + 1);
        const potentialDbIndex = parseInt(potentialDbIndexStr, 10);
        
        // 检查是否是有效的dbIndex（0-15）
        if (!isNaN(potentialDbIndex) && potentialDbIndex >= 0 && potentialDbIndex <= 15) {
          connectionId = rest.substring(0, lastDashInRest);
          dbIndex = potentialDbIndex;
          actualKey = potentialActualKey;
          break;
        }
      }
    }
  }

  if (dbIndex === -1 || !connectionId || !actualKey) {
    throw new Error(`Invalid fullKey format: ${fullKey}. Expected format: connectionId-dbIndex-actualKey`);
  }

  return { connectionId, dbIndex, actualKey };
}

/**
 * 构造fullKey格式
 */
export function buildFullKey(connectionId: string, dbIndex: number, key: string): string {
  return `${connectionId}-${dbIndex}-${key}`;
}

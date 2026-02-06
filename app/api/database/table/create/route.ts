import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateDatabaseConnection } from '@/lib/databaseCache';

export async function POST(request: NextRequest) {
  try {
    const { 
      connectionId, 
      tabId, 
      dbName, 
      tableName, 
      columns, 
      schema 
    } = await request.json();

    if (!connectionId || !dbName || !tableName || !columns || !Array.isArray(columns)) {
      return NextResponse.json(
        { 
          code: 400, 
          message: 'Missing required parameters: connectionId, dbName, tableName, columns' 
        },
        { status: 400 }
      );
    }

    const connection = await getOrCreateDatabaseConnection(connectionId, tabId, dbName);
    if (!connection) {
      return NextResponse.json(
        { code: 404, message: 'Database connection not found' },
        { status: 404 }
      );
    }

    const { type: dbType, executeQuery } = connection;

    // 构建CREATE TABLE语句
    let createTableSQL = '';
    
    if (dbType === 'mysql') {
      // MySQL 创建表语句
      const columnDefs = columns.map(col => {
        // 构建带参数的数据类型
        let dataType = col.dataType;
        if (col.typeLength) {
          // 如果提供了类型长度/精度，则使用它
          if (['VARCHAR', 'CHAR', 'VARBINARY', 'BINARY'].some(t => dataType.toUpperCase() === t)) {
            dataType = `${dataType}(${col.typeLength})`;
          } else if (['DECIMAL', 'NUMERIC'].some(t => dataType.toUpperCase() === t)) {
            // 对于DECIMAL/NUMERIC，使用长度和小数位
            if (col.scale) {
              dataType = `${dataType}(${col.typeLength},${col.scale})`;
            } else {
              dataType = `${dataType}(${col.typeLength})`;
            }
          } else if (['BIT'].some(t => dataType.toUpperCase() === t)) {
            dataType = `${dataType}(${col.typeLength})`;
          } else if (['ENUM', 'SET'].some(t => dataType.toUpperCase() === t)) {
            // 对于 ENUM 和 SET，typeLength 包含所有值（可能用逗号分隔）
            if (col.typeLength) {
              // 如果 typeLength 包含逗号，说明是完整的值列表
              if (col.typeLength.includes(',')) {
                dataType = `${dataType}(${col.typeLength})`;
              } else {
                // 否则 typeLength 和 scale 分别是两个值
                const values = [col.typeLength];
                if (col.scale) values.push(col.scale);
                dataType = `${dataType}(${values.join(',')})`;
              }
            }
          } else if (['TIME', 'DATETIME', 'TIMESTAMP', 'YEAR'].some(t => dataType.toUpperCase() === t)) {
            // 对于时间类型，可以指定精度
            dataType = `${dataType}(${col.typeLength})`;
          }
        } else {
          // 如果没有提供类型长度，对某些类型使用默认值
          if (['VARCHAR', 'CHAR'].some(t => dataType.toUpperCase() === t)) {
            dataType = `${dataType}(255)`; // 默认长度
          } else if (['DECIMAL', 'NUMERIC'].some(t => dataType.toUpperCase() === t)) {
            dataType = `${dataType}(10,2)`; // 默认精度
          } else if (['TIME', 'DATETIME', 'TIMESTAMP'].some(t => dataType.toUpperCase() === t)) {
            dataType = `${dataType}(0)`; // 默认精度
          }
        }
        
        let def = `\`${col.name}\` ${dataType}`;
        
        if (col.nullable === false) {
          def += ' NOT NULL';
        }
        
        // 处理默认值，某些类型不支持默认值
        const noDefaultValueTypes = ['TEXT', 'LONGTEXT', 'MEDIUMTEXT', 'TINYTEXT', 'BLOB', 'LONGBLOB', 'MEDIUMBLOB', 'JSON'];
        const isNoDefaultType = noDefaultValueTypes.some(t => dataType.toUpperCase().includes(t));
        const isBitType = dataType.toUpperCase().startsWith('BIT');
        const isBinaryType = ['BINARY', 'VARBINARY'].some(t => dataType.toUpperCase().startsWith(t));
        const isEnumOrSetType = ['ENUM', 'SET'].some(t => col.dataType.toUpperCase() === t);
        
        if (col.defaultValue && !isNoDefaultType) {
          const defaultVal = col.defaultValue.toString();
          
          // 处理特殊的默认值格式
          if (defaultVal === 'CURRENT_TIMESTAMP') {
            def += ` DEFAULT CURRENT_TIMESTAMP`;
          } else if (isBitType && /^b'[01]+'$/.test(defaultVal)) {
            // BIT 类型的二进制字面值 (e.g., b'0', b'1', b'10101')
            def += ` DEFAULT ${defaultVal}`;
          } else if (isBinaryType && /^0x[0-9a-fA-F]+$/.test(defaultVal)) {
            // BINARY 类型的有效十六进制字面值 (e.g., 0x00, 0xFF)
            def += ` DEFAULT ${defaultVal}`;
          } else if (isBinaryType && defaultVal === '0x') {
            // 无效的十六进制值 '0x'，忽略默认值
            // 不添加 DEFAULT 子句
          } else if (isBitType) {
            // BIT 类型的其他默认值格式，忽略（MySQL 不支持）
            // 不添加 DEFAULT 子句
          } else if (isEnumOrSetType) {
            // ENUM/SET 类型：验证默认值是否在定义的值列表中
            const enumValues: string[] = [];
            if (col.typeLength) {
              const matches = col.typeLength.match(/'[^']+'/g);
              if (matches) enumValues.push(...matches.map((v: string) => v.slice(1, -1)));
            }
            if (col.scale) {
              const matches = col.scale.match(/'[^']+'/g);
              if (matches) enumValues.push(...matches.map((v: string) => v.slice(1, -1)));
            }
            // 只有默认值在列表中才添加 DEFAULT
            if (enumValues.includes(defaultVal)) {
              def += ` DEFAULT '${defaultVal}'`;
            }
            // 否则忽略无效的默认值
          } else if (typeof col.defaultValue === 'string') {
            def += ` DEFAULT '${col.defaultValue.replace(/'/g, "\\'")}'`;
          } else {
            def += ` DEFAULT ${col.defaultValue}`;
          }
        }
        
        if (col.isPrimaryKey) {
          def += ' PRIMARY KEY';
        }
        
        // 只有数字类型且是主键时，才允许 AUTO_INCREMENT
        const isNumeric = ['INT', 'BIGINT', 'SMALLINT', 'TINYINT', 'INTEGER'].some(t => dataType.toUpperCase().includes(t));
        if (col.autoIncrement && isNumeric && col.isPrimaryKey) {
          def += ' AUTO_INCREMENT';
        }
        
        if (col.comment) {
          def += ` COMMENT '${col.comment.replace(/'/g, "\\'")}'`;
        }
        
        return def;
      }).join(',\n  ');

      createTableSQL = `CREATE TABLE \`${dbName}\`.\`${tableName}\` (\n  ${columnDefs}\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`;
    } 
    else if (dbType === 'postgresql') {
      // PostgreSQL 创建表语句
      const columnDefs = columns.map(col => {
        // 构建带参数的数据类型
        let dataType = col.dataType;
        if (col.typeLength) {
          // 如果提供了类型长度/精度，则使用它
          if (['VARCHAR', 'CHAR', 'CHARACTER VARYING', 'CHARACTER'].some(t => dataType.toUpperCase() === t)) {
            dataType = `${dataType}(${col.typeLength})`;
          } else if (['DECIMAL', 'NUMERIC'].some(t => dataType.toUpperCase() === t)) {
            // 对于DECIMAL/NUMERIC，使用长度和小数位
            if (col.scale) {
              dataType = `${dataType}(${col.typeLength},${col.scale})`;
            } else {
              dataType = `${dataType}(${col.typeLength})`;
            }
          } else if (['TIME', 'TIMESTAMP'].some(t => dataType.toUpperCase() === t)) {
            // 对于时间类型，可以指定精度
            dataType = `${dataType}(${col.typeLength})`;
          }
        } else {
          // 如果没有提供类型长度，对某些类型使用默认值
          if (['VARCHAR', 'CHARACTER VARYING'].some(t => dataType.toUpperCase() === t)) {
            dataType = `${dataType}(255)`; // 默认长度
          } else if (['DECIMAL', 'NUMERIC'].some(t => dataType.toUpperCase() === t)) {
            dataType = `${dataType}(10,2)`; // 默认精度
          } else if (['TIME', 'TIMESTAMP'].some(t => dataType.toUpperCase() === t)) {
            dataType = `${dataType}(6)`; // 默认精度
          }
        }
        
        let def = `"${col.name}" ${dataType}`;
        
        if (col.nullable === false) {
          def += ' NOT NULL';
        }
        
        if (col.defaultValue) {
          if (typeof col.defaultValue === 'string') {
            def += ` DEFAULT '${col.defaultValue.replace(/'/g, "\\'")}'`;
          } else {
            def += ` DEFAULT ${col.defaultValue}`;
          }
        }
        
        return def;
      }).join(',\n  ');

      // 如果有主键列，添加主键约束
      const primaryKeyCols = columns.filter(col => col.isPrimaryKey).map(col => `"${col.name}"`);
      let primaryKeyConstraint = '';
      if (primaryKeyCols.length > 0) {
        primaryKeyConstraint = `, CONSTRAINT "${tableName}_pkey" PRIMARY KEY (${primaryKeyCols.join(', ')})`;
      }

      const schemaName = schema || 'public';
      createTableSQL = `CREATE TABLE "${schemaName}"."${tableName}" (\n  ${columnDefs}${primaryKeyConstraint}\n);`;
    } 
    else if (dbType === 'sqlite') {
      // SQLite 创建表语句
      const columnDefs = columns.map(col => {
        // 构建带参数的数据类型
        // SQLite 对数据类型比较宽松，大多数类型都可以接受长度参数，但实际存储不受影响
        let dataType = col.dataType;
        if (col.typeLength) {
          // 如果提供了类型长度/精度，则使用它
          if (['VARCHAR', 'NVARCHAR', 'CHAR', 'NCHAR', 'TEXT', 'BLOB'].some(t => dataType.toUpperCase() === t)) {
            dataType = `${dataType}(${col.typeLength})`;
          } else if (['DECIMAL', 'NUMERIC'].some(t => dataType.toUpperCase() === t)) {
            // 对于DECIMAL/NUMERIC，使用长度和小数位
            if (col.scale) {
              dataType = `${dataType}(${col.typeLength},${col.scale})`;
            } else {
              dataType = `${dataType}(${col.typeLength})`;
            }
          }
        }
        
        let def = `"${col.name}" ${dataType}`;
        
        if (col.nullable === false) {
          def += ' NOT NULL';
        }
        
        if (col.defaultValue) {
          if (typeof col.defaultValue === 'string') {
            def += ` DEFAULT '${col.defaultValue.replace(/'/g, "\\'")}'`;
          } else {
            def += ` DEFAULT ${col.defaultValue}`;
          }
        }
        
        if (col.isPrimaryKey) {
          def += ' PRIMARY KEY';
          
          if (col.autoIncrement) {
            def += ' AUTOINCREMENT';
          }
        }
        
        return def;
      }).join(',\n  ');

      createTableSQL = `CREATE TABLE "${tableName}" (\n  ${columnDefs}\n);`;
    } 
    else {
      return NextResponse.json(
        { code: 400, message: `Unsupported database type: ${dbType}` },
        { status: 400 }
      );
    }

    try {
      // 执行创建表的SQL
      await executeQuery(createTableSQL);

      return NextResponse.json({
        code: 200,
        message: 'Table created successfully'
      });
    } catch (queryError: any) {
      console.error('Error executing create table SQL:', queryError);
      return NextResponse.json(
        { 
          code: 500, 
          message: `Failed to create table: ${queryError.message}` 
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Error creating table:', error);
    return NextResponse.json(
      { code: 500, message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
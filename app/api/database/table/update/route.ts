import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateDatabaseConnection } from '@/lib/databaseCache';

export async function POST(request: NextRequest) {
  try {
    const { 
      connectionId, 
      tabId, 
      dbName, 
      tableName, 
      originalTableName, 
      columns,
      changedColumns,
      deletedColumns,
      addedColumns,
      allColumns,
      schema 
    } = await request.json();

    // 支持两种模式：完整更新和增量更新
    const isIncrementalUpdate = changedColumns !== undefined || deletedColumns !== undefined || addedColumns !== undefined;
    
    // 确定实际要使用的列列表
    let actualColumns: any[];
    if (isIncrementalUpdate) {
      // 增量更新模式：使用 allColumns（完整列表用于验证）
      actualColumns = allColumns || [];
    } else {
      // 完整更新模式：使用 columns
      actualColumns = columns || [];
    }

    if (!connectionId || !dbName || !tableName || !actualColumns || !Array.isArray(actualColumns)) {
      return NextResponse.json(
        { code: 400, message: 'Missing required parameters: connectionId, dbName, tableName, columns' },
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

    // 用于查询现有列的表名（如果修改了表名，使用原始表名查询；否则使用新表名）
    const queryTableName = originalTableName || tableName;

    let alterStatements: string[] = [];

    if (dbType === 'mysql') {
      // 增量更新优化：只处理改动的字段
      if (isIncrementalUpdate) {
        // 删除字段
        if (deletedColumns && deletedColumns.length > 0) {
          deletedColumns.forEach((colName: string) => {
            alterStatements.push(`ALTER TABLE \`${dbName}\`.\`${queryTableName}\` DROP COLUMN \`${colName}\``);
          });
        }
        
        // 修改字段
        if (changedColumns && changedColumns.length > 0) {
          changedColumns.forEach((col: any) => {
            let dataType = col.dataType;
            if (col.typeLength) {
              if (['VARCHAR', 'CHAR', 'VARBINARY', 'BINARY'].some(t => dataType.toUpperCase() === t)) {
                dataType = `${dataType}(${col.typeLength})`;
              } else if (['DECIMAL', 'NUMERIC'].some(t => dataType.toUpperCase() === t)) {
                if (col.scale) {
                  dataType = `${dataType}(${col.typeLength},${col.scale})`;
                } else {
                  dataType = `${dataType}(${col.typeLength})`;
                }
              } else if (['BIT'].some(t => dataType.toUpperCase() === t)) {
                dataType = `${dataType}(${col.typeLength})`;
              } else if (['ENUM', 'SET'].some(t => dataType.toUpperCase() === t)) {
                if (col.typeLength) {
                  if (col.typeLength.includes(',')) {
                    dataType = `${dataType}(${col.typeLength})`;
                  } else {
                    const values = [col.typeLength];
                    if (col.scale) values.push(col.scale);
                    dataType = `${dataType}(${values.join(',')})`;
                  }
                }
              } else if (['TIME', 'DATETIME', 'TIMESTAMP', 'YEAR'].some(t => dataType.toUpperCase() === t)) {
                dataType = `${dataType}(${col.typeLength})`;
              }
            }

            let def = `MODIFY COLUMN \`${col.name}\` ${dataType}`;
            if (col.nullable === false) {
              def += ' NOT NULL';
            }
            
            // 处理默认值
            const noDefaultValueTypes = ['TEXT', 'LONGTEXT', 'MEDIUMTEXT', 'TINYTEXT', 'BLOB', 'LONGBLOB', 'MEDIUMBLOB', 'JSON'];
            const isNoDefaultType = noDefaultValueTypes.some(t => dataType.toUpperCase().includes(t));
            const isBitType = dataType.toUpperCase().startsWith('BIT');
            const isBinaryType = ['BINARY', 'VARBINARY'].some(t => dataType.toUpperCase().startsWith(t));
            const isEnumOrSetType = ['ENUM', 'SET'].some(t => col.dataType.toUpperCase() === t);
            
            if (col.defaultValue && !isNoDefaultType) {
              const defaultVal = col.defaultValue.toString();
              
              if (defaultVal === 'CURRENT_TIMESTAMP') {
                def += ` DEFAULT CURRENT_TIMESTAMP`;
              } else if (isBitType && /^b'[01]+'$/.test(defaultVal)) {
                def += ` DEFAULT ${defaultVal}`;
              } else if (isBinaryType && /^0x[0-9a-fA-F]+$/.test(defaultVal)) {
                def += ` DEFAULT ${defaultVal}`;
              } else if (isBinaryType && defaultVal === '0x') {
                // 无效的十六进制值，忽略
              } else if (isBitType) {
                // BIT 类型的其他默认值格式，忽略
              } else if (isEnumOrSetType) {
                // ENUM/SET 类型：验证默认值
                const enumValues: string[] = [];
                if (col.typeLength) {
                  const matches = col.typeLength.match(/'[^']+'/g);
                  if (matches) enumValues.push(...matches.map((v: string) => v.slice(1, -1)));
                }
                if (col.scale) {
                  const matches = col.scale.match(/'[^']+'/g);
                  if (matches) enumValues.push(...matches.map((v: string) => v.slice(1, -1)));
                }
                if (enumValues.includes(defaultVal)) {
                  def += ` DEFAULT '${defaultVal}'`;
                }
              } else if (typeof col.defaultValue === 'string') {
                def += ` DEFAULT '${col.defaultValue.replace(/'/g, "\\'")}'`;
              } else {
                def += ` DEFAULT ${col.defaultValue}`;
              }
            }

            const isNumeric = ['INT', 'BIGINT', 'SMALLINT', 'TINYINT', 'INTEGER'].some(t => dataType.toUpperCase().includes(t));
            if (col.autoIncrement && isNumeric) {
              def += ' AUTO_INCREMENT';
            }
            
            if (col.comment) {
              def += ` COMMENT '${col.comment.replace(/'/g, "\\'")}'`;
            }

            alterStatements.push(`ALTER TABLE \`${dbName}\`.\`${queryTableName}\` ${def}`);
          });
        }
        
        // 添加新字段
        if (addedColumns && addedColumns.length > 0) {
          addedColumns.forEach((col: any) => {
            let dataType = col.dataType;
            if (col.typeLength) {
              if (['VARCHAR', 'CHAR', 'VARBINARY', 'BINARY'].some(t => dataType.toUpperCase() === t)) {
                dataType = `${dataType}(${col.typeLength})`;
              } else if (['DECIMAL', 'NUMERIC'].some(t => dataType.toUpperCase() === t)) {
                if (col.scale) {
                  dataType = `${dataType}(${col.typeLength},${col.scale})`;
                } else {
                  dataType = `${dataType}(${col.typeLength})`;
                }
              } else if (['BIT'].some(t => dataType.toUpperCase() === t)) {
                dataType = `${dataType}(${col.typeLength})`;
              } else if (['ENUM', 'SET'].some(t => dataType.toUpperCase() === t)) {
                if (col.typeLength) {
                  if (col.typeLength.includes(',')) {
                    dataType = `${dataType}(${col.typeLength})`;
                  } else {
                    const values = [col.typeLength];
                    if (col.scale) values.push(col.scale);
                    dataType = `${dataType}(${values.join(',')})`;
                  }
                }
              } else if (['TIME', 'DATETIME', 'TIMESTAMP', 'YEAR'].some(t => dataType.toUpperCase() === t)) {
                dataType = `${dataType}(${col.typeLength})`;
              }
            }

            let def = `ADD COLUMN \`${col.name}\` ${dataType}`;
            if (col.nullable === false) {
              def += ' NOT NULL';
            }
            
            const noDefaultValueTypes = ['TEXT', 'LONGTEXT', 'MEDIUMTEXT', 'TINYTEXT', 'BLOB', 'LONGBLOB', 'MEDIUMBLOB', 'JSON'];
            const isNoDefaultType = noDefaultValueTypes.some(t => dataType.toUpperCase().includes(t));
            const isBitType = dataType.toUpperCase().startsWith('BIT');
            const isBinaryType = ['BINARY', 'VARBINARY'].some(t => dataType.toUpperCase().startsWith(t));
            const isEnumOrSetType = ['ENUM', 'SET'].some(t => col.dataType.toUpperCase() === t);
            
            if (col.defaultValue && !isNoDefaultType) {
              const defaultVal = col.defaultValue.toString();
              
              if (defaultVal === 'CURRENT_TIMESTAMP') {
                def += ` DEFAULT CURRENT_TIMESTAMP`;
              } else if (isBitType && /^b'[01]+'$/.test(defaultVal)) {
                def += ` DEFAULT ${defaultVal}`;
              } else if (isBinaryType && /^0x[0-9a-fA-F]+$/.test(defaultVal)) {
                def += ` DEFAULT ${defaultVal}`;
              } else if (isBinaryType && defaultVal === '0x') {
                // 无效的十六进制值，忽略
              } else if (isBitType) {
                // BIT 类型的其他默认值格式，忽略
              } else if (isEnumOrSetType) {
                const enumValues: string[] = [];
                if (col.typeLength) {
                  const matches = col.typeLength.match(/'[^']+'/g);
                  if (matches) enumValues.push(...matches.map((v: string) => v.slice(1, -1)));
                }
                if (col.scale) {
                  const matches = col.scale.match(/'[^']+'/g);
                  if (matches) enumValues.push(...matches.map((v: string) => v.slice(1, -1)));
                }
                if (enumValues.includes(defaultVal)) {
                  def += ` DEFAULT '${defaultVal}'`;
                }
              } else if (typeof col.defaultValue === 'string') {
                def += ` DEFAULT '${col.defaultValue.replace(/'/g, "\\'")}'`;
              } else {
                def += ` DEFAULT ${col.defaultValue}`;
              }
            }
            
            if (col.comment) {
              def += ` COMMENT '${col.comment.replace(/'/g, "\\'")}'`;
            }

            const isNumeric = ['INT', 'BIGINT', 'SMALLINT', 'TINYINT', 'INTEGER'].some(t => dataType.toUpperCase().includes(t));
            if (col.autoIncrement && isNumeric) {
              def += ' AUTO_INCREMENT';
            }

            alterStatements.push(`ALTER TABLE \`${dbName}\`.\`${queryTableName}\` ${def}`);
          });
        }
      } else {
        // 完整更新模式：获取现有列，对比所有改动
        const existingResult = await executeQuery(`SHOW FULL COLUMNS FROM \`${dbName}\`.\`${queryTableName}\``);
        const existingColumnNames = existingResult.rows.map((row: any) => row.Field || row.field);
        const existingPrimaryKeys = existingResult.rows
          .filter((row: any) => row.Key === 'PRI')
          .map((row: any) => row.Field || row.field);

        const newColumns = actualColumns.filter((col: any) => !existingColumnNames.includes(col.name));
        const modifiedColumns = actualColumns.filter((col: any) => existingColumnNames.includes(col.name));
        const deletedColumnNames = existingColumnNames.filter((colName: string) => !actualColumns.some((col: any) => col.name === colName));

        // 修改列逻辑（与上面相同）
        modifiedColumns.forEach((col: any) => {
          let dataType = col.dataType;
          if (col.typeLength) {
            if (['VARCHAR', 'CHAR', 'VARBINARY', 'BINARY'].some(t => dataType.toUpperCase() === t)) {
              dataType = `${dataType}(${col.typeLength})`;
            } else if (['DECIMAL', 'NUMERIC'].some(t => dataType.toUpperCase() === t)) {
              if (col.scale) {
                dataType = `${dataType}(${col.typeLength},${col.scale})`;
              } else {
                dataType = `${dataType}(${col.typeLength})`;
              }
            } else if (['BIT'].some(t => dataType.toUpperCase() === t)) {
              dataType = `${dataType}(${col.typeLength})`;
            } else if (['ENUM', 'SET'].some(t => dataType.toUpperCase() === t)) {
              if (col.typeLength) {
                if (col.typeLength.includes(',')) {
                  dataType = `${dataType}(${col.typeLength})`;
                } else {
                  const values = [col.typeLength];
                  if (col.scale) values.push(col.scale);
                  dataType = `${dataType}(${values.join(',')})`;
                }
              }
            } else if (['TIME', 'DATETIME', 'TIMESTAMP', 'YEAR'].some(t => dataType.toUpperCase() === t)) {
              dataType = `${dataType}(${col.typeLength})`;
            }
          }

          let def = `MODIFY COLUMN \`${col.name}\` ${dataType}`;
          if (col.nullable === false) {
            def += ' NOT NULL';
          }
          
          const noDefaultValueTypes = ['TEXT', 'LONGTEXT', 'MEDIUMTEXT', 'TINYTEXT', 'BLOB', 'LONGBLOB', 'MEDIUMBLOB', 'JSON'];
          const isNoDefaultType = noDefaultValueTypes.some(t => dataType.toUpperCase().includes(t));
          const isBitType = dataType.toUpperCase().startsWith('BIT');
          const isBinaryType = ['BINARY', 'VARBINARY'].some(t => dataType.toUpperCase().startsWith(t));
          const isEnumOrSetType = ['ENUM', 'SET'].some(t => col.dataType.toUpperCase() === t);
          
          if (col.defaultValue && !isNoDefaultType) {
            const defaultVal = col.defaultValue.toString();
            
            if (defaultVal === 'CURRENT_TIMESTAMP') {
              def += ` DEFAULT CURRENT_TIMESTAMP`;
            } else if (isBitType && /^b'[01]+'$/.test(defaultVal)) {
              def += ` DEFAULT ${defaultVal}`;
            } else if (isBinaryType && /^0x[0-9a-fA-F]+$/.test(defaultVal)) {
              def += ` DEFAULT ${defaultVal}`;
            } else if (isBinaryType && defaultVal === '0x') {
              // 无效值，忽略
            } else if (isBitType) {
              // 忽略
            } else if (isEnumOrSetType) {
              const enumValues: string[] = [];
              if (col.typeLength) {
                const matches = col.typeLength.match(/'[^']+'/g);
                if (matches) enumValues.push(...matches.map((v: string) => v.slice(1, -1)));
              }
              if (col.scale) {
                const matches = col.scale.match(/'[^']+'/g);
                if (matches) enumValues.push(...matches.map((v: string) => v.slice(1, -1)));
              }
              if (enumValues.includes(defaultVal)) {
                def += ` DEFAULT '${defaultVal}'`;
              }
            } else if (typeof col.defaultValue === 'string') {
              def += ` DEFAULT '${col.defaultValue.replace(/'/g, "\\'")}'`;
            } else {
              def += ` DEFAULT ${col.defaultValue}`;
            }
          }

          const isNumeric = ['INT', 'BIGINT', 'SMALLINT', 'TINYINT', 'INTEGER'].some(t => dataType.toUpperCase().includes(t));
          if (col.autoIncrement && isNumeric) {
            def += ' AUTO_INCREMENT';
          }
          
          if (col.comment) {
            def += ` COMMENT '${col.comment.replace(/'/g, "\\'")}'`;
          }

          alterStatements.push(`ALTER TABLE \`${dbName}\`.\`${queryTableName}\` ${def}`);
        });

        // 添加新列
        newColumns.forEach((col: any) => {
          let dataType = col.dataType;
          if (col.typeLength) {
            if (['VARCHAR', 'CHAR', 'VARBINARY', 'BINARY'].some(t => dataType.toUpperCase() === t)) {
              dataType = `${dataType}(${col.typeLength})`;
            } else if (['DECIMAL', 'NUMERIC'].some(t => dataType.toUpperCase() === t)) {
              if (col.scale) {
                dataType = `${dataType}(${col.typeLength},${col.scale})`;
              } else {
                dataType = `${dataType}(${col.typeLength})`;
              }
            } else if (['BIT'].some(t => dataType.toUpperCase() === t)) {
              dataType = `${dataType}(${col.typeLength})`;
            } else if (['ENUM', 'SET'].some(t => dataType.toUpperCase() === t)) {
              if (col.typeLength) {
                if (col.typeLength.includes(',')) {
                  dataType = `${dataType}(${col.typeLength})`;
                } else {
                  const values = [col.typeLength];
                  if (col.scale) values.push(col.scale);
                  dataType = `${dataType}(${values.join(',')})`;
                }
              }
            } else if (['TIME', 'DATETIME', 'TIMESTAMP', 'YEAR'].some(t => dataType.toUpperCase() === t)) {
              dataType = `${dataType}(${col.typeLength})`;
            }
          }

          let def = `ADD COLUMN \`${col.name}\` ${dataType}`;
          if (col.nullable === false) {
            def += ' NOT NULL';
          }
          
          const noDefaultValueTypes = ['TEXT', 'LONGTEXT', 'MEDIUMTEXT', 'TINYTEXT', 'BLOB', 'LONGBLOB', 'MEDIUMBLOB', 'JSON'];
          const isNoDefaultType = noDefaultValueTypes.some(t => dataType.toUpperCase().includes(t));
          const isBitType = dataType.toUpperCase().startsWith('BIT');
          const isBinaryType = ['BINARY', 'VARBINARY'].some(t => dataType.toUpperCase().startsWith(t));
          const isEnumOrSetType = ['ENUM', 'SET'].some(t => col.dataType.toUpperCase() === t);
          
          if (col.defaultValue && !isNoDefaultType) {
            const defaultVal = col.defaultValue.toString();
            
            if (defaultVal === 'CURRENT_TIMESTAMP') {
              def += ` DEFAULT CURRENT_TIMESTAMP`;
            } else if (isBitType && /^b'[01]+'$/.test(defaultVal)) {
              def += ` DEFAULT ${defaultVal}`;
            } else if (isBinaryType && /^0x[0-9a-fA-F]+$/.test(defaultVal)) {
              def += ` DEFAULT ${defaultVal}`;
            } else if (isBinaryType && defaultVal === '0x') {
              // 无效值，忽略
            } else if (isBitType) {
              // 忽略
            } else if (isEnumOrSetType) {
              const enumValues: string[] = [];
              if (col.typeLength) {
                const matches = col.typeLength.match(/'[^']+'/g);
                if (matches) enumValues.push(...matches.map((v: string) => v.slice(1, -1)));
              }
              if (col.scale) {
                const matches = col.scale.match(/'[^']+'/g);
                if (matches) enumValues.push(...matches.map((v: string) => v.slice(1, -1)));
              }
              if (enumValues.includes(defaultVal)) {
                def += ` DEFAULT '${defaultVal}'`;
              }
            } else if (typeof col.defaultValue === 'string') {
              def += ` DEFAULT '${col.defaultValue.replace(/'/g, "\\'")}'`;
            } else {
              def += ` DEFAULT ${col.defaultValue}`;
            }
          }
          
          if (col.comment) {
            def += ` COMMENT '${col.comment.replace(/'/g, "\\'")}'`;
          }

          const isNumeric = ['INT', 'BIGINT', 'SMALLINT', 'TINYINT', 'INTEGER'].some(t => dataType.toUpperCase().includes(t));
          if (col.autoIncrement && isNumeric) {
            def += ' AUTO_INCREMENT';
          }

          alterStatements.push(`ALTER TABLE \`${dbName}\`.\`${queryTableName}\` ${def}`);
        });

        // 删除列
        deletedColumnNames.forEach((colName: string) => {
          alterStatements.push(`ALTER TABLE \`${dbName}\`.\`${queryTableName}\` DROP COLUMN \`${colName}\``);
        });
      }

      // 如果表名改变，添加重命名语句
      if (queryTableName !== tableName) {
        alterStatements.push(`RENAME TABLE \`${dbName}\`.\`${queryTableName}\` TO \`${dbName}\`.\`${tableName}\``);
      }
    } else if (dbType === 'postgresql') {
      const schemaName = schema || 'public';
      
      // 增量更新优化：只处理改动的字段
      if (isIncrementalUpdate) {
        // 删除字段
        if (deletedColumns && deletedColumns.length > 0) {
          deletedColumns.forEach((colName: string) => {
            alterStatements.push(`ALTER TABLE "${schemaName}"."${queryTableName}" DROP COLUMN "${colName}" CASCADE`);
          });
        }
        
        // 修改字段
        if (changedColumns && changedColumns.length > 0) {
          changedColumns.forEach((col: any) => {
            let dataType = col.dataType;
            
            // PostgreSQL 类型构造
            if (col.typeLength) {
              if (['char', 'varchar'].includes(dataType.toLowerCase())) {
                dataType = `${dataType}(${col.typeLength})`;
              } else if (['numeric', 'decimal'].includes(dataType.toLowerCase())) {
                if (col.scale) {
                  dataType = `${dataType}(${col.typeLength},${col.scale})`;
                } else {
                  dataType = `${dataType}(${col.typeLength})`;
                }
              }
            }

            // 修改字段类型
            alterStatements.push(`ALTER TABLE "${schemaName}"."${queryTableName}" ALTER COLUMN "${col.name}" TYPE ${dataType}`);
            
            // 修改 NOT NULL 约束
            if (col.nullable === false) {
              alterStatements.push(`ALTER TABLE "${schemaName}"."${queryTableName}" ALTER COLUMN "${col.name}" SET NOT NULL`);
            } else {
              alterStatements.push(`ALTER TABLE "${schemaName}"."${queryTableName}" ALTER COLUMN "${col.name}" DROP NOT NULL`);
            }
            
            // 处理默认值
            if (col.defaultValue) {
              const defaultVal = col.defaultValue.toString();
              
              if (defaultVal === 'CURRENT_TIMESTAMP' || defaultVal.includes('CURRENT_TIMESTAMP')) {
                alterStatements.push(`ALTER TABLE "${schemaName}"."${queryTableName}" ALTER COLUMN "${col.name}" SET DEFAULT CURRENT_TIMESTAMP`);
              } else if (defaultVal.includes('::')) {
                // PostgreSQL 类型强制转换格式（如 'unnamed'::character varying）
                alterStatements.push(`ALTER TABLE "${schemaName}"."${queryTableName}" ALTER COLUMN "${col.name}" SET DEFAULT ${defaultVal}`);
              } else if (defaultVal.includes("'")) {
                // 已经带引号的字符串
                alterStatements.push(`ALTER TABLE "${schemaName}"."${queryTableName}" ALTER COLUMN "${col.name}" SET DEFAULT ${defaultVal}`);
              } else if (typeof col.defaultValue === 'string') {
                alterStatements.push(`ALTER TABLE "${schemaName}"."${queryTableName}" ALTER COLUMN "${col.name}" SET DEFAULT '${col.defaultValue.replace(/'/g, "''")}'`);
              } else {
                alterStatements.push(`ALTER TABLE "${schemaName}"."${queryTableName}" ALTER COLUMN "${col.name}" SET DEFAULT ${col.defaultValue}`);
              }
            } else {
              alterStatements.push(`ALTER TABLE "${schemaName}"."${queryTableName}" ALTER COLUMN "${col.name}" DROP DEFAULT`);
            }
            
            // PostgreSQL 中的注释修改
            if (col.comment) {
              alterStatements.push(`COMMENT ON COLUMN "${schemaName}"."${queryTableName}"."${col.name}" IS '${col.comment.replace(/'/g, "''")}'`);
            }
          });
        }
        
        // 添加新字段
        if (addedColumns && addedColumns.length > 0) {
          addedColumns.forEach((col: any) => {
            let dataType = col.dataType;
            
            if (col.typeLength) {
              if (['char', 'varchar'].includes(dataType.toLowerCase())) {
                dataType = `${dataType}(${col.typeLength})`;
              } else if (['numeric', 'decimal'].includes(dataType.toLowerCase())) {
                if (col.scale) {
                  dataType = `${dataType}(${col.typeLength},${col.scale})`;
                } else {
                  dataType = `${dataType}(${col.typeLength})`;
                }
              }
            }

            let def = `ADD COLUMN "${col.name}" ${dataType}`;
            if (col.nullable === false) {
              def += ' NOT NULL';
            }
            
            if (col.defaultValue) {
              const defaultVal = col.defaultValue.toString();
              
              if (defaultVal === 'CURRENT_TIMESTAMP' || defaultVal.includes('CURRENT_TIMESTAMP')) {
                def += ` DEFAULT CURRENT_TIMESTAMP`;
              } else if (defaultVal.includes('::')) {
                def += ` DEFAULT ${defaultVal}`;
              } else if (defaultVal.includes("'")) {
                def += ` DEFAULT ${defaultVal}`;
              } else if (typeof col.defaultValue === 'string') {
                def += ` DEFAULT '${col.defaultValue.replace(/'/g, "''")}'`;
              } else {
                def += ` DEFAULT ${col.defaultValue}`;
              }
            }
            
            alterStatements.push(`ALTER TABLE "${schemaName}"."${queryTableName}" ${def}`);
            
            // 添加注释
            if (col.comment) {
              alterStatements.push(`COMMENT ON COLUMN "${schemaName}"."${queryTableName}"."${col.name}" IS '${col.comment.replace(/'/g, "''")}'`);
            }
          });
        }
      } else {
        // 完整更新模式：获取现有列，对比所有改动
        const query = `
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_schema = '${schemaName}' AND table_name = '${queryTableName}'
          ORDER BY ordinal_position
        `;
        const existingResult = await executeQuery(query);
        const existingColumnNames = existingResult.rows.map((row: any) => row.column_name);

        const newColumns = actualColumns.filter((col: any) => !existingColumnNames.includes(col.name));
        const modifiedColumns = actualColumns.filter((col: any) => existingColumnNames.includes(col.name));
        const deletedColumnNames = existingColumnNames.filter((colName: string) => !actualColumns.some((col: any) => col.name === colName));

        // 修改列
        modifiedColumns.forEach((col: any) => {
          let dataType = col.dataType;
          
          if (col.typeLength) {
            if (['char', 'varchar'].includes(dataType.toLowerCase())) {
              dataType = `${dataType}(${col.typeLength})`;
            } else if (['numeric', 'decimal'].includes(dataType.toLowerCase())) {
              if (col.scale) {
                dataType = `${dataType}(${col.typeLength},${col.scale})`;
              } else {
                dataType = `${dataType}(${col.typeLength})`;
              }
            }
          }

          alterStatements.push(`ALTER TABLE "${schemaName}"."${queryTableName}" ALTER COLUMN "${col.name}" TYPE ${dataType}`);
          
          if (col.nullable === false) {
            alterStatements.push(`ALTER TABLE "${schemaName}"."${queryTableName}" ALTER COLUMN "${col.name}" SET NOT NULL`);
          } else {
            alterStatements.push(`ALTER TABLE "${schemaName}"."${queryTableName}" ALTER COLUMN "${col.name}" DROP NOT NULL`);
          }
          
          if (col.defaultValue) {
            const defaultVal = col.defaultValue.toString();
            
            if (defaultVal === 'CURRENT_TIMESTAMP' || defaultVal.includes('CURRENT_TIMESTAMP')) {
              alterStatements.push(`ALTER TABLE "${schemaName}"."${queryTableName}" ALTER COLUMN "${col.name}" SET DEFAULT CURRENT_TIMESTAMP`);
            } else if (defaultVal.includes('::')) {
              alterStatements.push(`ALTER TABLE "${schemaName}"."${queryTableName}" ALTER COLUMN "${col.name}" SET DEFAULT ${defaultVal}`);
            } else if (defaultVal.includes("'")) {
              alterStatements.push(`ALTER TABLE "${schemaName}"."${queryTableName}" ALTER COLUMN "${col.name}" SET DEFAULT ${defaultVal}`);
            } else if (typeof col.defaultValue === 'string') {
              alterStatements.push(`ALTER TABLE "${schemaName}"."${queryTableName}" ALTER COLUMN "${col.name}" SET DEFAULT '${col.defaultValue.replace(/'/g, "''")}'`);
            } else {
              alterStatements.push(`ALTER TABLE "${schemaName}"."${queryTableName}" ALTER COLUMN "${col.name}" SET DEFAULT ${col.defaultValue}`);
            }
          } else {
            alterStatements.push(`ALTER TABLE "${schemaName}"."${queryTableName}" ALTER COLUMN "${col.name}" DROP DEFAULT`);
          }
          
          if (col.comment) {
            alterStatements.push(`COMMENT ON COLUMN "${schemaName}"."${queryTableName}"."${col.name}" IS '${col.comment.replace(/'/g, "''")}'`);
          }
        });

        // 添加新列
        newColumns.forEach((col: any) => {
          let dataType = col.dataType;
          
          if (col.typeLength) {
            if (['char', 'varchar'].includes(dataType.toLowerCase())) {
              dataType = `${dataType}(${col.typeLength})`;
            } else if (['numeric', 'decimal'].includes(dataType.toLowerCase())) {
              if (col.scale) {
                dataType = `${dataType}(${col.typeLength},${col.scale})`;
              } else {
                dataType = `${dataType}(${col.typeLength})`;
              }
            }
          }

          let def = `ADD COLUMN "${col.name}" ${dataType}`;
          if (col.nullable === false) {
            def += ' NOT NULL';
          }
          
          if (col.defaultValue) {
            const defaultVal = col.defaultValue.toString();
            
            if (defaultVal === 'CURRENT_TIMESTAMP' || defaultVal.includes('CURRENT_TIMESTAMP')) {
              def += ` DEFAULT CURRENT_TIMESTAMP`;
            } else if (defaultVal.includes('::')) {
              def += ` DEFAULT ${defaultVal}`;
            } else if (defaultVal.includes("'")) {
              def += ` DEFAULT ${defaultVal}`;
            } else if (typeof col.defaultValue === 'string') {
              def += ` DEFAULT '${col.defaultValue.replace(/'/g, "''")}'`;
            } else {
              def += ` DEFAULT ${col.defaultValue}`;
            }
          }
          
          alterStatements.push(`ALTER TABLE "${schemaName}"."${queryTableName}" ${def}`);
          
          if (col.comment) {
            alterStatements.push(`COMMENT ON COLUMN "${schemaName}"."${queryTableName}"."${col.name}" IS '${col.comment.replace(/'/g, "''")}'`);
          }
        });

        // 删除列
        deletedColumnNames.forEach((colName: string) => {
          alterStatements.push(`ALTER TABLE "${schemaName}"."${queryTableName}" DROP COLUMN "${colName}" CASCADE`);
        });
      }

      // 如果表名改变，添加重命名语句
      if (queryTableName !== tableName) {
        alterStatements.push(`ALTER TABLE "${schemaName}"."${queryTableName}" RENAME TO "${tableName}"`);
      }
    } else if (dbType === 'sqlite') {
      return NextResponse.json(
        { code: 500, message: 'SQLite does not support direct column modification. Table reconstruction required.' },
        { status: 500 }
      );
    }

    try {
      // 对于 MySQL，临时关闭严格模式
      if (dbType === 'mysql') {
        try {
          await executeQuery("SET @old_sql_mode = @@sql_mode");
          await executeQuery("SET SESSION sql_mode = REPLACE(@@sql_mode, 'STRICT_TRANS_TABLES', '')");
        } catch (e) {
          // 忽略错误
        }
      }
      
      // 逐个执行 ALTER 语句
      for (const sql of alterStatements) {
        await executeQuery(sql);
      }
      
      // 恢复 MySQL 严格模式
      if (dbType === 'mysql') {
        try {
          await executeQuery("SET SESSION sql_mode = @old_sql_mode");
        } catch (e) {
          // 忽略错误
        }
      }

      return NextResponse.json({
        code: 200,
        message: 'Table updated successfully'
      });
    } catch (queryError: any) {
      // 恢复 MySQL 严格模式（即使出错也要恢复）
      if (dbType === 'mysql') {
        try {
          await executeQuery("SET SESSION sql_mode = @old_sql_mode");
        } catch (e) {
          // 忽略错误
        }
      }
      
      console.error('Error executing alter table SQL:', queryError);
      return NextResponse.json(
        { 
          code: 500, 
          message: `Failed to update table: ${queryError.message}` 
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Error updating table:', error);
    return NextResponse.json(
      { code: 500, message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

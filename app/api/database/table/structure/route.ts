import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateDatabaseConnection } from '@/lib/databaseCache';

export async function POST(request: NextRequest) {
  try {
    const { connectionId, tabId, dbName, tableName, schema } = await request.json();

    if (!connectionId || !dbName || !tableName) {
      return NextResponse.json(
        { code: 400, message: 'Missing required parameters: connectionId, dbName, tableName' },
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
    let columns: any[] = [];

    if (dbType === 'mysql') {
      const result = await executeQuery(`SHOW FULL COLUMNS FROM \`${dbName}\`.\`${tableName}\``);
      columns = result.rows.map((row: any) => {
        let typeLength = '';
        let scale = '';
        
        if (row.Type.includes('(')) {
          const match = row.Type.match(/\((.*?)\)/);
          if (match) {
            const typeParams = match[1];
            // 检查是否包含逗号（precision,scale 格式）
            if (typeParams.includes(',')) {
              const [precision, scaleVal] = typeParams.split(',');
              typeLength = precision;
              scale = scaleVal;
            } else {
              typeLength = typeParams;
            }
          }
        }
        
        return {
          name: row.Field,
          dataType: row.Type.split('(')[0].toUpperCase(),
          typeLength: typeLength,
          scale: scale,
          nullable: row.Null === 'YES',
          defaultValue: row.Default,
          isPrimaryKey: row.Key === 'PRI',
          autoIncrement: row.Extra ? row.Extra.toLowerCase().includes('auto_increment') : false,
          comment: row.Comment
        };
      });
    } else if (dbType === 'postgresql') {
      const schemaName = schema || 'public';
      const result = await executeQuery(`
        SELECT 
          c.column_name, 
          c.data_type, 
          c.character_maximum_length,
          c.numeric_precision,
          c.numeric_scale,
          c.is_nullable, 
          c.column_default,
          d.description as comment,
          CASE WHEN pk.constraint_type = 'PRIMARY KEY' THEN true ELSE false END AS is_primary_key
        FROM information_schema.columns c
        LEFT JOIN pg_catalog.pg_stat_user_tables t ON t.relname = c.table_name AND t.schemaname = c.table_schema
        LEFT JOIN pg_catalog.pg_description d ON d.objoid = t.relid AND d.objsubid = c.ordinal_position
        LEFT JOIN (
          SELECT kcu.column_name, tc.constraint_type
          FROM information_schema.key_column_usage kcu
          JOIN information_schema.table_constraints tc ON kcu.constraint_name = tc.constraint_name
          WHERE kcu.table_name = '${tableName}' AND kcu.table_schema = '${schemaName}' AND tc.constraint_type = 'PRIMARY KEY'
        ) pk ON c.column_name = pk.column_name
        WHERE c.table_schema = '${schemaName}' AND c.table_name = '${tableName}'
        ORDER BY c.ordinal_position
      `);

      columns = result.rows.map((row: any) => {
        let typeLength = '';
        let scale = '';
        
        if (row.character_maximum_length) {
          typeLength = row.character_maximum_length.toString();
        } else if (row.numeric_precision) {
          typeLength = row.numeric_precision.toString();
          if (row.numeric_scale) {
            scale = row.numeric_scale.toString();
          }
        }

        // PostgreSQL 类型别名映射（显示缩写形式）
        const typeAliasMap: any = {
          'character varying': 'varchar',
          'character': 'char',
          'integer': 'int4',
          'smallint': 'int2',
          'bigint': 'int8',
          'real': 'float4',
          'double precision': 'float8',
          'boolean': 'bool',
          'timestamp without time zone': 'timestamp',
          'timestamp with time zone': 'timestamptz',
          'time without time zone': 'time',
          'time with time zone': 'timetz'
        };

        let dataType = row.data_type.toLowerCase();
        dataType = typeAliasMap[dataType] || dataType;

        return {
          name: row.column_name,
          dataType: dataType,
          typeLength: typeLength,
          scale: scale,
          nullable: row.is_nullable === 'YES',
          defaultValue: row.column_default,
          isPrimaryKey: row.is_primary_key,
          autoIncrement: row.column_default?.includes('nextval'),
          comment: row.comment || ''
        };
      });
    } else if (dbType === 'sqlite') {
      const result = await executeQuery(`PRAGMA table_info("${tableName}")`);
      columns = result.rows.map((row: any) => {
        let typeLength = '';
        let scale = '';
        
        if (row.type.includes('(')) {
          const match = row.type.match(/\((.*?)\)/);
          if (match) {
            const typeParams = match[1];
            if (typeParams.includes(',')) {
              const [precision, scaleVal] = typeParams.split(',');
              typeLength = precision;
              scale = scaleVal;
            } else {
              typeLength = typeParams;
            }
          }
        }
        
        return {
          name: row.name,
          dataType: row.type.split('(')[0].toUpperCase(),
          typeLength: typeLength,
          scale: scale,
          nullable: row.notnull === 0,
          defaultValue: row.dflt_value,
          isPrimaryKey: row.pk === 1,
          autoIncrement: row.pk === 1 && row.type.toUpperCase() === 'INTEGER',
          comment: ''
        };
      });
    }

    return NextResponse.json({
      code: 200,
      message: 'Success',
      data: {
        tableName,
        dbName,
        columns
      }
    });
  } catch (error: any) {
    console.error('Error getting table structure:', error);
    return NextResponse.json(
      { code: 500, message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
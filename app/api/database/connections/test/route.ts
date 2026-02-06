import { NextResponse } from 'next/server';
import * as mysql from 'mysql2/promise';
import Database from 'better-sqlite3';

export async function POST(request: Request) {
  try {
    const config = await request.json();

    // 根据不同的数据库类型进行连接测试
    let connectionSuccess = false;
    let errorMessage = '';

    try {
      if (config.databaseType === 'sqlite') {
        // SQLite 测试连接 - 检查文件是否存在并尝试打开
        if (config.filePath) {
          const fsModule = await import('fs');
          if (fsModule.existsSync(config.filePath)) {
            // 尝试打开数据库文件
            try {
              const db = new Database(config.filePath);
              db.prepare('SELECT 1').get();
              db.close();
              connectionSuccess = true;
            } catch (err: any) {
              errorMessage = `无法打开SQLite数据库: ${err.message}`;
            }
          } else {
            errorMessage = 'SQLite 数据库文件不存在';
          }
        } else {
          errorMessage = 'SQLite 数据库文件路径未指定';
        }
      } else if (config.databaseType === 'mysql') {
        // MySQL 真实连接测试
        if (!config.host || !config.port || !config.username) {
          errorMessage = '缺少必需的连接参数';
        } else {
          try {
            const mysqlConfig: any = {
              host: config.host,
              port: config.port,
              user: config.username,
              password: config.password || '',
              database: config.databaseName || undefined,
              connectTimeout: (config.connectionTimeout || 10) * 1000,
              dateStrings: true,
            };

            // 添加额外参数
            if (config.additionalParams) {
              try {
                const params = JSON.parse(config.additionalParams);
                Object.assign(mysqlConfig, params);
              } catch (e) {
                console.warn('测试连接时无法解析额外参数:', config.additionalParams);
              }
            }

            const connection = await mysql.createConnection(mysqlConfig);
            await connection.ping();
            await connection.end();
            connectionSuccess = true;
          } catch (err: any) {
            errorMessage = `MySQL连接失败: ${err.code || err.message}`;
          }
        }
      } else if (config.databaseType === 'postgresql') {
        // PostgreSQL 真实连接测试
        if (!config.host || !config.port || !config.username) {
          errorMessage = '缺少必需的连接参数';
        } else {
          try {
            const { Client } = require('pg');
            const pgConfig: any = {
              host: config.host,
              port: config.port,
              user: config.username,
              password: config.password || '',
              database: config.databaseName || 'postgres',
              query_timeout: (config.connectionTimeout || 10) * 1000,
              application_name: 'next-tools',
            };

            // 添加额外参数
            if (config.additionalParams) {
              try {
                const params = JSON.parse(config.additionalParams);
                Object.assign(pgConfig, params);
              } catch (e) {
                console.warn('测试连接时无法解析额外参数:', config.additionalParams);
              }
            }

            const client = new Client(pgConfig);
            await client.connect();
            
            // 如果配置了时区，则设置会话时区
            if (pgConfig.timezone) {
              const tzValue = pgConfig.timezone;
              if (tzValue.startsWith('+') || tzValue.startsWith('-')) {
                await client.query(`SET TIME ZONE INTERVAL '${tzValue}' HOUR TO MINUTE`);
              } else {
                await client.query(`SET TIME ZONE '${tzValue}'`);
              }
            }
            
            await client.query('SELECT 1');
            await client.end();
            connectionSuccess = true;
          } catch (err: any) {
            errorMessage = `PostgreSQL连接失败: ${err.code || err.message}`;
          }
        }
      } else {
        errorMessage = `不支持的数据库类型: ${config.databaseType}`;
      }
    } catch (error: any) {
      errorMessage = error.message || '连接测试失败';
      connectionSuccess = false;
    }

    if (connectionSuccess) {
      return NextResponse.json({
        success: true,
        message: `${config.databaseType.toUpperCase()} 连接测试成功!`,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          message: `连接测试失败: ${errorMessage}`,
        },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('数据库连接测试错误:', error);
    return NextResponse.json(
      {
        success: false,
        message: `服务器错误: ${error.message || '未知错误'}`,
      },
      { status: 500 }
    );
  }
}
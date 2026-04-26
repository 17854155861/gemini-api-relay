import { NextRequest, NextResponse } from 'next/server';
import { S3Storage } from 'coze-coding-dev-sdk';

const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: '',
  secretKey: '',
  bucketName: process.env.COZE_BUCKET_NAME,
  region: 'cn-beijing',
});

// 列出对象存储中的数据库文件（调试用）
export async function GET(request: NextRequest) {
  // 验证授权
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }
  
  const token = authHeader.replace('Bearer ', '');
  try {
    const decoded = Buffer.from(token, 'base64').toString();
    if (!decoded.startsWith('admin:')) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }
  } catch {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  try {
    // 列出 database/ 前缀的文件
    const result = await storage.listFiles({ prefix: 'database/', maxKeys: 20 });
    
    return NextResponse.json({
      success: true,
      data: {
        keys: result.keys,
        count: result.keys?.length || 0
      }
    });
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : '获取失败' 
    }, { status: 500 });
  }
}

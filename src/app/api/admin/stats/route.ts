import { NextRequest, NextResponse } from 'next/server';
import { statsDb, callLogsDb } from '@/lib/db';

function validateAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return false;
  
  const token = authHeader.replace('Bearer ', '');
  try {
    const decoded = Buffer.from(token, 'base64').toString();
    return decoded.startsWith('admin:');
  } catch {
    return false;
  }
}

// 获取统计数据
export async function GET(request: NextRequest) {
  if (!validateAuth(request)) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  try {
    const overview = await statsDb.getOverview();
    const logs = await callLogsDb.getRecent(50);

    return NextResponse.json({ 
      success: true, 
      data: {
        overview,
        recentLogs: logs
      }
    });
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : '获取失败' 
    }, { status: 500 });
  }
}

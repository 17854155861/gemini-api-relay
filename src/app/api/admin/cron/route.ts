import { NextRequest, NextResponse } from 'next/server';
import { refreshAllBalances } from '@/lib/new-api';
import { settingsDb } from '@/lib/db';

// 定时刷新余额的 API
// 可以通过外部定时任务（如 cron job）调用
// 或者通过管理后台手动触发

export async function POST(request: NextRequest) {
  // 验证授权（简单的 token 验证）
  const authHeader = request.headers.get('Authorization');
  const cronSecret = process.env.CRON_SECRET || 'default-cron-secret';
  
  // 支持两种授权方式：
  // 1. Bearer token（管理后台）
  // 2. Cron secret（外部定时任务）
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '');
    
    // 检查是否是管理后台 token
    try {
      const decoded = Buffer.from(token, 'base64').toString();
      if (!decoded.startsWith('admin:') && token !== cronSecret) {
        return NextResponse.json({ error: '未授权' }, { status: 401 });
      }
    } catch {
      if (token !== cronSecret) {
        return NextResponse.json({ error: '未授权' }, { status: 401 });
      }
    }
  } else {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  try {
    const result = await refreshAllBalances();
    // 更新最后刷新时间
    await settingsDb.set('last_refresh_time', new Date().toISOString());
    return NextResponse.json({ 
      success: true, 
      data: result 
    });
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : '刷新失败' 
    }, { status: 500 });
  }
}

// GET 方法用于健康检查
export async function GET() {
  return NextResponse.json({ 
    status: 'ok',
    message: 'Cron endpoint is ready. Use POST to trigger balance refresh.' 
  });
}

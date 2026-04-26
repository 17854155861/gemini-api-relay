import { NextRequest, NextResponse } from 'next/server';
import { settingsDb, verifyAdminPassword } from '@/lib/db';

// 验证授权
function verifyAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return false;
  
  const token = authHeader.replace('Bearer ', '');
  try {
    const decoded = Buffer.from(token, 'base64').toString();
    if (!decoded.startsWith('admin:')) return false;
    const password = decoded.substring(6);
    return verifyAdminPassword(password);
  } catch {
    return false;
  }
}

// GET - 获取自动刷新设置
export async function GET(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  const enabled = await settingsDb.get('auto_refresh_enabled');
  const intervalMinutes = await settingsDb.get('auto_refresh_interval');
  
  return NextResponse.json({ 
    success: true, 
    data: {
      enabled: enabled === 'true',
      intervalMinutes: intervalMinutes ? parseInt(intervalMinutes) : 60
    }
  });
}

// PUT - 更新自动刷新设置
export async function PUT(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { enabled, intervalMinutes } = body;

    // 验证参数
    if (enabled !== undefined && typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'enabled 必须是布尔值' }, { status: 400 });
    }

    if (intervalMinutes !== undefined) {
      const minutes = Number(intervalMinutes);
      if (isNaN(minutes) || minutes < 30) {
        return NextResponse.json({ error: '刷新间隔最短为30分钟' }, { status: 400 });
      }
    }

    if (enabled !== undefined) {
      await settingsDb.set('auto_refresh_enabled', enabled.toString());
    }
    if (intervalMinutes !== undefined) {
      await settingsDb.set('auto_refresh_interval', intervalMinutes.toString());
    }
    
    return NextResponse.json({ 
      success: true, 
      data: {
        enabled: enabled !== undefined ? enabled : (await settingsDb.get('auto_refresh_enabled')) === 'true',
        intervalMinutes: intervalMinutes || parseInt(await settingsDb.get('auto_refresh_interval') || '60')
      }
    });
  } catch (error) {
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : '更新失败' 
    }, { status: 500 });
  }
}

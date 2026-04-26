import { NextRequest, NextResponse } from 'next/server';
import { userKeysDb } from '@/lib/db';

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

// 获取所有用户 Key
export async function GET(request: NextRequest) {
  if (!validateAuth(request)) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  try {
    const keys = await userKeysDb.getAll();
    return NextResponse.json({ success: true, data: keys });
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : '获取失败' 
    }, { status: 500 });
  }
}

// 创建用户 Key
export async function POST(request: NextRequest) {
  if (!validateAuth(request)) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, balance_limit } = body;

    // 生成唯一的 key_value: gky_时间戳_随机字符串
    const key_value = `gky_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

    const result = await userKeysDb.create({ 
      key_value, 
      name, 
      balance_limit 
    });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : '创建失败' 
    }, { status: 500 });
  }
}

// 更新用户 Key（支持修改名称、余额限制和已使用余额）
export async function PUT(request: NextRequest) {
  if (!validateAuth(request)) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, name, is_active, balance_limit, used_balance } = body;

    if (!id) {
      return NextResponse.json({ 
        success: false, 
        error: '缺少 Key ID' 
      }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    
    if (name !== undefined) {
      updateData.name = name;
    }
    if (is_active !== undefined) {
      updateData.is_active = is_active;
    }
    if (balance_limit !== undefined) {
      updateData.balance_limit = balance_limit;
    }
    if (used_balance !== undefined) {
      updateData.used_balance = used_balance;
    }

    await userKeysDb.update(id, updateData);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : '更新失败' 
    }, { status: 500 });
  }
}

// 删除用户 Key
export async function DELETE(request: NextRequest) {
  if (!validateAuth(request)) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = parseInt(searchParams.get('id') || '0');

    if (!id) {
      return NextResponse.json({ 
        success: false, 
        error: '缺少 Key ID' 
      }, { status: 400 });
    }

    await userKeysDb.delete(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : '删除失败' 
    }, { status: 500 });
  }
}

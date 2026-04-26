import { NextRequest, NextResponse } from 'next/server';
import { sitesDb } from '@/lib/db';

// 简单的 token 验证
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

// 获取所有站点
export async function GET(request: NextRequest) {
  if (!validateAuth(request)) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  try {
    const sites = await sitesDb.getAll();
    return NextResponse.json({ success: true, data: sites });
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : '获取失败' 
    }, { status: 500 });
  }
}

// 创建站点（支持批量导入）
export async function POST(request: NextRequest) {
  if (!validateAuth(request)) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  try {
    const body = await request.json();
    
    // 批量导入模式
    if (body.sites && Array.isArray(body.sites)) {
      let added = 0;
      let failed = 0;
      
      for (const site of body.sites) {
        try {
          if (site.name && site.base_url) {
            await sitesDb.create({ name: site.name, base_url: site.base_url, description: site.description || null });
            added++;
          } else {
            failed++;
          }
        } catch {
          failed++;
        }
      }
      
      return NextResponse.json({ success: true, data: { added, failed } });
    }
    
    // 单个站点创建
    const { name, base_url, description } = body;

    if (!name || !base_url) {
      return NextResponse.json({ 
        success: false, 
        error: '站点名称和 URL 不能为空' 
      }, { status: 400 });
    }

    const site = await sitesDb.create({ name, base_url, description });
    return NextResponse.json({ success: true, data: { id: site.id } });
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : '创建失败' 
    }, { status: 500 });
  }
}

// 更新站点
export async function PUT(request: NextRequest) {
  if (!validateAuth(request)) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, ...data } = body;

    if (!id) {
      return NextResponse.json({ 
        success: false, 
        error: '缺少站点 ID' 
      }, { status: 400 });
    }

    await sitesDb.update(id, data);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : '更新失败' 
    }, { status: 500 });
  }
}

// 删除站点
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
        error: '缺少站点 ID' 
      }, { status: 400 });
    }

    await sitesDb.delete(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : '删除失败' 
    }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { accountsDb, sitesDb } from '@/lib/db';
import { refreshAccountBalance, refreshAllBalances } from '@/lib/new-api';

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

// 获取所有账号
export async function GET(request: NextRequest) {
  if (!validateAuth(request)) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get('siteId');

    let accounts;
    if (siteId) {
      accounts = await accountsDb.getBySiteId(parseInt(siteId));
    } else {
      accounts = await accountsDb.getAll();
    }

    return NextResponse.json({ success: true, data: accounts });
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : '获取失败' 
    }, { status: 500 });
  }
}

// 创建账号
export async function POST(request: NextRequest) {
  if (!validateAuth(request)) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  try {
    const body = await request.json();
    
    // 批量添加模式
    if (body.accounts && Array.isArray(body.accounts)) {
      const { siteId, accounts } = body;
      
      if (!siteId) {
        return NextResponse.json({ 
          success: false, 
          error: '缺少站点 ID' 
        }, { status: 400 });
      }

      // 验证站点存在
      const site = await sitesDb.getById(siteId);
      if (!site) {
        return NextResponse.json({ 
          success: false, 
          error: '站点不存在' 
        }, { status: 400 });
      }

      // 解析账号格式: "用户名: xxx | 密码: xxx"
      const parsedAccounts: Array<{ username: string; password: string }> = [];
      
      for (const acc of accounts) {
        if (typeof acc === 'string') {
          // 解析字符串格式
          const usernameMatch = acc.match(/用户名[：:]\s*(\S+)/);
          const passwordMatch = acc.match(/密码[：:]\s*(\S+)/);
          
          if (usernameMatch && passwordMatch) {
            parsedAccounts.push({
              username: usernameMatch[1],
              password: passwordMatch[1]
            });
          } else {
            // 尝试简单分割
            const parts = acc.split(/[|,;]/).map(p => p.trim());
            if (parts.length >= 2) {
              const userPart = parts.find(p => p.includes('用户名') || p.includes('username'));
              const passPart = parts.find(p => p.includes('密码') || p.includes('password'));
              
              if (userPart && passPart) {
                const user = userPart.split(/[：:]/)[1]?.trim();
                const pass = passPart.split(/[：:]/)[1]?.trim();
                if (user && pass) {
                  parsedAccounts.push({ username: user, password: pass });
                }
              }
            }
          }
        } else if (acc.username && acc.password) {
          parsedAccounts.push({ username: acc.username, password: acc.password });
        }
      }

      if (parsedAccounts.length === 0) {
        return NextResponse.json({ 
          success: false, 
          error: '未解析到有效账号，请检查格式' 
        }, { status: 400 });
      }

      const result = await accountsDb.bulkCreate(parsedAccounts.map(a => ({
        site_id: siteId,
        username: a.username,
        password: a.password
      })));
      return NextResponse.json({ 
        success: true, 
        data: { added: result.length, total: parsedAccounts.length } 
      });
    }
    
    // 单个添加模式
    const { siteId, username, password } = body;

    if (!siteId || !username || !password) {
      return NextResponse.json({ 
        success: false, 
        error: '站点、用户名和密码不能为空' 
      }, { status: 400 });
    }

    const account = await accountsDb.create({ site_id: siteId, username, password });
    return NextResponse.json({ success: true, data: { id: account.id } });
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : '创建失败' 
    }, { status: 500 });
  }
}

// 更新账号
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
        error: '缺少账号 ID' 
      }, { status: 400 });
    }

    await accountsDb.update(id, data);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : '更新失败' 
    }, { status: 500 });
  }
}

// 删除账号
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
        error: '缺少账号 ID' 
      }, { status: 400 });
    }

    await accountsDb.delete(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : '删除失败' 
    }, { status: 500 });
  }
}

// 刷新余额
export async function PATCH(request: NextRequest) {
  if (!validateAuth(request)) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action, accountId, siteId } = body;

    if (action === 'refreshAll') {
      const result = await refreshAllBalances();
      return NextResponse.json({ success: true, data: result });
    }

    if (action === 'refreshSite' && siteId) {
      // 获取该站点下的所有账号并刷新
      const accounts = await accountsDb.getBySiteId(siteId);
      let success = 0;
      let failed = 0;
      
      for (const account of accounts) {
        const result = await refreshAccountBalance(account.id);
        if (result.success) {
          success++;
        } else {
          failed++;
        }
      }
      
      return NextResponse.json({ success: true, data: { success, failed } });
    }

    if (action === 'refreshOne' && accountId) {
      const result = await refreshAccountBalance(accountId);
      return NextResponse.json(result);
    }

    return NextResponse.json({ 
      success: false, 
      error: '无效的操作' 
    }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : '刷新失败' 
    }, { status: 500 });
  }
}

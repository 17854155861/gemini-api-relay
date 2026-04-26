import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminPassword } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();
    
    if (!password) {
      return NextResponse.json({ error: '请输入密码' }, { status: 400 });
    }

    const isValid = await verifyAdminPassword(password);
    
    if (!isValid) {
      return NextResponse.json({ error: '密码错误' }, { status: 401 });
    }

    // 生成简单的 token (实际生产中应该使用更安全的方式)
    const token = Buffer.from(`admin:${password}`).toString('base64');
    
    return NextResponse.json({ 
      success: true, 
      token,
      message: '登录成功' 
    });
  } catch (error) {
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : '登录失败' 
    }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';

// 健康检查接口 - 保持服务活跃
export async function GET() {
  return NextResponse.json({ 
    status: 'ok',
    timestamp: Date.now(),
    service: 'Gemini API Relay'
  }, { 
    status: 200,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache'
    }
  });
}

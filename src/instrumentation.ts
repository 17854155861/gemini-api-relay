// Next.js instrumentation - 在应用启动时执行
export async function register() {
  // 只在 Node.js 环境执行（不在 Edge 运行时）
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('[Instrumentation] Initializing Supabase database...');
    try {
      // 初始化 Supabase（实际上是自动连接的，这里只是验证连接）
      const { initDatabase } = await import('@/lib/db');
      await initDatabase();
      console.log('[Instrumentation] Supabase database initialized successfully');
    } catch (error) {
      console.error('[Instrumentation] Failed to initialize database:', error);
    }
  }
}

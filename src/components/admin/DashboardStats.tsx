'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Stats } from './Stats';

interface OverviewStats {
  activeSites: number;
  activeAccounts: number;
  accountsWithKey: number;
  totalBalance: number;
  total: number;
  success: number;
  today: number;
}

interface SystemStats {
  availableAccounts: number;
  totalBalance: number;
  topAccounts: Array<{
    id: number;
    siteName: string;
    username: string;
    balance: number;
  }>;
}

interface DashboardStatsProps {
  token: string;
}

export function DashboardStats({ token }: DashboardStatsProps) {
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [system, setSystem] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/admin/stats', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setOverview(data.data.overview);
        setSystem(data.data.system);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    // 每 30 秒刷新一次
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [token]);

  if (loading) {
    return <div className="text-center py-4">加载中...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Stats
          title="活跃站点"
          value={overview?.activeSites || 0}
          description="已启用的站点数"
        />
        <Stats
          title="可用账号"
          value={overview?.accountsWithKey || 0}
          description="有 API Key 的账号"
        />
        <Stats
          title="总余额"
          value={`¥${(overview?.totalBalance || 0).toFixed(4)}`}
          description="所有账号余额总和"
        />
        <Stats
          title="今日调用"
          value={overview?.today || 0}
          description={`总调用 ${overview?.total || 0} 次`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>余额 Top 5 账号</CardTitle>
          <CardDescription>当前余额最高的账号</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {system?.topAccounts.map((account, index) => (
              <div key={account.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-gray-400">#{index + 1}</span>
                  <div>
                    <div className="font-medium">{account.siteName}</div>
                    <div className="text-sm text-gray-500">{account.username}</div>
                  </div>
                </div>
                <div className="text-lg font-semibold text-green-600">
                  ¥{account.balance.toFixed(4)}
                </div>
              </div>
            ))}
            {(!system?.topAccounts || system.topAccounts.length === 0) && (
              <div className="text-center text-gray-500 py-4">暂无数据</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

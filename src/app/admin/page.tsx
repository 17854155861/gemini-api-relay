'use client';

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LoginForm } from '@/components/admin/LoginForm';
import { SitesManager } from '@/components/admin/SitesManager';
import { AccountsManager } from '@/components/admin/AccountsManager';
import { UserKeysManager } from '@/components/admin/UserKeysManager';
import { RecentLogs } from '@/components/admin/RecentLogs';
import { DashboardStats } from '@/components/admin/DashboardStats';
import { Button } from '@/components/ui/button';
import { LogOut, Settings, Users, Key, FileText, LayoutDashboard } from 'lucide-react';

export default function AdminPage() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sites, setSites] = useState<Array<{ id: number; name: string }>>([]);

  // 从 localStorage 恢复 token
  useEffect(() => {
    const savedToken = localStorage.getItem('admin_token');
    if (savedToken) {
      // 验证 token 是否有效，添加超时保护
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
        setLoading(false);
      }, 5000); // 5秒超时

      fetch('/api/admin/stats', {
        headers: { Authorization: `Bearer ${savedToken}` },
        signal: controller.signal,
      }).then(res => {
        clearTimeout(timeoutId);
        if (res.ok) {
          setToken(savedToken);
        } else {
          localStorage.removeItem('admin_token');
        }
        setLoading(false);
      }).catch(() => {
        clearTimeout(timeoutId);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, []);

  // 获取站点列表（用于账号管理下拉框）
  useEffect(() => {
    if (token) {
      fetch('/api/admin/sites', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setSites(data.data);
          }
        });
    }
  }, [token]);

  // 健康检查心跳 - 保持服务活跃，防止休眠回收
  useEffect(() => {
    const HEARTBEAT_INTERVAL = 5 * 60 * 1000; // 每5分钟发送一次心跳
    
    const sendHeartbeat = async () => {
      try {
        await fetch('/api/health', { cache: 'no-store' });
        console.log('[Heartbeat] 服务活跃保活');
      } catch (error) {
        console.log('[Heartbeat] 保活请求失败');
      }
    };
    
    // 立即发送一次心跳
    sendHeartbeat();
    
    // 设置定时心跳
    const intervalId = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);
    
    return () => clearInterval(intervalId);
  }, []);

  const handleLogin = (newToken: string) => {
    setToken(newToken);
    localStorage.setItem('admin_token', newToken);
  };

  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem('admin_token');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!token) {
    return <LoginForm onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl font-bold">Gemini API 中转站管理系统</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              退出登录
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <Tabs defaultValue="dashboard" className="space-y-4">
          <TabsList className="bg-white border">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <LayoutDashboard className="w-4 h-4" />
              仪表盘
            </TabsTrigger>
            <TabsTrigger value="sites" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              站点管理
            </TabsTrigger>
            <TabsTrigger value="accounts" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              账号管理
            </TabsTrigger>
            <TabsTrigger value="keys" className="flex items-center gap-2">
              <Key className="w-4 h-4" />
              API Key 管理
            </TabsTrigger>
            <TabsTrigger value="logs" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              调用日志
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <DashboardStats token={token} />
          </TabsContent>

          <TabsContent value="sites">
            <SitesManager token={token} />
          </TabsContent>

          <TabsContent value="accounts">
            <AccountsManager token={token} sites={sites} />
          </TabsContent>

          <TabsContent value="keys">
            <UserKeysManager token={token} />
          </TabsContent>

          <TabsContent value="logs">
            <RecentLogs token={token} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

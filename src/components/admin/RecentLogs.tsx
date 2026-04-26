'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle, XCircle, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

// 用户调用日志类型
interface UserCallLog {
  id: number;
  user_key_id: number;
  account_id: number | null;
  prompt: string;
  model: string | null;
  success: boolean;
  error_message: string | null;
  cost: number;
  created_at: string;
  // 关联数据
  key_name?: string;
  key_value?: string;
  account_username?: string;
  site_name?: string;
}

interface RecentLogsProps {
  token: string;
}

export function RecentLogs({ token }: RecentLogsProps) {
  const [logs, setLogs] = useState<UserCallLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      // 使用 stats API 获取 recentLogs
      const res = await fetch('/api/admin/stats', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && data.data?.recentLogs) {
        setLogs(data.data.recentLogs || []);
      }
    } catch {
      console.error('获取日志失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    // 每 30 秒刷新一次日志
    const interval = setInterval(fetchLogs, 30000);
    return () => {
      clearInterval(interval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  const truncatePrompt = (prompt: string, maxLength = 30) => {
    if (!prompt) return '-';
    return prompt.length > maxLength ? prompt.slice(0, maxLength) + '...' : prompt;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>用户调用日志</CardTitle>
            <p className="text-sm text-muted-foreground">用户调用 API 生成的记录</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchLogs}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            加载中...
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">暂无调用记录</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>状态</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>模型</TableHead>
                  <TableHead>提示词</TableHead>
                  <TableHead>消耗</TableHead>
                  <TableHead>时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      {log.success ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-500" />
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="font-medium">{log.key_name || '未知'}</div>
                      <div className="text-xs text-gray-500">{log.key_value || '-'}</div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {log.model === 'gemini-3.1-flash-image-preview' ? 'banana2' : 
                       log.model === 'gpt-image-2-all' ? 'GPT-Image-2' : 
                       log.model || '-'}
                    </TableCell>
                    <TableCell className="text-sm max-w-xs">
                      <span title={log.prompt}>
                        {truncatePrompt(log.prompt)}
                      </span>
                      {log.error_message && (
                        <div className="text-xs text-red-500 mt-1" title={log.error_message}>
                          {log.error_message.slice(0, 50)}...
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      ¥{(log.cost ?? 0).toFixed(4)}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500 whitespace-nowrap">
                      {formatTime(log.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, RefreshCw, ToggleLeft, ToggleRight, AlertCircle, CheckCircle, ChevronDown, ChevronRight, Wallet, Users, ChevronsDown, ChevronsUp, Clock, Settings2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Site {
  id: number;
  name: string;
}

interface Account {
  id: number;
  site_id: number;
  site_name: string;
  base_url: string;
  username: string;
  password: string;
  api_key: string | null;
  token: string | null;
  balance: number;
  is_active: number;
  last_error: string | null;
  balance_updated_at: string | null;
}

interface AccountsManagerProps {
  token: string;
  sites: Site[];
}

interface AutoRefreshSettings {
  enabled: boolean;
  intervalMinutes: number;
  lastRefreshAt: string | null;
}

export function AccountsManager({ token, sites }: AccountsManagerProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [bulkText, setBulkText] = useState('');
  const [expandedSites, setExpandedSites] = useState<Set<number>>(new Set());
  
  // 删除确认对话框状态
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState<Account | null>(null);

  // 自动刷新设置
  const [autoRefreshSettings, setAutoRefreshSettings] = useState<AutoRefreshSettings>({
    enabled: true,
    intervalMinutes: 60,
    lastRefreshAt: null
  });
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [tempInterval, setTempInterval] = useState(60);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/accounts', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setAccounts(data.data);
        // 默认展开所有站点
        const siteIds = new Set<number>(data.data.map((a: Account) => a.site_id));
        setExpandedSites(siteIds);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
    fetchAutoRefreshSettings();
  }, [token]);

  // 获取自动刷新设置
  const fetchAutoRefreshSettings = async () => {
    try {
      const res = await fetch('/api/admin/settings', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setAutoRefreshSettings(data.data);
        setTempInterval(data.data.intervalMinutes);
      }
    } catch (error) {
      console.error('获取自动刷新设置失败', error);
    }
  };

  // 执行自动刷新（静默刷新，不显示提示）
  const performAutoRefresh = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/accounts', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'refreshAll' }),
      });

      const data = await res.json();
      if (data.success) {
        // 更新最后刷新时间
        setAutoRefreshSettings(prev => ({
          ...prev,
          lastRefreshAt: new Date().toISOString()
        }));
        fetchAccounts();
      }
    } catch (error) {
      console.error('自动刷新失败', error);
    }
  }, [token]);

  // 设置定时刷新
  useEffect(() => {
    // 清除之前的定时器
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // 如果启用自动刷新，设置定时器
    if (autoRefreshSettings.enabled && autoRefreshSettings.intervalMinutes >= 30) {
      const intervalMs = autoRefreshSettings.intervalMinutes * 60 * 1000;
      timerRef.current = setInterval(performAutoRefresh, intervalMs);
    }

    // 清理函数
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [autoRefreshSettings.enabled, autoRefreshSettings.intervalMinutes, performAutoRefresh]);

  // 更新自动刷新设置
  const updateAutoRefreshSettings = async (updates: Partial<AutoRefreshSettings>) => {
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (data.success) {
        setAutoRefreshSettings(data.data);
        return true;
      } else {
        alert(data.error || '设置失败');
        return false;
      }
    } catch {
      alert('网络错误');
      return false;
    }
  };

  // 处理设置保存
  const handleSaveSettings = async () => {
    if (tempInterval < 30) {
      alert('刷新间隔最短为30分钟');
      return;
    }
    const success = await updateAutoRefreshSettings({ intervalMinutes: tempInterval });
    if (success) {
      setSettingsDialogOpen(false);
    }
  };

  // 按站点分组
  const groupedAccounts = useMemo(() => {
    const groups: Record<number, { site: Site; accounts: Account[]; totalBalance: number; activeCount: number }> = {};
    
    accounts.forEach(account => {
      if (!groups[account.site_id]) {
        const site = sites.find(s => s.id === account.site_id);
        groups[account.site_id] = {
          site: site || { id: account.site_id, name: account.site_name },
          accounts: [],
          totalBalance: 0,
          activeCount: 0,
        };
      }
      groups[account.site_id].accounts.push(account);
      groups[account.site_id].totalBalance += account.balance;
      if (account.is_active) {
        groups[account.site_id].activeCount++;
      }
    });

    // 按站点名称排序
    return Object.values(groups).sort((a, b) => a.site.name.localeCompare(b.site.name));
  }, [accounts, sites]);

  const toggleSite = (siteId: number) => {
    setExpandedSites(prev => {
      const next = new Set(prev);
      if (next.has(siteId)) {
        next.delete(siteId);
      } else {
        next.add(siteId);
      }
      return next;
    });
  };

  const expandAllSites = () => {
    const allSiteIds = new Set(groupedAccounts.map(g => g.site.id));
    setExpandedSites(allSiteIds);
  };

  const collapseAllSites = () => {
    setExpandedSites(new Set());
  };

  const handleBulkAdd = async () => {
    if (!selectedSiteId) {
      alert('请选择站点');
      return;
    }

    // 解析批量文本
    const lines = bulkText.split('\n').filter(line => line.trim());
    if (lines.length === 0) {
      alert('请输入账号信息');
      return;
    }

    const res = await fetch('/api/admin/accounts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        siteId: parseInt(selectedSiteId),
        accounts: lines,
      }),
    });

    const data = await res.json();
    if (data.success) {
      alert(`成功添加 ${data.data.added} 个账号`);
      setDialogOpen(false);
      setBulkText('');
      setSelectedSiteId('');
      fetchAccounts();
    } else {
      alert(data.error || '添加失败');
    }
  };

  const handleDelete = async () => {
    if (!deletingAccount) return;
    
    const res = await fetch(`/api/admin/accounts?id=${deletingAccount.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    
    const data = await res.json();
    if (data.success) {
      setDeleteDialogOpen(false);
      setDeletingAccount(null);
      fetchAccounts();
    }
  };

  const openDeleteDialog = (account: Account) => {
    setDeletingAccount(account);
    setDeleteDialogOpen(true);
  };

  const handleToggleActive = async (account: Account) => {
    const res = await fetch('/api/admin/accounts', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ id: account.id, is_active: !account.is_active }),
    });
    
    const data = await res.json();
    if (data.success) {
      fetchAccounts();
    }
  };

  const handleRefreshBalance = async (accountId?: number, siteId?: number) => {
    setRefreshing(true);
    try {
      if (accountId) {
        // 刷新单个账号
        const res = await fetch('/api/admin/accounts', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            action: 'refreshOne',
            accountId,
          }),
        });

        const data = await res.json();
        if (data.success) {
          fetchAccounts();
        } else {
          alert(data.error || '刷新失败');
        }
      } else if (siteId) {
        // 刷新单个站点
        const res = await fetch('/api/admin/accounts', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            action: 'refreshSite',
            siteId,
          }),
        });

        const data = await res.json();
        if (data.success) {
          fetchAccounts();
        } else {
          alert(data.error || '刷新失败');
        }
      } else {
        // 刷新全部：按站点逐个刷新
        for (const group of groupedAccounts) {
          try {
            const res = await fetch('/api/admin/accounts', {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                action: 'refreshSite',
                siteId: group.site.id,
              }),
            });

            const data = await res.json();
            // 每刷新完一个站点就更新列表
            fetchAccounts();
          } catch (error) {
            console.error(`刷新站点 ${group.site.name} 失败:`, error);
          }
        }
        // 全部刷新完成后不弹窗
      }
    } finally {
      setRefreshing(false);
    }
  };

  const formatBalance = (balance: number) => {
    return `¥${balance.toFixed(4)}`;
  };

  // 格式化最后刷新时间
  const formatLastRefreshTime = (isoString: string | null) => {
    if (!isoString) return '从未';
    try {
      const date = new Date(isoString);
      return date.toLocaleString('zh-CN', { 
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '无效时间';
    }
  };

  // 计算下次刷新时间
  const getNextRefreshTime = () => {
    if (!autoRefreshSettings.enabled || !autoRefreshSettings.lastRefreshAt) return null;
    try {
      const lastRefresh = new Date(autoRefreshSettings.lastRefreshAt);
      const nextRefresh = new Date(lastRefresh.getTime() + autoRefreshSettings.intervalMinutes * 60 * 1000);
      const now = new Date();
      const diffMs = nextRefresh.getTime() - now.getTime();
      if (diffMs <= 0) return '即将刷新';
      const diffMins = Math.ceil(diffMs / 60000);
      if (diffMins < 60) return `${diffMins}分钟后`;
      const diffHours = Math.floor(diffMins / 60);
      const remainMins = diffMins % 60;
      return `${diffHours}小时${remainMins > 0 ? remainMins + '分钟' : ''}后`;
    } catch {
      return null;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>账号管理</CardTitle>
            <CardDescription>
              按站点分组管理账号，每个站点内按余额排序
              {autoRefreshSettings.enabled && (
                <span className="ml-2 text-green-600 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  自动刷新: {autoRefreshSettings.intervalMinutes}分钟
                  {getNextRefreshTime() && <span className="text-gray-400">({getNextRefreshTime()})</span>}
                </span>
              )}
            </CardDescription>
          </div>
          <div className="flex gap-2 flex-wrap">
            {/* 自动刷新设置按钮 */}
            <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Settings2 className="w-4 h-4 mr-1" />
                  自动刷新
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>自动刷新设置</DialogTitle>
                  <DialogDescription>
                    设置账号余额自动刷新的时间和频率
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="auto-refresh-toggle" className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      启用自动刷新
                    </Label>
                    <Switch
                      id="auto-refresh-toggle"
                      checked={autoRefreshSettings.enabled}
                      onCheckedChange={(checked) => updateAutoRefreshSettings({ enabled: checked })}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="interval-input">刷新间隔（分钟）</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="interval-input"
                        type="number"
                        min={30}
                        max={1440}
                        value={tempInterval}
                        onChange={(e) => setTempInterval(Number(e.target.value))}
                        disabled={!autoRefreshSettings.enabled}
                      />
                      <span className="text-sm text-gray-500 whitespace-nowrap">分钟</span>
                    </div>
                    <p className="text-xs text-gray-500">最短30分钟，最长1440分钟（24小时）</p>
                  </div>

                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">上次刷新：</span>
                      <span>{formatLastRefreshTime(autoRefreshSettings.lastRefreshAt)}</span>
                    </div>
                    {autoRefreshSettings.enabled && autoRefreshSettings.lastRefreshAt && (
                      <div className="flex justify-between mt-1">
                        <span className="text-gray-500">下次刷新：</span>
                        <span className="text-green-600">{getNextRefreshTime()}</span>
                      </div>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setSettingsDialogOpen(false)}>
                    取消
                  </Button>
                  <Button onClick={handleSaveSettings} disabled={!autoRefreshSettings.enabled}>
                    保存
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Button
              variant="outline"
              size="sm"
              onClick={expandAllSites}
              title="展开所有站点"
            >
              <ChevronsDown className="w-4 h-4 mr-1" />
              展开全部
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={collapseAllSites}
              title="折叠所有站点"
            >
              <ChevronsUp className="w-4 h-4 mr-1" />
              折叠全部
            </Button>
            <Button
              variant="outline"
              onClick={() => handleRefreshBalance()}
              disabled={refreshing}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              刷新全部余额
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  批量添加账号
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>批量添加账号</DialogTitle>
                  <DialogDescription>
                    选择站点并输入账号信息，每行一个账号
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">选择站点</label>
                    <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
                      <SelectTrigger>
                        <SelectValue placeholder="选择站点" />
                      </SelectTrigger>
                      <SelectContent>
                        {sites.map((site) => (
                          <SelectItem key={site.id} value={site.id.toString()}>
                            {site.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">账号列表</label>
                    <Textarea
                      value={bulkText}
                      onChange={(e) => setBulkText(e.target.value)}
                      placeholder={`每行一个账号，格式示例：
用户名: 17854155861 | 密码: 2032097qq
用户名: 13800138000 | 密码: password123`}
                      rows={10}
                    />
                  </div>
                  <Button onClick={handleBulkAdd} className="w-full">
                    添加
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-4">加载中...</div>
        ) : groupedAccounts.length === 0 ? (
          <div className="text-center py-4 text-gray-500">暂无账号，请添加</div>
        ) : (
          <div className="space-y-4">
            {groupedAccounts.map((group) => (
              <div key={group.site.id} className="border rounded-lg overflow-hidden">
                {/* 站点头部 */}
                <div
                  className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  onClick={() => toggleSite(group.site.id)}
                >
                  <div className="flex items-center gap-3">
                    {expandedSites.has(group.site.id) ? (
                      <ChevronDown className="w-5 h-5 text-slate-500" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-slate-500" />
                    )}
                    <span className="font-semibold text-lg">{group.site.name}</span>
                    <div className="flex items-center gap-4 text-sm text-slate-500">
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {group.accounts.length} 个账号
                      </span>
                      <span className="flex items-center gap-1">
                        <Wallet className="w-4 h-4" />
                        {formatBalance(group.totalBalance)}
                      </span>
                      <Badge variant="outline">
                        {group.activeCount}/{group.accounts.length} 启用
                      </Badge>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRefreshBalance(undefined, group.site.id);
                    }}
                    disabled={refreshing}
                  >
                    <RefreshCw className={`w-4 h-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
                    刷新余额
                  </Button>
                </div>

                {/* 账号列表 */}
                {expandedSites.has(group.site.id) && (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>用户名</TableHead>
                          <TableHead>余额</TableHead>
                          <TableHead>API Key</TableHead>
                          <TableHead>状态</TableHead>
                          <TableHead>最后错误</TableHead>
                          <TableHead className="text-right">操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.accounts
                          .sort((a, b) => b.balance - a.balance) // 按余额排序
                          .map((account) => (
                          <TableRow key={account.id}>
                            <TableCell className="font-medium">{account.username}</TableCell>
                            <TableCell>
                              <span className={account.balance > 0 ? 'text-green-600 font-semibold' : 'text-gray-400'}>
                                {formatBalance(account.balance)}
                              </span>
                            </TableCell>
                            <TableCell className="max-w-[200px]">
                              {account.api_key ? (
                                <div className="flex items-center gap-1">
                                  <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                                  <span className="text-xs font-mono truncate">{account.api_key}</span>
                                </div>
                              ) : account.token ? (
                                <div className="flex items-center gap-1">
                                  <CheckCircle className="w-4 h-4 text-blue-500 shrink-0" />
                                  <span className="text-xs font-mono truncate">{account.token}</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1 text-gray-400">
                                  <AlertCircle className="w-4 h-4 shrink-0" />
                                  <span className="text-xs">未获取</span>
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant={account.is_active ? 'default' : 'secondary'}>
                                {account.is_active ? '启用' : '禁用'}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-xs">
                              {account.last_error && (
                                <span className="text-xs text-red-500 truncate block" title={account.last_error}>
                                  {account.last_error}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleRefreshBalance(account.id)}
                                  disabled={refreshing}
                                  title="刷新余额"
                                >
                                  <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleToggleActive(account)}
                                  title={account.is_active ? '禁用' : '启用'}
                                >
                                  {account.is_active ? (
                                    <ToggleRight className="w-4 h-4 text-green-500" />
                                  ) : (
                                    <ToggleLeft className="w-4 h-4 text-gray-400" />
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => openDeleteDialog(account)}
                                >
                                  <Trash2 className="w-4 h-4 text-red-500" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* 删除确认对话框 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除账号 <strong>{deletingAccount?.username}</strong> ({deletingAccount?.site_name}) 吗？
              <br />
              此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

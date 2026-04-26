'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Copy, Check, ToggleLeft, ToggleRight, Edit, Infinity, RotateCcw, Wallet, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
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

interface UserKey {
  id: number;
  key_value: string;
  name: string | null;
  is_active: number;
  usage_count: number;
  balance_limit: number | null;
  used_balance: number;
  total_calls: number;
  success_calls: number;
  created_at: string;
}

interface UserKeysManagerProps {
  token: string;
}

export function UserKeysManager({ token }: UserKeysManagerProps) {
  const [keys, setKeys] = useState<UserKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyLimit, setNewKeyLimit] = useState<string>('');
  
  // 编辑对话框状态
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<UserKey | null>(null);
  const [editName, setEditName] = useState('');
  const [editLimit, setEditLimit] = useState('');
  const [editUsedBalance, setEditUsedBalance] = useState('');
  
  // 删除确认对话框状态
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingKey, setDeletingKey] = useState<UserKey | null>(null);
  
  // 重置余额确认对话框状态
  const [resetBalanceDialogOpen, setResetBalanceDialogOpen] = useState(false);

  const fetchKeys = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/user-keys', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setKeys(data.data);
      } else {
        setError(data.error || '获取失败');
      }
    } catch {
      setError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, [token]);

  const handleCreate = async () => {
    setActionLoading(true);
    setError(null);
    try {
      const limit = newKeyLimit ? parseFloat(newKeyLimit) : null;
      
      const res = await fetch('/api/admin/user-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ 
          name: newKeyName || undefined,
          balanceLimit: limit 
        }),
      });

      const data = await res.json();
      if (data.success) {
        setNewKeyName('');
        setNewKeyLimit('');
        fetchKeys();
        copyToClipboard(data.data.key_value, 0);
        alert(`Key 创建成功！已复制到剪贴板：${data.data.key_value}`);
      } else {
        setError(data.error || '创建失败');
      }
    } catch {
      setError('网络错误，请重试');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingKey) return;
    
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/user-keys?id=${deletingKey.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      
      const data = await res.json();
      if (data.success) {
        setDeleteDialogOpen(false);
        setDeletingKey(null);
        fetchKeys();
      } else {
        setError(data.error || '删除失败');
      }
    } catch {
      setError('网络错误，请重试');
    } finally {
      setActionLoading(false);
    }
  };

  const openDeleteDialog = (key: UserKey) => {
    setDeletingKey(key);
    setDeleteDialogOpen(true);
  };

  const handleToggleActive = async (key: UserKey) => {
    setError(null);
    try {
      const res = await fetch('/api/admin/user-keys', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id: key.id, is_active: !key.is_active }),
      });
      
      const data = await res.json();
      if (data.success) {
        fetchKeys();
      } else {
        setError(data.error || '操作失败');
      }
    } catch {
      setError('网络错误，请重试');
    }
  };

  const handleEdit = async () => {
    if (!editingKey) return;
    
    setActionLoading(true);
    setError(null);
    try {
      const limit = editLimit === '' ? null : parseFloat(editLimit);
      const usedBalance = editUsedBalance !== '' ? parseFloat(editUsedBalance) : undefined;
      
      const res = await fetch('/api/admin/user-keys', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ 
          id: editingKey.id, 
          name: editName || null,
          balance_limit: limit,
          used_balance: usedBalance
        }),
      });
      
      const data = await res.json();
      if (data.success) {
        setEditDialogOpen(false);
        fetchKeys();
      } else {
        setError(data.error || '更新失败');
      }
    } catch {
      setError('网络错误，请重试');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetUsedBalance = async () => {
    if (!editingKey) return;
    
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/user-keys', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ 
          id: editingKey.id, 
          used_balance: 0
        }),
      });
      
      const data = await res.json();
      if (data.success) {
        setEditUsedBalance('0');
        setEditingKey({ ...editingKey, used_balance: 0 });
        setResetBalanceDialogOpen(false);
        fetchKeys();
      } else {
        setError(data.error || '重置失败');
      }
    } catch {
      setError('网络错误，请重试');
    } finally {
      setActionLoading(false);
    }
  };

  const openEditDialog = (key: UserKey) => {
    setEditingKey(key);
    setEditName(key.name || '');
    setEditLimit(key.balance_limit !== null ? key.balance_limit.toString() : '');
    setEditUsedBalance(key.used_balance?.toString() || '0');
    setEditDialogOpen(true);
  };

  const copyToClipboard = async (text: string, id: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      alert('复制失败，请手动复制');
    }
  };

  const formatBalance = (limit: number | null, used: number) => {
    if (limit === null) {
      return (
        <div className="flex items-center gap-1">
          <Infinity className="w-4 h-4 text-green-500" />
          <span className="text-gray-500">无限制</span>
        </div>
      );
    }
    const remaining = Math.max(0, limit - used);
    return (
      <div className="text-sm">
        <span className="text-green-600 font-medium">¥{remaining.toFixed(4)}</span>
        <span className="text-gray-400"> / ¥{limit.toFixed(4)}</span>
      </div>
    );
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle>用户 API Key 管理</CardTitle>
              <CardDescription>为前端用户创建调用密钥，可设置余额限制</CardDescription>
            </div>
            <div className="flex gap-2 items-center flex-wrap">
              <Input
                placeholder="名称（可选）"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                className="w-32"
              />
              <Input
                placeholder="余额限制（可选）"
                type="number"
                step="0.01"
                value={newKeyLimit}
                onChange={(e) => setNewKeyLimit(e.target.value)}
                className="w-32"
              />
              <Button onClick={handleCreate} disabled={actionLoading}>
                {actionLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                创建 Key
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
              <Button variant="ghost" size="sm" className="ml-2" onClick={() => setError(null)}>
                关闭
              </Button>
            </div>
          )}
          {loading ? (
            <div className="text-center py-4">加载中...</div>
          ) : keys.length === 0 ? (
            <div className="text-center py-4 text-gray-500">暂无 API Key，请创建</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead>API Key</TableHead>
                  <TableHead>余额</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>使用次数</TableHead>
                  <TableHead>成功率</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium">{key.name || '-'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                          {key.key_value}
                        </code>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(key.key_value, key.id)}
                        >
                          {copiedId === key.id ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      {formatBalance(key.balance_limit, key.used_balance || 0)}
                      {(key.used_balance || 0) > 0 && (
                        <div className="text-xs text-gray-400">
                          已用 ¥{(key.used_balance || 0).toFixed(4)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={key.is_active ? 'default' : 'secondary'}>
                        {key.is_active ? '启用' : '禁用'}
                      </Badge>
                    </TableCell>
                    <TableCell>{key.usage_count}</TableCell>
                    <TableCell>
                      {key.total_calls > 0 
                        ? `${((key.success_calls / key.total_calls) * 100).toFixed(1)}%`
                        : '-'
                      }
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openEditDialog(key)}
                          title="编辑"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleToggleActive(key)}
                          title={key.is_active ? '禁用' : '启用'}
                        >
                          {key.is_active ? (
                            <ToggleRight className="w-4 h-4 text-green-500" />
                          ) : (
                            <ToggleLeft className="w-4 h-4 text-gray-400" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openDeleteDialog(key)}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 编辑对话框 */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              编辑 API Key
            </DialogTitle>
            <DialogDescription>
              修改 Key 的名称、余额限制和已使用余额
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">名称</Label>
              <Input
                id="name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Key 名称"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="limit">余额限制（留空表示无限制）</Label>
              <Input
                id="limit"
                type="number"
                step="0.01"
                value={editLimit}
                onChange={(e) => setEditLimit(e.target.value)}
                placeholder="例如: 10.00"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="usedBalance">已使用余额</Label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setResetBalanceDialogOpen(true)}
                  className="text-xs"
                >
                  <RotateCcw className="w-3 h-3 mr-1" />
                  重置为 0
                </Button>
              </div>
              <Input
                id="usedBalance"
                type="number"
                step="0.01"
                min="0"
                value={editUsedBalance}
                onChange={(e) => setEditUsedBalance(e.target.value)}
                placeholder="已使用金额"
              />
            </div>
            
            {/* 余额预览 */}
            {editingKey && (
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <div className="text-sm font-medium mb-2">余额预览</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-500">余额限制：</span>
                    <span className="font-medium">
                      {editLimit === '' ? '无限制' : `¥${parseFloat(editLimit || '0').toFixed(4)}`}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">已使用：</span>
                    <span className="font-medium">¥{(parseFloat(editUsedBalance || '0') || 0).toFixed(4)}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-500">剩余余额：</span>
                    <span className="font-semibold text-green-600">
                      {editLimit === '' 
                        ? '无限制' 
                        : `¥${Math.max(0, parseFloat(editLimit || '0') - (parseFloat(editUsedBalance || '0') || 0)).toFixed(4)}`
                      }
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={actionLoading}>
              取消
            </Button>
            <Button onClick={handleEdit} disabled={actionLoading}>
              {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 重置余额确认对话框 */}
      <AlertDialog open={resetBalanceDialogOpen} onOpenChange={setResetBalanceDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认重置余额</AlertDialogTitle>
            <AlertDialogDescription>
              确定要将已使用余额重置为 0 吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>取消</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleResetUsedBalance} 
              className="bg-blue-600 hover:bg-blue-700"
              disabled={actionLoading}
            >
              {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              确认重置
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 删除确认对话框 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除 API Key <strong>{deletingKey?.name || deletingKey?.key_value.slice(0, 20)}...</strong> 吗？
              <br />
              此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700" disabled={actionLoading}>
              {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

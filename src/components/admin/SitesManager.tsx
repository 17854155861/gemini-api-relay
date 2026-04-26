'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Edit, RefreshCw, ToggleLeft, ToggleRight, Users, Upload } from 'lucide-react';

interface Site {
  id: number;
  name: string;
  base_url: string;
  description: string | null;
  is_active: number;
  account_count: number;
  active_account_count: number;
  created_at: string;
}

interface SitesManagerProps {
  token: string;
}

export function SitesManager({ token }: SitesManagerProps) {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [formData, setFormData] = useState({ name: '', baseUrl: '', description: '' });
  const [bulkText, setBulkText] = useState('');

  const fetchSites = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/sites', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        // 按站点名称字母排序
        const sortedSites = [...data.data].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
        setSites(sortedSites);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSites();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const url = '/api/admin/sites';
    const method = editingSite ? 'PUT' : 'POST';
    const body = editingSite 
      ? { id: editingSite.id, ...formData }
      : formData;

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (data.success) {
      setDialogOpen(false);
      setEditingSite(null);
      setFormData({ name: '', baseUrl: '', description: '' });
      fetchSites();
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这个站点吗？相关的账号也会被删除。')) return;
    
    try {
      const res = await fetch(`/api/admin/sites?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      
      const data = await res.json();
      if (data.success) {
        fetchSites();
      } else {
        alert(data.error || '删除失败');
      }
    } catch (error) {
      alert('网络错误，删除失败');
      console.error('删除站点失败:', error);
    }
  };

  const handleToggleActive = async (site: Site) => {
    const res = await fetch('/api/admin/sites', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ id: site.id, is_active: !site.is_active }),
    });
    
    const data = await res.json();
    if (data.success) {
      fetchSites();
    }
  };

  const openEditDialog = (site: Site) => {
    setEditingSite(site);
    setFormData({
      name: site.name,
      baseUrl: site.base_url,
      description: site.description || '',
    });
    setDialogOpen(true);
  };

  // 批量导入站点
  const handleBulkAdd = async () => {
    if (!bulkText.trim()) {
      alert('请输入站点信息');
      return;
    }

    // 解析批量文本，支持多种格式
    const lines = bulkText.split('\n').filter(line => line.trim());
    const sitesToAdd: Array<{ name: string; base_url: string; description?: string }> = [];

    for (const line of lines) {
      // 格式1: 名称 | URL | 描述
      // 格式2: 名称, URL, 描述
      // 格式3: 名称 URL 描述（空格分隔）
      // 格式4: URL（自动提取域名作为名称）
      
      const parts = line.split(/[|,]/).map(p => p.trim()).filter(p => p);
      
      if (parts.length >= 2) {
        // 有名称和URL
        sitesToAdd.push({
          name: parts[0],
          base_url: parts[1],
          description: parts[2] || undefined,
        });
      } else if (parts.length === 1 && parts[0].startsWith('http')) {
        // 只有URL，提取域名作为名称
        try {
          const url = new URL(parts[0]);
          sitesToAdd.push({
            name: url.hostname.replace('www.', ''),
            base_url: parts[0],
          });
        } catch {
          // URL 解析失败，跳过
        }
      }
    }

    if (sitesToAdd.length === 0) {
      alert('未解析到有效的站点信息，请检查格式');
      return;
    }

    const res = await fetch('/api/admin/sites', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ sites: sitesToAdd }),
    });

    const data = await res.json();
    if (data.success) {
      alert(`成功添加 ${data.data.added} 个站点${data.data.failed > 0 ? `，失败 ${data.data.failed} 个` : ''}`);
      setBulkDialogOpen(false);
      setBulkText('');
      fetchSites();
    } else {
      alert(data.error || '添加失败');
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>站点管理</CardTitle>
            <CardDescription>管理 Gemini API 中转站点</CardDescription>
          </div>
          <div className="flex gap-2">
            {/* 批量导入按钮 */}
            <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Upload className="w-4 h-4 mr-2" />
                  批量导入
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>批量导入站点</DialogTitle>
                  <DialogDescription>
                    每行一个站点，支持以下格式：
                    <br />• 名称 | URL | 描述
                    <br />• 名称, URL, 描述
                    <br />• URL（自动提取域名作为名称）
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <Textarea
                    placeholder="例如：&#10;站点1 | https://site1.com | 描述1&#10;站点2, https://site2.com&#10;https://site3.com"
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    rows={8}
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>
                      取消
                    </Button>
                    <Button onClick={handleBulkAdd}>
                      导入
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            
            {/* 添加站点按钮 */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => {
                setEditingSite(null);
                setFormData({ name: '', baseUrl: '', description: '' });
              }}>
                <Plus className="w-4 h-4 mr-2" />
                添加站点
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingSite ? '编辑站点' : '添加站点'}</DialogTitle>
                <DialogDescription>
                  {editingSite ? '修改站点信息' : '添加一个新的中转站点'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-medium">站点名称</label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="例如：站点1"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">站点 URL</label>
                  <Input
                    value={formData.baseUrl}
                    onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                    placeholder="例如：https://n.lconai.com"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">描述（可选）</label>
                  <Input
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="站点描述"
                  />
                </div>
                <Button type="submit" className="w-full">
                  {editingSite ? '保存' : '添加'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-4">加载中...</div>
        ) : sites.length === 0 ? (
          <div className="text-center py-4 text-gray-500">暂无站点，请添加</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>账号数</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sites.map((site) => (
                <TableRow key={site.id}>
                  <TableCell className="font-medium">{site.name}</TableCell>
                  <TableCell className="text-sm text-gray-500 max-w-xs truncate">
                    {site.base_url}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {site.active_account_count}/{site.account_count}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={site.is_active ? 'default' : 'secondary'}>
                      {site.is_active ? '启用' : '禁用'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleToggleActive(site)}
                        title={site.is_active ? '禁用' : '启用'}
                      >
                        {site.is_active ? (
                          <ToggleRight className="w-4 h-4 text-green-500" />
                        ) : (
                          <ToggleLeft className="w-4 h-4 text-gray-400" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEditDialog(site)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(site.id)}
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
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Sparkles, 
  Loader2, 
  Download, 
  Copy, 
  Check, 
  Settings, 
  Wallet,
  Search,
  History,
  Trash2,
  X,
  Image as ImageIcon,
  Plus,
  Zap,
  Palette,
  Layers,
  Code,
  Video,
  Play,
  RefreshCw
} from 'lucide-react';
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// 模型类型
type ModelType = 'gemini' | 'gpt-image-2';
type TabType = 'image' | 'video';

// GPT-image-2 尺寸选项
const GPT_IMAGE_SIZES = [
  { value: '1024x1024', label: '1024×1024 (正方形)', cost: 0.06 },
  { value: '1536x1024', label: '1536×1024 (横版)', cost: 0.06 },
  { value: '1024x1536', label: '1024×1536 (竖版)', cost: 0.06 },
];

// Gemini 宽高比选项
const GEMINI_ASPECT_RATIOS = [
  { value: '1:1', label: '1:1 (正方形)' },
  { value: '16:9', label: '16:9 (横版)' },
  { value: '9:16', label: '9:16 (竖版)' },
  { value: '4:3', label: '4:3 (横版)' },
  { value: '3:4', label: '3:4 (竖版)' },
];

// Gemini 分辨率选项
const GEMINI_IMAGE_SIZES = [
  { value: '2K', label: '2K (¥0.10)' },
  { value: '4K', label: '4K (¥0.15)' },
];

// 视频宽高比选项
const VIDEO_ASPECT_RATIOS = [
  { value: '1:1', label: '1:1 (正方形)' },
  { value: '2:3', label: '2:3 (竖版)' },
  { value: '3:2', label: '3:2 (横版)' },
];

// 视频分辨率选项（固定720P，仅供显示）
const VIDEO_SIZES = [
  { value: '720P', label: '720P (¥0.30)' },
];

// 历史记录类型
interface HistoryItem {
  id: string;
  prompt: string;
  image: string;
  mimeType: string;
  cost: number;
  model: ModelType;
  timestamp: number;
}

interface VideoHistoryItem {
  id: string;
  prompt: string;
  taskId: string;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  status: string;
  cost: number;
  timestamp: number;
}

interface BalanceInfo {
  name: string | null;
  is_active: boolean;
  usage_count: number;
  balance_limit: number | null;
  used_balance: number;
  remaining_balance: number | null;
}

interface ReferenceImage {
  mimeType: string;
  data: string;
  preview: string;
}

// 最大历史记录数
const MAX_HISTORY = 50;
const MAX_VIDEO_HISTORY = 10;

export default function Home() {
  // 基础状态
  const [apiKey, setApiKey] = useState('');
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  
  // Tab 选择（图片/视频）
  const [activeTab, setActiveTab] = useState<TabType>('image');
  
  // 模型选择
  const [model, setModel] = useState<ModelType>('gemini');
  
  // Gemini 参数
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [imageSize, setImageSize] = useState('2K');
  
  // GPT-image-2 参数
  const [gptSize, setGptSize] = useState('1024x1024');
  
  // 参考图（两个模型共用，存储 base64）
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);
  
  // 结果
  const [result, setResult] = useState<{ image: string; mimeType: string; cost: number } | null>(null);
  
  // 视频生成相关状态
  const [videoPrompt, setVideoPrompt] = useState('');
  const [videoAspectRatio, setVideoAspectRatio] = useState('1:1');
  const [videoSize] = useState('720P'); // 固定720P，不可更改
  const [videoReferenceImage, setVideoReferenceImage] = useState<ReferenceImage | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState('');
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [currentVideoStatus, setCurrentVideoStatus] = useState<{
    status: string;
    videoUrl: string | null;
    thumbnailUrl: string | null;
    error: string | null;
  } | null>(null);
  const [videoHistory, setVideoHistory] = useState<VideoHistoryItem[]>([]);
  const [isPolling, setIsPolling] = useState(false);
  
  // 余额
  const [balanceInfo, setBalanceInfo] = useState<BalanceInfo | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  
  // 历史记录
  const [history, setHistory] = useState<HistoryItem[]>([]);
  
  // 初始化
  useEffect(() => {
    // 从 localStorage 恢复历史记录
    const savedHistory = localStorage.getItem('banana2-history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch {
        // 解析失败，忽略
      }
    }
    
    // 恢复视频历史记录
    const savedVideoHistory = localStorage.getItem('banana2-video-history');
    if (savedVideoHistory) {
      try {
        setVideoHistory(JSON.parse(savedVideoHistory));
      } catch {
        // 解析失败，忽略
      }
    }
    
    // 恢复 API Key
    const savedApiKey = localStorage.getItem('banana2-apiKey');
    if (savedApiKey) {
      setApiKey(savedApiKey);
    }
  }, []);
  
  // 保存 API Key
  useEffect(() => {
    if (apiKey) {
      localStorage.setItem('banana2-apiKey', apiKey);
    }
  }, [apiKey]);
  
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
  
  // 保存历史记录
  const addToHistory = useCallback((data: { image: string; mimeType: string; cost: number }) => {
    const newItem: HistoryItem = {
      id: Date.now().toString(),
      prompt,
      image: data.image,
      mimeType: data.mimeType,
      cost: data.cost,
      model,
      timestamp: Date.now(),
    };
    
    setHistory(prev => {
      const newHistory = [newItem, ...prev].slice(0, MAX_HISTORY);
      localStorage.setItem('banana2-history', JSON.stringify(newHistory));
      return newHistory;
    });
  }, [prompt, model]);
  
  // 从历史记录移除
  const removeFromHistory = useCallback((id: string) => {
    setHistory(prev => {
      const newHistory = prev.filter(item => item.id !== id);
      localStorage.setItem('banana2-history', JSON.stringify(newHistory));
      return newHistory;
    });
  }, []);
  
  // 清空历史
  const clearHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem('banana2-history');
  }, []);
  
  // 查看历史项
  const viewHistoryItem = useCallback((item: HistoryItem) => {
    setResult({
      image: item.image,
      mimeType: item.mimeType,
      cost: item.cost,
    });
    setPrompt(item.prompt);
    setModel(item.model);
  }, []);
  
  // 查询余额
  const handleCheckBalance = async () => {
    if (!apiKey) {
      setError('请输入 API Key');
      return;
    }
    
    setBalanceLoading(true);
    try {
      const res = await fetch(`/api/generate?apiKey=${apiKey}`);
      const data = await res.json();
      
      if (data.success) {
        setBalanceInfo(data.data);
        setError('');
      } else {
        setError(data.error || '查询失败');
      }
    } catch {
      setError('网络错误');
    } finally {
      setBalanceLoading(false);
    }
  };
  
  // 处理文件上传（参考图）
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // 检查数量限制（Gemini 6张，GPT 5张）
      const maxImages = model === 'gemini' ? 6 : 5;
      if (referenceImages.length >= maxImages) {
        setError(`最多只能上传${maxImages}张参考图`);
        return;
      }
      
      // 检查文件类型
      if (!file.type.startsWith('image/')) {
        setError('请上传图片文件');
        return;
      }
      
      // 检查文件大小 (最大 20MB)
      if (file.size > 20 * 1024 * 1024) {
        setError('图片大小不能超过 20MB');
        return;
      }
      
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        const mimeType = file.type;
        
        // 创建预览
        const preview = `data:${mimeType};base64,${base64}`;
        
        setReferenceImages(prev => [...prev, {
          mimeType,
          data: base64,
          preview
        }]);
        setError('');
      };
      reader.readAsDataURL(file);
    }
    
    e.target.value = '';
  };
  
  // 移除参考图
  const handleRemoveReferenceImage = (index: number) => {
    setReferenceImages(prev => prev.filter((_, i) => i !== index));
  };
  
  // 清空所有参考图
  const handleClearAllReferenceImages = () => {
    setReferenceImages([]);
  };
  
  // 切换模型时清空参考图
  const handleModelChange = (newModel: ModelType) => {
    setModel(newModel);
    setReferenceImages([]);
  };
  
  // 视频参考图上传处理
  const handleVideoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // 检查文件类型
      if (!file.type.startsWith('image/')) {
        setVideoError('请上传图片文件');
        return;
      }
      
      // 检查文件大小 (最大 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setVideoError('图片大小不能超过 10MB');
        return;
      }
      
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        const mimeType = file.type;
        
        // 创建预览
        const preview = `data:${mimeType};base64,${base64}`;
        
        setVideoReferenceImage({
          mimeType,
          data: base64,
          preview
        });
        setVideoError('');
      };
      reader.readAsDataURL(file);
    }
    
    e.target.value = '';
  };
  
  // 生成图片
  const handleGenerate = async () => {
    if (!apiKey) {
      setError('请输入 API Key');
      return;
    }
    if (!prompt) {
      setError('请输入提示词');
      return;
    }

    // 检查余额
    if (balanceInfo && balanceInfo.balance_limit !== null && balanceInfo.remaining_balance !== null) {
      if (balanceInfo.remaining_balance <= 0) {
        setError('余额不足，请联系管理员充值');
        return;
      }
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const body: Record<string, unknown> = {
        apiKey,
        prompt,
        model,
      };

      if (model === 'gemini') {
        body.aspectRatio = aspectRatio;
        body.imageSize = imageSize;
        
        // Gemini 参考图（base64）
        if (referenceImages.length > 0) {
          body.referenceImages = referenceImages.map(img => ({
            mimeType: img.mimeType,
            data: img.data
          }));
        }
      } else {
        // GPT-image-2
        body.size = gptSize;
        
        // GPT-image-2 参考图（转为 data URL）
        if (referenceImages.length > 0) {
          body.imageUrls = referenceImages.map(img => 
            `data:${img.mimeType};base64,${img.data}`
          );
        }
      }

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (data.success) {
        setResult(data.data);
        addToHistory(data.data);
        handleCheckBalance();
      } else {
        setError(data.error || '生成失败');
      }
    } catch {
      setError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  // 下载图片
  const handleDownload = () => {
    if (!result) return;
    
    const link = document.createElement('a');
    link.href = `data:${result.mimeType};base64,${result.image}`;
    link.download = `banana2-image-${Date.now()}.png`;
    link.click();
  };

  // 复制图片
  const handleCopyImage = async () => {
    if (!result) return;
    
    try {
      const response = await fetch(`data:${result.mimeType};base64,${result.image}`);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob })
      ]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 浏览器不支持复制图片
    }
  };

  // 模型名称显示
  const getModelDisplayName = (m: ModelType) => {
    return m === 'gemini' ? 'banana2 (gemini-3.1)' : 'GPT-Image-2';
  };

  // 添加视频到历史记录
  const addToVideoHistory = useCallback((data: {
    taskId: string;
    prompt: string;
    status: string;
    videoUrl?: string | null;
    thumbnailUrl?: string | null;
    cost?: number;
  }) => {
    const newItem: VideoHistoryItem = {
      id: Date.now().toString(),
      prompt: data.prompt,
      taskId: data.taskId,
      videoUrl: data.videoUrl || null,
      thumbnailUrl: data.thumbnailUrl || null,
      status: data.status,
      cost: data.cost || 0.3,
      timestamp: Date.now(),
    };
    
    setVideoHistory(prev => {
      const newHistory = [newItem, ...prev].slice(0, MAX_VIDEO_HISTORY);
      localStorage.setItem('banana2-video-history', JSON.stringify(newHistory));
      return newHistory;
    });
  }, []);

  // 更新视频历史记录
  const updateVideoHistory = useCallback((taskId: string, updates: {
    status?: string;
    videoUrl?: string | null;
    thumbnailUrl?: string | null;
  }) => {
    setVideoHistory(prev => {
      const newHistory = prev.map(item => 
        item.taskId === taskId ? { ...item, ...updates } : item
      );
      localStorage.setItem('banana2-video-history', JSON.stringify(newHistory));
      return newHistory;
    });
  }, []);

  // 生成视频
  const handleGenerateVideo = async () => {
    if (!apiKey) {
      setVideoError('请输入 API Key');
      return;
    }
    if (!videoPrompt) {
      setVideoError('请输入提示词');
      return;
    }

    // 检查余额
    if (balanceInfo && balanceInfo.balance_limit !== null && balanceInfo.remaining_balance !== null) {
      if (balanceInfo.remaining_balance <= 0) {
        setVideoError('余额不足，请联系管理员充值');
        return;
      }
    }

    setVideoLoading(true);
    setVideoError('');
    setCurrentVideoStatus(null);
    setCurrentTaskId(null);

    try {
      // 处理参考图：如果有参考图，先上传到图床
      let imageUrls: string[] = [];
      
      if (videoReferenceImage) {
        try {
          const res = await fetch('/api/upload-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              base64: videoReferenceImage.data,
              mimeType: videoReferenceImage.mimeType
            }),
          });
          
          const uploadResult = await res.json();
          
          if (uploadResult.success && uploadResult.url) {
            imageUrls = [uploadResult.url];
          } else {
            console.error('图床上传失败:', uploadResult.error);
            // 继续尝试，API 端可能会处理失败的 URL
          }
        } catch (uploadError) {
          console.error('图床上传请求失败:', uploadError);
        }
      }
      
      const res = await fetch('/api/generate/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          prompt: videoPrompt,
          aspectRatio: videoAspectRatio,
          size: '720P', // 固定720P
          images: imageUrls
        }),
      });

      const data = await res.json();

      if (data.success) {
        setCurrentTaskId(data.data.taskId);
        setCurrentVideoStatus({
          status: 'pending',
          videoUrl: null,
          thumbnailUrl: null,
          error: null
        });
        addToVideoHistory({
          taskId: data.data.taskId,
          prompt: videoPrompt,
          status: 'pending'
        });
        handleCheckBalance();
        // 开始轮询
        startPolling(data.data.taskId);
      } else {
        setVideoError(data.error || '创建视频任务失败');
      }
    } catch {
      setVideoError('网络错误，请重试');
    } finally {
      setVideoLoading(false);
    }
  };

  // 轮询查询视频状态
  const startPolling = useCallback((taskId: string) => {
    setIsPolling(true);
    
    const poll = async () => {
      try {
        const res = await fetch(`/api/generate/video?apiKey=${encodeURIComponent(apiKey)}&taskId=${encodeURIComponent(taskId)}`);
        const data = await res.json();

        if (data.success) {
          const status = data.data.status;
          const videoUrl = data.data.videoUrl;
          const thumbnailUrl = data.data.thumbnailUrl;
          const error = data.data.error;

          setCurrentVideoStatus({
            status,
            videoUrl,
            thumbnailUrl,
            error
          });

          updateVideoHistory(taskId, {
            status,
            videoUrl,
            thumbnailUrl
          });

          // 如果完成或失败，停止轮询
          if (status === 'completed' || status === 'failed') {
            setIsPolling(false);
            return;
          }
        }
      } catch (error) {
        console.error('轮询失败:', error);
      }

      // 继续轮询（每 5 秒）
      setTimeout(poll, 5000);
    };

    poll();
  }, [apiKey, updateVideoHistory]);

  // 停止轮询
  const stopPolling = () => {
    setIsPolling(false);
  };

  // 重新查询某个视频
  const recheckVideo = async (taskId: string) => {
    try {
      const res = await fetch(`/api/generate/video?apiKey=${encodeURIComponent(apiKey)}&taskId=${encodeURIComponent(taskId)}`);
      const data = await res.json();

      if (data.success) {
        updateVideoHistory(taskId, {
          status: data.data.status,
          videoUrl: data.data.videoUrl,
          thumbnailUrl: data.data.thumbnailUrl
        });
      }
    } catch (error) {
      console.error('查询失败:', error);
    }
  };

  // 清除视频历史
  const clearVideoHistory = () => {
    setVideoHistory([]);
    localStorage.removeItem('banana2-video-history');
  };

  // 下载视频
  const handleDownloadVideo = async (videoUrl: string) => {
    try {
      const response = await fetch(videoUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `banana2-video-${Date.now()}.mp4`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('下载失败:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* 背景装饰 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-40 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 right-1/3 w-80 h-80 bg-pink-500/20 rounded-full blur-3xl" />
      </div>

      {/* 顶部导航 */}
      <header className="relative border-b border-white/10 bg-black/20 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 blur-md opacity-50" />
              <div className="relative w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
            </div>
            <div>
              <h1 className="font-bold text-xl text-white">Gemini API 中转站</h1>
              <p className="text-xs text-white/50">AI 图像生成平台</p>
            </div>
          </div>
          <Link 
            href="/admin" 
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all duration-300 border border-white/10"
          >
            <Settings className="w-4 h-4" />
            <span className="text-sm">管理后台</span>
          </Link>
        </div>
      </header>

      <main className="relative max-w-7xl mx-auto px-4 py-8">
        {/* Hero 区域 */}
        <div className="text-center mb-8">
          <p className="text-lg text-white/60 max-w-2xl mx-auto mb-6">
            支持 banana2、GPT-Image-2 和 Grok Video，快速生成高质量图像和视频
          </p>
          
          {/* Tab 选择 */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)} className="inline-block">
            <TabsList className="bg-white/5 border border-white/10">
              <TabsTrigger 
                value="image" 
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-500 data-[state=active]:text-white"
              >
                <ImageIcon className="w-4 h-4 mr-2" />
                图片生成
              </TabsTrigger>
              <TabsTrigger 
                value="video" 
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-500 data-[state=active]:text-white"
              >
                <Video className="w-4 h-4 mr-2" />
                视频生成
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="grid gap-8 lg:grid-cols-5">
          {/* 左侧：控制面板 */}
          <div className="lg:col-span-3 space-y-6">
            {/* API Key 卡片 */}
            <Card className="bg-white/5 border-white/10 backdrop-blur-xl overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-transparent pointer-events-none" />
              <CardHeader className="relative">
                <CardTitle className="flex items-center gap-2 text-white">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                    <Wallet className="w-4 h-4 text-white" />
                  </div>
                  API Key 管理
                </CardTitle>
              </CardHeader>
              <CardContent className="relative space-y-4">
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <Input
                      type="password"
                      placeholder="请输入你的 API Key"
                      value={apiKey}
                      onChange={(e) => {
                        setApiKey(e.target.value);
                        setBalanceInfo(null);
                      }}
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-purple-500/50 focus:ring-purple-500/20"
                    />
                  </div>
                  <Button 
                    onClick={handleCheckBalance}
                    disabled={balanceLoading}
                    className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white border-0 px-6"
                  >
                    {balanceLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                    <span className="ml-2">查询</span>
                  </Button>
                </div>

                {/* 余额信息 */}
                {balanceInfo && (
                  <div className="p-4 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 rounded-xl border border-emerald-500/20">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="space-y-1">
                        <span className="text-white/50 text-xs">Key 名称</span>
                        <p className="text-white font-medium">{balanceInfo.name || '未命名'}</p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-white/50 text-xs">使用次数</span>
                        <p className="text-white font-medium">{balanceInfo.usage_count} 次</p>
                      </div>
                      {balanceInfo.balance_limit !== null && balanceInfo.balance_limit !== undefined ? (
                        <>
                          <div className="space-y-1">
                            <span className="text-white/50 text-xs">余额限制</span>
                            <p className="text-white font-medium">¥{balanceInfo.balance_limit.toFixed(4)}</p>
                          </div>
                          <div className="space-y-1">
                            <span className="text-white/50 text-xs">剩余余额</span>
                            <p className={`font-bold ${(balanceInfo.remaining_balance ?? 0) > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              ¥{(balanceInfo.remaining_balance ?? 0).toFixed(4)}
                            </p>
                          </div>
                        </>
                      ) : (
                        <div className="space-y-1 col-span-2">
                          <span className="text-white/50 text-xs">余额状态</span>
                          <p className="text-emerald-400 font-bold">无限制</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)} className="w-full">
              <TabsContent value="image" className="space-y-6 mt-0">
                {/* 模型选择 */}
                <Card className="bg-white/5 border-white/10 backdrop-blur-xl">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center">
                        <Layers className="w-4 h-4 text-white" />
                      </div>
                      模型选择
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        onClick={() => handleModelChange('gemini')}
                        className={`relative p-4 rounded-xl border transition-all duration-300 ${
                          model === 'gemini' 
                            ? 'bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border-blue-500/50' 
                            : 'bg-white/5 border-white/10 hover:border-white/30'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            model === 'gemini' ? 'bg-blue-500' : 'bg-white/10'
                          }`}>
                            <Sparkles className="w-5 h-5 text-white" />
                          </div>
                          <div className="text-left">
                            <p className="font-semibold text-white">banana2</p>
                            <p className="text-xs text-white/50">gemini-3.1</p>
                          </div>
                        </div>
                      </button>
                      <button
                        onClick={() => handleModelChange('gpt-image-2')}
                        className={`relative p-4 rounded-xl border transition-all duration-300 ${
                          model === 'gpt-image-2' 
                            ? 'bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border-emerald-500/50' 
                            : 'bg-white/5 border-white/10 hover:border-white/30'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            model === 'gpt-image-2' ? 'bg-emerald-500' : 'bg-white/10'
                          }`}>
                            <Zap className="w-5 h-5 text-white" />
                          </div>
                          <div className="text-left">
                            <p className="font-semibold text-white">GPT-Image-2</p>
                            <p className="text-xs text-white/50">OpenAI 出品</p>
                          </div>
                        </div>
                      </button>
                    </div>
                  </CardContent>
                </Card>

                {/* 提示词 */}
                <Card className="bg-white/5 border-white/10 backdrop-blur-xl">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center">
                        <Palette className="w-4 h-4 text-white" />
                      </div>
                      创意描述
                    </CardTitle>
                    <CardDescription className="text-white/50">
                      用自然语言描述你想要生成的图片
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      placeholder="例如：一只可爱的橘猫在阳光下打盹，毛茸茸的，温暖的氛围，高清细节..."
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      rows={4}
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-pink-500/50 focus:ring-pink-500/20 resize-none"
                    />
                  </CardContent>
                </Card>

            {/* Gemini 参数 */}
            {model === 'gemini' && (
              <div className="grid gap-4 md:grid-cols-2">
                {/* 宽高比 */}
                <Card className="bg-white/5 border-white/10 backdrop-blur-xl">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-white/80">宽高比</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Select value={aspectRatio} onValueChange={setAspectRatio}>
                      <SelectTrigger className="bg-white/5 border-white/10 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-white/10">
                        {GEMINI_ASPECT_RATIOS.map(ratio => (
                          <SelectItem key={ratio.value} value={ratio.value} className="text-white hover:bg-white/10">
                            {ratio.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>

                {/* 分辨率 */}
                <Card className="bg-white/5 border-white/10 backdrop-blur-xl">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-white/80">分辨率</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Select value={imageSize} onValueChange={setImageSize}>
                      <SelectTrigger className="bg-white/5 border-white/10 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-white/10">
                        {GEMINI_IMAGE_SIZES.map(size => (
                          <SelectItem key={size.value} value={size.value} className="text-white hover:bg-white/10">
                            {size.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* GPT-Image-2 尺寸选择 */}
            {model === 'gpt-image-2' && (
              <Card className="bg-white/5 border-white/10 backdrop-blur-xl">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-white/80">图像尺寸</CardTitle>
                </CardHeader>
                <CardContent>
                  <Select value={gptSize} onValueChange={setGptSize}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-white/10">
                      {GPT_IMAGE_SIZES.map(size => (
                        <SelectItem key={size.value} value={size.value} className="text-white hover:bg-white/10">
                          {size.label} (¥{size.cost.toFixed(2)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            )}

            {/* 参考图上传（两个模型共用） */}
            <Card className="bg-white/5 border-white/10 backdrop-blur-xl">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white">参考图片</CardTitle>
                  {referenceImages.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearAllReferenceImages}
                      className="text-white/50 hover:text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      清空
                    </Button>
                  )}
                </div>
                <CardDescription className="text-white/50">
                  上传参考图片让 AI 参考（可选，{model === 'gemini' ? '最多6张' : '最多5张'}）
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {referenceImages.length > 0 && (
                  <div className="flex flex-wrap gap-3">
                    {referenceImages.map((img, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={img.preview}
                          alt={`参考图 ${index + 1}`}
                          className="w-16 h-16 object-cover rounded-lg border border-white/10"
                        />
                        <button
                          onClick={() => handleRemoveReferenceImage(index)}
                          className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-red-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                {referenceImages.length < (model === 'gemini' ? 6 : 5) && (
                  <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-white/20 rounded-xl cursor-pointer hover:bg-white/5 hover:border-white/40 transition-all duration-300">
                    <Plus className="w-8 h-8 text-white/30 mb-2" />
                    <p className="text-sm text-white/40">点击上传参考图</p>
                    <input 
                      type="file" 
                      className="hidden" 
                      accept="image/*"
                      onChange={handleFileUpload}
                    />
                  </label>
                )}
              </CardContent>
            </Card>

            {/* 生成按钮 */}
            <Button 
              onClick={handleGenerate} 
              disabled={loading}
              className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500 hover:from-purple-600 hover:via-pink-600 hover:to-blue-600 text-white border-0 shadow-lg shadow-purple-500/25 transition-all duration-300"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 mr-2" />
                  生成图片
                </>
              )}
            </Button>

            {/* 错误提示 */}
            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl">
                {error}
              </div>
            )}
              </TabsContent>

              <TabsContent value="video" className="space-y-6 mt-0">
                {/* 视频生成说明 */}
                <Card className="bg-white/5 border-white/10 backdrop-blur-xl">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center">
                        <Video className="w-4 h-4 text-white" />
                      </div>
                      Grok Video
                    </CardTitle>
                    <CardDescription className="text-white/50">
                      基于提示词生成高质量视频，支持图生视频功能
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="p-4 bg-purple-500/10 rounded-xl border border-purple-500/20">
                      <p className="text-sm text-purple-300">
                        视频生成是异步任务，创建后会自动轮询查询状态。生成完成后可下载视频。
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* 视频提示词 */}
                <Card className="bg-white/5 border-white/10 backdrop-blur-xl">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center">
                        <Palette className="w-4 h-4 text-white" />
                      </div>
                      视频描述
                    </CardTitle>
                    <CardDescription className="text-white/50">
                      用自然语言描述你想要生成的视频内容
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      placeholder="例如：一只橘色小猫在阳光下吃鱼，萌萌的表情，温馨的氛围..."
                      value={videoPrompt}
                      onChange={(e) => setVideoPrompt(e.target.value)}
                      rows={4}
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-pink-500/50 focus:ring-pink-500/20 resize-none"
                    />
                  </CardContent>
                </Card>

                {/* 视频参数 */}
                <div className="grid gap-4 md:grid-cols-2">
                  {/* 宽高比 */}
                  <Card className="bg-white/5 border-white/10 backdrop-blur-xl">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm text-white/80">宽高比</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Select value={videoAspectRatio} onValueChange={setVideoAspectRatio}>
                        <SelectTrigger className="bg-white/5 border-white/10 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-white/10">
                          {VIDEO_ASPECT_RATIOS.map(ratio => (
                            <SelectItem key={ratio.value} value={ratio.value} className="text-white hover:bg-white/10">
                              {ratio.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </CardContent>
                  </Card>

                  {/* 固定分辨率 */}
                  <Card className="bg-white/5 border-white/10 backdrop-blur-xl">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm text-white/80">分辨率</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                        <span className="text-purple-300 font-medium">720P (默认10秒)</span>
                        <span className="text-white/50 text-xs ml-2">¥0.30</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* 参考图上传 */}
                <Card className="bg-white/5 border-white/10 backdrop-blur-xl">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-white">参考图片 (可选)</CardTitle>
                        <CardDescription className="text-white/50">
                          上传参考图让视频基于图片生成（图生视频）
                        </CardDescription>
                      </div>
                      {videoReferenceImage && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setVideoReferenceImage(null)}
                          className="text-white/50 hover:text-red-400 hover:bg-red-500/10"
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          清空
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {videoReferenceImage ? (
                      <div className="relative group inline-block">
                        <img
                          src={videoReferenceImage.preview}
                          alt="参考图"
                          className="w-32 h-32 object-cover rounded-xl border border-white/10"
                        />
                        <button
                          onClick={() => setVideoReferenceImage(null)}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-1 rounded text-xs text-white">
                          参考图
                        </div>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-white/20 rounded-xl cursor-pointer hover:bg-white/5 hover:border-white/40 transition-all">
                        <ImageIcon className="w-8 h-8 text-white/30 mb-2" />
                        <p className="text-sm text-white/40">点击上传参考图</p>
                        <p className="text-xs text-white/20 mt-1">支持 JPG、PNG，最大 10MB</p>
                        <input 
                          type="file" 
                          className="hidden" 
                          accept="image/*"
                          onChange={handleVideoFileUpload}
                        />
                      </label>
                    )}
                    {videoReferenceImage && (
                      <div className="mt-3 p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                        <p className="text-sm text-emerald-400">
                          图片将自动上传到图床用于视频生成
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* 视频生成状态 */}
                {currentTaskId && currentVideoStatus && (
                  <Card className="bg-white/5 border-white/10 backdrop-blur-xl">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-white">
                        <RefreshCw className={`w-4 h-4 ${isPolling ? 'animate-spin' : ''}`} />
                        生成状态
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-white/50">任务ID:</span>
                        <span className="text-xs text-white/70 font-mono">{currentTaskId}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-white/50">状态:</span>
                        <span className={`text-sm font-medium ${
                          currentVideoStatus.status === 'completed' ? 'text-emerald-400' :
                          currentVideoStatus.status === 'failed' ? 'text-red-400' :
                          'text-amber-400'
                        }`}>
                          {currentVideoStatus.status === 'pending' ? '生成中...' :
                           currentVideoStatus.status === 'completed' ? '已完成' :
                           currentVideoStatus.status === 'failed' ? '失败' :
                           currentVideoStatus.status}
                        </span>
                      </div>
                      {currentVideoStatus.error && (
                        <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                          <p className="text-sm text-red-400">{currentVideoStatus.error}</p>
                        </div>
                      )}
                      {currentVideoStatus.videoUrl && (
                        <div className="space-y-2">
                          <p className="text-sm text-emerald-400">视频生成成功！</p>
                          <a
                            href={currentVideoStatus.videoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 w-full p-3 bg-emerald-500/20 hover:bg-emerald-500/30 rounded-lg border border-emerald-500/30 text-emerald-300 transition-all"
                          >
                            <Play className="w-4 h-4" />
                            观看视频
                          </a>
                          <Button
                            onClick={() => handleDownloadVideo(currentVideoStatus.videoUrl!)}
                            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white border-0"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            下载视频
                          </Button>
                        </div>
                      )}
                      {isPolling && currentVideoStatus.status === 'pending' && (
                        <div className="flex items-center justify-center gap-2 text-sm text-amber-400">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          自动刷新中，每 5 秒查询一次状态...
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={stopPolling}
                            className="text-white/50 hover:text-white"
                          >
                            停止
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* 生成视频按钮 */}
                <Button 
                  onClick={handleGenerateVideo} 
                  disabled={videoLoading || isPolling}
                  className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-purple-500 via-pink-500 to-indigo-500 hover:from-purple-600 hover:via-pink-600 hover:to-indigo-600 text-white border-0 shadow-lg shadow-purple-500/25 transition-all duration-300"
                >
                  {videoLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      创建任务...
                    </>
                  ) : (
                    <>
                      <Video className="w-5 h-5 mr-2" />
                      生成视频
                    </>
                  )}
                </Button>

                {/* 错误提示 */}
                {videoError && (
                  <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl">
                    {videoError}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* 右侧：结果展示 */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-white/5 border-white/10 backdrop-blur-xl sticky top-24">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white">
                    {activeTab === 'image' ? '生成结果' : '视频结果'}
                  </CardTitle>
                  {activeTab === 'image' && result && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCopyImage}
                        className="bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white"
                      >
                        {copied ? (
                          <>
                            <Check className="w-4 h-4 mr-1 text-emerald-400" />
                            <span className="text-emerald-400">已复制</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4 mr-1" />
                            复制
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDownload}
                        className="bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white"
                      >
                        <Download className="w-4 h-4 mr-1" />
                        下载
                      </Button>
                    </div>
                  )}
                  {activeTab === 'video' && currentVideoStatus?.videoUrl && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadVideo(currentVideoStatus.videoUrl!)}
                        className="bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white"
                      >
                        <Download className="w-4 h-4 mr-1" />
                        下载
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {activeTab === 'image' ? (
                  result ? (
                    <div className="space-y-4">
                      <div className="relative group">
                        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-pink-500/20 blur-xl opacity-50 group-hover:opacity-70 transition-opacity" />
                        <img 
                          src={`data:${result.mimeType};base64,${result.image}`}
                          alt="Generated"
                          className="relative w-full rounded-xl border border-white/10 shadow-2xl"
                        />
                      </div>
                      <div className="flex items-center justify-between text-sm text-white/50 px-2">
                        <span>消耗: <span className="text-white font-medium">¥{(result.cost ?? 0).toFixed(4)}</span></span>
                        <span>模型: <span className="text-white font-medium">{getModelDisplayName(model)}</span></span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-72 text-white/30">
                      <div className="w-20 h-20 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                        <ImageIcon className="w-10 h-10" />
                      </div>
                      <p className="text-center">生成的图片将显示在这里</p>
                      <p className="text-xs text-white/20 mt-1">支持复制和下载</p>
                    </div>
                  )
                ) : (
                  currentVideoStatus?.videoUrl ? (
                    <div className="space-y-4">
                      {currentVideoStatus.thumbnailUrl && (
                        <div className="relative group">
                          <img 
                            src={currentVideoStatus.thumbnailUrl}
                            alt="Video Thumbnail"
                            className="relative w-full rounded-xl border border-white/10 shadow-2xl"
                          />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <a
                              href={currentVideoStatus.videoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-16 h-16 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center transition-all"
                            >
                              <Play className="w-8 h-8 text-white" />
                            </a>
                          </div>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-sm text-white/50 px-2">
                        <span>状态: <span className="text-emerald-400 font-medium">已完成</span></span>
                        <span>模型: <span className="text-white font-medium">Grok Video</span></span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-72 text-white/30">
                      <div className="w-20 h-20 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                        <Video className="w-10 h-10" />
                      </div>
                      <p className="text-center">生成的视频将显示在这里</p>
                      <p className="text-xs text-white/20 mt-1">点击播放按钮观看</p>
                    </div>
                  )
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* 图片历史记录 */}
        {history.length > 0 && activeTab === 'image' && (
          <Card className="mt-8 bg-white/5 border-white/10 backdrop-blur-xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <History className="w-5 h-5" />
                    生成历史
                  </CardTitle>
                  <CardDescription className="text-white/50">
                    最近生成的 {history.length} 张图片（最多保留 {MAX_HISTORY} 条）
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearHistory}
                  className="text-white/50 hover:text-red-400 hover:bg-red-500/10"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  清空
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="group relative cursor-pointer"
                    onClick={() => viewHistoryItem(item)}
                  >
                    <img
                      src={`data:${item.mimeType};base64,${item.image}`}
                      alt={item.prompt}
                      className="w-full aspect-square object-cover rounded-xl border border-white/10 hover:border-purple-500/50 transition-all duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-end p-3">
                      <div className="text-white text-xs">
                        <p className="line-clamp-2">{item.prompt.slice(0, 40)}{item.prompt.length > 40 ? '...' : ''}</p>
                        <p className="mt-1 text-purple-300">¥{(item.cost ?? 0).toFixed(4)}</p>
                      </div>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0 opacity-0 group-hover:opacity-100 transition-all duration-200 bg-red-500 hover:bg-red-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFromHistory(item.id);
                      }}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 视频历史记录 */}
        {videoHistory.length > 0 && activeTab === 'video' && (
          <Card className="mt-8 bg-white/5 border-white/10 backdrop-blur-xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <History className="w-5 h-5" />
                    视频历史
                  </CardTitle>
                  <CardDescription className="text-white/50">
                    最近生成的 {videoHistory.length} 个视频（最多保留 {MAX_VIDEO_HISTORY} 条）
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearVideoHistory}
                  className="text-white/50 hover:text-red-400 hover:bg-red-500/10"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  清空
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {videoHistory.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-4 p-4 bg-white/5 rounded-xl border border-white/10 hover:border-purple-500/30 transition-all"
                  >
                    {item.thumbnailUrl ? (
                      <div className="relative w-24 h-24 flex-shrink-0">
                        <img
                          src={item.thumbnailUrl}
                          alt={item.prompt}
                          className="w-full h-full object-cover rounded-lg"
                        />
                        {item.videoUrl && (
                          <a
                            href={item.videoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/50 rounded-lg transition-all"
                          >
                            <Play className="w-8 h-8 text-white" />
                          </a>
                        )}
                      </div>
                    ) : (
                      <div className="w-24 h-24 flex-shrink-0 bg-white/5 rounded-lg flex items-center justify-center">
                        <Video className="w-8 h-8 text-white/30" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white line-clamp-2">{item.prompt}</p>
                      <p className="text-xs text-white/50 mt-1 font-mono">ID: {item.taskId.slice(0, 20)}...</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          item.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
                          item.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                          'bg-amber-500/20 text-amber-400'
                        }`}>
                          {item.status === 'completed' ? '已完成' :
                           item.status === 'failed' ? '失败' :
                           item.status === 'pending' ? '生成中' : item.status}
                        </span>
                        <span className="text-xs text-white/50">¥{(item.cost ?? 0).toFixed(4)}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {item.videoUrl && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownloadVideo(item.videoUrl!)}
                            className="bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white"
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => recheckVideo(item.taskId)}
                        className="bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 使用说明 */}
        <Card className="mt-8 bg-white/5 border-white/10 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-white">使用指南</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-5 gap-4">
              {[
                { icon: Wallet, title: '输入 Key', desc: '输入你的 API Key', color: 'from-amber-400 to-orange-500' },
                { icon: Search, title: '查询余额', desc: '查看剩余额度', color: 'from-emerald-400 to-teal-500' },
                { icon: Layers, title: '选择模型', desc: 'banana2 或 GPT-Image-2', color: 'from-blue-400 to-cyan-500' },
                { icon: Palette, title: '描述创意', desc: '用自然语言描述', color: 'from-pink-400 to-rose-500' },
                { icon: Sparkles, title: '生成图片', desc: '一键生成高质量图像', color: 'from-purple-400 to-pink-500' },
              ].map((step, i) => (
                <div key={i} className="text-center p-4">
                  <div className={`w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center`}>
                    <step.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="font-semibold text-white mb-1">{step.title}</h3>
                  <p className="text-xs text-white/50">{step.desc}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* API 调用示例 */}
        <Card className="mt-8 bg-white/5 border-white/10 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Code className="w-5 h-5" />
              API 调用示例
            </CardTitle>
            <CardDescription className="text-white/50">
              使用以下代码示例调用我们的 API
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 文生图示例 */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-400" />
                文生图 (Text to Image)
              </h4>
              <div className="space-y-3">
                <div className="text-xs text-white/50">banana2 (gemini-3.1) 模型</div>
                <div className="bg-black/40 rounded-lg p-4 overflow-x-auto">
                  <pre className="text-sm text-green-400 font-mono">
{`curl -X POST 域名/api/generate \\
  -H "Content-Type: application/json" \\
  -d '{
    "apiKey": "YOUR_API_KEY",
    "prompt": "一只可爱的橘猫在阳光下打盹",
    "model": "gemini",
    "aspectRatio": "1:1",
    "imageSize": "2K"
  }'`}
                  </pre>
                </div>
                <div className="text-xs text-white/50">GPT-Image-2 模型</div>
                <div className="bg-black/40 rounded-lg p-4 overflow-x-auto">
                  <pre className="text-sm text-green-400 font-mono">
{`curl -X POST 域名/api/generate \\
  -H "Content-Type: application/json" \\
  -d '{
    "apiKey": "YOUR_API_KEY",
    "prompt": "A beautiful sunset over the ocean",
    "model": "gpt-image-2",
    "size": "1024x1024"
  }'`}
                  </pre>
                </div>
              </div>
            </div>

            {/* 图生图示例 */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-pink-400" />
                图生图 (Image to Image)
              </h4>
              <div className="space-y-3">
                <div className="text-xs text-white/50">banana2 (gemini-3.1) 模型 - 参考 base64 图片</div>
                <div className="bg-black/40 rounded-lg p-4 overflow-x-auto">
                  <pre className="text-sm text-green-400 font-mono">
{`curl -X POST 域名/api/generate \\
  -H "Content-Type: application/json" \\
  -d '{
    "apiKey": "YOUR_API_KEY",
    "prompt": "将这张图片转换成油画风格",
    "model": "gemini",
    "aspectRatio": "1:1",
    "imageSize": "2K",
    "referenceImages": [
      {
        "mimeType": "image/png",
        "data": "BASE64_IMAGE_DATA"
      }
    ]
  }'`}
                  </pre>
                </div>
                <div className="text-xs text-white/50">GPT-Image-2 模型 - 参考 base64 图片</div>
                <div className="bg-black/40 rounded-lg p-4 overflow-x-auto">
                  <pre className="text-sm text-green-400 font-mono">
{`curl -X POST 域名/api/generate \\
  -H "Content-Type: application/json" \\
  -d '{
    "apiKey": "YOUR_API_KEY",
    "prompt": "Edit this image to add a rainbow in the sky",
    "model": "gpt-image-2",
    "size": "1024x1024",
    "imageUrls": ["data:image/png;base64,BASE64_IMAGE_DATA"]
  }'`}
                  </pre>
                </div>
              </div>
            </div>

            {/* 视频生成示例 */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Video className="w-4 h-4 text-purple-400" />
                视频生成 (Grok Video)
              </h4>
              <div className="space-y-3">
                <div className="text-xs text-white/50">创建视频任务（异步）</div>
                <div className="bg-black/40 rounded-lg p-4 overflow-x-auto">
                  <pre className="text-sm text-green-400 font-mono">
{`curl -X POST 域名/api/generate/video \\
  -H "Content-Type: application/json" \\
  -d '{
    "apiKey": "YOUR_API_KEY",
    "prompt": "一只小猫在吃鱼",
    "aspectRatio": "1:1",
    "images": []
  }'`}
                  </pre>
                </div>
                <div className="text-xs text-white/50">查询视频状态</div>
                <div className="bg-black/40 rounded-lg p-4 overflow-x-auto">
                  <pre className="text-sm text-green-400 font-mono">
{`curl "域名/api/generate/video?apiKey=YOUR_API_KEY&taskId=TASK_ID"`}
                  </pre>
                </div>
              </div>
            </div>

            {/* 查询余额示例 */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Wallet className="w-4 h-4 text-amber-400" />
                查询余额
              </h4>
              <div className="bg-black/40 rounded-lg p-4 overflow-x-auto">
                <pre className="text-sm text-green-400 font-mono">
{`curl 域名/api/generate?apiKey=YOUR_API_KEY`}
                </pre>
              </div>
            </div>

            {/* 返回格式说明 */}
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <h4 className="text-sm font-semibold text-blue-300 mb-2">返回格式</h4>
              <div className="bg-black/40 rounded-lg p-3 overflow-x-auto">
                <pre className="text-xs text-green-400 font-mono">
{`// 成功响应
{
  "success": true,
  "data": {
    "image": "base64编码的图片数据",
    "mimeType": "image/png",
    "cost": 0.1,
    "model": "gemini"
  }
}

// 视频响应
{
  "success": true,
  "data": {
    "taskId": "task_xxx",
    "status": "completed",
    "videoUrl": "https://xxx.mp4",
    "thumbnailUrl": "https://xxx.jpg",
    "progress": 100
  }
}

// 错误响应
{
  "success": false,
  "error": "错误信息"
}`}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 页脚 */}
        <footer className="mt-12 text-center text-white/30 text-sm">
          <p>Powered by banana2 (gemini-3.1) & GPT-Image-2 & Grok Video | Gemini API 中转站</p>
        </footer>
      </main>
    </div>
  );
}

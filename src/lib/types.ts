// 数据库类型定义

export interface Site {
  id: number;
  name: string;
  base_url: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  account_count?: number;
  active_account_count?: number;
}

export interface Account {
  id: number;
  site_id: number;
  site_name?: string;
  base_url?: string;
  username: string;
  password: string;
  api_key: string | null;
  token: string | null;
  session?: string | null;
  remote_user_id?: number | null;
  balance: number;
  is_active: boolean;
  last_error: string | null;
  balance_updated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserKey {
  id: number;
  key_value: string;
  name: string | null;
  is_active: boolean;
  usage_count: number;
  balance_limit: number | null;  // 余额限制（null 表示无限制）
  used_balance: number;          // 已使用余额
  created_at: string;
  total_calls?: number;
  success_calls?: number;
}

export interface CallLog {
  id: number;
  user_key_id: number | null;
  account_id: number | null;
  prompt: string | null;
  model: string | null;
  success: boolean;
  error_message: string | null;
  cost: number | null;
  created_at: string;
  key_name?: string | null;
  key_value?: string | null;
  account_username?: string | null;
  site_name?: string | null;
}

export interface OverviewStats {
  activeSites: number;
  activeAccounts: number;
  accountsWithKey: number;
  totalBalance: number;
  total: number;
  success: number;
  today: number;
}

export interface SystemStats {
  availableAccounts: number;
  totalBalance: number;
  topAccounts: Array<{
    id: number;
    siteName: string;
    username: string;
    balance: number;
  }>;
}

// 用户 Key 余额信息（前端查询用）
export interface UserKeyBalance {
  key_value: string;
  name: string | null;
  is_active: boolean;
  balance_limit: number | null;
  used_balance: number;
  remaining_balance: number | null;  // null 表示无限制
  usage_count: number;
}

// 平台日志（从中转站获取）
export interface PlatformLog {
  id: number;
  site_id: number;
  site_name: string;
  account_id: number;
  account_username: string;
  type: number;  // 0: 充值, 1: 消费, 2: 管理, 3: 其他
  content: string;
  model: string | null;
  prompt_tokens: number;
  completion_tokens: number;
  quota: number;
  cost: number;
  created_at: number;
}

// 模型类型
export type ModelType = 'gemini' | 'gpt-image-2';

// GPT-image-2 尺寸选项
export type GPTImageSize = '1024x1024' | '1536x1024' | '1024x1536';

// 生成图片选项
export interface GenerateImageOptions {
  prompt: string;
  model?: ModelType;  // 模型类型
  // Gemini 参数
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
  imageSize?: '1K' | '2K';
  referenceImage?: { data: string; mimeType: string };
  referenceImages?: Array<{ data: string; mimeType: string }>;
  // GPT-image-2 参数
  gptSize?: GPTImageSize;
  gptImages?: string[];  // 图片 URL 数组
}

// GPT-image-2 API 请求
export interface GPTImageRequest {
  model: string;
  size: string;
  n: number;
  prompt: string;
  image?: string[];  // 可选的图片 URL 数组
}

// GPT-image-2 API 响应
export interface GPTImageResponse {
  data?: Array<{
    url?: string;
    b64_json?: string;
  }>;
  error?: {
    message: string;
    type: string;
  };
}

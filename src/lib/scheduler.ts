import { accountsDb, userKeysDb, logsDb, sitesDb } from './db';
import { getBalanceWithApiKey } from './new-api';
import type { Account, Site } from './types';

// 日志创建重试包装函数（处理唯一约束冲突）
async function createLogWithRetry(
  log: { user_key_id?: number | null; account_id?: number | null; prompt: string; model?: string; success: boolean; error_message?: string | null; cost: number },
  maxRetries: number = 5
): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await logsDb.create(log);
      return;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('duplicate key') || errorMessage.includes('unique constraint')) {
        // 如果是唯一约束冲突，短暂等待后重试
        await new Promise(resolve => setTimeout(resolve, 50 * (i + 1)));
        continue;
      }
      // 其他错误直接忽略
      console.warn('记录日志失败（非唯一约束）:', errorMessage);
      return;
    }
  }
  // 达到最大重试次数，忽略错误（不影响主流程）
  console.warn('记录日志失败，已达到最大重试次数');
}

// 模型配置
const GEMINI_MODEL = 'gemini-3.1-flash-image-preview';
const GPT_MODEL = 'gpt-image-2-all';
const GROK_VIDEO_MODEL = 'grok-video-3';

// 用户定价（每次请求）
const USER_COST_PER_IMAGE: Record<string, number> = {
  '2K': 0.1,
  '4K': 0.15,
  '1024x1024': 0.06,
  '1536x1024': 0.06,
  '1024x1536': 0.06,
};

// 视频定价（用户价格，每次请求）
const USER_COST_PER_VIDEO: Record<string, number> = {
  '720P': 0.3,
};

// 实际成本（用于记录）
const ACTUAL_COST_PER_VIDEO: Record<string, number> = {
  '720P': 0.4,
};

// 实际成本（用于记录）
const ACTUAL_COST_PER_IMAGE: Record<string, number> = {
  '2K': 0.248,
  '4K': 0.443,
  '1024x1024': 0.12,
  '1536x1024': 0.12,
  '1024x1536': 0.12,
};

// Gemini 支持的宽高比
const GEMINI_ASPECT_RATIOS = ['1:1', '16:9', '9:16', '4:3', '3:4'] as const;

// GPT-image-2 支持的尺寸
const GPT_IMAGE_SIZES = ['1024x1024', '1536x1024', '1024x1536'] as const;

// Gemini API 请求格式
interface GeminiRequest {
  contents: Array<{
    parts: Array<{
      text?: string;
      inline_data?: {
        mime_type: string;
        data: string;
      };
    }>;
  }>;
  generationConfig?: {
    imageConfig?: {
      aspectRatio: string;
      imageSize: string;
    };
  };
}

// Gemini API 响应格式
interface GeminiResponse {
  candidates?: Array<{
    content: {
      parts: Array<{
        text?: string;
        inlineData?: {
          mimeType: string;
          data: string;
        };
      }>;
    };
  }>;
  error?: {
    code: number;
    message: string;
    status: string;
  };
}

// GPT-image-2 API 请求格式
interface GPTImageRequest {
  model: string;
  prompt: string;
  size?: string;
  n?: number;
  image?: string[];
}

// GPT-image-2 API 响应格式
interface GPTImageResponse {
  data?: Array<{
    url?: string;
    b64_json?: string;
  }>;
  error?: {
    message: string;
    type: string;
    code: string;
  };
}

export interface GenerateImageOptions {
  prompt: string;
  model?: 'gemini' | 'gpt-image-2';
  // Gemini 参数
  aspectRatio?: string;
  imageSize?: string;
  referenceImage?: {
    mimeType: string;
    data: string;
  };
  referenceImages?: Array<{
    mimeType: string;
    data: string;
  }>;
  // GPT-image-2 参数
  size?: string;
  n?: number;
  imageUrls?: string[];
}

export interface GenerateImageResult {
  success: boolean;
  images?: Array<{ data: string; mimeType: string }>;
  model?: string;
  error?: string;
  cost?: number;
}

// 扩展 Account 类型，包含站点信息
interface AccountWithSite extends Account {
  base_url: string;
  site_name: string;
}

// 智能调度器：获取所有可用账号按余额排序
export async function getSortedAccounts(): Promise<AccountWithSite[]> {
  const accounts = await accountsDb.getAccountsWithSite();
  // 按余额从高到低排序，并确保类型正确
  return [...accounts].sort((a, b) => b.balance - a.balance) as AccountWithSite[];
}

// 检查错误是否为余额不足
function isInsufficientBalanceError(error: string): boolean {
  const lowerError = error.toLowerCase();
  return lowerError.includes('quota') || 
         lowerError.includes('balance') || 
         lowerError.includes('insufficient') ||
         lowerError.includes('余额不足') ||
         lowerError.includes('配额不足') ||
         lowerError.includes('rate limit');
}

// 检查错误是否为临时性错误（应该重试下一个账号）
function isTemporaryError(error: string): boolean {
  const lowerError = error.toLowerCase();
  return lowerError.includes('负载已饱和') ||
         lowerError.includes('upstream') ||
         lowerError.includes('暂时') ||
         lowerError.includes('busy') ||
         lowerError.includes('retry') ||
         lowerError.includes('timeout') ||
         lowerError.includes('temporary');
}

// 使用 Gemini 生成图片
async function generateWithGemini(
  account: AccountWithSite,
  options: GenerateImageOptions,
  keyInfo: { id: number; is_active: boolean }
): Promise<GenerateImageResult> {
  const requestBody: GeminiRequest = {
    contents: [
      {
        parts: [
          { text: options.prompt }
        ]
      }
    ],
    generationConfig: {
      imageConfig: {
        aspectRatio: options.aspectRatio || '1:1',
        imageSize: options.imageSize || '2K'
      }
    }
  };

  // 添加参考图（支持多张）
  const images = options.referenceImages || (options.referenceImage ? [options.referenceImage] : []);
  for (const img of images) {
    requestBody.contents[0].parts.push({
      inline_data: {
        mime_type: img.mimeType,
        data: img.data
      }
    });
  }

  try {
    // 清理 baseUrl，移除末尾斜杠
    const cleanUrl = account.base_url.replace(/\/$/, '');
    const url = `${cleanUrl}/v1beta/models/${GEMINI_MODEL}:generateContent`;
    
    // 移除 sk- 前缀（如果存在）
    const apiKey = account.api_key?.replace(/^sk-/, '') || '';
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    const data: GeminiResponse = await response.json();

    if (data.error) {
      return { success: false, error: data.error.message };
    }

    const candidates = data.candidates;
    if (!candidates || candidates.length === 0) {
      return { success: false, error: '未返回生成结果' };
    }

    const parts = candidates[0].content.parts;
    const imagePart = parts.find(p => p.inlineData);

    if (!imagePart?.inlineData) {
      const textPart = parts.find(p => p.text);
      return { success: false, error: textPart?.text || '未生成图片' };
    }

    return {
      success: true,
      images: [{
        data: imagePart.inlineData.data,
        mimeType: imagePart.inlineData.mimeType
      }],
      model: GEMINI_MODEL
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '请求失败' };
  }
}

// 使用 GPT-image-2 生成图片
async function generateWithGPT(
  account: AccountWithSite,
  options: GenerateImageOptions,
  keyInfo: { id: number; is_active: boolean }
): Promise<GenerateImageResult> {
  const requestBody: GPTImageRequest = {
    model: GPT_MODEL,
    prompt: options.prompt,
    size: options.size || '1024x1024',
    n: options.n || 1
  };

  // 添加参考图片 URL
  if (options.imageUrls && options.imageUrls.length > 0) {
    requestBody.image = options.imageUrls;
  }

  try {
    const cleanUrl = account.base_url.replace(/\/$/, '');
    const url = `${cleanUrl}/v1/images/generations`;
    const apiKey = account.api_key?.replace(/^sk-/, '') || '';
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    const data: GPTImageResponse = await response.json();

    if (data.error) {
      return { success: false, error: data.error.message };
    }

    if (!data.data || data.data.length === 0) {
      return { success: false, error: '未返回生成结果' };
    }

    // 处理返回的图片（可能是 URL 或 base64）
    const images: Array<{ data: string; mimeType: string }> = [];
    
    for (const item of data.data) {
      if (item.b64_json) {
        images.push({
          data: item.b64_json,
          mimeType: 'image/png'
        });
      } else if (item.url) {
        // 如果返回的是 URL，下载图片并转换为 base64
        try {
          const imgResponse = await fetch(item.url);
          const buffer = await imgResponse.arrayBuffer();
          const base64 = Buffer.from(buffer).toString('base64');
          const mimeType = imgResponse.headers.get('content-type') || 'image/png';
          images.push({
            data: base64,
            mimeType
          });
        } catch {
          // 如果下载失败，返回 URL 作为错误信息
          return { success: false, error: `图片已生成但无法下载: ${item.url}` };
        }
      }
    }

    if (images.length === 0) {
      return { success: false, error: '未获取到图片数据' };
    }

    return {
      success: true,
      images,
      model: GPT_MODEL
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '请求失败' };
  }
}

// 生成图片（主函数）
export async function generateImage(
  userKey: string,
  options: GenerateImageOptions
): Promise<GenerateImageResult> {
  // 验证用户 Key
  const keyInfo = await userKeysDb.getByKeyValue(userKey);
  if (!keyInfo) {
    return { success: false, error: '无效的 API Key' };
  }
  
  if (!keyInfo.is_active) {
    return { success: false, error: 'API Key 已禁用' };
  }

  // 检查余额限制
  if (keyInfo.balance_limit !== null && keyInfo.used_balance >= keyInfo.balance_limit) {
    return { success: false, error: '余额已用尽' };
  }

  // 确定模型
  const model = options.model || 'gemini';
  const modelStr = model === 'gpt-image-2' ? GPT_MODEL : GEMINI_MODEL;

  // 计算本次消耗
  const sizeKey = model === 'gpt-image-2' 
    ? (options.size || '1024x1024')
    : (options.imageSize || '2K');
  const userCost = USER_COST_PER_IMAGE[sizeKey] || USER_COST_PER_IMAGE['2K'];
  const actualCost = ACTUAL_COST_PER_IMAGE[sizeKey] || ACTUAL_COST_PER_IMAGE['2K'];

  // 获取所有可用账号并按余额排序
  const sortedAccounts = await getSortedAccounts();
  if (sortedAccounts.length === 0) {
    // 记录失败日志（使用重试包装）
    await createLogWithRetry({
      user_key_id: keyInfo.id,
      prompt: options.prompt,
      model: modelStr,
      success: false,
      error_message: '没有可用账号',
      cost: 0
    });
    return { success: false, error: '没有可用的账号' };
  }

  // 尝试每个账号，直到成功或全部失败
  const triedAccounts: string[] = [];
  let lastError = '';

  for (const account of sortedAccounts) {
    triedAccounts.push(`${account.site_name}/${account.username} (余额: ¥${account.balance.toFixed(4)})`);

    // 根据模型选择生成函数
    const result = model === 'gpt-image-2'
      ? await generateWithGPT(account, options, { id: keyInfo.id, is_active: keyInfo.is_active })
      : await generateWithGemini(account, options, { id: keyInfo.id, is_active: keyInfo.is_active });

    if (!result.success) {
      lastError = result.error || '未知错误';
      
      // 记录失败日志（使用重试包装）
      await createLogWithRetry({
        user_key_id: keyInfo.id,
        account_id: account.id,
        prompt: options.prompt,
        model: modelStr,
        success: false,
        error_message: lastError,
        cost: 0
      });

      // 异步更新账号余额（可能已经扣费）
      getBalanceWithApiKey(account.base_url, account.api_key!)
        .then(async balanceResult => {
          if (balanceResult.success) {
            await accountsDb.update(account.id, { balance: balanceResult.balance });
          }
        })
        .catch(() => {});

      // 如果是余额不足，继续尝试下一个账号
      if (isInsufficientBalanceError(lastError)) {
        console.log(`账号 ${account.username} 余额不足，尝试下一个账号...`);
        continue;
      }

      continue;
    }

    // 成功！更新用户 Key 使用次数和消耗
    await userKeysDb.incrementUsage(keyInfo.id, userCost);

    // 异步更新账号余额
    getBalanceWithApiKey(account.base_url, account.api_key!)
      .then(async balanceResult => {
        if (balanceResult.success) {
          await accountsDb.update(account.id, { balance: balanceResult.balance });
        }
      })
      .catch(() => {});

    // 记录成功日志（使用重试包装）
    await createLogWithRetry({
      user_key_id: keyInfo.id,
      account_id: account.id,
      prompt: options.prompt,
      model: modelStr,
      success: true,
      cost: actualCost
    });

    return {
      success: true,
      images: result.images,
      model: modelStr,
      cost: userCost
    };
  }

  // 所有账号都失败了
  return { 
    success: false, 
    error: `所有账号都失败了。尝试了 ${triedAccounts.length} 个账号。最后错误: ${lastError}` 
  };
}

// 获取用户 Key 余额信息
export async function getUserKeyBalance(keyValue: string) {
  return userKeysDb.getBalanceInfo(keyValue);
}

// 导出常量供前端使用
export { GEMINI_MODEL, GPT_MODEL, GROK_VIDEO_MODEL, GEMINI_ASPECT_RATIOS, GPT_IMAGE_SIZES, USER_COST_PER_VIDEO };

// ============ 视频生成功能 ============

export interface GenerateVideoOptions {
  prompt: string;
  aspectRatio?: string;  // '2:3', '3:2', '1:1'
  size?: string;        // '720P', '1080P'
  images?: string[];    // 参考图片 URL
}

export interface GenerateVideoResult {
  success: boolean;
  taskId?: string;
  error?: string;
}

export interface VideoQueryResult {
  success: boolean;
  taskId?: string;
  status?: string;       // 'pending', 'completed', 'failed'
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  error?: string;
  progress?: number;
}

// 使用 Grok Video 生成视频
async function generateWithGrokVideo(
  account: AccountWithSite,
  options: GenerateVideoOptions,
  keyInfo: { id: number; is_active: boolean }
): Promise<GenerateVideoResult> {
  const requestBody = {
    model: GROK_VIDEO_MODEL,
    prompt: options.prompt,
    aspect_ratio: options.aspectRatio || '1:1',
    size: options.size || '720P',
    images: options.images || []
  };

  try {
    const cleanUrl = account.base_url.replace(/\/$/, '');
    const url = `${cleanUrl}/v1/video/create`;
    const apiKey = account.api_key?.replace(/^sk-/, '') || '';
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    // 检查是否返回了任务 ID
    if (data.id) {
      return { success: true, taskId: data.id };
    }

    // 如果返回错误（可能是字符串或对象）
    if (data.error) {
      const errorMsg = typeof data.error === 'string' ? data.error : (data.error.message || JSON.stringify(data.error));
      return { success: false, error: errorMsg };
    }

    // 如果既没有 id 也没有明确的错误
    return { success: false, error: '创建视频任务失败，未获取到任务ID' };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '请求失败' };
  }
}

// 查询视频生成状态
async function queryGrokVideoStatus(
  account: AccountWithSite,
  taskId: string
): Promise<VideoQueryResult> {
  try {
    const cleanUrl = account.base_url.replace(/\/$/, '');
    const url = `${cleanUrl}/v1/video/query?id=${encodeURIComponent(taskId)}`;
    const apiKey = account.api_key?.replace(/^sk-/, '') || '';
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      }
    });

    const data = await response.json();

    // 检查状态
    const status = data.status || 'unknown';
    
    // 如果是 error 状态，说明该账号无法查询此任务（任务不存在或账号不匹配）
    if (status === 'error') {
      // 继续尝试下一个账号
      return { 
        success: false, 
        error: data.error || '该账号无法查询此任务' 
      };
    }
    
    if (status === 'completed') {
      return {
        success: true,
        taskId: data.id || taskId,
        status: 'completed',
        videoUrl: data.video_url || null,
        thumbnailUrl: data.thumbnail_url || null,
        progress: data.progress || 100
      };
    }

    if (status === 'failed') {
      return {
        success: false,
        taskId: data.id || taskId,
        status: 'failed',
        error: data.error || '视频生成失败',
        videoUrl: null,
        thumbnailUrl: data.thumbnail_url || null,
        progress: data.progress || 0
      };
    }

    // pending 或 processing 等其他状态
    return {
      success: true,
      taskId: data.id || taskId,
      status: status,
      videoUrl: null,
      thumbnailUrl: data.thumbnail_url || null,
      progress: data.progress || 0
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '查询失败' };
  }
}

// 生成视频（主函数）- 异步创建任务
export async function generateVideo(
  userKey: string,
  options: GenerateVideoOptions
): Promise<GenerateVideoResult> {
  // 验证用户 Key
  const keyInfo = await userKeysDb.getByKeyValue(userKey);
  if (!keyInfo) {
    return { success: false, error: '无效的 API Key' };
  }
  
  if (!keyInfo.is_active) {
    return { success: false, error: 'API Key 已禁用' };
  }

  // 检查余额限制
  if (keyInfo.balance_limit !== null && keyInfo.used_balance >= keyInfo.balance_limit) {
    return { success: false, error: '余额已用尽' };
  }

  // 计算本次消耗（固定720P）
  const userCost = USER_COST_PER_VIDEO['720P'];  // 用户价格 0.3
  const actualCost = ACTUAL_COST_PER_VIDEO['720P'];  // 实际成本 0.4

  // 获取所有可用账号并按余额排序
  const sortedAccounts = await getSortedAccounts();
  if (sortedAccounts.length === 0) {
    return { success: false, error: '没有可用账号' };
  }

  // 尝试每个账号，直到成功或全部失败
  let lastError = '';

  for (const account of sortedAccounts) {
    const result = await generateWithGrokVideo(account, options, { id: keyInfo.id, is_active: keyInfo.is_active });

    if (!result.success) {
      lastError = result.error || '未知错误';
      
      // 如果是余额不足或临时错误，继续尝试下一个账号
      if (isInsufficientBalanceError(lastError) || isTemporaryError(lastError)) {
        console.log(`账号 ${account.username} 出错 (${lastError})，尝试下一个账号...`);
        continue;
      }

      continue;
    }

    // 成功创建任务！预扣费用（等查询到完成再确认扣费）
    await userKeysDb.incrementUsage(keyInfo.id, userCost);

    // 异步更新账号余额
    getBalanceWithApiKey(account.base_url, account.api_key!)
      .then(async balanceResult => {
        if (balanceResult.success) {
          await accountsDb.update(account.id, { balance: balanceResult.balance });
        }
      })
      .catch(() => {});

    // 记录日志（使用实际成本）- 带重试逻辑
    try {
      await createLogWithRetry({
        user_key_id: keyInfo.id,
        account_id: account.id,
        prompt: options.prompt,
        model: GROK_VIDEO_MODEL,
        success: true,
        cost: actualCost  // 实际成本 0.4
      });
    } catch (logError) {
      // 日志记录失败不影响主流程
      console.error('记录视频日志失败:', logError);
    }

    return {
      success: true,
      taskId: result.taskId
    };
  }

  // 所有账号都失败了
  return { 
    success: false, 
    error: `所有账号都失败了。最后错误: ${lastError}` 
  };
}

// 查询视频状态
export async function queryVideoStatus(
  userKey: string,
  taskId: string
): Promise<VideoQueryResult> {
  // 验证用户 Key
  const keyInfo = await userKeysDb.getByKeyValue(userKey);
  if (!keyInfo) {
    return { success: false, error: '无效的 API Key' };
  }

  // 获取所有可用账号并按余额排序
  const sortedAccounts = await getSortedAccounts();
  if (sortedAccounts.length === 0) {
    return { success: false, error: '没有可用账号' };
  }

  // 尝试每个账号查询状态
  for (const account of sortedAccounts) {
    const result = await queryGrokVideoStatus(account, taskId);

    if (result.success) {
      return result;
    }

    // 如果是余额不足，继续尝试下一个账号
    if (isInsufficientBalanceError(result.error || '')) {
      continue;
    }
  }

  return { success: false, error: '查询失败' };
}

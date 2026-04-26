import { accountsDb, sitesDb } from './db';
import type { Account, PlatformLog } from './types';

// New-API 登录接口响应（支持两种格式）
interface LoginResponse {
  success: boolean;
  message: string;
  data?: {
    token?: string;  // 有些站点返回 token
    id?: number;     // 有些站点返回用户信息
    username?: string;
    display_name?: string;
  };
}

// New-API 用户信息响应（包含余额）
interface UserInfoResponse {
  success: boolean;
  message: string;
  data?: {
    id: number;
    username: string;
    quota: number;
    display_quota?: string;
    used_quota?: number;
    request_count?: number;
  };
}

// New-API Token 列表响应
interface TokenListResponse {
  success: boolean;
  message: string;
  data?: {
    items?: Array<{
      id: number;
      key: string;
      status: number;
      name: string;
      created_time: number;
      accessed_time: number;
      expired_time: number;
      remain_quota: number;
      unlimited_quota: boolean;
    }>;
  };
}

// New-API 日志列表响应
interface LogListResponse {
  success: boolean;
  message: string;
  data?: {
    items?: Array<{
      id: number;
      user_id: number;
      created_at: number;
      type: number;
      content: string;
      username: string;
      token_name: string;
      model_name?: string;
      quota: number;
      prompt_tokens?: number;
      completion_tokens?: number;
      use_time?: number;
      channel?: string;
      channel_id?: number;
      is_stream?: boolean;
    }>;
    total_count?: number;
  };
}

// 登录并获取 token/session
export async function loginToSite(baseUrl: string, username: string, password: string): Promise<{
  success: boolean;
  token?: string;
  session?: string;
  userId?: number;
  error?: string;
}> {
  try {
    const cleanUrl = baseUrl.replace(/\/$/, '');
    
    const response = await fetch(`${cleanUrl}/api/user/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      body: JSON.stringify({ username, password }),
    });

    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      return { success: false, error: `服务器返回了 ${contentType} 而不是 JSON` };
    }

    const data: LoginResponse = await response.json();

    if (!data.success) {
      return { 
        success: false, 
        error: data.message || '登录失败' 
      };
    }

    // 方式1: 返回 token
    if (data.data?.token) {
      return { 
        success: true, 
        token: data.data.token 
      };
    }

    // 方式2: 需要从 Set-Cookie 获取 session
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      const sessionMatch = setCookie.match(/session=([^;]+)/);
      if (sessionMatch) {
        return { 
          success: true, 
          session: sessionMatch[1],
          userId: data.data?.id 
        };
      }
    }

    // 如果有用户 ID，尝试用其他方式获取信息
    if (data.data?.id) {
      return { 
        success: true, 
        userId: data.data.id 
      };
    }

    return { success: true };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '网络请求失败' 
    };
  }
}

// 获取用户信息（包含余额）- 使用 token
export async function getUserInfo(baseUrl: string, token: string): Promise<{
  success: boolean;
  quota?: number;
  error?: string;
}> {
  try {
    const response = await fetch(`${baseUrl}/api/user/self`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const data: UserInfoResponse = await response.json();

    if (!data.success) {
      return { success: false, error: data.message || '获取用户信息失败' };
    }

    // quota 是配额，需要转换为余额（500000 = 1元）
    const balance = data.data?.quota ? data.data.quota / 500000 : 0;
    return { success: true, quota: balance };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '网络请求失败' 
    };
  }
}

// 获取用户信息（包含余额）- 使用 session
export async function getUserInfoWithSession(baseUrl: string, session: string, userId: number): Promise<{
  success: boolean;
  quota?: number;
  error?: string;
}> {
  try {
    const response = await fetch(`${baseUrl}/api/user/self`, {
      method: 'GET',
      headers: {
        'Cookie': `session=${session}`,
        'New-Api-User': userId.toString(),
      },
    });

    const data: UserInfoResponse = await response.json();

    if (!data.success) {
      return { success: false, error: data.message || '获取用户信息失败' };
    }

    // quota 是配额，需要转换为余额（500000 = 1元）
    const balance = data.data?.quota ? data.data.quota / 500000 : 0;
    return { success: true, quota: balance };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '网络请求失败' 
    };
  }
}

// 获取 Token 列表
export async function getTokens(baseUrl: string, token: string): Promise<{
  success: boolean;
  tokens?: Array<{ id: number; key: string; name: string }>;
  error?: string;
}> {
  try {
    const cleanUrl = baseUrl.replace(/\/$/, '');
    const response = await fetch(`${cleanUrl}/api/token/?p=0&size=10`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });

    const data: TokenListResponse = await response.json();

    if (!data.success) {
      return { success: false, error: data.message || '获取 Token 列表失败' };
    }

    return { 
      success: true, 
      tokens: data.data?.items?.map(item => {
        let key = item.key;
        if (!key.startsWith('sk-')) {
          key = `sk-${key}`;
        }
        return {
          id: item.id,
          key: key,
          name: item.name
        };
      }) || []
    };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '网络请求失败' 
    };
  }
}

// 创建 Token
export async function createToken(baseUrl: string, token: string): Promise<{
  success: boolean;
  key?: string;
  error?: string;
}> {
  try {
    const cleanUrl = baseUrl.replace(/\/$/, '');
    const response = await fetch(`${cleanUrl}/api/token/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'auto-generated',
        remain_quota: 500000000, // 大配额
        unlimited_quota: true,
      }),
    });

    const data = await response.json();

    if (!data.success) {
      return { success: false, error: data.message || '创建 Token 失败' };
    }

    let key = data.data?.key;
    if (key && !key.startsWith('sk-')) {
      key = `sk-${key}`;
    }
    return { success: true, key };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '网络请求失败' 
    };
  }
}

// 获取或创建 API Key
export async function getOrCreateApiKey(baseUrl: string, token: string): Promise<{
  success: boolean;
  apiKey?: string;
  error?: string;
}> {
  // 先尝试获取现有 Token
  const tokensResult = await getTokens(baseUrl, token);
  
  if (tokensResult.success && tokensResult.tokens && tokensResult.tokens.length > 0) {
    return { success: true, apiKey: tokensResult.tokens[0].key };
  }

  // 没有则创建新的
  const createResult = await createToken(baseUrl, token);
  if (createResult.success) {
    return { success: true, apiKey: createResult.key };
  }

  return { success: false, error: createResult.error };
}

// 使用 session 获取 API Key
export async function getApiKeyWithSession(baseUrl: string, session: string, userId: number): Promise<{
  success: boolean;
  apiKey?: string;
  error?: string;
}> {
  try {
    const cleanUrl = baseUrl.replace(/\/$/, '');
    
    // 先获取现有 Token
    const response = await fetch(`${cleanUrl}/api/token/?p=0&size=10`, {
      method: 'GET',
      headers: {
        'Cookie': `session=${session}`,
        'New-Api-User': userId.toString(),
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    const data: TokenListResponse = await response.json();

    if (data.success && data.data?.items && data.data.items.length > 0) {
      let key = data.data.items[0].key;
      // 确保 API Key 有 sk- 前缀
      if (!key.startsWith('sk-')) {
        key = `sk-${key}`;
      }
      return { success: true, apiKey: key };
    }

    // 创建新 Token
    const createResponse = await fetch(`${cleanUrl}/api/token/`, {
      method: 'POST',
      headers: {
        'Cookie': `session=${session}`,
        'New-Api-User': userId.toString(),
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      body: JSON.stringify({
        name: 'auto-generated',
        remain_quota: 500000000,
        unlimited_quota: true,
      }),
    });

    const createData = await createResponse.json();

    if (createData.success) {
      let key = createData.data?.key;
      if (key && !key.startsWith('sk-')) {
        key = `sk-${key}`;
      }
      return { success: true, apiKey: key };
    }

    return { success: false, error: createData.message || '创建 Token 失败' };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '网络请求失败' 
    };
  }
}

// 使用 API Key 获取余额（支持多种 API 格式）
export async function getBalanceWithApiKey(baseUrl: string, apiKey: string): Promise<{
  success: boolean;
  balance?: number;
  error?: string;
}> {
  // 尝试多种端点
  const endpoints = [
    // New-API 格式
    { url: `${baseUrl}/api/user/self`, parse: (data: any) => data.data?.quota ? data.data.quota / 500000 : 0 },
    // 兼容旧格式
    { url: `${baseUrl}/api/user/info`, parse: (data: any) => data.data?.quota ? data.data.quota / 500000 : 0 },
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint.url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      const data = await response.json();

      if (data.success && data.data) {
        const balance = endpoint.parse(data);
        return { success: true, balance };
      }
      
      // 如果是 access token 无效错误，尝试其他端点
      if (data.message?.includes('access token') || data.message?.includes('无效')) {
        continue;
      }
    } catch {
      continue;
    }
  }

  return { success: false, error: '该站点不支持通过 API Key 查询余额' };
}

// 使用 session 获取余额
export async function getBalanceWithSession(baseUrl: string, session: string, userId: number): Promise<{
  success: boolean;
  balance?: number;
  error?: string;
}> {
  try {
    const cleanUrl = baseUrl.replace(/\/$/, '');
    
    const response = await fetch(`${cleanUrl}/api/user/self`, {
      method: 'GET',
      headers: {
        'Cookie': `session=${session}`,
        'New-Api-User': userId.toString(),
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    const data: UserInfoResponse = await response.json();

    if (!data.success) {
      return { success: false, error: data.message || '获取余额失败' };
    }

    // quota 是配额，需要转换为余额（500000 = 1元）
    const balance = data.data?.quota ? data.data.quota / 500000 : 0;
    return { success: true, balance };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '网络请求失败' 
    };
  }
}

// 刷新单个账号的余额
export async function refreshAccountBalance(accountId: number): Promise<{
  success: boolean;
  balance?: number;
  error?: string;
}> {
  const account = await accountsDb.getById(accountId);
  if (!account) {
    return { success: false, error: '账号不存在' };
  }

  const site = await sitesDb.getById(account.site_id);
  if (!site) {
    return { success: false, error: '站点不存在' };
  }

  // 如果已有 API Key，直接用它查余额
  if (account.api_key) {
    const result = await getBalanceWithApiKey(site.base_url, account.api_key);
    if (result.success) {
      await accountsDb.update(accountId, { balance: result.balance! });
      return result;
    }
  }

  // 登录获取认证信息
  const loginResult = await loginToSite(site.base_url, account.username, account.password);
  if (!loginResult.success) {
    await accountsDb.update(accountId, { last_error: loginResult.error || null });
    return { success: false, error: loginResult.error };
  }

  let apiKey: string | undefined;
  let balance: number | undefined;

  // 方式1: 使用 token 认证
  if (loginResult.token) {
    const apiKeyResult = await getOrCreateApiKey(site.base_url, loginResult.token);
    if (apiKeyResult.success && apiKeyResult.apiKey) {
      apiKey = apiKeyResult.apiKey;
      const balanceResult = await getBalanceWithApiKey(site.base_url, apiKey);
      if (balanceResult.success) {
        balance = balanceResult.balance;
      }
    }
  }

  // 方式2: 使用 session cookie 认证
  if (loginResult.session && loginResult.userId) {
    // 获取 API Key
    const apiKeyResult = await getApiKeyWithSession(site.base_url, loginResult.session, loginResult.userId);
    if (apiKeyResult.success && apiKeyResult.apiKey) {
      apiKey = apiKeyResult.apiKey;
    }
    
    const balanceResult = await getBalanceWithSession(site.base_url, loginResult.session, loginResult.userId);
    if (balanceResult.success) {
      balance = balanceResult.balance;
    }
  }

  if (balance === undefined) {
    await accountsDb.update(accountId, { last_error: '获取余额失败' });
    return { success: false, error: '获取余额失败' };
  }

  // 更新账号信息
  await accountsDb.update(accountId, { 
    balance,
    token: loginResult.token || loginResult.session,
    api_key: apiKey ?? undefined,
    last_error: null
  });

  return { success: true, balance };
}

// 刷新所有账号余额
export async function refreshAllBalances(): Promise<{
  total: number;
  success: number;
  failed: number;
  errors: Array<{ accountId: number; error: string }>;
}> {
  const accounts = await accountsDb.getAvailableAccounts();
  const errors: Array<{ accountId: number; error: string }> = [];
  let successCount = 0;
  let failedCount = 0;

  const concurrencyLimit = 5;
  const chunks: Account[][] = [];
  
  for (let i = 0; i < accounts.length; i += concurrencyLimit) {
    chunks.push(accounts.slice(i, i + concurrencyLimit));
  }

  for (const chunk of chunks) {
    const results = await Promise.all(
      chunk.map(async (account) => {
        const result = await refreshAccountBalance(account.id);
        return { accountId: account.id, ...result };
      })
    );

    for (const result of results) {
      if (result.success) {
        successCount++;
      } else {
        failedCount++;
        errors.push({ accountId: result.accountId, error: result.error || '未知错误' });
      }
    }
  }

  return {
    total: accounts.length,
    success: successCount,
    failed: failedCount,
    errors
  };
}

// 从单个账号获取使用日志
export async function fetchAccountLogs(
  baseUrl: string, 
  auth: string, // token 或 api_key
  limit: number = 50,
  authType: 'token' | 'session' = 'token',
  userId?: number
): Promise<{
  success: boolean;
  logs?: PlatformLog[];
  error?: string;
}> {
  try {
    const headers: Record<string, string> = {};
    
    if (authType === 'session' && userId) {
      headers['Cookie'] = `session=${auth}`;
      headers['New-Api-User'] = userId.toString();
    } else {
      headers['Authorization'] = `Bearer ${auth}`;
    }
    
    const response = await fetch(`${baseUrl}/api/log/?p=0&size=${limit}&order=desc`, {
      method: 'GET',
      headers,
    });

    const data: LogListResponse = await response.json();

    if (!data.success) {
      return { success: false, error: data.message || '获取日志失败' };
    }

    if (!data.data?.items) {
      return { success: true, logs: [] };
    }

    const logs: PlatformLog[] = data.data.items.map(item => ({
      id: item.id,
      site_id: 0, // 会在外层填充
      site_name: '', // 会在外层填充
      account_id: 0, // 会在外层填充
      account_username: item.username || '',
      type: item.type,
      content: item.content || '',
      model: item.model_name || null,
      prompt_tokens: item.prompt_tokens || 0,
      completion_tokens: item.completion_tokens || 0,
      quota: item.quota || 0,
      cost: item.quota ? item.quota / 500000 : 0, // 转换为元
      created_at: item.created_at,
    }));

    return { success: true, logs };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '网络请求失败' 
    };
  }
}

// 从所有账号获取日志
export async function fetchAllPlatformLogs(limit: number = 50): Promise<PlatformLog[]> {
  const accounts = await accountsDb.getAvailableAccounts();
  const allLogs: PlatformLog[] = [];

  const concurrencyLimit = 5;
  const chunks: Account[][] = [];
  
  for (let i = 0; i < accounts.length; i += concurrencyLimit) {
    chunks.push(accounts.slice(i, i + concurrencyLimit));
  }

  for (const chunk of chunks) {
    const results = await Promise.all(
      chunk.map(async (account) => {
        const site = await sitesDb.getById(account.site_id);
        if (!site || !account.token) return null;

        // 尝试使用 token 或 api_key 获取日志
        const auth = account.api_key || account.token;
        const authType = account.api_key ? 'token' : 'session';
        
        const result = await fetchAccountLogs(
          site.base_url, 
          auth, 
          limit, 
          authType,
          account.remote_user_id || undefined
        );

        if (!result.success || !result.logs) return null;

        // 填充站点和账号信息
        return result.logs.map(log => ({
          ...log,
          site_id: site.id,
          site_name: site.name,
          account_id: account.id,
          account_username: account.username
        }));
      })
    );

    for (const logs of results) {
      if (logs) {
        allLogs.push(...logs);
      }
    }
  }

  // 按时间排序，取最新的
  allLogs.sort((a, b) => b.created_at - a.created_at);
  return allLogs.slice(0, limit);
}

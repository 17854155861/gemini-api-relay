import { getSupabaseClient } from '@/storage/database/supabase-client';
import type { Site, Account, UserKey, CallLog, OverviewStats, UserKeyBalance } from './types';

// 获取 Supabase 客户端
const getClient = () => getSupabaseClient();

/**
 * 初始化数据库（Supabase 自动初始化，此函数保留用于兼容）
 */
export async function initDatabase(): Promise<void> {
  // Supabase 自动初始化，无需手动操作
  console.log('[DB] Using Supabase cloud database');
}

/**
 * 触发数据库同步（Supabase 自动同步，此函数保留用于兼容）
 */
export function triggerSync(): void {
  // Supabase 自动同步，无需手动操作
}

// ============ 工具函数 ============

// 验证管理员密码
export function verifyAdminPassword(password: string): boolean {
  const ADMIN_PASSWORD = '2032097';
  return password === ADMIN_PASSWORD;
}

// ============ 站点操作 ============

export const sitesDb = {
  async getAll(): Promise<Site[]> {
    const client = getClient();
    const { data, error } = await client
      .from('sites')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw new Error(`查询站点失败: ${error.message}`);
    return (data || []) as Site[];
  },

  async getById(id: number): Promise<Site | null> {
    const client = getClient();
    const { data, error } = await client
      .from('sites')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(`查询站点失败: ${error.message}`);
    return data as Site | null;
  },

  async create(site: { name: string; base_url: string; description?: string | null; is_active?: boolean }): Promise<Site> {
    const client = getClient();
    const { data, error } = await client
      .from('sites')
      .insert({
        name: site.name,
        base_url: site.base_url,
        description: site.description || null,
        is_active: site.is_active ?? true
      })
      .select()
      .single();
    if (error) throw new Error(`创建站点失败: ${error.message}`);
    return data as Site;
  },

  async bulkCreate(sites: Array<{ name: string; base_url: string; description?: string | null; is_active?: boolean }>): Promise<Site[]> {
    const client = getClient();
    const { data, error } = await client
      .from('sites')
      .insert(sites.map(s => ({
        name: s.name,
        base_url: s.base_url,
        description: s.description || null,
        is_active: s.is_active ?? true
      })))
      .select();
    if (error) throw new Error(`批量创建站点失败: ${error.message}`);
    return (data || []) as Site[];
  },

  async update(id: number, site: Partial<Omit<Site, 'id' | 'created_at' | 'updated_at'>>): Promise<Site | null> {
    const client = getClient();
    const updateData: Record<string, unknown> = { ...site };
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await client
      .from('sites')
      .update(updateData)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw new Error(`更新站点失败: ${error.message}`);
    return data as Site | null;
  },

  async delete(id: number): Promise<boolean> {
    const client = getClient();
    // 先删除关联的 call_logs
    const { data: accounts } = await client
      .from('accounts')
      .select('id')
      .eq('site_id', id);
    
    if (accounts && accounts.length > 0) {
      const accountIds = accounts.map(a => a.id);
      if (accountIds.length > 0) {
        await client
          .from('call_logs')
          .delete()
          .in('account_id', accountIds);
      }
    }
    
    // 再删除关联的 accounts
    await client
      .from('accounts')
      .delete()
      .eq('site_id', id);
    
    // 最后删除站点
    const { error } = await client
      .from('sites')
      .delete()
      .eq('id', id);
    
    return !error;
  }
};

// ============ 账号操作 ============

export const accountsDb = {
  async getAll(): Promise<Account[]> {
    const client = getClient();
    const { data, error } = await client
      .from('accounts')
      .select(`
        *,
        sites (name, base_url)
      `)
      .order('id');
    if (error) throw new Error(`查询账号失败: ${error.message}`);
    return (data || []).map((row: Record<string, unknown>) => ({
      ...row,
      site_name: (row.sites as Record<string, unknown>)?.name,
      base_url: (row.sites as Record<string, unknown>)?.base_url
    })) as Account[];
  },

  async getById(id: number): Promise<Account | null> {
    const client = getClient();
    const { data, error } = await client
      .from('accounts')
      .select(`
        *,
        sites (name, base_url)
      `)
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(`查询账号失败: ${error.message}`);
    if (!data) return null;
    return {
      ...data,
      site_name: (data.sites as Record<string, unknown>)?.name,
      base_url: (data.sites as Record<string, unknown>)?.base_url
    } as Account;
  },

  async getBySiteId(siteId: number): Promise<Account[]> {
    const client = getClient();
    const { data, error } = await client
      .from('accounts')
      .select('*')
      .eq('site_id', siteId)
      .order('id');
    if (error) throw new Error(`查询账号失败: ${error.message}`);
    return (data || []) as Account[];
  },

  async getAvailableAccounts(): Promise<Account[]> {
    const client = getClient();
    const { data, error } = await client
      .from('accounts')
      .select(`
        *,
        sites (name, base_url)
      `)
      .eq('is_active', true)
      .order('balance', { ascending: false });
    if (error) throw new Error(`查询可用账号失败: ${error.message}`);
    return (data || []).map((row: Record<string, unknown>) => ({
      ...row,
      site_name: (row.sites as Record<string, unknown>)?.name as string || '',
      base_url: (row.sites as Record<string, unknown>)?.base_url as string || ''
    })) as Account[];
  },

  async getAccountsWithSite(): Promise<Account[]> {
    const client = getClient();
    const { data, error } = await client
      .from('accounts')
      .select(`
        *,
        sites (name, base_url)
      `)
      .eq('is_active', true)
      .order('balance', { ascending: false });
    if (error) throw new Error(`查询账号失败: ${error.message}`);
    return (data || []).map((row: Record<string, unknown>) => ({
      ...row,
      site_name: (row.sites as Record<string, unknown>)?.name as string || '',
      base_url: (row.sites as Record<string, unknown>)?.base_url as string || ''
    })) as Account[];
  },

  async create(account: { site_id: number; username: string; password: string; api_key?: string | null; token?: string | null; session?: string | null; remote_user_id?: number | null; balance?: number; is_active?: boolean }): Promise<Account> {
    const client = getClient();
    const { data, error } = await client
      .from('accounts')
      .insert({
        site_id: account.site_id,
        username: account.username,
        password: account.password,
        api_key: account.api_key || null,
        token: account.token || null,
        session: account.session || null,
        remote_user_id: account.remote_user_id || null,
        balance: account.balance ?? 0,
        is_active: account.is_active ?? true,
        last_error: null
      })
      .select()
      .single();
    if (error) throw new Error(`创建账号失败: ${error.message}`);
    return data as Account;
  },

  async bulkCreate(accounts: Array<{ site_id: number; username: string; password: string; api_key?: string | null; token?: string | null; session?: string | null; remote_user_id?: number | null; balance?: number; is_active?: boolean }>): Promise<Account[]> {
    const client = getClient();
    const { data, error } = await client
      .from('accounts')
      .insert(accounts.map(a => ({
        site_id: a.site_id,
        username: a.username,
        password: a.password,
        api_key: a.api_key || null,
        token: a.token || null,
        session: a.session || null,
        remote_user_id: a.remote_user_id || null,
        balance: a.balance ?? 0,
        is_active: a.is_active ?? true,
        last_error: null
      })))
      .select();
    if (error) throw new Error(`批量创建账号失败: ${error.message}`);
    return (data || []) as Account[];
  },

  async update(id: number, account: Partial<Omit<Account, 'id' | 'created_at' | 'updated_at'>>): Promise<Account | null> {
    const client = getClient();
    const updateData: Record<string, unknown> = { ...account };
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await client
      .from('accounts')
      .update(updateData)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw new Error(`更新账号失败: ${error.message}`);
    return data as Account | null;
  },

  async delete(id: number): Promise<boolean> {
    const client = getClient();
    // 先删除关联的 call_logs
    await client
      .from('call_logs')
      .delete()
      .eq('account_id', id);
    
    const { error } = await client
      .from('accounts')
      .delete()
      .eq('id', id);
    return !error;
  },

  async incrementUsage(id: number): Promise<void> {
    // Supabase 没有 increment，需要手动更新
    const client = getClient();
    const { data } = await client
      .from('accounts')
      .select('balance')
      .eq('id', id)
      .single();
    
    if (data) {
      await client
        .from('accounts')
        .update({ 
          balance: (data.balance as number) - 0.01,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);
    }
  }
};

// ============ 用户 Key 操作 ============

export const userKeysDb = {
  async getAll(): Promise<UserKey[]> {
    const client = getClient();
    const { data, error } = await client
      .from('user_keys')
      .select('*')
      .order('id');
    if (error) throw new Error(`查询用户Key失败: ${error.message}`);
    return (data || []) as UserKey[];
  },

  async getById(id: number): Promise<UserKey | null> {
    const client = getClient();
    const { data, error } = await client
      .from('user_keys')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(`查询用户Key失败: ${error.message}`);
    return data as UserKey | null;
  },

  async getByKeyValue(keyValue: string): Promise<UserKey | null> {
    const client = getClient();
    const { data, error } = await client
      .from('user_keys')
      .select('*')
      .eq('key_value', keyValue)
      .maybeSingle();
    if (error) throw new Error(`查询用户Key失败: ${error.message}`);
    return data as UserKey | null;
  },

  async getBalanceInfo(keyValue: string): Promise<UserKeyBalance | null> {
    const client = getClient();
    const { data, error } = await client
      .from('user_keys')
      .select('*')
      .eq('key_value', keyValue)
      .maybeSingle();
    if (error) throw new Error(`查询用户Key失败: ${error.message}`);
    if (!data) return null;
    
    const key = data as UserKey;
    return {
      key_value: key.key_value,
      name: key.name,
      is_active: key.is_active,
      balance_limit: key.balance_limit,
      used_balance: key.used_balance,
      remaining_balance: key.balance_limit ? key.balance_limit - key.used_balance : null,
      usage_count: key.usage_count
    };
  },

  async create(key: { key_value: string; name?: string | null; is_active?: boolean; balance_limit?: number | null }): Promise<UserKey> {
    const client = getClient();
    const { data, error } = await client
      .from('user_keys')
      .insert({
        key_value: key.key_value,
        name: key.name || null,
        is_active: key.is_active ?? true,
        usage_count: 0,
        balance_limit: key.balance_limit || null,
        used_balance: 0
      })
      .select()
      .single();
    if (error) throw new Error(`创建用户Key失败: ${error.message}`);
    return data as UserKey;
  },

  async update(id: number, key: Partial<Omit<UserKey, 'id' | 'created_at'>>): Promise<UserKey | null> {
    const client = getClient();
    const { data, error } = await client
      .from('user_keys')
      .update(key)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw new Error(`更新用户Key失败: ${error.message}`);
    return data as UserKey | null;
  },

  async delete(id: number): Promise<boolean> {
    const client = getClient();
    const { error } = await client
      .from('user_keys')
      .delete()
      .eq('id', id);
    return !error;
  },

  async incrementUsage(id: number, cost: number = 0): Promise<void> {
    const client = getClient();
    const { data } = await client
      .from('user_keys')
      .select('usage_count, used_balance')
      .eq('id', id)
      .single();
    
    if (data) {
      await client
        .from('user_keys')
        .update({ 
          usage_count: (data.usage_count as number) + 1,
          used_balance: (data.used_balance as number) + cost
        })
        .eq('id', id);
    }
  },

  async validateKey(keyValue: string): Promise<UserKey | null> {
    const client = getClient();
    const { data, error } = await client
      .from('user_keys')
      .select('*')
      .eq('key_value', keyValue)
      .eq('is_active', true)
      .maybeSingle();
    if (error) throw new Error(`验证用户Key失败: ${error.message}`);
    return data as UserKey | null;
  },

  async checkBalanceLimit(keyValue: string): Promise<boolean> {
    const client = getClient();
    const { data, error } = await client
      .from('user_keys')
      .select('balance_limit, used_balance')
      .eq('key_value', keyValue)
      .maybeSingle();
    if (error || !data) return false;
    
    const key = data as { balance_limit: number | null; used_balance: number };
    // 如果没有设置余额限制，则认为有余额
    if (key.balance_limit === null) return true;
    return key.used_balance < key.balance_limit;
  }
};

// ============ 调用日志操作 ============

export const callLogsDb = {
  async getAll(limit: number = 100): Promise<CallLog[]> {
    const client = getClient();
    const { data, error } = await client
      .from('call_logs')
      .select(`
        *,
        user_keys (name, key_value),
        accounts (username, sites (name))
      `)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(`查询日志失败: ${error.message}`);
    return (data || []).map((row: Record<string, unknown>) => ({
      ...row,
      key_name: (row.user_keys as Record<string, unknown>)?.name,
      key_value: (row.user_keys as Record<string, unknown>)?.key_value,
      account_username: (row.accounts as Record<string, unknown>)?.username,
      site_name: ((row.accounts as Record<string, unknown>)?.sites as Record<string, unknown>)?.name
    })) as CallLog[];
  },

  async getRecent(limit: number = 20): Promise<CallLog[]> {
    return this.getAll(limit);
  },

  async getByUserKeyId(userKeyId: number, limit: number = 20): Promise<CallLog[]> {
    const client = getClient();
    const { data, error } = await client
      .from('call_logs')
      .select('*')
      .eq('user_key_id', userKeyId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(`查询用户日志失败: ${error.message}`);
    return (data || []) as CallLog[];
  },

  async create(log: { user_key_id?: number | null; account_id?: number | null; prompt: string; model?: string; success: boolean; error_message?: string | null; cost: number }): Promise<CallLog> {
    const client = getClient();
    const { data, error } = await client
      .from('call_logs')
      .insert({
        user_key_id: log.user_key_id || null,
        account_id: log.account_id || null,
        prompt: log.prompt,
        model: log.model || null,
        success: log.success,
        error_message: log.error_message || null,
        cost: log.cost
      })
      .select()
      .single();
    if (error) throw new Error(`创建日志失败: ${error.message}`);
    return data as CallLog;
  },

  async getStats(): Promise<{ total: number; success: number; today: number }> {
    const client = getClient();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const { count: total } = await client
      .from('call_logs')
      .select('*', { count: 'exact', head: true });
    
    const { count: success } = await client
      .from('call_logs')
      .select('*', { count: 'exact', head: true })
      .eq('success', true);
    
    const { count: todayCount } = await client
      .from('call_logs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString());
    
    return {
      total: total || 0,
      success: success || 0,
      today: todayCount || 0
    };
  }
};

// ============ 统计操作 ============

export const statsDb = {
  async getOverview(): Promise<OverviewStats> {
    const client = getClient();
    
    // 活跃站点数
    const { count: activeSites } = await client
      .from('sites')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);
    
    // 活跃账号数
    const { count: activeAccounts } = await client
      .from('accounts')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);
    
    // 有 API Key 的账号数
    const { data: accountsWithKey } = await client
      .from('accounts')
      .select('id')
      .not('api_key', 'is', null);
    
    // 总余额
    const { data: balanceData } = await client
      .from('accounts')
      .select('balance');
    
    const totalBalance = (balanceData || []).reduce((sum: number, a) => sum + (a.balance as number || 0), 0);
    
    // 调用统计
    const logStats = await callLogsDb.getStats();
    
    return {
      activeSites: activeSites || 0,
      activeAccounts: activeAccounts || 0,
      accountsWithKey: (accountsWithKey || []).length,
      totalBalance,
      ...logStats
    };
  }
};

// ============ 设置操作 ============

export const settingsDb = {
  async get(key: string): Promise<string | null> {
    const client = getClient();
    const { data, error } = await client
      .from('settings')
      .select('value')
      .eq('key', key)
      .maybeSingle();
    if (error) throw new Error(`获取设置失败: ${error.message}`);
    return data?.value || null;
  },

  async set(key: string, value: string): Promise<void> {
    const client = getClient();
    const { error } = await client
      .from('settings')
      .upsert({ key, value }, { onConflict: 'key' });
    if (error) throw new Error(`保存设置失败: ${error.message}`);
  }
};

// logsDb 是 callLogsDb 的别名，保持向后兼容
export const logsDb = callLogsDb;

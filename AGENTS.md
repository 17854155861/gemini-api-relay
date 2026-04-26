# 项目上下文

## 项目简介

Gemini API 中转站聚合管理系统，支持：
- 管理 100 个同源 API 中转站
- 智能调度：按余额从大到小选择最优账号
- 批量添加账号、自动登录获取 API Key
- 用户 API Key 管理，支持余额限制
- 前端调用界面：输入提示词生成图片，查询余额

### 版本技术栈

- **Framework**: Next.js 16 (App Router)
- **Core**: React 19
- **Language**: TypeScript 5
- **UI 组件**: shadcn/ui (基于 Radix UI)
- **Styling**: Tailwind CSS 4
- **Database**: Supabase (PostgreSQL) - 云端数据库，数据永久存储

## 目录结构

```
├── public/                  # 静态资源
├── scripts/                 # 构建与启动脚本
├── src/
│   ├── app/                 # 页面路由与布局
│   │   ├── admin/           # 管理后台页面
│   │   │   └── page.tsx     # 管理后台主页
│   │   ├── api/             # API 路由
│   │   │   ├── admin/       # 管理接口
│   │   │   │   ├── auth/    # 登录认证
│   │   │   │   ├── sites/   # 站点管理
│   │   │   │   ├── accounts/# 账号管理
│   │   │   │   ├── user-keys/# 用户 Key 管理
│   │   │   │   ├── stats/   # 统计信息
│   │   │   │   ├── logs/    # 调用日志
│   │   │   │   └── cron/    # 定时任务
│   │   │   └── generate/    # 图片生成接口
│   │   ├── layout.tsx       # 根布局
│   │   ├── page.tsx         # 首页（用户调用界面）
│   │   └── globals.css      # 全局样式
│   ├── components/
│   │   ├── admin/           # 管理后台组件
│   │   │   ├── LoginForm.tsx
│   │   │   ├── SitesManager.tsx
│   │   │   ├── AccountsManager.tsx
│   │   │   ├── UserKeysManager.tsx
│   │   │   ├── RecentLogs.tsx
│   │   │   ├── DashboardStats.tsx
│   │   │   └── Stats.tsx
│   │   └── ui/              # Shadcn UI 组件库
│   ├── hooks/               # 自定义 Hooks
│   ├── lib/                 # 工具库
│   │   ├── utils.ts         # 通用工具函数
│   │   ├── types.ts         # 类型定义
│   │   ├── db.ts            # 数据库操作 (Supabase)
│   │   ├── new-api.ts       # New-API 接口封装
│   │   └── scheduler.ts     # 智能调度器
│   └── storage/             # Supabase 存储
│       └── database/        # 数据库配置
│           ├── supabase-client.ts  # Supabase 客户端
│           └── shared/schema.ts    # 表结构定义
├── next.config.ts           # Next.js 配置
├── package.json             # 项目依赖管理
└── tsconfig.json            # TypeScript 配置
```

## 数据库结构

**数据库类型**: Supabase (PostgreSQL)

**数据持久化**: 数据存储在云端 Supabase 数据库，永久保存，不会丢失。

### sites 表（站点）
- id: 主键
- name: 站点名称
- base_url: 站点 URL
- description: 描述
- is_active: 是否启用
- created_at: 创建时间
- updated_at: 更新时间

### accounts 表（账号）
- id: 主键
- site_id: 关联站点
- username: 用户名
- password: 密码
- api_key: API Key
- token: 登录 Token
- balance: 余额
- is_active: 是否启用
- session: 会话信息
- remote_user_id: 远程用户ID
- last_error: 最后错误信息
- created_at: 创建时间
- updated_at: 更新时间

### user_keys 表（用户 API Key）
- id: 主键
- key_value: Key 值
- name: 名称
- is_active: 是否启用
- usage_count: 使用次数
- balance_limit: 余额限制
- used_balance: 已使用余额
- created_at: 创建时间

### call_logs 表（调用日志）
- id: 主键
- user_key_id: 关联用户 Key
- account_id: 关联账号
- prompt: 提示词
- success: 是否成功
- error_message: 错误信息
- cost: 消耗金额
- created_at: 创建时间

## API 接口

### 管理接口（需要认证）
- POST /api/admin/auth - 管理员登录
- GET/POST/PUT/DELETE /api/admin/sites - 站点管理
- GET/POST/PUT/DELETE/PATCH /api/admin/accounts - 账号管理
- GET/POST/PUT/DELETE /api/admin/user-keys - 用户 Key 管理（支持余额限制）
- GET /api/admin/stats - 统计信息
- GET /api/admin/logs - 调用日志
- POST /api/admin/cron - 定时刷新余额

### 用户接口
- POST /api/generate - 生成图片（不返回站点信息）
- GET /api/generate - 获取系统状态或查询余额（?apiKey=xxx）

## 包管理规范

**仅允许使用 pnpm** 作为包管理器，**严禁使用 npm 或 yarn**。

## 开发规范

### 编码规范
- 默认按 TypeScript `strict` 心智写代码
- 禁止隐式 `any` 和 `as any`
- 函数参数、返回值应有明确类型

### Hydration 问题防范
- 严禁在 JSX 渲染逻辑中直接使用 typeof window、Date.now()、Math.random() 等动态数据
- 必须使用 'use client' 并配合 useEffect + useState 确保动态内容仅在客户端挂载后渲染

## UI 设计与组件规范
- 项目预装核心组件库 `shadcn/ui`，位于 `src/components/ui/` 目录下
- 默认采用 shadcn/ui 组件、风格和规范

## 管理员密码
管理后台密码：`2032097`

# Supabase配置指南

## 1. 创建Supabase项目

1. 访问 https://supabase.com
2. 注册/登录账号
3. 创建新项目（免费套餐足够）
4. 记录项目URL和API Key（anon/public key）

## 2. 创建数据表

在Supabase SQL编辑器中执行以下SQL：

```sql
-- 壁纸表（注意：用 description 而不是 desc，desc是SQL保留关键字）
CREATE TABLE wallpapers (
    id SERIAL PRIMARY KEY,
    url TEXT NOT NULL,
    text TEXT NOT NULL,
    description TEXT DEFAULT '高清精美壁纸',
    downloads INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 统计表
CREATE TABLE stats (
    id INTEGER PRIMARY KEY DEFAULT 1,
    views INTEGER DEFAULT 0,
    downloads INTEGER DEFAULT 0
);

-- 插入初始统计数据
INSERT INTO stats (id, views, downloads) VALUES (1, 0, 0);

-- 启用RLS（行级安全）
ALTER TABLE wallpapers ENABLE ROW LEVEL SECURITY;
ALTER TABLE stats ENABLE ROW LEVEL SECURITY;

-- wallpapers表的RLS策略（允许匿名所有操作）
CREATE POLICY "Allow all wallpapers" ON wallpapers FOR ALL USING (true) WITH CHECK (true);

-- stats表的RLS策略（允许匿名所有操作）
CREATE POLICY "Allow all stats" ON stats FOR ALL USING (true) WITH CHECK (true);
```

## 3. Vercel环境变量配置

在Vercel项目设置 → Environment Variables 中添加：

| 变量名 | 值 | 说明 |
|:---|:---|:---|
| `SUPABASE_URL` | `https://your-project.supabase.co` | Supabase项目URL |
| `SUPABASE_KEY` | `eyJ...` | Supabase anon/public key（不是service_role key） |
| `ADMIN_PASSWORD` | `lanxi123` | 后台管理密码 |

**获取SUPABASE_KEY**：Supabase Dashboard → Project Settings → API → `anon public`

## 4. 部署到Vercel

1. 将代码推送到GitHub
2. 在Vercel导入项目
3. 配置环境变量
4. 部署

## 常见问题排查

**上传后数据清空、壁纸没保存？**

1. 检查Vercel部署日志（Deployments → 点击最新部署 → Functions → 查看日志）
2. 检查Supabase RLS策略是否正确配置
3. 浏览器F12 → Network 查看 `/api/wallpapers` 请求的响应

## 链接结构

| 页面 | 链接 | 说明 |
|:---|:---|:---|
| 浏览页面 | `https://你的域名/` | 公开访问，给用户看的 |
| 后台管理 | `https://你的域名/admin` | 需要密码 |

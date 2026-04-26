# Netlify部署指南

## 1. 创建Netlify项目

1. 访问 https://netlify.com
2. 注册/登录账号
3. 从GitHub导入项目
4. 配置环境变量（和Vercel一样）

## 2. 环境变量配置

在Netlify项目设置 → Site settings → Environment variables 中添加：

| 变量名 | 值 | 说明 |
|:---|:---|:---|
| `SUPABASE_URL` | `https://your-project.supabase.co` | Supabase项目URL |
| `SUPABASE_KEY` | `eyJ...` | Supabase anon/public key |
| `ADMIN_PASSWORD` | `lanxi123` | 后台管理密码 |

## 3. 部署

1. 将代码推送到GitHub
2. Netlify自动检测 `netlify.toml` 并部署
3. 配置环境变量
4. 重新部署

## 链接结构

| 页面 | 链接 | 说明 |
|:---|:---|:---|
| 浏览页面 | `https://你的域名/` | 公开访问，给用户看的 |
| 后台管理 | `https://你的域名/admin` | 需要密码 |

## 常见问题

**Netlify Functions超时？**
- 免费版函数执行时间限制10秒
- 如果Supabase连接慢，可能会超时
- 解决方案：使用内存备用存储（已内置）

**静态文件不显示？**
- Netlify会自动部署 `public` 文件夹
- 确保 `netlify.toml` 中 `publish = "public"`

# Lanxi-蓝希 免费壁纸

一个精美的壁纸展示和管理网站。

## 功能特性

- 🎨 管理后台：上传、编辑、删除壁纸
- 📊 数据统计：浏览次数、下载次数
- 👁️ 展示页面：瀑布流布局，点击查看详情
- ✨ 高级动效：悬停动画、渐变效果

## 部署到 Render

1. 在 Render 注册账号并登录
2. 点击 "New +" → "Web Service"
3. 选择 GitHub 仓库或上传代码
4. 设置：
   - Build Command: `npm install`
   - Start Command: `node server.js`
5. 点击 "Create Web Service"

## 链接结构

- 管理后台：`https://your-service.onrender.com/`
- 展示页面：`https://your-service.onrender.com/?view=display`

## 本地运行

```bash
npm install
npm start
```

访问：`http://localhost:3000`

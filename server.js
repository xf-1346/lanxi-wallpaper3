const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const { URL } = require('url');
let sharp = null;
try { sharp = require('sharp'); } catch (e) { /* sharp not available */ }

// ========== 环境变量诊断 ==========
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'lanxi123';

// 诊断信息
const diagnostics = {
    supabaseUrlSet: !!SUPABASE_URL,
    supabaseKeySet: !!SUPABASE_KEY,
    adminPasswordSet: !!process.env.ADMIN_PASSWORD,
    initError: null,
    initSuccess: false
};

// 初始化Supabase
let supabase = null;
try {
    if (SUPABASE_URL && SUPABASE_KEY) {
        supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
        diagnostics.initSuccess = true;
    } else {
        diagnostics.initError = `SUPABASE_URL=${!!SUPABASE_URL}, SUPABASE_KEY=${!!SUPABASE_KEY} (环境变量未设置)`;
    }
} catch (e) {
    diagnostics.initError = `Supabase初始化失败: ${e.message}`;
    supabase = null;
}

// ========== 内存备用存储 ==========
let memoryStore = {
    wallpapers: [],
    stats: { id: 1, views: 0, downloads: 0 }
};

const express = require('express');
const app = express();
app.use(express.json({ limit: '10mb' }));

// CORS
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    next();
});

// ========== Admin 密码中间件（必须在所有路由之前）==========
app.use((req, res, next) => {
    const url = req.originalUrl || req.url || '';
    if (url.startsWith('/admin')) {
        const password = req.query.password || req.query.pwd || req.body?.password || '';
        if (password === ADMIN_PASSWORD) {
            try {
                // 在 public/ 中查找 admin-panel.html（适配 Netlify 和本地开发）
                const adminPath = path.join(getPublicPath(), 'admin-panel.html');
                const adminHtml = fs.readFileSync(adminPath, 'utf8');
                return res.send(adminHtml);
            } catch (e) {
                return res.status(500).send('Error loading admin page: ' + e.message);
            }
        }
        return res.send(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>管理后台登录</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:linear-gradient(135deg,#0c1220 0%,#1a2744 50%,#0f1a2e 100%);color:#fff;display:flex;justify-content:center;align-items:center;height:100vh;font-family:-apple-system,BlinkMacSystemFont,sans-serif}
.login-box{background:rgba(15,26,46,.8);padding:50px;border-radius:20px;border:1px solid rgba(58,123,213,.3);text-align:center;min-width:300px}
h2{font-size:24px;margin-bottom:30px;background:linear-gradient(135deg,#5c9cf5,#a78bfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
input{width:100%;padding:15px;border-radius:10px;border:1px solid rgba(58,123,213,.3);background:rgba(12,18,32,.8);color:#fff;font-size:16px;margin-bottom:20px}
button{width:100%;padding:15px;background:linear-gradient(135deg,#3a7bd5,#5c9cf5);color:#fff;border:none;border-radius:10px;cursor:pointer;font-size:16px;transition:all .3s ease}
button:hover{transform:translateY(-2px);box-shadow:0 8px 25px rgba(58,123,213,.4)}
</style></head>
<body><div class="login-box"><h2>🔒 管理后台登录</h2><input type="password" id="pwd" placeholder="输入密码"><button onclick="login()">进入后台</button></div>
<script>function login(){var pwd=document.getElementById('pwd').value;window.location.href='/admin?password='+encodeURIComponent(pwd)}document.getElementById('pwd').addEventListener('keypress',function(e){if(e.key==='Enter')login()})</script>
</body></html>`);
    }
    next();
});

// ========== Supabase数据操作（带备用） ==========

async function getWallpapers() {
    if (!supabase) return memoryStore.wallpapers;
    try {
        const { data, error } = await supabase
            .from('wallpapers')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        memoryStore.wallpapers = data || []; // 同步到内存
        return data || [];
    } catch (e) {
        console.error('getWallpapers error:', e.message);
        return memoryStore.wallpapers;
    }
}

async function addWallpaper(wallpaper) {
    const insertData = {
        url: wallpaper.url,
        text: wallpaper.text,
        description: wallpaper.desc || '高清精美壁纸',
        downloads: 0
    };

    // 先存内存（确保不丢失）
    const memId = Date.now();
    const memItem = { id: memId, ...insertData, created_at: new Date().toISOString() };
    memoryStore.wallpapers.unshift(memItem);

    if (!supabase) return memItem;
    try {
        const { data, error } = await supabase
            .from('wallpapers')
            .insert([insertData])
            .select()
            .single();
        if (error) throw error;
        return data ? { ...data, desc: data.description } : memItem;
    } catch (e) {
        console.error('addWallpaper error:', e.message);
        return { ...memItem, _error: e.message, _mode: 'memory_only' };
    }
}

async function updateWallpaper(id, updates) {
    // 更新内存
    const idx = memoryStore.wallpapers.findIndex(w => w.id == id);
    if (idx !== -1) {
        if (updates.text !== undefined) memoryStore.wallpapers[idx].text = updates.text;
        if (updates.desc !== undefined) memoryStore.wallpapers[idx].description = updates.desc;
        if (updates.url !== undefined) memoryStore.wallpapers[idx].url = updates.url;
        if (updates.downloads !== undefined) memoryStore.wallpapers[idx].downloads = updates.downloads;
    }

    if (!supabase) return memoryStore.wallpapers[idx] || null;
    try {
        const updateData = {};
        if (updates.url !== undefined) updateData.url = updates.url;
        if (updates.text !== undefined) updateData.text = updates.text;
        if (updates.desc !== undefined) updateData.description = updates.desc;
        if (updates.downloads !== undefined) updateData.downloads = updates.downloads;

        const { data, error } = await supabase
            .from('wallpapers')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data ? { ...data, desc: data.description } : memoryStore.wallpapers[idx];
    } catch (e) {
        console.error('updateWallpaper error:', e.message);
        return memoryStore.wallpapers[idx] || null;
    }
}

async function deleteWallpaper(id) {
    // 删除内存
    memoryStore.wallpapers = memoryStore.wallpapers.filter(w => w.id != id);

    if (!supabase) return true;
    try {
        const { error } = await supabase.from('wallpapers').delete().eq('id', id);
        if (error) throw error;
        return true;
    } catch (e) {
        console.error('deleteWallpaper error:', e.message);
        return true; // 内存已删除，返回成功
    }
}

async function getStats() {
    if (!supabase) return memoryStore.stats;
    try {
        const { data, error } = await supabase.from('stats').select('*').eq('id', 1).single();
        if (error && error.code !== 'PGRST116') throw error;
        if (!data) {
            await supabase.from('stats').insert([{ id: 1, views: 0, downloads: 0 }]);
            memoryStore.stats = { id: 1, views: 0, downloads: 0 };
            return memoryStore.stats;
        }
        memoryStore.stats = data;
        return data;
    } catch (e) {
        console.error('getStats error:', e.message);
        return memoryStore.stats;
    }
}

async function updateStats(stats) {
    memoryStore.stats = { ...memoryStore.stats, ...stats };

    if (!supabase) return;
    try {
        await supabase.from('stats').upsert([{ id: 1, views: stats.views || 0, downloads: stats.downloads || 0 }]);
    } catch (e) {
        console.error('updateStats error:', e.message);
    }
}

// ========== API路由 ==========

// ========== 图片缩略图代理 ==========
// 无数据库/存储变更的纯代理压缩。浏览页用 `?w=400`，详情预览用 `?w=800`，下载始终取原 URL

app.get('/api/thumb', async (req, res) => {
    const imageUrl = req.query.url;
    const width = parseInt(req.query.w) || 400;
    
    if (!imageUrl) {
        return res.status(400).send('Missing url parameter');
    }
    
    try {
        const parsed = new URL(imageUrl);
        const fetcher = parsed.protocol === 'https:' ? https : http;
        
        // 先尝试验证 URL 有效性
        const response = await new Promise((resolve, reject) => {
            const reqGet = fetcher.get(imageUrl, { timeout: 8000 }, (res) => {
                if (res.statusCode >= 400) {
                    // 拒绝坏链接
                    reject(new Error('Remote server returned ' + res.statusCode));
                    return;
                }
                resolve(res);
            });
            reqGet.on('error', reject);
            reqGet.on('timeout', () => { reqGet.destroy(); reject(new Error('Request timeout')); });
        });
        
        // 收集原图数据
        const chunks = [];
        for await (const chunk of response) {
            chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);
        
        // 浏览器强缓存：图片几乎不变，缓存 7 天
        res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
        res.setHeader('CDN-Cache-Control', 'public, max-age=604800');
        
        if (sharp && buffer.length > 50000) {
            // 用 sharp 压缩：转为 webp + 设定宽度 + 适度质量
            const compressed = await sharp(buffer)
                .resize({ width, withoutEnlargement: true })
                .webp({ quality: 80 })
                .toBuffer();
            
            res.setHeader('Content-Type', 'image/webp');
            res.setHeader('X-Image-Original-Size', buffer.length);
            res.setHeader('X-Image-Compressed-Size', compressed.length);
            return res.send(compressed);
        } else {
            // 没有 sharp 或图片太小：原图直出
            const contentType = response.headers['content-type'] || 'image/jpeg';
            res.setHeader('Content-Type', contentType);
            return res.send(buffer);
        }
    } catch (e) {
        console.error('Image proxy error:', e.message);
        // 代理失败，返回一个极小的占位图片（1x1 透明像素）
        res.setHeader('Content-Type', 'image/gif');
        res.setHeader('Cache-Control', 'no-cache');
        res.send(Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'));
    }
});

// 调试端点 - 诊断环境变量
app.get('/api/debug', (req, res) => {
    res.json({
        diagnostics: {
            supabaseUrlSet: diagnostics.supabaseUrlSet,
            supabaseKeySet: diagnostics.supabaseKeySet,
            adminPasswordSet: diagnostics.adminPasswordSet,
            initSuccess: diagnostics.initSuccess,
            initError: diagnostics.initError,
            urlPrefix: SUPABASE_URL ? SUPABASE_URL.substring(0, 20) + '...' : null,
            keyPrefix: SUPABASE_KEY ? SUPABASE_KEY.substring(0, 10) + '...' : null,
            memoryMode: !supabase,
            wallpaperCount: memoryStore.wallpapers.length,
            nodeEnv: process.env.NODE_ENV || 'unknown'
        },
        message: supabase ? 'Supabase已连接' : '使用内存模式（数据重启后丢失）'
    });
});

app.get('/api/wallpapers', async (req, res) => {
    const wallpapers = await getWallpapers();
    const normalized = wallpapers.map(w => ({ ...w, desc: w.description || w.desc }));
    res.json(normalized);
});

app.post('/api/wallpapers', async (req, res) => {
    const wallpaper = await addWallpaper(req.body);
    if (wallpaper) {
        res.json(wallpaper);
    } else {
        res.status(500).json({ error: 'Failed to add wallpaper' });
    }
});

app.put('/api/wallpapers/:id', async (req, res) => {
    const wallpaper = await updateWallpaper(req.params.id, req.body);
    if (wallpaper) {
        res.json(wallpaper);
    } else {
        res.status(404).json({ error: 'Wallpaper not found' });
    }
});

app.delete('/api/wallpapers/:id', async (req, res) => {
    const success = await deleteWallpaper(req.params.id);
    res.json({ success });
});

app.get('/api/stats', async (req, res) => {
    const stats = await getStats();
    res.json(stats);
});

app.post('/api/stats', async (req, res) => {
    await updateStats(req.body);
    res.json({ success: true });
});

// ========== 页面路由 ==========

// 辅助函数：查找public文件夹路径（适配不同部署环境）
function getPublicPath() {
    const possiblePaths = [
        path.join(__dirname, '..', '..', 'public'),  // Netlify: /var/task/netlify/functions -> /var/task/public
        path.join(path.dirname(__dirname), 'public'),
        path.join(__dirname, 'public'),
        path.join(process.cwd(), 'public'),
        path.resolve('./public'),
        '/var/task/public',
        '/var/task/netlify/functions/public',
        '/var/task/public',
    ];
    for (const p of possiblePaths) {
        if (fs.existsSync(p)) return p;
    }
    // 返回第一个路径，让错误信息显示出来
    return possiblePaths[0];
}

app.get('/', (req, res) => {
    try {
        const publicPath = getPublicPath();
        const viewHtml = fs.readFileSync(path.join(publicPath, 'view.html'), 'utf8');
        res.send(viewHtml);
    } catch (e) {
        res.status(500).send('Error loading page: ' + e.message + ' (tried: ' + getPublicPath() + ')');
    }
});

app.use(express.static(getPublicPath()));

app.get('*', (req, res) => {
    try {
        const publicPath = getPublicPath();
        const viewHtml = fs.readFileSync(path.join(publicPath, 'view.html'), 'utf8');
        res.send(viewHtml);
    } catch (e) {
        res.status(500).send('Error loading page: ' + e.message + ' (tried: ' + getPublicPath() + ')');
    }
});

module.exports = app;
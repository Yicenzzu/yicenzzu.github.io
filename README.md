# Yicen Liu · Academic Homepage

一个**不需要构建**的静态学术主页。页面在浏览器中直接读取 `config.yml`、`_pages/*.md` 和 `_posts/*.md`，用 JavaScript 渲染，布局与交互参考 <https://yicenzzu.github.io/>。

没有 Jekyll、Ruby、Node 或打包步骤。

## 目录

```text
.
├── config.yml                   # 站点配置：标题、Hero、导航、页脚
├── index.html                   # 唯一页面骨架
├── open-site.bat                # Windows 一键预览（启动本地服务器）
├── _pages/                      # 固定页面内容
│   ├── home.md                  # 个人主页 / 简介
│   ├── about.md                 # 关于我
│   ├── archives.md              # 归档（技能、经历、奖项）
│   ├── blog.md                  # 博客列表页
│   ├── projects.md              # 项目
│   └── publications.md          # 论文 / 发表
├── _posts/                      # 文章只放这里
│   ├── 2026-11-10-reproducible-data-analysis.md
│   └── 2026-11-10-from-question-to-modeling-experiment.md
├── static/
│   ├── assets/img/              # 头像、背景、文章配图
│   ├── css/main.css
│   └── js/
│       ├── main.js              # 读取 config.yml + _pages/*.md，负责路由与界面
│       ├── blog.js              # 维护 POSTS 数组，渲染博客列表和正文
│       └── vendor/              # 本地版 js-yaml + marked（不依赖 CDN）
└── README.md
```

## 本地预览（打不开先看这里）

**不要直接双击 `index.html`。** 浏览器出于安全限制，不允许 `file://` 页面用 `fetch()` 读取本地 YAML/Markdown，所以直接双击会显示 “Content unavailable”。

最简单的办法：双击项目根目录的 **`open-site.bat`**。它会自动启动本地服务器并打开浏览器。

也可以手动运行：

```powershell
cd "C:\Users\haotian.li\academic-blog-canonical - 副本"
python -m http.server 8000
```

然后打开 <http://localhost:8000>。

如果使用 VS Code，也可以安装 Live Server 插件，右键 `index.html` → *Open with Live Server*。

部署到 GitHub Pages、Cloudflare Pages 等静态托管后，直接访问域名即可，不需要本地服务器。

## 修改内容

### 站点信息 / Hero / 导航 / 页脚

编辑 `config.yml`：

- `title`、`tagline`、`description`、`avatar`
- `hero`：首页的眉标、标题、职位、头像和三个链接
- `nav`：侧边栏导航顺序与图标（`id` 同时是 `#/id/` 路由）
- `social`：侧边栏底部社交图标
- `footer`：页脚版权、协议和署名

### 固定页面

编辑 `_pages/*.md`。文件顶部的 YAML front matter 支持：

```yaml
---
title: 页面标题
description: 页面副标题（可选）
---
```

正文用 Markdown 书写，也可以直接写 HTML（现有项目和论文页就是 HTML + Markdown 混排）。图片路径使用相对根目录的 `static/assets/img/...`。

### 发布新文章

1. 在 `_posts/` 新建 Markdown 文件，例如：

   ```markdown
   ---
   title: "文章标题"
   date: 2026-11-11 10:00:00 +0800
   categories:
     - Research notes
   tags:
     - Aerosol
   description: 列表页摘要（可选；不写会自动截取正文）
   cover: static/assets/img/posts/my-cover.jpg
   cover_alt: 封面图的替代文字
   ---

   正文……
   ```

2. 在 `static/js/blog.js` 顶部的 `POSTS` 数组中追加一项：

   ```js
   {
     file: '_posts/2026-11-11-my-new-post.md',
     slug: 'my-new-post'
   }
   ```

   `slug` 就是文章地址 `#/posts/my-new-post/`。保存后刷新页面即可。

3. 文章会自动按日期倒序出现在首页 “Latest notes” 和 `#/blog/` 列表里，同时进入搜索索引。

### 替换图片

- 头像：替换 `static/assets/img/profile_YL_casual.jpg`，或在 `config.yml` 的 `avatar` / `hero.image` 中改路径。
- 项目配图：`static/assets/img/projects/`
- 论文配图：`static/assets/img/publications/`
- 文章封面：`static/assets/img/posts/`，在文章 front matter 里用 `cover` 指定；不写 `cover` 就不显示封面。

替换图片后如果浏览器仍显示旧图，按 `Ctrl + F5` 强制刷新，或给新图片换一个文件名。

> 部署时一定要把整个 **`static` 目录**（尤其是 `static/assets/img/`）一起上传。只上传 HTML/CSS/JS 而漏掉图片目录，页面就会出现图片 404、只显示替代文字的情况。

## 功能

- 侧边栏 + 移动端抽屉导航
- Light / Dark / System 三种主题，自动记住选择
- Hash 路由（`#/about/`、`#/posts/...`），无需服务器 rewrite
- 站内搜索（页面 + 文章），按 `/` 快速打开
- 文章目录、阅读时长、上一篇 / 下一篇
- 图片点击放大
- 返回顶部、滚动时顶栏阴影、入场动画

## 部署

把整个目录上传到任意静态托管即可（GitHub Pages、Cloudflare Pages、Netlify、Vercel、Nginx……）。**不要漏掉 `static` 目录**。所有路径都是相对 `index.html` 的，因此放在子路径（例如 `https://name.github.io/repo/`）也能正常工作。

GitHub Pages 设置：仓库 **Settings → Pages → Build and deployment → Source: Deploy from a branch**，选择分支根目录即可。仓库里不要保留 Jekyll 的构建配置，本目录已经是最终静态文件。

> 由于使用 hash 路由，直接访问 `https://.../#/blog/` 没问题；直接访问 `https://.../blog/` 不会命中页面。站内链接都已使用 `#/...` 形式。

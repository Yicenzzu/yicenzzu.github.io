/* ============================================================
   blog.js — post index and renderer
   ------------------------------------------------------------
   Each post lives in its own folder under _posts/:
     _posts/2026-11-10-my-post/
       ├── 2026-11-10-my-post.md
       └── data/                  # cover, images, demos, videos…
   To publish a new post, append its markdown path to POSTS below.
   Inside the markdown, reference assets as data/cover.jpg and the
   renderer will resolve them against that post's data/ folder.
   ============================================================ */

(function (global) {
  'use strict';

  const POSTS = [
    '_posts/2026-11-10-deepseek-3d-generation/2026-11-10-deepseek-3d-generation.md',
    '_posts/2026-11-10-reproducible-data-analysis/2026-11-10-reproducible-data-analysis.md',
    '_posts/2026-11-10-from-question-to-modeling-experiment/2026-11-10-from-question-to-modeling-experiment.md'
  ];

  const cache = new Map();
  let posts = [];
  let loaded = false;
  let loadPromise = null;

  function utils() {
    return global.SiteUtils;
  }

  function resolveDataPath(value, assetBase) {
    if (typeof value !== 'string' || value.indexOf('data/') !== 0) {
      return value;
    }
    return assetBase + value.slice('data/'.length);
  }

  async function loadPost(entry) {
    if (cache.has(entry.file)) {
      return cache.get(entry.file);
    }

    const U = utils();
    const raw = await U.fetchText(entry.file);
    const parsed = U.parseFrontMatter(raw);
    const data = parsed.data || {};
    const segments = entry.file.split('/');
    const fileName = segments.pop();
    const folder = segments.pop() || '';
    const assetBase = '_posts/' + folder + '/data/';
    let html = U.renderMarkdown(parsed.body || '');
    html = html.replace(/(src|href|poster|data-video)="data\//g, '$1="' + assetBase);
    const text = U.plainText(html);
    const fallbackSlug = fileName
      .replace(/\.md$/i, '')
      .replace(/^\d{4}-\d{2}-\d{2}-/, '');
    const fileDate = fileName.match(/^(\d{4}-\d{2}-\d{2})/);
    const rawCover =
      typeof data.cover === 'string'
        ? data.cover
        : typeof data.image === 'string'
          ? data.image
          : null;
    const coverValue = resolveDataPath(rawCover, assetBase);

    const post = Object.assign({}, entry, data, {
      cover: coverValue,
      coverAlt: data.cover_alt || data.image_alt || data.title || '',
      hideHeader: data.hide_header === true,
      hideCover: data.hide_cover === true,
      hideToc: data.hide_toc === true,
      hideNav: data.hide_nav === true,
      wideLayout: data.wide_layout === true,
      slug: data.slug || fallbackSlug,
      title: data.title || U.titleFromFile(entry.file),
      date: U.toDate(data.date || (fileDate ? fileDate[1] : null)),
      categories: U.toArray(data.categories != null ? data.categories : data.category),
      tags: U.toArray(data.tags != null ? data.tags : data.tag),
      html: html,
      text: text,
      excerpt: data.description || data.summary || U.truncate(text, 180),
      readingTime: U.readingTime(text)
    });

    cache.set(entry.file, post);
    return post;
  }

  async function loadAll(force) {
    if (loaded && !force) {
      return posts;
    }
    if (loadPromise && !force) {
      return loadPromise;
    }

    loadPromise = Promise.all(
      POSTS.map(async function (entry) {
        const file = typeof entry === 'string' ? entry : entry.file;
        try {
          return await loadPost({ file: file });
        } catch (error) {
          console.error('Unable to load post:', file, error);
          return null;
        }
      })
    ).then(function (list) {
      posts = list
        .filter(Boolean)
        .sort(function (a, b) {
          const aTime = a.date ? a.date.getTime() : 0;
          const bTime = b.date ? b.date.getTime() : 0;
          return bTime - aTime;
        });
      loaded = true;
      return posts;
    });

    return loadPromise;
  }

  function getPosts() {
    return posts.slice();
  }

  function getBySlug(slug) {
    return posts.find(function (post) {
      return post.slug === slug;
    });
  }

  function metaHtml(post) {
    const U = utils();
    const categories = post.categories
      .map(function (category) {
        return (
          '<span class="post-category"><i class="far fa-folder-open fa-fw"></i>' +
          U.escapeHtml(category) +
          '</span>'
        );
      })
      .join('');

    return (
      '<div class="post-meta">' +
      '<span><i class="far fa-calendar fa-fw"></i><time datetime="' +
      (post.date ? post.date.toISOString() : '') +
      '">' +
      U.escapeHtml(U.formatDate(post.date)) +
      '</time></span>' +
      '<span><i class="far fa-clock fa-fw"></i>' +
      post.readingTime +
      ' min read</span>' +
      categories +
      '</div>'
    );
  }

  function cardHtml(post) {
    const U = utils();
    const cover = post.cover
      ? '<div class="post-cover"><img src="' +
        U.escapeHtml(post.cover) +
        '" alt="' +
        U.escapeHtml(post.coverAlt) +
        '" loading="eager"></div>'
      : '';

    return (
      '<article class="card-wrapper">' +
      '<a class="post-preview' +
      (post.cover ? ' post-preview--with-cover' : '') +
      '" href="/posts/' +
      encodeURIComponent(post.slug) +
      '/">' +
      cover +
      '<div class="card-body">' +
      '<h2 class="card-title">' +
      U.escapeHtml(post.title) +
      '</h2>' +
      '<p class="card-text">' +
      U.escapeHtml(post.excerpt) +
      '</p>' +
      metaHtml(post) +
      '</div>' +
      '</a>' +
      '</article>'
    );
  }

  function renderList(container, list) {
    if (!container) {
      return;
    }
    const items = list || posts;
    if (!items.length) {
      container.innerHTML = '<p class="empty-state">New posts will appear here.</p>';
      return;
    }
    container.innerHTML = items.map(cardHtml).join('');
  }

  function renderLatest(container, limit) {
    renderList(container, posts.slice(0, limit || 2));
  }

  function renderPost(container, slug) {
    const U = utils();
    const post = getBySlug(slug);

    if (!post || !container) {
      return null;
    }

    const index = posts.indexOf(post);
    const newer = index > 0 ? posts[index - 1] : null;
    const older = index >= 0 && index < posts.length - 1 ? posts[index + 1] : null;

    const tags = post.tags.length
      ? '<div class="post-tags">' +
        post.tags
          .map(function (tag) {
            return '<span class="tag">#' + U.escapeHtml(tag) + '</span>';
          })
          .join('') +
        '</div>'
      : '';

    const cover = post.cover && !post.hideCover
      ? '<figure class="post-hero"><img src="' +
        U.escapeHtml(post.cover) +
        '" alt="' +
        U.escapeHtml(post.coverAlt) +
        '"></figure>'
      : '';

    const navigation = post.hideNav
      ? ''
      : '<nav class="post-navigation" aria-label="Post navigation">' +
      (older
        ? '<a class="post-nav-link post-nav-link--prev" href="/posts/' +
          encodeURIComponent(older.slug) +
          '/"><span class="post-nav-label"><i class="fas fa-arrow-left fa-fw"></i> Older</span><span class="post-nav-title">' +
          U.escapeHtml(older.title) +
          '</span></a>'
        : '<span class="post-nav-link is-disabled"></span>') +
      (newer
        ? '<a class="post-nav-link post-nav-link--next" href="/posts/' +
          encodeURIComponent(newer.slug) +
          '/"><span class="post-nav-label">Newer <i class="fas fa-arrow-right fa-fw"></i></span><span class="post-nav-title">' +
          U.escapeHtml(newer.title) +
          '</span></a>'
        : '<span class="post-nav-link is-disabled"></span>') +
      '</nav>';

    const header = post.hideHeader
      ? ''
      : '<header class="post-header">' +
        '<h1 class="post-title">' +
        U.escapeHtml(post.title) +
        '</h1>' +
        metaHtml(post) +
        tags +
        '</header>';

    container.innerHTML =
      '<article class="post' +
      (post.hideHeader ? ' post--bare' : '') +
      '">' +
      header +
      cover +
      '<div class="content post-content">' +
      post.html +
      '</div>' +
      navigation +
      '</article>';

    const headings = U.enhanceContent(container);

    return {
      post: post,
      headings: headings
    };
  }

  function getSearchEntries() {
    const U = utils();
    return posts.map(function (post) {
      return {
        type: 'Post',
        title: post.title,
        url: '/posts/' + encodeURIComponent(post.slug) + '/',
        text: post.text,
        date: post.date ? U.formatDate(post.date) : ''
      };
    });
  }

  global.Blog = {
    init: function () {
      return loadAll();
    },
    loadAll: loadAll,
    getPosts: getPosts,
    getBySlug: getBySlug,
    getSearchEntries: getSearchEntries,
    renderList: renderList,
    renderLatest: renderLatest,
    renderPost: renderPost
  };
})(window);

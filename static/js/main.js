/* ============================================================
   main.js — runtime shell for the static site
   ------------------------------------------------------------
   Loads config.yml and _pages/*.md with fetch(), renders the
   sidebar, routes hash URLs, and provides search, theme mode,
   table of contents, and back-to-top behaviour.
   ============================================================ */

(function (global) {
  'use strict';

  const $ = function (selector, root) {
    return (root || document).querySelector(selector);
  };

  const $$ = function (selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  };

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[character];
    });
  }

  function slugify(text) {
    return String(text || '')
      .toLowerCase()
      .trim()
      .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  const SiteUtils = {
    timeZone: null,

    fetchText: async function (path) {
      const response = await fetch(path, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Could not load ' + path + ' (HTTP ' + response.status + ').');
      }
      return response.text();
    },

    escapeHtml: escapeHtml,
    slugify: slugify,

    parseFrontMatter: function (raw) {
      const match = String(raw).match(/^\uFEFF?---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/);
      if (!match) {
        return { data: {}, body: String(raw) };
      }

      let data = {};
      try {
        data = (global.jsyaml && global.jsyaml.load(match[1])) || {};
      } catch (error) {
        console.warn('Could not parse front matter:', error);
      }

      return {
        data: data,
        body: String(raw).slice(match[0].length)
      };
    },

    renderMarkdown: function (markdown) {
      if (global.marked && typeof global.marked.parse === 'function') {
        return global.marked.parse(markdown || '');
      }
      return '<pre>' + escapeHtml(markdown || '') + '</pre>';
    },

    plainText: function (html) {
      const spaced = String(html || '')
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<\/(p|div|li|ul|ol|h[1-6]|section|article|blockquote|pre|tr|td|th)>/gi, '$& ');
      const documentFragment = new DOMParser().parseFromString(spaced, 'text/html');
      return (documentFragment.body.textContent || '').replace(/\s+/g, ' ').trim();
    },

    truncate: function (text, length) {
      const clean = String(text || '').replace(/\s+/g, ' ').trim();
      if (clean.length <= length) {
        return clean;
      }
      return clean.slice(0, length).replace(/\s+\S*$/, '') + '…';
    },

    toArray: function (value) {
      if (value == null || value === '') {
        return [];
      }
      return Array.isArray(value) ? value : [value];
    },

    toDate: function (value) {
      if (!value) {
        return null;
      }
      if (value instanceof Date) {
        return isNaN(value.getTime()) ? null : value;
      }
      if (typeof value === 'number') {
        const numeric = new Date(value);
        return isNaN(numeric.getTime()) ? null : numeric;
      }

      const normalized = String(value)
        .trim()
        .replace(/^(\d{4}-\d{2}-\d{2})\s+/, '$1T')
        .replace(/\s+([+-]\d{2}:?\d{2})$/, '$1')
        .replace(/([+-]\d{2})(\d{2})$/, '$1:$2');

      const parsed = new Date(normalized);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }

      const fallback = new Date(value);
      return isNaN(fallback.getTime()) ? null : fallback;
    },

    formatDate: function (value) {
      const date = value instanceof Date ? value : this.toDate(value);
      if (!date) {
        return '';
      }
      const options = {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      };
      if (this.timeZone) {
        options.timeZone = this.timeZone;
      }
      return new Intl.DateTimeFormat('en-US', options).format(date);
    },

    readingTime: function (text) {
      const words = String(text || '').trim().split(/\s+/).filter(Boolean).length;
      return Math.max(1, Math.round(words / 200));
    },

    titleFromFile: function (file) {
      const base = String(file)
        .split('/')
        .pop()
        .replace(/\.md$/i, '')
        .replace(/^\d{4}-\d{2}-\d{2}-/, '')
        .replace(/[-_]+/g, ' ');
      return base.charAt(0).toUpperCase() + base.slice(1);
    },

    enhanceContent: function (root) {
      if (!root) {
        return [];
      }

      const usedIds = {};
      const headings = $$('h2, h3', root);

      headings.forEach(function (heading) {
        let base = heading.id || slugify(heading.textContent) || 'section';
        let candidate = base;
        let counter = 1;
        while (usedIds[candidate]) {
          candidate = base + '-' + counter;
          counter += 1;
        }
        usedIds[candidate] = true;
        heading.id = candidate;
      });

      $$('a[href]', root).forEach(function (link) {
        const href = link.getAttribute('href');
        if (!href) {
          return;
        }

        if (/^\/(blog|publications|projects|archives|about|posts)(\/|$)/.test(href)) {
          link.setAttribute('href', '#' + href);
        }

        if (/^https?:\/\//i.test(href) && link.hostname && link.hostname !== global.location.hostname) {
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
        }
      });

      $$('img', root).forEach(function (image) {
        if (!image.closest('.post-hero') && !image.closest('.post-cover')) {
          image.loading = 'lazy';
        }
        image.decoding = 'async';
        image.classList.add('zoomable');
      });

      return headings.map(function (heading) {
        return {
          id: heading.id,
          text: heading.textContent.trim(),
          level: Number(heading.tagName.slice(1))
        };
      });
    }
  };

  global.SiteUtils = SiteUtils;

  const state = {
    config: null,
    pages: new Map(),
    searchIndex: [],
    currentRoute: null,
    routeToken: 0,
    tocHeadings: [],
    tocLinks: []
  };

  /* ------------------------------------------------------------
     Config, navigation, footer
     ------------------------------------------------------------ */

  async function loadConfig() {
    const raw = await SiteUtils.fetchText('config.yml');
    const config = global.jsyaml ? global.jsyaml.load(raw) : null;
    if (!config || typeof config !== 'object') {
      throw new Error('config.yml could not be parsed.');
    }
    return config;
  }

  function applyConfig() {
    const config = state.config;
    const title = config.title || 'Academic homepage';

    document.documentElement.lang = config.lang || 'en';
    document.title = title;
    SiteUtils.timeZone = config.timezone || null;

    const descriptionMeta = $('meta[name="description"]');
    if (descriptionMeta) {
      descriptionMeta.setAttribute('content', config.description || '');
    }

    const siteTitle = $('#site-title');
    siteTitle.textContent = title;
    siteTitle.href = '#/';

    $('#site-subtitle').textContent = config.tagline || '';
    $('#avatar').href = '#/';

    if (config.avatar) {
      $('#avatar-img').src = config.avatar;
      $('#avatar-img').alt = title;
    }

    if (config.favicon) {
      $('#favicon-link').href = config.favicon;
    }

    $('#topbar-title').textContent = title;
    renderNavigation();
    renderSocialLinks();
    renderFooter();
  }

  function renderNavigation() {
    const items = state.config.nav || [];
    $('#nav-list').innerHTML = items
      .map(function (item) {
        const href = item.id === 'home' ? '#/' : '#/' + item.id + '/';
        return (
          '<li class="nav-item">' +
          '<a class="nav-link" data-nav="' +
          escapeHtml(item.id) +
          '" href="' +
          href +
          '">' +
          '<i class="' +
          escapeHtml(item.icon || 'fas fa-circle') +
          '" aria-hidden="true"></i>' +
          '<span>' +
          escapeHtml(item.label) +
          '</span>' +
          '</a>' +
          '</li>'
        );
      })
      .join('');
  }

  function renderSocialLinks() {
    const links = state.config.social || [];
    $('#social-links').innerHTML = links
      .map(function (link) {
        const external = /^https?:\/\//i.test(link.url || '');
        return (
          '<a href="' +
          escapeHtml(link.url || '#') +
          '" aria-label="' +
          escapeHtml(link.label || 'Social link') +
          '"' +
          (external ? ' target="_blank" rel="noopener noreferrer"' : '') +
          '>' +
          '<i class="' +
          escapeHtml(link.icon || 'fas fa-link') +
          '" aria-hidden="true"></i>' +
          '</a>'
        );
      })
      .join('');
  }

  function renderFooter() {
    const footer = state.config.footer || {};
    const year = new Date().getFullYear();
    const copyright = escapeHtml(footer.copyright || state.config.title || '');

    $('#footer-left').innerHTML =
      '© <time datetime="' +
      year +
      '">' +
      year +
      '</time> <a href="#/">' +
      copyright +
      '</a>. ' +
      (footer.license_url
        ? '<a href="' +
          escapeHtml(footer.license_url) +
          '" target="_blank" rel="noopener noreferrer">' +
          escapeHtml(footer.license || '') +
          '</a>'
        : escapeHtml(footer.license || ''));

    $('#footer-right').innerHTML = footer.credit
      ? footer.credit_url
        ? '<a href="' +
          escapeHtml(footer.credit_url) +
          '" target="_blank" rel="noopener noreferrer">' +
          escapeHtml(footer.credit) +
          '</a>'
        : escapeHtml(footer.credit)
      : '';
  }

  function setActiveNav(id) {
    $$('#nav-list .nav-link').forEach(function (link) {
      const isActive = link.dataset.nav === id;
      link.classList.toggle('active', isActive);
      if (isActive) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });
  }

  function updateBreadcrumb(items) {
    $('#breadcrumb-text').innerHTML = items
      .map(function (item, index) {
        const isLast = index === items.length - 1;
        if (isLast) {
          return '<span aria-current="page">' + escapeHtml(item.label) + '</span>';
        }
        return (
          '<a href="' + escapeHtml(item.url || '#/') + '">' + escapeHtml(item.label) + '</a>' +
          '<span class="breadcrumb-sep" aria-hidden="true">/</span>'
        );
      })
      .join('');
    $('#topbar-title').textContent = items[items.length - 1].label;
  }

  function setPageMeta(title, description) {
    document.title = title
      ? title + ' | ' + (state.config.title || '')
      : state.config.title || '';
    const descriptionMeta = $('meta[name="description"]');
    if (descriptionMeta) {
      descriptionMeta.setAttribute('content', description || state.config.description || '');
    }
  }

  /* ------------------------------------------------------------
     Page loading and views
     ------------------------------------------------------------ */

  function loadPage(file) {
    if (state.pages.has(file)) {
      return state.pages.get(file);
    }

    const promise = SiteUtils.fetchText('_pages/' + file).then(function (raw) {
      return SiteUtils.parseFrontMatter(raw);
    });

    state.pages.set(file, promise);
    return promise;
  }

  function setContent(html) {
    const container = $('#page-content');
    container.innerHTML = html;
    container.classList.remove('fade-in');
    void container.offsetWidth;
    container.classList.add('fade-in');
    return SiteUtils.enhanceContent(container);
  }

  function showLoading() {
    $('#page-content').innerHTML =
      '<div class="loader" role="status" aria-label="Loading"><span></span><span></span><span></span></div>';
    hidePanel();
  }

  function showNotFound() {
    setContent(
      '<div class="not-found">' +
        '<p class="academic-eyebrow">404</p>' +
        '<h1>Page not found</h1>' +
        '<p>The page you requested does not exist or has moved.</p>' +
        '<a class="button" href="#/"><i class="fas fa-arrow-left fa-fw"></i>Back to home</a>' +
        '</div>'
    );
    hidePanel();
    setActiveNav('');
    updateBreadcrumb([{ label: 'Not found' }]);
    setPageMeta('Page not found', state.config.description);
  }

  function showError(error) {
    console.error(error);

    const isFileProtocol = global.location.protocol === 'file:';
    const hint = isFileProtocol
      ? '<p class="muted">你正在直接双击打开 <code>index.html</code>。浏览器出于安全限制，不允许本地页面读取 ' +
        '<code>config.yml</code>、<code>_pages/*.md</code> 和 <code>_posts/*.md</code>。</p>' +
        '<p><strong>最简单的办法：</strong>回到项目文件夹，双击 <code>open-site.bat</code>，浏览器会自动打开。</p>' +
        '<p class="muted">也可以在当前文件夹运行：</p>' +
        '<pre><code>python -m http.server 8000</code></pre>' +
        '<p>然后访问 <code>http://localhost:8000</code>。部署到 GitHub Pages 后则不需要这一步。</p>'
      : '<p class="muted">站点通过 <code>fetch()</code> 读取 YAML 和 Markdown。请确认文件仍在原目录，' +
        '并且是通过 HTTP 服务访问，而不是直接打开本地文件。</p>' +
        '<p class="muted">在当前文件夹运行：</p>' +
        '<pre><code>python -m http.server 8000</code></pre>' +
        '<p>然后访问 <code>http://localhost:8000</code>。</p>';

    $('#page-content').innerHTML =
      '<div class="error-state">' +
      '<h1>Content unavailable</h1>' +
      '<p>' +
      escapeHtml(error && error.message ? error.message : 'An unexpected error occurred.') +
      '</p>' +
      hint +
      '</div>';
    hidePanel();
  }

  function renderHome(page) {
    const config = state.config;
    const hero = config.hero || {};
    const links = (hero.links || [])
      .map(function (link) {
        return '<a href="' + escapeHtml(link.url || '#/') + '">' + escapeHtml(link.label) + '</a>';
      })
      .join('');
    const bio = SiteUtils.renderMarkdown((page.data && page.data.bio) || '');

    setContent(
      '<section class="academic-home" aria-labelledby="academic-home-title">' +
        '<div class="academic-home__portrait-wrap">' +
        '<img class="academic-home__portrait" src="' +
        escapeHtml(hero.image || config.avatar || '') +
        '" alt="' +
        escapeHtml(hero.image_alt || config.title || '') +
        '">' +
        '</div>' +
        '<div class="academic-home__content">' +
        '<p class="academic-eyebrow">' +
        escapeHtml(hero.eyebrow || 'Academic homepage') +
        '</p>' +
        '<h1 id="academic-home-title">' +
        escapeHtml(hero.title || config.title || '') +
        '</h1>' +
        '<p class="academic-home__role">' +
        (hero.role || '') +
        '</p>' +
        '<div class="academic-bio">' +
        bio +
        '</div>' +
        '<div class="academic-home__links">' +
        links +
        '</div>' +
        '</div>' +
        '</section>' +
        SiteUtils.renderMarkdown(page.body)
    );

    window.Blog.renderLatest($('#home-posts'), 2);
    setActiveNav('home');
    updateBreadcrumb([{ label: 'Home' }]);
    setPageMeta('', config.description);
    renderRecentPanel();
  }

  function renderBlogPage(page) {
    const title = (page.data && page.data.title) || 'Blog';
    const description = (page.data && page.data.description) || '';

    setContent(
      '<header class="page-header">' +
        '<h1>' +
        escapeHtml(title) +
        '</h1>' +
        (description ? '<p class="page-description">' + escapeHtml(description) + '</p>' : '') +
        '</header>' +
        '<div class="content">' +
        SiteUtils.renderMarkdown(page.body) +
        '</div>'
    );

    window.Blog.renderList($('#blog-list'));

    setActiveNav('blog');
    updateBreadcrumb([{ label: 'Home', url: '#/' }, { label: title }]);
    setPageMeta(title, description);
    renderRecentPanel();
  }

  function renderStandardPage(page, nav) {
    const title = (page.data && page.data.title) || nav.label;
    const description = (page.data && page.data.description) || '';
    const headings = setContent(
      '<header class="page-header">' +
        '<h1>' +
        escapeHtml(title) +
        '</h1>' +
        (description ? '<p class="page-description">' + escapeHtml(description) + '</p>' : '') +
        '</header>' +
        '<div class="content">' +
        SiteUtils.renderMarkdown(page.body) +
        '</div>'
    );

    const tocHeadings = headings.filter(function (heading) {
      return heading.level === 2;
    });

    if (tocHeadings.length > 1) {
      renderTOCPanel(tocHeadings);
    } else {
      hidePanel();
    }

    setActiveNav(nav.id);
    updateBreadcrumb([{ label: 'Home', url: '#/' }, { label: title }]);
    setPageMeta(title, description);
  }

  async function renderPageRoute(id, token) {
    const nav = (state.config.nav || []).find(function (item) {
      return item.id === id;
    });

    if (!nav) {
      showNotFound();
      return;
    }

    const page = await loadPage(nav.file);
    if (token !== state.routeToken) {
      return;
    }

    if (nav.id === 'home') {
      renderHome(page);
    } else if (nav.id === 'blog') {
      renderBlogPage(page);
    } else {
      renderStandardPage(page, nav);
    }
  }

  async function renderPostRoute(slug, token) {
    await window.Blog.loadAll();
    if (token !== state.routeToken) {
      return;
    }

    const container = $('#page-content');
    const result = window.Blog.renderPost(container, slug);

    if (!result) {
      showNotFound();
      return;
    }

    container.classList.remove('fade-in');
    void container.offsetWidth;
    container.classList.add('fade-in');

    setActiveNav('blog');
    updateBreadcrumb([
      { label: 'Home', url: '#/' },
      { label: 'Blog', url: '#/blog/' },
      { label: result.post.title }
    ]);
    setPageMeta(result.post.title, result.post.excerpt);
    renderTOCPanel(result.headings);
  }

  /* ------------------------------------------------------------
     Panel: recent posts and table of contents
     ------------------------------------------------------------ */

  function showPanel(html) {
    $('#panel-wrapper').hidden = false;
    $('#panel-content').innerHTML = html;
  }

  function hidePanel() {
    $('#panel-wrapper').hidden = true;
    $('#panel-content').innerHTML = '';
    state.tocHeadings = [];
    state.tocLinks = [];
  }

  function renderRecentPanel() {
    const posts = window.Blog ? window.Blog.getPosts().slice(0, 5) : [];
    if (!posts.length) {
      hidePanel();
      return;
    }

    showPanel(
      '<section class="access">' +
        '<h2 class="panel-heading">Recently Updated</h2>' +
        '<ul class="panel-list">' +
        posts
          .map(function (post) {
            return (
              '<li><a href="#/posts/' +
              encodeURIComponent(post.slug) +
              '/">' +
              escapeHtml(post.title) +
              '</a></li>'
            );
          })
          .join('') +
        '</ul>' +
        '</section>'
    );
  }

  function renderTOCPanel(headings) {
    if (!headings.length) {
      hidePanel();
      return;
    }

    showPanel(
      '<nav class="toc-panel" aria-label="Table of contents">' +
        '<h2 class="panel-heading">Contents</h2>' +
        '<ul class="toc-list">' +
        headings
          .map(function (heading) {
            return (
              '<li class="toc-item toc-level-' +
              heading.level +
              '">' +
              '<a class="toc-link" href="#' +
              escapeHtml(heading.id) +
              '" data-target="' +
              escapeHtml(heading.id) +
              '">' +
              escapeHtml(heading.text) +
              '</a>' +
              '</li>'
            );
          })
          .join('') +
        '</ul>' +
        '</nav>'
    );

    state.tocHeadings = headings;
    state.tocLinks = $$('#panel-content .toc-link');
    updateTOC();
  }

  function updateTOC() {
    if (!state.tocHeadings.length) {
      return;
    }

    let activeIndex = -1;
    state.tocHeadings.forEach(function (heading, index) {
      const element = document.getElementById(heading.id);
      if (element && element.getBoundingClientRect().top <= 110) {
        activeIndex = index;
      }
    });

    const nearBottom =
      window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
    if (nearBottom) {
      activeIndex = state.tocHeadings.length - 1;
    }

    state.tocLinks.forEach(function (link, index) {
      link.classList.toggle('active', index === activeIndex);
    });
  }

  /* ------------------------------------------------------------
     Router
     ------------------------------------------------------------ */

  function getRoute() {
    const hash = global.location.hash || '';
    if (!hash || hash === '#' || hash === '#/') {
      return { type: 'page', id: 'home' };
    }

    const path = hash.replace(/^#\/?/, '').replace(/\/+$/, '');
    const parts = path.split('/').filter(Boolean);

    if (parts[0] === 'posts' && parts[1]) {
      return { type: 'post', slug: decodeURIComponent(parts[1]) };
    }
    if (parts.length === 1) {
      return { type: 'page', id: parts[0] };
    }
    return { type: 'notfound' };
  }

  async function route() {
    const current = getRoute();
    const token = ++state.routeToken;
    state.currentRoute = current;

    closeSidebar();
    closeSearch();
    showLoading();

    try {
      if (current.type === 'post') {
        await renderPostRoute(current.slug, token);
      } else if (current.type === 'page') {
        await renderPageRoute(current.id, token);
      } else {
        showNotFound();
      }
    } catch (error) {
      if (token === state.routeToken) {
        showError(error);
      }
    }

    if (token !== state.routeToken) {
      return;
    }

    global.scrollTo({ top: 0, behavior: 'auto' });
    updateScrollUI();
  }

  /* ------------------------------------------------------------
     Search
     ------------------------------------------------------------ */

  async function buildSearchIndex() {
    const pageEntries = await Promise.all(
      (state.config.nav || []).map(async function (nav) {
        try {
          const page = await loadPage(nav.file);
          const bodyText = SiteUtils.plainText(SiteUtils.renderMarkdown(page.body || ''));
          const bioText = page.data && page.data.bio
            ? SiteUtils.plainText(SiteUtils.renderMarkdown(page.data.bio))
            : '';
          return {
            type: 'Page',
            title: (page.data && page.data.title) || nav.label,
            url: nav.id === 'home' ? '#/' : '#/' + nav.id + '/',
            text: (bioText + ' ' + bodyText).replace(/\s+/g, ' ').trim()
          };
        } catch (error) {
          console.warn('Search index: could not load', nav.file, error);
          return null;
        }
      })
    );

    const entries = pageEntries.filter(Boolean);
    if (window.Blog) {
      entries.push.apply(entries, window.Blog.getSearchEntries());
    }

    state.searchIndex = entries;
  }

  function highlightTerms(text, terms) {
    let output = escapeHtml(text);
    terms.forEach(function (term) {
      if (!term) {
        return;
      }
      const safe = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      output = output.replace(new RegExp('(' + safe + ')', 'ig'), '<mark>$1</mark>');
    });
    return output;
  }

  function searchSnippet(entry, terms) {
    const text = entry.text || '';
    const lower = text.toLowerCase();
    let index = -1;

    terms.forEach(function (term) {
      const found = lower.indexOf(term);
      if (found >= 0 && (index < 0 || found < index)) {
        index = found;
      }
    });

    if (index < 0) {
      index = 0;
    }

    const start = Math.max(0, index - 70);
    let snippet = text.slice(start, start + 190);
    if (start > 0) {
      snippet = '…' + snippet;
    }
    if (start + 190 < text.length) {
      snippet += '…';
    }
    return snippet;
  }

  function runSearch(query) {
    const resultsContainer = $('#search-results');
    const terms = String(query || '')
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (!state.searchIndex.length) {
      resultsContainer.innerHTML =
        '<p class="search-hint">The search index is still loading. Try again in a moment.</p>';
      return;
    }

    if (!terms.length) {
      resultsContainer.innerHTML =
        '<p class="search-hint">Search ' +
        state.searchIndex.length +
        ' pages and posts. Start typing to filter.</p>';
      return;
    }

    const matches = state.searchIndex
      .map(function (entry) {
        const title = entry.title.toLowerCase();
        const text = (entry.text || '').toLowerCase();
        let score = 0;

        terms.forEach(function (term) {
          if (title.indexOf(term) >= 0) {
            score += 6;
          }
          if (text.indexOf(term) >= 0) {
            score += 2;
          }
        });

        return { entry: entry, score: score };
      })
      .filter(function (item) {
        return item.score > 0;
      })
      .sort(function (a, b) {
        return b.score - a.score;
      })
      .slice(0, 18);

    if (!matches.length) {
      resultsContainer.innerHTML =
        '<p class="search-hint">No results for “' + escapeHtml(query) + '”.</p>';
      return;
    }

    resultsContainer.innerHTML = matches
      .map(function (item) {
        const entry = item.entry;
        return (
          '<a class="search-result" href="' +
          escapeHtml(entry.url) +
          '">' +
          '<span class="search-result__type">' +
          escapeHtml(entry.type) +
          '</span>' +
          '<span class="search-result__title">' +
          highlightTerms(entry.title, terms) +
          '</span>' +
          '<span class="search-result__snippet">' +
          highlightTerms(searchSnippet(entry, terms), terms) +
          '</span>' +
          '</a>'
        );
      })
      .join('');
  }

  function openSearch() {
    closeSidebar();
    const panel = $('#search-panel');
    panel.hidden = false;
    document.body.classList.add('search-open');
    $('#search-trigger').setAttribute('aria-expanded', 'true');
    runSearch('');
    window.setTimeout(function () {
      $('#search-input').focus();
    }, 30);
  }

  function closeSearch() {
    const panel = $('#search-panel');
    if (!panel || panel.hidden) {
      return;
    }
    panel.hidden = true;
    document.body.classList.remove('search-open');
    $('#search-trigger').setAttribute('aria-expanded', 'false');
    $('#search-input').value = '';
    $('#search-results').innerHTML = '';
  }

  /* ------------------------------------------------------------
     Sidebar and theme
     ------------------------------------------------------------ */

  function openSidebar() {
    closeSearch();
    document.body.classList.add('sidebar-open');
    $('#mask').hidden = false;
    $('#sidebar-trigger').setAttribute('aria-expanded', 'true');
  }

  function closeSidebar() {
    if (!document.body.classList.contains('sidebar-open')) {
      return;
    }
    document.body.classList.remove('sidebar-open');
    $('#mask').hidden = true;
    $('#sidebar-trigger').setAttribute('aria-expanded', 'false');
  }

  function getStoredMode() {
    try {
      return global.localStorage.getItem('theme') || 'system';
    } catch (error) {
      return 'system';
    }
  }

  function initTheme() {
    const root = document.documentElement;
    const modes = ['light', 'dark', 'system'];

    function applyMode(mode, persist) {
      if (modes.indexOf(mode) < 0) {
        mode = 'system';
      }

      const prefersDark = global.matchMedia('(prefers-color-scheme: dark)').matches;
      const isDark = mode === 'dark' || (mode === 'system' && prefersDark);

      root.setAttribute('data-mode', mode);
      root.setAttribute('data-theme', isDark ? 'dark' : 'light');

      if (persist) {
        try {
          global.localStorage.setItem('theme', mode);
        } catch (error) {
          /* ignore unavailable storage */
        }
      }

      $$('#mode-menu-list [data-mode]').forEach(function (button) {
        const isActive = button.dataset.mode === mode;
        button.classList.toggle('active', isActive);
        button.setAttribute('aria-pressed', String(isActive));
      });
    }

    applyMode(root.getAttribute('data-mode') || getStoredMode(), false);

    $('#mode-toggle').addEventListener('click', function (event) {
      event.stopPropagation();
      const menu = $('#mode-menu-list');
      const willOpen = menu.hidden;
      menu.hidden = !willOpen;
      $('#mode-toggle').setAttribute('aria-expanded', String(willOpen));
    });

    $$('#mode-menu-list [data-mode]').forEach(function (button) {
      button.addEventListener('click', function () {
        applyMode(button.dataset.mode, true);
        $('#mode-menu-list').hidden = true;
        $('#mode-toggle').setAttribute('aria-expanded', 'false');
      });
    });

    const media = global.matchMedia('(prefers-color-scheme: dark)');
    const onMediaChange = function () {
      if ((root.getAttribute('data-mode') || 'system') === 'system') {
        applyMode('system', false);
      }
    };

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', onMediaChange);
    } else if (typeof media.addListener === 'function') {
      media.addListener(onMediaChange);
    }
  }

  /* ------------------------------------------------------------
     Image viewer
     ------------------------------------------------------------ */

  function ensureImageViewer() {
    let viewer = $('#image-viewer');
    if (viewer) {
      return viewer;
    }

    viewer = document.createElement('div');
    viewer.id = 'image-viewer';
    viewer.className = 'image-viewer';
    viewer.hidden = true;
    viewer.innerHTML =
      '<button type="button" class="image-viewer__close" aria-label="Close image"><i class="fas fa-xmark"></i></button>' +
      '<img alt="">';
    document.body.appendChild(viewer);
    return viewer;
  }

  function openImageViewer(src, alt) {
    const viewer = ensureImageViewer();
    const image = viewer.querySelector('img');
    image.src = src;
    image.alt = alt || '';
    viewer.hidden = false;
    document.body.classList.add('viewer-open');
  }

  function closeImageViewer() {
    const viewer = $('#image-viewer');
    if (!viewer || viewer.hidden) {
      return;
    }
    viewer.hidden = true;
    document.body.classList.remove('viewer-open');
    viewer.querySelector('img').src = '';
  }

  /* ------------------------------------------------------------
     UI events and scrolling
     ------------------------------------------------------------ */

  function updateScrollUI() {
    const y = global.scrollY || global.pageYOffset;
    $('#back-to-top').classList.toggle('visible', y > 260);
    document.body.classList.toggle('scrolled', y > 4);
    updateTOC();
  }

  function bindUI() {
    $('#sidebar-trigger').addEventListener('click', function () {
      if (document.body.classList.contains('sidebar-open')) {
        closeSidebar();
      } else {
        openSidebar();
      }
    });

    $('#mask').addEventListener('click', closeSidebar);

    $('#nav-list').addEventListener('click', function (event) {
      if (event.target.closest('a.nav-link')) {
        closeSidebar();
      }
    });

    $('#search-trigger').addEventListener('click', function () {
      if ($('#search-panel').hidden) {
        openSearch();
      } else {
        closeSearch();
      }
    });

    $('#search-cancel').addEventListener('click', closeSearch);

    $('#search-input').addEventListener('input', function (event) {
      runSearch(event.target.value);
    });

    $('#back-to-top').addEventListener('click', function () {
      global.scrollTo({ top: 0, behavior: 'smooth' });
    });

    document.addEventListener('click', function (event) {
      const image = event.target.closest('#page-content img.zoomable');
      if (image) {
        openImageViewer(image.src, image.alt);
        return;
      }

      const viewer = event.target.closest('#image-viewer');
      if (viewer) {
        const closeButton = event.target.closest('.image-viewer__close');
        const targetImage = event.target.closest('img');
        if (closeButton || !targetImage) {
          closeImageViewer();
        }
        return;
      }

      const tocLink = event.target.closest('a.toc-link');
      if (tocLink) {
        event.preventDefault();
        const target = document.getElementById(tocLink.dataset.target);
        if (target) {
          const top = target.getBoundingClientRect().top + global.scrollY - 84;
          global.scrollTo({ top: top, behavior: 'smooth' });
        }
        return;
      }

      const searchResult = event.target.closest('#search-results a.search-result');
      if (searchResult) {
        const href = searchResult.getAttribute('href');
        closeSearch();
        if (global.location.hash === href) {
          route();
        }
        return;
      }

      if (!event.target.closest('.mode-menu')) {
        $('#mode-menu-list').hidden = true;
        $('#mode-toggle').setAttribute('aria-expanded', 'false');
      }
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        closeSearch();
        closeSidebar();
        closeImageViewer();
        $('#mode-menu-list').hidden = true;
      }

      const tag = (event.target.tagName || '').toLowerCase();
      const typing =
        tag === 'input' || tag === 'textarea' || tag === 'select' || event.target.isContentEditable;

      if (event.key === '/' && !typing) {
        event.preventDefault();
        openSearch();
      }
    });

    let ticking = false;
    global.addEventListener(
      'scroll',
      function () {
        if (ticking) {
          return;
        }
        ticking = true;
        global.requestAnimationFrame(function () {
          updateScrollUI();
          ticking = false;
        });
      },
      { passive: true }
    );

    global.addEventListener('resize', closeSidebar);
  }

  /* ------------------------------------------------------------
     Boot
     ------------------------------------------------------------ */

  async function init() {
    initTheme();
    bindUI();
    updateScrollUI();

    try {
      state.config = await loadConfig();
      applyConfig();
    } catch (error) {
      showError(error);
      $('#footer-left').innerHTML =
        '© ' + new Date().getFullYear() + ' ' + escapeHtml('Yicen Liu');
      return;
    }

    try {
      await window.Blog.init();
    } catch (error) {
      console.error('Posts could not be loaded:', error);
    }

    global.addEventListener('hashchange', route);
    await route();
    buildSearchIndex();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);

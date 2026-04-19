/**
 * Lawsnote 判決大綱導航 v1.1.0
 * 在判決頁面左側顯示可展開的結構大綱，點擊跳轉到對應段落
 *
 * 適配：lawsnote.com / atlas.lawsnote.com 的判決頁面
 * 判決內文容器：div.document__judgement-content
 * 內文結構：<div data-para="0"> 內的 <span> 元素，用 \n 分行
 */

(function () {
  'use strict';

  // ── 常數 ──────────────────────────────────────────────
  const SIDEBAR_ID = 'lno-outline-sidebar';
  const CONTAINER_SEL = '.document__judgement-content';
  const HIGHLIGHT_CLASS = 'lno-text-highlight';

  // 階層定義（由高到低）
  const HIERARCHY = [
    { level: 0, label: '段落標題', pattern: /^[　\s]*(主\s*文|事\s*實\s*及?\s*理\s*由|事\s*實|理\s*由|據上論結|附\s*[表錄件])/  },
    { level: 1, label: '壹貳參',   pattern: /^[　\s]*(壹|貳|參|肆|伍|陸|柒|捌|玖|拾|拾壹|拾貳|拾參|拾肆|拾伍)[、\s.:：]/  },
    { level: 2, label: '一二三',   pattern: /^[　\s]*(一|二|三|四|五|六|七|八|九|十|十一|十二|十三|十四|十五|十六|十七|十八|十九|二十|二十一|二十二|二十三|二十四|二十五)[、\s.:：]/  },
    { level: 3, label: '㈠㈡㈢',   pattern: /^[　\s]*[㈠㈡㈢㈣㈤㈥㈦㈧㈨㈩]/  },
    { level: 4, label: '⒈⒉⒊',    pattern: /^[　\s]*[⒈⒉⒊⒋⒌⒍⒎⒏⒐⒑⒒⒓⒔⒕⒖⒗⒘⒙⒚⒛]/  },
    { level: 4, label: '1.2.3.',   pattern: /^[　\s]*(\d{1,2})[.\s.:：、]/  },
    { level: 5, label: '⑴⑵⑶',    pattern: /^[　\s]*[⑴⑵⑶⑷⑸⑹⑺⑻⑼⑽⑾⑿⒀⒁⒂⒃⒄⒅⒆⒇]/  },
    { level: 5, label: '(1)(2)',   pattern: /^[　\s]*\((\d{1,2})\)/  },
    { level: 6, label: '①②③',    pattern: /^[　\s]*[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]/  },
  ];

  // ── 主流程 ────────────────────────────────────────────

  let initialized = false;

  function init() {
    const container = document.querySelector(CONTAINER_SEL);
    if (!container || container.textContent.trim().length < 50) return;
    if (document.getElementById(SIDEBAR_ID)) return;
    if (initialized) return;
    initialized = true;

    const headings = parseHeadings(container);
    if (headings.length === 0) return;

    // 為每個 heading 標記對應的文字節點和位置
    mapHeadingsToDOM(container, headings);
    renderSidebar(headings);
  }

  // ── 解析判決結構 ──────────────────────────────────────

  function parseHeadings(container) {
    const text = container.textContent;
    const lines = text.split('\n');
    const headings = [];
    let charOffset = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.replace(/^[　\s]+/, '');
      if (trimmed.length === 0) {
        charOffset += line.length + 1;
        continue;
      }

      for (const h of HIERARCHY) {
        const m = h.pattern.exec(line);
        if (m) {
          let title = trimmed.substring(0, 40).replace(/\s+/g, ' ');
          if (trimmed.length > 40) title += '…';

          headings.push({
            level: h.level,
            title: title,
            charOffset: charOffset,
            lineIndex: i,
            // 以下會在 mapHeadingsToDOM 填入
            targetNode: null,
            targetOffset: 0,
          });
          break;
        }
      }

      charOffset += line.length + 1;
    }

    return headings;
  }

  // ── 將 heading 映射到 DOM 文字節點 ───────────────────

  function mapHeadingsToDOM(container, headings) {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    const segments = [];
    let pos = 0;

    while (walker.nextNode()) {
      const node = walker.currentNode;
      const len = node.textContent.length;
      segments.push({ node, start: pos, end: pos + len });
      pos += len;
    }

    for (const h of headings) {
      const target = h.charOffset;
      const seg = segments.find(s => s.start <= target && target < s.end);
      if (seg) {
        h.targetNode = seg.node;
        h.targetOffset = target - seg.start;
      }
    }
  }

  // ── 跳轉到指定的 heading ──────────────────────────────

  function scrollToHeading(heading) {
    if (!heading.targetNode) return;

    const node = heading.targetNode;
    // 找到包含這個文字節點的最近元素
    const parentEl = node.parentElement;
    if (!parentEl) return;

    // 方法1：嘗試用 Range 精確定位
    try {
      const range = document.createRange();
      range.setStart(node, Math.min(heading.targetOffset, node.textContent.length));
      range.setEnd(node, Math.min(heading.targetOffset + 1, node.textContent.length));

      const rect = range.getBoundingClientRect();
      if (rect.height > 0) {
        // Range 有效，用它來精準滾動
        const scrollTarget = rect.top + window.scrollY - 80;

        // 嘗試找到 Lawsnote 的滾動容器
        const scrollContainer = findScrollContainer();
        if (scrollContainer && scrollContainer !== document.documentElement) {
          const containerRect = scrollContainer.getBoundingClientRect();
          const scrollOffset = rect.top - containerRect.top - 80;
          scrollContainer.scrollBy({ top: scrollOffset, behavior: 'smooth' });
        } else {
          window.scrollTo({ top: scrollTarget, behavior: 'smooth' });
        }

        highlightRange(range, parentEl);
        return;
      }
    } catch (e) {
      // Range 失敗，使用 fallback
    }

    // 方法2：fallback 用 scrollIntoView
    parentEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    highlightElement(parentEl);
  }

  // 找到 Lawsnote 的主滾動容器
  function findScrollContainer() {
    // 常見的 Lawsnote 滾動容器候選
    const candidates = [
      '.judgement__container',
      '.document__content-container',
      '.main-section',
      '.fullHeight',
    ];

    for (const sel of candidates) {
      const el = document.querySelector(sel);
      if (el) {
        const style = getComputedStyle(el);
        const overflow = style.overflow + style.overflowY;
        if (/(auto|scroll)/.test(overflow) && el.scrollHeight > el.clientHeight) {
          return el;
        }
      }
    }

    // 往上爬找任何可滾動的祖先
    const content = document.querySelector(CONTAINER_SEL);
    if (content) {
      let parent = content.parentElement;
      while (parent && parent !== document.body) {
        const style = getComputedStyle(parent);
        const overflow = style.overflow + style.overflowY;
        if (/(auto|scroll)/.test(overflow) && parent.scrollHeight > parent.clientHeight) {
          return parent;
        }
        parent = parent.parentElement;
      }
    }

    return document.documentElement;
  }

  // 高亮 Range 附近的文字
  function highlightRange(range, fallbackEl) {
    removeHighlights();

    try {
      // 擴展 Range 到整行（往後抓到換行為止，最多50字）
      const startNode = range.startContainer;
      const startOffset = range.startOffset;
      const text = startNode.textContent;
      let endOffset = text.indexOf('\n', startOffset);
      if (endOffset === -1 || endOffset - startOffset > 50) {
        endOffset = Math.min(startOffset + 50, text.length);
      }

      const highlightRange = document.createRange();
      highlightRange.setStart(startNode, startOffset);
      highlightRange.setEnd(startNode, endOffset);

      const highlight = document.createElement('mark');
      highlight.className = HIGHLIGHT_CLASS;
      highlightRange.surroundContents(highlight);

      setTimeout(() => {
        highlight.classList.add('lno-fade-out');
        setTimeout(() => {
          // 把文字放回去，移除 mark
          const parent = highlight.parentNode;
          if (parent) {
            while (highlight.firstChild) {
              parent.insertBefore(highlight.firstChild, highlight);
            }
            parent.removeChild(highlight);
            parent.normalize(); // 合併相鄰文字節點
          }
        }, 2500);
      }, 500);

    } catch (e) {
      // surroundContents 可能跨元素失敗，用 fallback
      highlightElement(fallbackEl);
    }
  }

  // 高亮整個元素（fallback）
  function highlightElement(el) {
    removeHighlights();
    el.classList.add(HIGHLIGHT_CLASS);
    setTimeout(() => {
      el.classList.add('lno-fade-out');
      setTimeout(() => {
        el.classList.remove(HIGHLIGHT_CLASS, 'lno-fade-out');
      }, 2500);
    }, 500);
  }

  // 移除所有現有高亮
  function removeHighlights() {
    document.querySelectorAll('.' + HIGHLIGHT_CLASS).forEach(el => {
      if (el.tagName === 'MARK') {
        const parent = el.parentNode;
        if (parent) {
          while (el.firstChild) parent.insertBefore(el.firstChild, el);
          parent.removeChild(el);
          parent.normalize();
        }
      } else {
        el.classList.remove(HIGHLIGHT_CLASS, 'lno-fade-out');
      }
    });
  }

  // ── 渲染側邊欄 ────────────────────────────────────────

  function renderSidebar(headings) {
    const maxLevel = Math.max(...headings.map(h => h.level));
    const cardWidth = Math.min(420, 280 + maxLevel * 20);

    const sidebar = document.createElement('div');
    sidebar.id = SIDEBAR_ID;

    // Tab 觸發區
    const tab = document.createElement('div');
    tab.className = 'lno-sidebar-tab';
    tab.textContent = '大綱';
    sidebar.appendChild(tab);

    // 卡片區
    const card = document.createElement('div');
    card.className = 'lno-sidebar-card';
    card.style.width = cardWidth + 'px';

    // 標題列
    const header = document.createElement('div');
    header.className = 'lno-sidebar-header';
    header.innerHTML = '<span class="lno-sidebar-title">判決結構</span>';

    // 全部展開/收合按鈕
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'lno-toggle-btn';
    toggleBtn.textContent = '全部展開';
    toggleBtn.title = '展開/收合所有子項目';
    let allExpanded = false;
    toggleBtn.addEventListener('click', () => {
      allExpanded = !allExpanded;
      toggleBtn.textContent = allExpanded ? '全部收合' : '全部展開';
      card.querySelectorAll('.lno-item-children').forEach(el => {
        el.style.display = allExpanded ? 'block' : 'none';
      });
      card.querySelectorAll('.lno-expand-icon').forEach(el => {
        if (el.dataset.hasChildren === 'true') {
          el.textContent = allExpanded ? '▾' : '▸';
        }
      });
    });
    header.appendChild(toggleBtn);
    card.appendChild(header);

    // 大綱列表
    const list = document.createElement('div');
    list.className = 'lno-sidebar-list';

    const tree = buildTree(headings);
    renderTree(tree, list, 0, headings);

    card.appendChild(list);
    sidebar.appendChild(card);
    document.body.appendChild(sidebar);

    // 滑鼠互動
    let hideTimer = null;
    const show = () => {
      clearTimeout(hideTimer);
      sidebar.classList.add('lno-open');
    };
    const hide = () => {
      hideTimer = setTimeout(() => sidebar.classList.remove('lno-open'), 300);
    };

    tab.addEventListener('mouseenter', show);
    card.addEventListener('mouseenter', show);
    sidebar.addEventListener('mouseleave', hide);

    tab.addEventListener('click', (e) => {
      e.stopPropagation();
      if (sidebar.classList.contains('lno-open')) {
        sidebar.classList.remove('lno-open');
      } else {
        show();
      }
    });
  }

  // 將扁平 headings 轉成樹狀結構
  function buildTree(headings) {
    const root = [];
    const stack = [{ level: -1, children: root }];

    for (let i = 0; i < headings.length; i++) {
      const h = headings[i];
      const node = { ...h, index: i, children: [] };

      while (stack.length > 1 && stack[stack.length - 1].level >= h.level) {
        stack.pop();
      }

      stack[stack.length - 1].children.push(node);
      stack.push(node);
    }

    return root;
  }

  // 遞迴渲染樹狀結構
  function renderTree(nodes, parent, depth, headings) {
    nodes.forEach(node => {
      const item = document.createElement('div');
      item.className = 'lno-item';
      item.style.paddingLeft = (8 + depth * 14) + 'px';

      const expandIcon = document.createElement('span');
      expandIcon.className = 'lno-expand-icon';
      if (node.children.length > 0) {
        expandIcon.textContent = '▸';
        expandIcon.style.cursor = 'pointer';
        expandIcon.dataset.hasChildren = 'true';
      } else {
        expandIcon.textContent = ' ';
        expandIcon.dataset.hasChildren = 'false';
      }

      const titleSpan = document.createElement('span');
      titleSpan.className = 'lno-item-title';
      titleSpan.textContent = node.title;
      titleSpan.title = node.title;

      const levelColors = ['#e74c3c', '#e67e22', '#2980b9', '#27ae60', '#8e44ad', '#16a085', '#7f8c8d'];
      const dot = document.createElement('span');
      dot.className = 'lno-level-dot';
      dot.style.backgroundColor = levelColors[node.level] || '#999';

      item.appendChild(expandIcon);
      item.appendChild(dot);
      item.appendChild(titleSpan);

      // 點擊標題 → 跳轉
      titleSpan.addEventListener('click', (e) => {
        e.stopPropagation();
        scrollToHeading(headings[node.index]);
      });

      // 點擊展開圖示 → 切換子項目
      if (node.children.length > 0) {
        expandIcon.addEventListener('click', (e) => {
          e.stopPropagation();
          const childContainer = item.nextElementSibling;
          if (childContainer && childContainer.classList.contains('lno-item-children')) {
            const isHidden = childContainer.style.display === 'none';
            childContainer.style.display = isHidden ? 'block' : 'none';
            expandIcon.textContent = isHidden ? '▾' : '▸';
          }
        });
      }

      parent.appendChild(item);

      if (node.children.length > 0) {
        const childContainer = document.createElement('div');
        childContainer.className = 'lno-item-children';
        childContainer.style.display = depth < 2 ? 'block' : 'none';
        expandIcon.textContent = depth < 2 ? '▾' : '▸';

        renderTree(node.children, childContainer, depth + 1, headings);
        parent.appendChild(childContainer);
      }
    });
  }

  // ── SPA 導航監聽 ──────────────────────────────────────

  let lastUrl = location.href;

  function watchNavigation() {
    const origPush = history.pushState;
    const origReplace = history.replaceState;

    history.pushState = function () {
      origPush.apply(this, arguments);
      onUrlChange();
    };
    history.replaceState = function () {
      origReplace.apply(this, arguments);
      onUrlChange();
    };
    window.addEventListener('popstate', onUrlChange);
  }

  function onUrlChange() {
    const newUrl = location.href;
    if (newUrl === lastUrl) return;
    lastUrl = newUrl;

    cleanup();
    initialized = false;

    if (/\/judgement\//.test(location.pathname)) {
      waitForContent();
    }
  }

  function cleanup() {
    const sidebar = document.getElementById(SIDEBAR_ID);
    if (sidebar) sidebar.remove();
    removeHighlights();
  }

  function waitForContent() {
    let attempts = 0;
    const maxAttempts = 30;

    const check = () => {
      attempts++;
      const container = document.querySelector(CONTAINER_SEL);
      if (container && container.textContent.trim().length > 50) {
        init();
        return;
      }
      if (attempts < maxAttempts) {
        setTimeout(check, 500);
      }
    };

    check();
  }

  // ── 啟動 ─────────────────────────────────────────────

  if (/\/judgement\//.test(location.pathname)) {
    watchNavigation();
    waitForContent();
  }

})();

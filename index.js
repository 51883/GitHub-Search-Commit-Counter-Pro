// ==UserScript==
// @name         GitHub Search Commit Counter & Leaderboard
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  精确注入 Commit 数，并在侧边栏生成可跳转的 Commit 排行榜
// @author       You
// @match        https://github.com/search*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // ⚠️ 请填入你的 Token
    const GITHUB_TOKEN = 'YOUR_NEW_TOKEN_HERE';

    // 全局状态管理
    const stats = { success: 0, error: 0, empty: 0, remaining: '...', resetTime: '...' };
    const leaderboardData = new Map(); // 使用 Map 避免重复数据存入
    let currentUrl = location.href;

    // 获取 Commit 数 (包含 409 空仓库处理)
    async function getCommitCount(owner, repo) {
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=1`, {
            headers: {
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        const limitRemaining = response.headers.get('x-ratelimit-remaining');
        if (limitRemaining) stats.remaining = limitRemaining;

        if (response.status === 409) return 0; 
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const linkHeader = response.headers.get('Link');
        if (linkHeader) {
            const match = linkHeader.match(/page=(\d+)>; rel="last"/);
            if (match) return parseInt(match[1], 10);
        }
        
        const data = await response.json();
        return data.length;
    }

    // 渲染或更新排行榜面板
    function updateLeaderboardUI() {
        // 兼容精确类名及未来可能变化的 hash 后缀
        const sidebar = document.querySelector('.Search-module__rightSidebar__S4cSw') 
                     || document.querySelector('[class^="Search-module__rightSidebar"]')
                     || document.querySelector('[data-testid="sidebar"]');
        if (!sidebar) return;

        let board = document.getElementById('commit-leaderboard-panel');
        if (!board) {
            board = document.createElement('div');
            board.id = 'commit-leaderboard-panel';
            // 采用 GitHub 原生侧边栏卡片样式
            board.style.cssText = "margin-bottom: 24px; border: 1px solid #d0d7de; border-radius: 6px; overflow: hidden; background: #fff;";
            sidebar.insertBefore(board, sidebar.firstChild);
        }

        // 将 Map 转为数组并按 Commit 数量降序排列
        const sorted = Array.from(leaderboardData.values()).sort((a, b) => b.count - a.count);

        // 构建排行榜 HTML
        let html = `
            <div style="padding: 12px 16px; background-color: #f6f8fa; border-bottom: 1px solid #d0d7de; font-weight: 600; font-size: 14px; color: #24292f;">
                🏆 本页 Commit 排行榜
            </div>
            <ul style="list-style: none; padding: 0; margin: 0; max-height: 500px; overflow-y: auto;">
        `;

        sorted.forEach((item, index) => {
            // 前三名加粗且给个特殊颜色
            const rankColor = index === 0 ? '#cf222e' : (index === 1 ? '#db6d28' : (index === 2 ? '#9a6700' : '#57606a'));
            // 提取仓库短名称（不带 owner）方便单行显示
            const shortName = item.name.split('/')[1];

            html += `
                <li data-repo="${item.name}" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 16px; border-bottom: 1px solid #ebf0f4; cursor: pointer; font-size: 12px; transition: background 0.2s;" onmouseover="this.style.backgroundColor='#f3f4f6'" onmouseout="this.style.backgroundColor='transparent'">
                    <div style="display: flex; align-items: center; overflow: hidden; white-space: nowrap;">
                        <span style="color: ${rankColor}; font-weight: 600; width: 20px; flex-shrink: 0;">${index + 1}.</span>
                        <span style="color: #0969da; font-weight: 500; text-overflow: ellipsis; overflow: hidden; max-width: 110px;" title="${item.name}">${shortName}</span>
                    </div>
                    <div style="display: flex; align-items: center; flex-shrink: 0; gap: 8px;">
                        <span style="color: #57606a; font-size: 11px;">${item.lang}</span>
                        <span style="font-weight: 600; color: #24292f; min-width: 35px; text-align: right;">${item.count > 0 ? item.count.toLocaleString() : 'Empty'}</span>
                    </div>
                </li>
            `;
        });

        html += `</ul>`;
        board.innerHTML = html;

        // 绑定点击跳转与高亮事件
        board.querySelectorAll('li').forEach(li => {
            li.addEventListener('click', () => {
                const repoName = li.getAttribute('data-repo');
                const targetNode = leaderboardData.get(repoName).node;
                if (targetNode) {
                    // 平滑滚动到卡片居中位置
                    targetNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    // 卡片背景闪烁高亮，提示用户
                    const originalBg = targetNode.style.backgroundColor;
                    targetNode.style.transition = "background-color 0.4s ease";
                    targetNode.style.backgroundColor = "#ddf4ff"; // GitHub 蓝色高亮
                    setTimeout(() => { targetNode.style.backgroundColor = originalBg; }, 1200);
                }
            });
        });
    }

    // 主业务逻辑
    function injectCommitCounts() {
        const repoLinks = document.querySelectorAll('.search-title a[href^="/"]:not([data-commit-checked])');
        if (repoLinks.length === 0) return;

        repoLinks.forEach(link => {
            const href = link.getAttribute('href');
            if (href.startsWith('/topics/') || href.startsWith('/search')) {
                link.setAttribute('data-commit-checked', 'ignored');
                return;
            }

            const match = href.match(/^\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)$/);
            if (match) {
                link.setAttribute('data-commit-checked', 'true');
                const owner = match[1];
                const repo = match[2];
                const fullName = `${owner}/${repo}`;

                // 提取整张卡片的顶级 DOM 节点，用于后续锚点跳转
                const cardNode = link.closest('[class^="Result-module__Result"]') || link.closest('div');
                
                // 提取开发语言 (从 aria-label 中提取，例如 "Java language" -> "Java")
                let lang = 'N/A';
                if (cardNode) {
                    const langNode = cardNode.querySelector('[aria-label$=" language"]');
                    if (langNode) {
                        lang = langNode.getAttribute('aria-label').replace(' language', '');
                    }
                }

                // 插入加载状态徽章
                const badge = document.createElement('span');
                badge.style.cssText = "margin-left: 12px; font-size: 12px; color: #57606a; border: 1px solid #d0d7de; border-radius: 2em; padding: 2px 8px; display: inline-flex; align-items: center; vertical-align: middle;";
                badge.innerHTML = '<i>⏳</i>&nbsp;...';
                link.parentNode.insertBefore(badge, link.nextSibling);

                // 发起请求
                getCommitCount(owner, repo)
                    .then(count => {
                        if (count === 0) {
                            badge.innerHTML = `<strong>0</strong>&nbsp;Commits (Empty)`;
                            badge.style.color = '#8c959f';
                            stats.empty++;
                        } else {
                            badge.innerHTML = `<strong>${count.toLocaleString()}</strong>&nbsp;Commits`;
                            stats.success++;
                        }
                        
                        // 将成功获取的数据写入 Map 仓库，并触发重新渲染排行榜
                        leaderboardData.set(fullName, { name: fullName, count: count, lang: lang, node: cardNode });
                        updateLeaderboardUI();
                    })
                    .catch((err) => {
                        badge.style.color = '#cf222e';
                        badge.style.borderColor = '#ff8182';
                        badge.textContent = 'API Error';
                        stats.error++;
                    });
            }
        });
    }

    // 监听 DOM 变化
    let timeoutId;
    const observer = new MutationObserver(() => {
        // SPA 页面路由改变拦截（翻页、重新搜索）清空上一页的旧数据
        if (location.href !== currentUrl) {
            currentUrl = location.href;
            leaderboardData.clear(); // 清空排行榜数据源
            const existingBoard = document.getElementById('commit-leaderboard-panel');
            if (existingBoard) existingBoard.remove(); // 清除旧面板
        }

        clearTimeout(timeoutId);
        timeoutId = setTimeout(injectCommitCounts, 600);
    });

    observer.observe(document.body, { childList: true, subtree: true });

})();

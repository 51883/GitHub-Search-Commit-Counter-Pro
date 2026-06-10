# GitHub Search Commit Counter Pro 🚀

[![Tampermonkey](https://img.shields.io/badge/Tampermonkey-Ready-success.svg)](https://www.tampermonkey.net/)
[![GitHub API](https://img.shields.io/badge/GitHub_API-v3-blue.svg)](https://docs.github.com/en/rest)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Seamlessly inject the total commit count for each repository directly into GitHub search results, and generate a dynamic **Commit Leaderboard** in the sidebar. Built for developers who need to quickly assess the activity, maturity, and scale of open-source projects.

## ✨ Core Features

* **⚡ Zero-Overhead Fetching**: Utilizes the `Link` Pagination Headers from the GitHub API to precisely extract the total number of commits. Requires only **1 network request** per repository, completely avoiding heavy payload data pulling.
* **🏆 Dynamic Leaderboard**: Automatically generates a commit leaderboard for the current search results page in the sidebar, highlighting the top 3 most active projects at a glance.
* **🎯 Anchor Jump Experience**: Click on any project in the leaderboard to trigger a smooth scroll to its repository card, complete with a brief, native-feeling visual highlight.
* **🔄 SPA Routing Compatibility**: Uses `MutationObserver` to monitor DOM changes, perfectly adapting to GitHub's Single Page Application (SPA) architecture for seamless pagination and re-searching.
* **🛡️ Robust Error Handling**:
    * Intelligently intercepts `409 Conflict` status codes, natively supporting uninitialized empty repositories (0 Commits) without throwing console errors.
    * Built-in API Rate Limit monitor that outputs precise quota consumption and reset times in the browser console.

## 📦 Installation

1. Ensure you have a userscript manager extension installed in your browser, such as [Tampermonkey](https://www.tampermonkey.net/) or Violentmonkey.
2. Click the extension icon and select **Create a new script**.
3. Copy the source code from `script.js` in this repository and paste it into the editor.
4. **[CRITICAL]** Replace the `GITHUB_TOKEN` on line 15 with your own token (see Configuration Guide below).
5. Press `Ctrl+S` (or `Cmd+S`) to save and enable the script.

## ⚙️ Configuration Guide

Due to GitHub's strict rate limits, unauthenticated API requests will hit the cap almost immediately. This script requires your **Personal Access Token (PAT)** to unlock the authenticated tier of 5,000 requests per hour.

1. Navigate to [GitHub Developer Settings](https://github.com/settings/tokens?type=beta).
2. Click **Generate new token** -> Select **Fine-grained tokens**.
3. Set a Token name (e.g., `Search-Commit-Counter`) and configure the Expiration date.
4. Under **Repository access**, select `Public Repositories (read-only)`.
5. Under **Permissions** -> **Repository permissions**, set both `Contents` and `Metadata` to **Read-only**.
6. Click generate and carefully copy the resulting Token string.
7. Return to your Tampermonkey script editor and replace the placeholder:
   ```javascript
   const GITHUB_TOKEN = 'github_pat_xxxx_PASTE_YOUR_TOKEN_HERE_xxxx';

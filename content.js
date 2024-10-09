chrome.storage.sync.get(['apiUrl', 'websites'], function (data) {
    const apiUrl = data.apiUrl || 'http://default-api-url.com'; // 默认API地址
    const websites = data.websites || [];

    // 检查当前页面是否在用户配置的生效网站列表中
    const currentDomain = window.location.hostname;
    const isSupportedSite = websites.some(site => currentDomain.includes(site));

    if (isSupportedSite) {
        if (window.location.href.includes('torrents.php')) {
            processPage(apiUrl, 'NexusPHP');
        } else if (window.location.href.includes('forumdisplay.php')) {
            processPage(apiUrl, 'Discuz');
        } else if (window.location.href.includes('details.php')) {
            processDetail(apiUrl, 'NexusPHP');
        } else if (window.location.href.includes('viewthread.php')) {
            processDetail(apiUrl, 'Discuz');
        }
    }
});

function getSelectors(siteType) {
    if (siteType === 'NexusPHP') {
        return {
            table: 'table.torrents',
            rows: 'table.torrents > tbody > tr',
            detailLink: 'a[href*="details.php?id="]',
            statusHeader: 'td.status',
            statusCell: 'td.status > a',
        }
    } else if (siteType === 'Discuz') {
        return {
            table: 'table.datatable',
            rows: 'table.datatable > tbody',
            detailLink: 'a[href*="viewthread.php?tid="]',
            statusHeader: 'td.status',
            statusCell: 'td.status > a',
        }
    }
}


// 在 torrents 页面（种子列表页）处理
function processPage(apiUrl, siteType) {
    const selectors = getSelectors(siteType);
    const table = document.querySelector(selectors.table);
    const rows = table.querySelectorAll(selectors.rows);
    const firstRow = siteType === 'NexusPHP' ? rows[0] : table.querySelector('thead > tr');
    const uniqueIds = Array.from(rows).map(row => {
        const detailLink = row.querySelector(selectors.detailLink);
        if (detailLink) {
            const searchParams = new URL(detailLink.href).searchParams;
            const id = searchParams.get('id') || searchParams.get('tid');
            return getUniqueId(id)
        } else {
            return null;
        }
    }).filter(id => id !== null);

    fetchStatusList(apiUrl, uniqueIds)
        .then(data => {
            // 处理表头
            const statusHeader = document.createElement('td');
            statusHeader.className = 'colhead';
            statusHeader.textContent = '状态';
            firstRow.insertBefore(statusHeader, firstRow.firstChild);  // 在第一列插入状态列
            rows.forEach(row => {
                const detailLink = row.querySelector(selectors.detailLink);
                if (detailLink) {
                    if (siteType === 'Discuz') {
                        row = row.querySelector('tr');
                    }
                    const searchParams = new URL(detailLink.href).searchParams;
                    const id = searchParams.get('id') || searchParams.get('tid');
                    const uniqueId = getUniqueId(id);
                    const status = data[uniqueId];
                    const statusCell = row.insertCell(0);  // 在第一列插入新的单元格
                    statusCell.textContent = status || 'none';  // 显示状态
                    statusCell.style.color = 'white';
                    statusCell.style.textAlign = 'center';
                    // 根据状态设置不同的颜色
                    if (status === 'like') {
                        statusCell.style.backgroundColor = 'green';
                    } else if (status === 'unlike') {
                        statusCell.style.backgroundColor = 'red';
                    } else if (status === 'achieve') {
                        statusCell.style.backgroundColor = 'blue';
                    } else {
                        statusCell.style.backgroundColor = 'gray';  // 对于未知状态
                    }
                }

            });
        })

}


// 处理详情页面（详情页的按钮）
function processDetail(apiUrl) {
    const h1Element = document.querySelector('h1');
    const id = getId();
    const uniqueId = getUniqueId(id);

    if (h1Element && uniqueId) {
        const newLabel = document.createElement('div');
        newLabel.id = 'thread-status';
        newLabel.style.marginBottom = '10px';
        newLabel.style.fontSize = '16px';
        fetchStatus(apiUrl, uniqueId).then(data => {
            if (data.status) {
                setLabelContent(newLabel, data.status);
            }
        });

        // 创建按钮容器
        const customContainer = document.createElement('div');
        customContainer.style.marginTop = '10px';
        customContainer.style.marginBottom = '10px';

        // 创建三个按钮
        const likeButton = createButton('Like', 'green', () => updateStatus(apiUrl, uniqueId, 'like'));
        const unlikeButton = createButton('Unlike', 'red', () => updateStatus(apiUrl, uniqueId, 'unlike'));
        const achieveButton = createButton('Achieve', 'blue', () => updateStatus(apiUrl, uniqueId, 'achieve'));

        // 将按钮添加到页面
        customContainer.appendChild(newLabel);
        customContainer.appendChild(likeButton);
        customContainer.appendChild(unlikeButton);
        customContainer.appendChild(achieveButton);
        h1Element.insertAdjacentElement('afterend', customContainer);
    }
}

// 创建按钮的辅助函数
function createButton(text, backgroundColor, onClick) {
    const button = document.createElement('button');
    button.textContent = text;
    button.classList.add('kaleido-status-btn'); // 加入样式类
    button.style.backgroundColor = backgroundColor;
    button.style.color = 'white';
    button.style.border = 'none';
    button.style.padding = '10px';
    button.style.marginRight = '5px';
    button.style.cursor = 'pointer';
    button.addEventListener('click', onClick);
    return button;
}

function fetchStatusList(apiUrl, uniqueIds) {
    return fetch(`${apiUrl}/api/thread/page`, {
        method: 'POST', headers: {
            'Content-Type': 'application/json'
        }, body: JSON.stringify({ids: uniqueIds})
    })
        .then(response => response.json())
        .catch(err => {
            console.error("Error fetching status:", err);
        });
}

// 调用 API 获取种子的状态
function fetchStatus(apiUrl, uniqueId) {
    return fetch(`${apiUrl}/api/thread/view`, {
        method: 'POST', headers: {
            'Content-Type': 'application/json'
        }, body: JSON.stringify({id: uniqueId})
    })
        .then(response => response.json())
        .catch(err => console.error("Error fetching status:", err));
}

// 调用 API 更新状态
function updateStatus(apiUrl, uniqueId, status) {
    fetch(`${apiUrl}/api/thread/update`, {
        method: 'POST', headers: {
            'Content-Type': 'application/json'
        }, body: JSON.stringify({id: uniqueId, status})
    })
        .then(response => response.json())
        .then(data => {
            const label = document.getElementById('thread-status');
            setLabelContent(label, status);
        })
        .catch(err => {
            console.error('Error updating status:', err);
        });
}

function setLabelContent(label, status) {
    if (status === 'like') {
        label.style.color = 'green';
    } else if (status === 'unlike') {
        label.style.color = 'red';
    } else if (status === 'achieve') {
        label.style.color = 'blue';
    }
    label.textContent = `当前状态: ${status}`;
}

// 获取当前页面的域名
function getDomain() {
    return window.location.hostname;
}

// 获取当前页面中的 torrent id（通常位于 URL 中，例如 details.php?id=1234）
function getId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id') || urlParams.get('tid');
}

// 获取带有域名的唯一ID
function getUniqueId(torrentId) {
    const domain = getDomain();
    return `${domain}-${torrentId}`;
}

// 在页面上添加样式
const style = document.createElement('style');
style.textContent = `
  .kaleido-status-btn {
    transition: background-color 0.3s ease, box-shadow 0.3s ease;
    border-radius: 5px;
    box-shadow: 0px 4px 6px rgba(0, 0, 0, 0.1);
  }

  .kaleido-status-btn:hover {
    background-color: #218838; /* 悬停时的颜色 */
    box-shadow: 0px 6px 8px rgba(0, 0, 0, 0.2);
  }

  .kaleido-status-btn:active {
    background-color: #1e7e34; /* 点击时的颜色 */
    box-shadow: 0px 2px 4px rgba(0, 0, 0, 0.2);
    transform: translateY(1px); /* 点击时的按压效果 */
  }
`;
document.head.appendChild(style);

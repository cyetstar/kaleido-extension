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
    const ids = extractIds();


    if (h1Element && uniqueId) {
        // 创建按钮容器
        const customContainer = document.createElement('div');
        customContainer.style.marginTop = '10px';
        customContainer.style.marginBottom = '10px';


        fetchStatus(apiUrl, {id: uniqueId, ...ids}).then(res => {
            const newLabel = document.createElement('div');
            newLabel.id = 'thread-status';
            newLabel.style.marginBottom = '10px';
            newLabel.style.fontSize = '16px';
            customContainer.appendChild(newLabel);
            setLabelContent(newLabel, res.status);

            createDataTable(customContainer, res)

            const data = {
                id: uniqueId, title: h1Element.textContent, url: window.location.href, ...ids
            };
            const likeButton = createButton('Like', () => updateStatus(apiUrl, data, 'like'));
            const unlikeButton = createButton('Unlike', () => updateStatus(apiUrl, data, 'unlike'));
            const achieveButton = createButton('Achieve', () => updateStatus(apiUrl, data, 'achieve'));

            customContainer.appendChild(likeButton);
            customContainer.appendChild(unlikeButton);
            customContainer.appendChild(achieveButton);
        });

        h1Element.insertAdjacentElement('afterend', customContainer);
    }
}

function createDataTable(container, data) {
    if ((data.filenameList != null && data.filenameList.length > 0) ||
        (data.threadList != null && data.threadList.length > 0)) {
        const table = document.createElement('table');
        table.classList.add('kaleido-table');
        table.style.marginBottom = '20px';
        data.filenameList.forEach(filename => {
            table.innerHTML += `<tr><td>${filename}</td></tr>`;
        });
        data.threadList.forEach(thread => {
            const threadRow = `
      <tr>
        <td><span class="kaleido-tag kaleido-${thread.status}">${thread.status}</span> <a href="${thread.url}" target="_blank">${thread.title}</a></td>
      </tr>
    `;
            table.innerHTML += threadRow;
        });
        container.appendChild(table);
    }

}

function extractIds() {
    const data = {
        doubanId: null, imdbId: null, bgmId: null
    };

    // 查找豆瓣链接
    const doubanMatch = document.body.innerHTML.match(/https:\/\/movie\.douban\.com\/subject\/(\d{5,})/);
    if (doubanMatch) {
        data.doubanId = doubanMatch[1];
    }

    // 查找IMDB链接
    const imdbMatch = document.body.innerHTML.match(/https:\/\/www\.imdb\.com\/title\/(tt\d{5,10})/);
    if (imdbMatch) {
        data.imdbId = imdbMatch[1];
    }

    // 查找bgm链接
    let bgmMatch = document.body.innerHTML.match(/https:\/\/bgm\.tv\/subject\/(\d{3,})/);
    if (bgmMatch) {
        data.bgmId = bgmMatch[1];
    } else {
        bgmMatch = document.body.innerHTML.match(/https:\/\/bangumi\.tv\/subject\/(\d{3,})/);
        if (bgmMatch) {
            data.bgmId = bgmMatch[1];
        }
    }
    return data;
}

// 创建按钮的辅助函数
function createButton(text, onClick) {
    const button = document.createElement('button');
    button.textContent = text;
    button.classList.add('kaleido-status-btn'); // 加入样式类
    button.classList.add('kaleido-' + text.toLowerCase()); // 加入样式类
    button.addEventListener('click', onClick);
    return button;
}

function createTag(text, backgroundColor) {

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
function fetchStatus(apiUrl, data) {
    return fetch(`${apiUrl}/api/thread/view`, {
        method: 'POST', headers: {
            'Content-Type': 'application/json'
        }, body: JSON.stringify(data)
    })
        .then(response => response.json())
        .catch(err => console.error("Error fetching status:", err));
}

// 调用 API 更新状态
function updateStatus(apiUrl, data, status) {
    fetch(`${apiUrl}/api/thread/update`, {
        method: 'POST', headers: {
            'Content-Type': 'application/json'
        }, body: JSON.stringify({status, ...data})
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



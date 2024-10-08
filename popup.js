document.addEventListener('DOMContentLoaded', function () {
    const apiUrlInput = document.getElementById('api-url');
    const websitesInput = document.getElementById('websites');
    const settingsForm = document.getElementById('settings-form');

    // 加载已保存的设置
    chrome.storage.sync.get(['apiUrl', 'websites'], function (data) {
        if (data.apiUrl) {
            apiUrlInput.value = data.apiUrl;
        }
        if (data.websites) {
            websitesInput.value = data.websites.join(', ');
        }
    });

    // 保存设置
    settingsForm.addEventListener('submit', function (event) {
        event.preventDefault();
        const apiUrl = apiUrlInput.value;
        const websites = websitesInput.value.split(',').map(site => site.trim()).filter(site => site);

        chrome.storage.sync.set({ apiUrl, websites }, function () {
            alert('设置已保存!');
        });
    });
});
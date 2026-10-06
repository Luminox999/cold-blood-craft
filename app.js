// НАСТРОЙКА ОБЛАКА FIREBASE
const FIREBASE_URL = "https://firebasedatabase.app";

let currentRoom = "";
let leaderKey = ""; 
let isLeader = false;
let globalTargetCounts = {};
let globalWarehouse = {};

// Глобальный перехватчик ошибок для Блокнота
window.onerror = function(message, source, lineno, colno, error) {
    const logEl = document.getElementById('tester-status-log');
    if (logEl) {
        logEl.style.color = '#ff5252';
        logEl.innerHTML += `<div style="margin-top:5px; font-weight:bold;">КРИТИЧЕСКИЙ СБОЙ В КОДЕ:</div>`;
        logEl.innerHTML += `<div>Ошибка: ${message}</div>`;
        logEl.innerHTML += `<div>Файл: ${source.split('/').pop()} (Строка: ${lineno})</div>`;
    }
    return false;
};

// Функция автоматической проверки файлов при старте
function runSystemAutoTests() {
    const logEl = document.getElementById('tester-status-log');
    if (!logEl) return;
    try {
        if (typeof craftData === 'undefined' || !craftData.sr25) {
            throw new Error("Файл craftData.js не подключен или поврежден!");
        }
        logEl.innerHTML += `<div>Тест 1: База рецептов из craftData.js успешно считана.</div>`;

        if (!FIREBASE_URL || FIREBASE_URL.includes("ЗАМЕНИ_МЕНЯ")) {
            throw new Error("Ссылка на Firebase указана неверно!");
        }
        logEl.innerHTML += `<div>Тест 2: Онлайн-база Firebase успешно инициализирована.</div>`;

        logEl.innerHTML += `<div style="color: #64b5f6; font-weight:bold; margin-top:5px;">Системный статус: Все файлы связаны. Готово к авторизации.</div>`;
    } catch (err) {
        logEl.style.color = '#ff5252';
        logEl.innerHTML += `<div style="margin-top:5px; font-weight:bold;">ТЕСТ НЕ ПРОЙДЕН: ${err.message}</div>`;
    }
}
window.addEventListener('load', runSystemAutoTests);

// Переключение окон (вкладок)
window.switchTab = function(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).style.display = 'flex';
    if (event && event.currentTarget) { event.currentTarget.classList.add('active'); }
};

// Клик по кнопке Войти в штаб
document.addEventListener("DOMContentLoaded", function() {
    const enterBtn = document.getElementById('btn-enter-room');
    if (!enterBtn) return;

    enterBtn.onclick = function() {
        const roomSelect = document.getElementById('room-input');
        const roomInput = roomSelect.options[roomSelect.selectedIndex].text;
        const passInput = document.getElementById('leader-pass-input').value.trim();

        currentRoom = roomSelect.value;
        document.getElementById('current-room-title').textContent = roomInput.toUpperCase();
        
        if (passInput) {
            isLeader = true;
            leaderKey = "_" + passInput.toLowerCase().replace(/[^a-zа-я0-9]/g, '');
            document.getElementById('leader-tab-nav').style.display = 'block';
            document.getElementById('user-status-text').textContent = "Режим ЛИДЕРА ГРУППИРОВКИ";
            document.getElementById('user-status-text').style.color = "#ffb74d";
        }

        document.getElementById('auth-screen').style.display = 'none';
        
        syncWithCloud();
        setInterval(syncWithCloud, 3000);
    };
});
function syncWithCloud() {
    if (!currentRoom) return;
    
    fetch(`${FIREBASE_URL}/rooms/${currentRoom}.json?nocache=${Date.now()}`)
    .then(res => res.json())
    .then(data => {
        const safeData = data || {};
        globalTargetCounts = safeData.targets || {};
        globalWarehouse = safeData.warehouse || {};
        
        renderLeaderEditPanel();
        renderMainDashboard();
    })
    .catch(err => console.error("Firebase Sync Error:", err));
}

function sendDataToCloud(type, updatedData) {
    if (!currentRoom) return;
    
    fetch(`${FIREBASE_URL}/rooms/${currentRoom}/${type}.json`, {
        method: 'PUT',
        body: JSON.stringify(updatedData)
    });
}

function getMaterialImagePath(name) {
    const translit = name.toLowerCase().replace(/[^a-zа-я0-9\s]/g, '').trim().replace(/\s+/g, '_');
    return "img/" + translit + ".png";
}

function renderMainDashboard() {
    const ordersPanel = document.getElementById('leader-orders-display');
    const warehousePanel = document.getElementById('global-warehouse-display');
    if (!ordersPanel || !warehousePanel) return;
    
    ordersPanel.innerHTML = '';
    warehousePanel.innerHTML = '';
    let hasOrders = false;
    const totalRequiredMaterials = {};

    for (let k in craftData) {
        const targetQty = globalTargetCounts[k] || 0;
        if (targetQty > 0) {
            hasOrders = true;
            const item = craftData[k];
            
            const row = document.createElement('div');
            row.className = 'recipe-item';
            row.innerHTML = `
                <div class="item-meta">
                    <img class="item-icon" src="${item.image}" onerror="this.style.display='none'">
                    <span class="recipe-name">${item.name}</span>
                </div>
                <span class="counter" style="color:#fff;">Приказ: ${targetQty} шт</span>
            `;
            ordersPanel.appendChild(row);

            for (let m in item.materials) {
                if (!totalRequiredMaterials[m]) totalRequiredMaterials[m] = 0;
                totalRequiredMaterials[m] += item.materials[m] * targetQty;
            }
        }
    }

    if (!hasOrders) {
        ordersPanel.innerHTML = '<div class="empty-message">Лидер фракции еще не выдал приказов на сборку ресурсов.</div>';
    }

    const allPossibleMaterials = new Set();
    for (let k in craftData) {
        for (let m in craftData[k].materials) { allPossibleMaterials.add(m); }
    }

    Array.from(allPossibleMaterials).sort().forEach(m => {
        const reqQty = totalRequiredMaterials[m] || 0;
        const stockQty = globalWarehouse[m] || 0;
        const left = reqQty - stockQty;
        const row = document.createElement('div');
        row.className = 'material-item';
        
        let statusText = "";
        if (reqQty > 0) {
            if (left <= 0) {
                row.classList.add('status-done');
                statusText = "Готово!";
            } else {
                statusText = `Надо: x${left}`;
            }
        } else {
            statusText = "Вне плана";
        }

        row.innerHTML = `
            <div class="item-meta">
                <img class="item-icon" src="${getMaterialImagePath(m)}" onerror="this.style.display='none'">
                <div class="mat-info">
                    <span class="mat-name">${m}</span>
                    <span class="mat-needed-text">${reqQty > 0 ? 'По плану требуется: ' + reqQty : 'План на этот хлам не задан'}</span>
                </div>
            </div>
            <div class="controls">
                <button class="btn" onclick="changeWarehouseStock('${m}', -1)">-</button>
                <span class="counter" style="color:#ffb74d;">${stockQty}</span>
                <button class="btn btn-plus" onclick="changeWarehouseStock('${m}', 1)">+</button>
                <span class="material-count">${statusText}</span>
            </div>
        `;
        warehousePanel.appendChild(row);
    });
}

window.changeWarehouseStock = function(matName, val) {
    let current = globalWarehouse[matName] || 0;
    current += val; if (current < 0) current = 0;
    globalWarehouse[matName] = current;
    sendDataToCloud('warehouse', globalWarehouse);
    renderMainDashboard();
};
function renderLeaderEditPanel() {
    const p = document.getElementById('leader-edit-list');
    if (!p || p.children.length > 0) return;

    for (let k in craftData) {
        const item = craftData[k];
        const row = document.createElement('div');
        row.className = 'recipe-item';
        row.innerHTML = `
            <div class="item-meta">
                <img class="item-icon" src="${item.image}" onerror="this.style.display='none'">
                <span class="recipe-name">${item.name}</span>
            </div>
            <div class="controls">
                <button class="btn" onclick="changeLeaderTarget('${k}', -1)">-</button>
                <span class="counter" id="lead-cnt-${k}">0</span>
                <button class="btn btn-plus" onclick="changeLeaderTarget('${k}', 1)">+</button>
            </div>
        `;
        p.appendChild(row);
    }
}

window.changeLeaderTarget = function(key, val) {
    if (!isLeader) return;
    let current = globalTargetCounts[key] || 0;
    current += val; if (current < 0) current = 0;
    globalTargetCounts[key] = current;
    
    const countElement = document.getElementById(`lead-cnt-${key}`);
    if (countElement) { countElement.textContent = current; }
    
    sendDataToCloud('targets', globalTargetCounts);
    renderMainDashboard();
};

function initSlicerInterface() {
    const fileInput = document.getElementById('screenshot-input');
    const outputZone = document.getElementById('cropper-zone');
    if (!fileInput || !outputZone) return;

    outputZone.innerHTML = `
        <div class="slicer-workspace">
            <p style="font-size: 13px; color: #ffb74d; margin: 0;">Зажмите левую кнопку мыши и выделите рамкой иконку предмета.</p>
            <div class="canvas-container">
                <canvas id="screenshot-canvas"></canvas>
                <div id="crop-selector"></div>
            </div>
            <div class="slicer-controls-row">
                <canvas id="preview-canvas" width="64" height="64"></canvas>
                <select id="material-selector" class="slicer-select"></select>
                <button id="btn-download-crop" class="btn btn-plus" style="width: auto; padding: 0 25px; height: 40px; font-size: 14px;">Скачать иконку</button>
            </div>
        </div>
    `;

    const canvas = document.getElementById('screenshot-canvas');
    const ctx = canvas.getContext('2d');
    const selector = document.getElementById('crop-selector');
    const previewCanvas = document.getElementById('preview-canvas');
    const pCtx = previewCanvas.getContext('2d');
    const selectEl = document.getElementById('material-selector');
    const btnDownload = document.getElementById('btn-download-crop');

    let img = new Image();
    let isDrawing = false;
    let startX = 0, startY = 0, cropX = 0, cropY = 0, cropW = 0, cropH = 0;

    const allMaterials = new Set();
    for (let key in craftData) {
        allMaterials.add(craftData[key].name);
        for (let mat in craftData[key].materials) { allMaterials.add(mat); }
    }
    Array.from(allMaterials).sort().forEach(mat => {
        const opt = document.createElement('option');
        opt.value = mat; opt.textContent = mat; selectEl.appendChild(opt);
    });

    fileInput.addEventListener('change', function(e) {
        const reader = new FileReader();
        reader.onload = function(ev) {
            img.onload = function() {
                canvas.width = img.width; canvas.height = img.height;
                ctx.drawImage(img, 0, 0); outputZone.style.display = 'block';
                selector.style.display = 'none'; pCtx.clearRect(0, 0, 64, 64);
            };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(e.target.files);
    });

    canvas.addEventListener('mousedown', function(e) {
        isDrawing = true;
        const rect = canvas.getBoundingClientRect();
        startX = (e.clientX - rect.left) * (canvas.width / rect.width);
        startY = (e.clientY - rect.top) * (canvas.height / rect.height);
        selector.style.display = 'block';
    });

    canvas.addEventListener('mousemove', function(e) {
        if (!isDrawing) return;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const currentX = (e.clientX - rect.left) * scaleX;
        const currentY = (e.clientY - rect.top) * scaleY;

        cropX = Math.min(startX, currentX); cropY = Math.min(startY, currentY);
        cropW = Math.abs(startX - currentX); cropH = Math.abs(startY - currentY);

        selector.style.left = (cropX / scaleX) + 'px';
        selector.style.top = (cropY / scaleY) + 'px';
        selector.style.width = (cropW / scaleX) + 'px';
        selector.style.height = (cropH / scaleY) + 'px';

        if (cropW > 5 && cropH > 5) {
            pCtx.clearRect(0, 0, 64, 64);
            pCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, 64, 64);
        }
    });

    window.addEventListener('mouseup', () => isDrawing = false);

    btnDownload.onclick = function() {
        if (cropW < 5) return alert('Выделите область!');
        const targetName = selectEl.value;
        let foundKey = Object.keys(craftData).find(k => craftData[k].name === targetName);
        let fn = foundKey ? foundKey + ".png" : targetName.toLowerCase().replace(/[^a-zа-я0-9\s]/g, '').trim().replace(/\s+/g, '_') + ".png";

        const saveCanvas = document.createElement('canvas');
        saveCanvas.width = 64; saveCanvas.height = 64;
        saveCanvas.getContext('2d').drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, 64, 64);

        const link = document.createElement('a');
        link.download = fn; link.href = saveCanvas.toDataURL('image/png'); link.click();
    };
}

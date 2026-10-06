// НАСТРОЙКА ОБЛАКА FIREBASE
const FIREBASE_URL = "https://firebasedatabase.app";

// База данных рецептов
const craftData = {
    "box_4": { name: "Ящик (Containers_DK4_Level_4)", image: "img/box_4.png", materials: { "Доски": 1, "Отвертка": 1, "Набор инструментов": 1, "Металлические пластины": 2, "Проволока": 2, "Журнал тех. разработок 2": 1 } },
    "mosin": { name: "Винтовка Мосин 91/30", image: "img/mosin.png", materials: { "Металлические пластины": 2, "Оружейное масло": 1, "Изолента": 1, "Отвертка": 1, "Кусачки": 1, "Проволока": 2 } },
    "journal_2": { name: "Журнал тех. разработок №2", image: "img/journal_2.png", materials: { "Журнал тех. разработок 1": 1, "Микросхема": 1, "Клей": 1, "Кожа": 1 } },
    "journal_3": { name: "Журнал тех. разработок №3", image: "img/journal_3.png", materials: { "Журнал тех. разработок 2": 1, "Микросхема": 1, "Клей": 1, "Синяя ткань": 1, "Кожа": 1 } },
    "sr25": { name: "Снайперская винтовка SR-25", image: "img/sr25.png", materials: { "Медный слиток": 5, "Металлический брусок": 5, "WD40 400мл": 3, "Набор для калибровки Мастер": 4, "Фазированная решетка РЛС": 4, "Накопитель VFX": 5, "Кусок резины": 4, "Контейнер оружие синий": 5, "Журнал технических разработок 5": 1, "Шеврон техника": 1 } },
    "fine_tools": { name: "Набор для тонкой работы", image: "img/fine_tools.png", materials: { "Доски": 1, "Проволока": 1, "Изолента": 1, "Кусачки": 1, "Ткань": 1, "Журнал тех. разработок 2": 1 } },
    "pszd": { name: "Комплект ПСЗД (Свобода)", image: "img/pszd.png", materials: { "Ткань": 1, "Бронеплита": 4, "Металлические пластины": 4, "Набор инструментов": 4, "Листовой металл": 3, "Противогазный фильтр": 2, "Аптечка Salewa": 1, "Журнал тех. разработок 1": 1 } },
    "ak105": { name: "АК-105 Булл-пап", image: "img/ak105.png", materials: { "Проволока": 2, "Кусачки": 1, "Отвертка": 1, "Изолента": 1, "Металлические пластины": 2, "Набор для тонкой работы": 1, "Журнал тех. разработок 1": 1 } }
};

let currentRoom = "";
let isLeader = false;
let globalTargetCounts = {};
let globalWarehouse = {};

function getMaterialImagePath(name) {
    const translit = name.toLowerCase().replace(/[^a-zа-я0-9\s]/g, '').trim().replace(/\s+/g, '_');
    return "img/" + translit + ".png";
}

window.switchTab = function(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).style.display = 'flex';
};

// Привязка клика после полной загрузки страницы
document.addEventListener("DOMContentLoaded", function() {
    const enterBtn = document.getElementById('btn-enter-room');
    if (!enterBtn) return;

    enterBtn.onclick = function() {
        const roomInput = document.getElementById('room-input').value.trim();
        const passInput = document.getElementById('leader-pass-input').value.trim();

        if(!roomInput) { alert("Введите название вашей группировки!"); return; }

        currentRoom = roomInput.toLowerCase().replace(/[^a-zа-я0-9]/g, '');
        document.getElementById('current-room-title').textContent = roomInput.toUpperCase();
        
        if(passInput === "свобода123") {
            isLeader = true;
            document.getElementById('leader-tab-nav').style.display = 'block';
            document.getElementById('user-status-text').textContent = "Режим ЛИДЕРА ГРУППИРОВКИ";
            document.getElementById('user-status-text').style.color = "#ffb74d";
        }

        document.getElementById('auth-screen').style.display = 'none';
        
        syncWithCloud();
        setInterval(syncWithCloud, 3000); // Синхронизация раз в 3 секунды
    };
});

function syncWithCloud() {
    if (!currentRoom) return;
    
    // Добавили принудительное отключение кэша для стабильности fetch в онлайне
    fetch(`${FIREBASE_URL}/rooms/${currentRoom}.json?nocache=${Date.now()}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
    })
    .then(res => {
        if (!res.ok) throw new Error('Статус ответа сервера: ' + res.status);
        return res.json();
    })
    .then(data => {
        if (data) {
            globalTargetCounts = data.targets || {};
            globalWarehouse = data.warehouse || {};
        }
        renderLeaderEditPanel();
        renderMainDashboard();
    })
    .catch(err => {
        console.error("Критическая ошибка Firebase:", err);
    });
}

function sendDataToCloud(type, updatedData) {
    if (!currentRoom) return;
    
    fetch(`${FIREBASE_URL}/rooms/${currentRoom}/${type}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData)
    })
    .catch(err => console.error("Ошибка отправки данных:", err));
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
            row.innerHTML = `<div class="item-meta"><img class="item-icon" src="${item.image}"><span class="recipe-name">${item.name}</span></div><span class="counter" style="color:#fff;">Приказ: ${targetQty} шт</span>`;
            ordersPanel.appendChild(row);

            for (let m in item.materials) {
                if (!totalRequiredMaterials[m]) totalRequiredMaterials[m] = 0;
                totalRequiredMaterials[m] += item.materials[m] * targetQty;
            }
        }
    }

    if (!hasOrders) {
        ordersPanel.innerHTML = '<div class="empty-message">Лидер фракции еще не выдал приказов на сборку ресурсов.</div>';
        warehousePanel.innerHTML = '<div class="empty-message">Склад пуст, так как задачи отсутствуют.</div>';
        return;
    }

    for (let m in totalRequiredMaterials) {
        const reqQty = totalRequiredMaterials[m];
        const stockQty = globalWarehouse[m] || 0;
        const left = reqQty - stockQty;
        const row = document.createElement('div');
        row.className = 'material-item';
        if (left <= 0) row.classList.add('status-done');

        row.innerHTML = `
            <div class="item-meta">
                <img class="item-icon" src="${getMaterialImagePath(m)}">
                <div class="mat-info"><span class="mat-name">${m}</span><span class="mat-needed-text">По плану нужно: ${reqQty} шт</span></div>
            </div>
            <div class="controls">
                <button class="btn" onclick="changeWarehouseStock('${m}', -1)">-</button>
                <span class="counter" style="color:#ffb74d;">${stockQty}</span>
                <button class="btn btn-plus" onclick="changeWarehouseStock('${m}', 1)">+</button>
                <span class="material-count">${left > 0 ? 'Надо: x' + left : 'Готово!'}</span>
            </div>
        `;
        warehousePanel.appendChild(row);
    }
}

window.changeWarehouseStock = function(matName, val) {
    let current = globalWarehouse[matName] || 0;
    current += val;
    if (current < 0) current = 0;
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
        row.innerHTML = `<div class="item-meta"><img class="item-icon" src="${item.image}"><span class="recipe-name">${item.name}</span></div><div class="controls"><button class="btn" onclick="changeLeaderTarget('${k}', -1)">-</button><span class="counter" id="lead-cnt-${k}">0</span><button class="btn btn-plus" onclick="changeLeaderTarget('${k}', 1)">+</button></div>`;
        p.appendChild(row);
    }
}

window.changeLeaderTarget = function(key, val) {
    if (!isLeader) return;
    let current = globalTargetCounts[key] || 0;
    current += val;
    if (current < 0) current = 0;
    globalTargetCounts[key] = current;
    const countElement = document.getElementById(`lead-cnt-${key}`);
    if (countElement) { countElement.textContent = current; }
    sendDataToCloud('targets', globalTargetCounts);
    renderMainDashboard();
};

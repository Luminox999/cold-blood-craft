// Функция фонового обмена данными с базой
function syncWithCloud() {
    if (!currentRoom) return;
    
    // В fetch мы собираем ссылку по кусочкам, чтобы обойти сетевые блокировки
    fetch(FIREBASE_URL + "/rooms/" + currentRoom + ".json?nocache=" + Date.now(), {
        method: "GET",
        headers: { "Accept": "application/json" }
    })
    .then(function(res) { 
        return res.json(); 
    })
    .then(function(data) {
        var safeData = data || {};
        globalTargetCounts = safeData.targets || {};
        globalWarehouse = safeData.warehouse || {};
        
        renderLeaderEditPanel();
        renderMainDashboard();
    })
    .catch(function(err) { 
        console.error("Ошибка синхронизации склада:", err); 
    });
}

// Функция отправки изменений обратно в Firebase
function sendDataToCloud(type, updatedData) {
    if (!currentRoom) return;
    
    fetch(FIREBASE_URL + "/rooms/" + currentRoom + "/" + type + ".json", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedData)
    })
    .catch(function(err) {
        console.error("Ошибка отправки данных в облако:", err);
    });
}

function getMaterialImagePath(name) {
    var translit = name.toLowerCase().replace(/[^a-zа-я0-9\s]/g, "").trim().replace(/\s+/g, "_");
    return "img/" + translit + ".png";
}
function renderMainDashboard() {
    var ordersPanel = document.getElementById("leader-orders-display");
    var warehousePanel = document.getElementById("global-warehouse-display");
    if (!ordersPanel || !warehousePanel) return;
    
    ordersPanel.innerHTML = "";
    warehousePanel.innerHTML = "";
    var hasOrders = false;
    var totalRequiredMaterials = {};

    for (var k in craftData) {
        var targetQty = globalTargetCounts[k] || 0;
        if (targetQty > 0) {
            hasOrders = true;
            var item = craftData[k];
            
            var row = document.createElement("div");
            row.className = "recipe-item";
            row.innerHTML = '<div class="item-meta"><img class="item-icon" src="' + item.image + '" onerror="this.style.display=\'none\'"><span class="recipe-name">' + item.name + '</span></div><span class="counter" style="color:#fff;">Приказ: ' + targetQty + ' шт</span>';
            ordersPanel.appendChild(row);

            for (var m in item.materials) {
                if (!totalRequiredMaterials[m]) totalRequiredMaterials[m] = 0;
                totalRequiredMaterials[m] += item.materials[m] * targetQty;
            }
        }
    }

    if (!hasOrders) {
        ordersPanel.innerHTML = '<div class="empty-message">Лидер фракции еще не выдал приказов на сборку ресурсов.</div>';
    }

    var allPossibleMaterials = new Set();
    for (var k in craftData) {
        for (var m in craftData[k].materials) { allPossibleMaterials.add(m); }
    }

    Array.from(allPossibleMaterials).sort().forEach(function(m) {
        var reqQty = totalRequiredMaterials[m] || 0;
        var stockQty = globalWarehouse[m] || 0;
        var left = reqQty - stockQty;
        var row = document.createElement("div");
        row.className = "material-item";
        
        var statusText = "";
        if (reqQty > 0) {
            if (left <= 0) {
                row.classList.add("status-done");
                statusText = "Готово!";
            } else {
                statusText = "Надо: x" + left;
            }
        } else {
            statusText = "Вне плана";
        }

        row.innerHTML = '<div class="item-meta"><img class="item-icon" src="' + getMaterialImagePath(m) + '" onerror="this.style.display=\'none\'"><div class="mat-info"><span class="mat-name">' + m + '</span><span class="mat-needed-text">' + (reqQty > 0 ? "По плану требуется: " + reqQty : "План на этот хлам не задан") + '</span></div></div><div class="controls"><button class="btn" onclick="changeWarehouseStock(\'' + m + '\', -1)">-</button><span class="counter" style="color:#ffb74d;">' + stockQty + '</span><button class="btn btn-plus" onclick="changeWarehouseStock(\'' + m + '\', 1)">+</button><span class="material-count">' + statusText + '</span></div>';
        warehousePanel.appendChild(row);
    });
}

window.changeWarehouseStock = function(matName, val) {
    var current = globalWarehouse[matName] || 0;
    current += val; if (current < 0) current = 0;
    globalWarehouse[matName] = current;
    sendDataToCloud("warehouse", globalWarehouse);
    renderMainDashboard();
};

function renderLeaderEditPanel() {
    var p = document.getElementById("leader-edit-list");
    if (!p || p.children.length > 0) return;

    for (var k in craftData) {
        var item = craftData[k];
        var row = document.createElement("div");
        row.className = "recipe-item";
        row.innerHTML = '<div class="item-meta"><img class="item-icon" src="' + item.image + '" onerror="this.style.display=\'none\'"><span class="recipe-name">' + item.name + '</span></div><div class="controls"><button class="btn" onclick="changeLeaderTarget(\'' + k + '\', -1)">-</button><span class="counter" id="lead-cnt-' + k + '">0</span><button class="btn btn-plus" onclick="changeLeaderTarget(\'' + k + '\', 1)">+</button></div>';
        p.appendChild(row);
    }
}

window.changeLeaderTarget = function(key, val) {
    if (!isLeader) return;
    var current = globalTargetCounts[key] || 0;
    current += val; if (current < 0) current = 0;
    globalTargetCounts[key] = current;
    
    var countElement = document.getElementById("lead-cnt-" + key);
    if (countElement) { countElement.textContent = current; }
    
    sendDataToCloud("targets", globalTargetCounts);
    renderMainDashboard();
};

function syncWithCloud() {
    if (!currentRoom) return;
    
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
        
        if (safeData.custom_recipes) {
            for (var key in safeData.custom_recipes) {
                craftData[key] = safeData.custom_recipes[key];
            }
        }
        
        renderLeaderEditPanel();
        renderMainDashboard();
    })
    .catch(function(err) { 
        console.error("Ошибка синхронизации данных:", err); 
    });
}

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
    
    var hasOrders = false;
    var totalRequiredMaterials = {};

    // 1. Рассчитываем суммарные потребности на основе приказов
    for (var k in craftData) {
        var targetQty = globalTargetCounts[k] || 0;
        if (targetQty > 0) {
            hasOrders = true;
            var item = craftData[k];
            for (var m in item.materials) {
                if (!totalRequiredMaterials[m]) totalRequiredMaterials[m] = 0;
                totalRequiredMaterials[m] += item.materials[m] * targetQty;
            }
        }
    }

    // 2. Статичное обновление панели приказов лидера
    if (!hasOrders) {
        ordersPanel.innerHTML = '<div class="empty-message">Лидер фракции еще не выдал приказов на сборку ресурсов.</div>';
    } else {
        var currentOrderItems = ordersPanel.querySelectorAll(".recipe-item");
        var activeOrdersCount = 0;
        for (var k in craftData) { if (globalTargetCounts[k] > 0) activeOrdersCount++; }

        if (currentOrderItems.length !== activeOrdersCount) {
            var ordersHtml = "";
            for (var k in craftData) {
                var targetQty = globalTargetCounts[k] || 0;
                if (targetQty > 0) {
                    var item = craftData[k];
                    ordersHtml += '<div class="recipe-item"><div class="item-meta"><img class="item-icon" src="' + item.image + '"><span class="recipe-name">' + item.name + '</span></div><span class="counter" style="color:#fff;">Приказ: ' + targetQty + ' шт</span></div>';
                }
            }
            ordersPanel.innerHTML = ordersHtml;
        }
    }

    // 3. Собираем уникальный список хлама со всей игры
    var allPossibleMaterials = new Set();
    for (var k in craftData) {
        for (var m in craftData[k].materials) { allPossibleMaterials.add(m); }
    }
    var sortedMats = Array.from(allPossibleMaterials).sort();

    // 4. ТЕХНОЛОГИЯ ЗАМОРОЗКИ СЛОТОВ (Строим каркас ячеек строго один раз в жизни)
    var currentRows = warehousePanel.querySelectorAll(".material-item");
    if (currentRows.length !== sortedMats.length) {
        warehousePanel.innerHTML = "";
        sortedMats.forEach(function(m) {
            var row = document.createElement("div");
            row.className = "material-item";
            row.setAttribute("data-mat-name", m);
            
            // Вшиваем пути картинок один раз. Сюда обновление больше никогда не залезет!
            row.innerHTML = '<div class="item-meta"><img class="item-icon" src="' + getMaterialImagePath(m) + '"><div class="mat-info"><span class="mat-name">' + m + '</span><span class="mat-needed-text" id="mat-req-text-' + m + '">План на этот хлам не задан</span></div></div><div class="controls"><button class="btn" onclick="changeWarehouseStock(\'' + m + '\', -1)">-</button><span class="counter" style="color:#ffb74d;" id="mat-stock-cnt-' + m + '">0</span><button class="btn btn-plus" onclick="changeWarehouseStock(\'' + m + '\', 1)">+</button><span class="material-count" id="mat-status-text-' + m + '">Вне плана</span></div>';
            warehousePanel.appendChild(row);
        });
    }

    // 5. ТОЧЕЧНОЕ ОБНОВЛЕНИЕ ТЕКСТА И ЦИФР СНАБЖЕНИЯ
    sortedMats.forEach(function(m) {
        var reqQty = totalRequiredMaterials[m] || 0;
        var stockQty = globalWarehouse[m] || 0;
        var left = reqQty - stockQty;

        var rowElement = warehousePanel.querySelector('[data-mat-name="' + m + '"]');
        var reqTxtElement = document.getElementById("mat-req-text-" + m);
        var stockCntElement = document.getElementById("mat-stock-cnt-" + m);
        var statusTxtElement = document.getElementById("mat-status-text-" + m);

        if (rowElement && reqTxtElement && stockCntElement && statusTxtElement) {
            // Возвращаем подписи планов снабжения на экран
            reqTxtElement.textContent = reqQty > 0 ? "По плану требуется: " + reqQty : "План на этот хлам не задан";
            stockCntElement.textContent = stockQty;

            if (reqQty > 0) {
                if (left <= 0) {
                    rowElement.classList.add("status-done");
                    statusTxtElement.textContent = "Готово!";
                    statusTxtElement.style.color = "#81c784";
                } else {
                    rowElement.classList.remove("status-done");
                    statusTxtElement.textContent = "Надо: x" + left;
                    statusTxtElement.style.color = "var(--orange-color)";
                }
            } else {
                rowElement.classList.remove("status-done");
                statusTxtElement.textContent = "Вне плана";
                statusTxtElement.style.color = "#888";
            }
        }
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
    if (!p) return;

    var groupedCrafts = {};
    for (var k in craftData) {
        var loc = craftData[k].location || "bar_bench";
        if (!groupedCrafts[loc]) { groupedCrafts[loc] = []; }
        groupedCrafts[loc].push(k);
    }

    var totalItemsInMemory = Object.keys(craftData).length;
    var currentRowsInDom = p.querySelectorAll(".recipe-item");

    if (currentRowsInDom.length !== totalItemsInMemory) {
        p.innerHTML = "";
        for (var locKey in locationNames) {
            if (groupedCrafts[locKey] && groupedCrafts[locKey].length > 0) {
                var header = document.createElement("h3");
                header.style.color = "#ffb74d"; header.style.borderBottom = "1px solid #333"; header.style.paddingBottom = "5px"; header.style.marginTop = "20px"; header.style.fontSize = "14px"; header.style.textTransform = "uppercase";
                header.textContent = locationNames[locKey]; p.appendChild(header);

                groupedCrafts[locKey].forEach(function(k) {
                    var item = craftData[k];
                    var row = document.createElement("div");
                    row.className = "recipe-item";
                    row.innerHTML = '<div class="item-meta"><img class="item-icon" src="' + item.image + '"><span class="recipe-name">' + item.name + '</span></div><div class="controls"><button class="btn" onclick="changeLeaderTarget(\'' + k + '\', -1)">-</button><span class="counter" id="lead-cnt-' + k + '">0</span><button class="btn btn-plus" onclick="changeLeaderTarget(\'' + k + '\', 1)">+</button></div>';
                    p.appendChild(row);
                });
            }
        }
    }

    for (var k in craftData) {
        var countElement = document.getElementById("lead-cnt-" + k);
        if (countElement) {
            var cloudValue = globalTargetCounts[k] || 0;
            if (countElement.textContent !== String(cloudValue)) {
                countElement.textContent = cloudValue;
            }
        }
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

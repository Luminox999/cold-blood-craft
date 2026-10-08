// Санитайзер ключей Firebase (запрещены . # $ / [ ])
function sanitizeFirebaseKey(key) {
    return String(key).replace(/[.#$\/\[\]]/g, "_");
}

function sanitizeFirebasePayload(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    var result = {};
    for (var k in obj) {
        result[sanitizeFirebaseKey(k)] = obj[k];
    }
    return result;
}

// ============ ИКОНКИ ИЗ ОБЛАКА ============
// Глобальные иконки, общие для всех фракций
var globalIcons = { items: {}, materials: {} };

function syncIconsFromCloud() {
    fetch(FIREBASE_URL + "/icons.json?nocache=" + Date.now(), {
        method: "GET",
        headers: { "Accept": "application/json" }
    })
        .then(function (res) { return res.json(); })
        .then(function (data) {
            var safe = data || {};
            globalIcons.items = safe.items || {};
            globalIcons.materials = safe.materials || {};

            // Перерисовываем всё после получения иконок
            if (typeof renderMainDashboard === 'function') renderMainDashboard();
            if (typeof renderLeaderEditPanel === 'function') renderLeaderEditPanel();
        })
        .catch(function (err) {
            console.error("Ошибка синхронизации иконок:", err);
        });
}

// Возвращает src иконки: сначала ищет в облаке, потом локальный файл
function getItemIconSrc(craftKey, item) {
    return globalIcons.items[craftKey] || item.image;
}

function getMaterialIconSrc(matName) {
    return globalIcons.materials[matName] || getMaterialImagePath(matName);
}

// ============ СКЛАД И ПРИКАЗЫ ============
function syncWithCloud() {
    if (!currentRoom) return;

    fetch(FIREBASE_URL + "/rooms/" + currentRoom + ".json?nocache=" + Date.now(), {
        method: "GET",
        headers: { "Accept": "application/json" }
    })
        .then(function (res) { return res.json(); })
        .then(function (data) {
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
        .catch(function (err) {
            console.error("Ошибка синхронизации данных:", err);
        });
}

function sendDataToCloud(type, updatedData) {
    if (!currentRoom) return;

    var safePayload = sanitizeFirebasePayload(updatedData);

    fetch(FIREBASE_URL + "/rooms/" + currentRoom + "/" + type + ".json", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(safePayload)
    })
        .catch(function (err) {
            console.error("Ошибка отправки данных в облако:", err);
        });
}

function getMaterialImagePath(name) {
    var slug = name.toLowerCase().replace(/[^a-zа-я0-9\s]/g, "").trim().replace(/\s+/g, "_");
    return "img/" + slug + ".png";
}

function renderMainDashboard() {
    var ordersPanel = document.getElementById("leader-orders-display");
    var warehousePanel = document.getElementById("global-warehouse-display");
    if (!ordersPanel || !warehousePanel) return;

    var totalRequiredMaterials = {};
    var ordersHtml = "";

    for (var k in craftData) {
        var targetQty = globalTargetCounts[k] || 0;
        if (targetQty > 0) {
            var item = craftData[k];
            ordersHtml += '<div class="recipe-item">'
                + '<div class="item-meta">'
                + '<img class="item-icon" src="' + getItemIconSrc(k, item) + '" onerror="this.style.visibility=\'hidden\'">'
                + '<span class="recipe-name">' + item.name + '</span>'
                + '</div>'
                + '<span class="counter" style="color:#fff;">Приказ: ' + targetQty + ' шт</span>'
                + '</div>';

            for (var m in item.materials) {
                if (!totalRequiredMaterials[m]) totalRequiredMaterials[m] = 0;
                totalRequiredMaterials[m] += item.materials[m] * targetQty;
            }
        }
    }

    ordersPanel.innerHTML = ordersHtml || '<div class="empty-message">Лидер фракции еще не выдал приказов на сборку ресурсов.</div>';

    // Склад
    var allMats = new Set();
    for (var k in craftData) {
        for (var m in craftData[k].materials) allMats.add(m);
    }
    var sortedMats = Array.from(allMats).sort();

    var currentRows = warehousePanel.querySelectorAll(".material-item");
    if (currentRows.length !== sortedMats.length) {
        warehousePanel.innerHTML = "";
        sortedMats.forEach(function (m) {
            var row = document.createElement("div");
            row.className = "material-item";
            row.setAttribute("data-mat-name", m);
            row.innerHTML = '<div class="item-meta">'
                + '<img class="item-icon" src="' + getMaterialIconSrc(m) + '" onerror="this.style.visibility=\'hidden\'">'
                + '<div class="mat-info">'
                + '<span class="mat-name">' + m + '</span>'
                + '<span class="mat-needed-text" id="mat-req-text-' + m + '">План на этот хлам не задан</span>'
                + '</div></div>'
                + '<div class="controls">'
                + '<button class="btn" onclick="changeWarehouseStock(\'' + m + '\', -1)">-</button>'
                + '<span class="counter" style="color:#ffb74d;" id="mat-stock-cnt-' + m + '">0</span>'
                + '<button class="btn btn-plus" onclick="changeWarehouseStock(\'' + m + '\', 1)">+</button>'
                + '<span class="material-count" id="mat-status-text-' + m + '">Вне плана</span>'
                + '</div>';
            warehousePanel.appendChild(row);
        });
    } else {
        // Обновляем существующие src — на случай если иконка подгрузилась из облака
        sortedMats.forEach(function (m) {
            var rowEl = warehousePanel.querySelector('[data-mat-name="' + m + '"]');
            if (!rowEl) return;
            var img = rowEl.querySelector(".item-icon");
            if (img) {
                var wantSrc = getMaterialIconSrc(m);
                if (img.getAttribute("src") !== wantSrc) {
                    img.style.visibility = "";
                    img.setAttribute("src", wantSrc);
                }
            }
        });
    }

    sortedMats.forEach(function (m) {
        var reqQty = totalRequiredMaterials[m] || 0;
        var stockQty = globalWarehouse[m] || 0;
        var left = reqQty - stockQty;

        var rowEl = warehousePanel.querySelector('[data-mat-name="' + m + '"]');
        var reqTxt = document.getElementById("mat-req-text-" + m);
        var stockCnt = document.getElementById("mat-stock-cnt-" + m);
        var statusTxt = document.getElementById("mat-status-text-" + m);

        if (rowEl && reqTxt && stockCnt && statusTxt) {
            reqTxt.textContent = reqQty > 0 ? "По плану требуется: " + reqQty : "План на этот хлам не задан";
            stockCnt.textContent = stockQty;

            if (reqQty > 0) {
                if (left <= 0) {
                    rowEl.classList.add("status-done");
                    statusTxt.textContent = "Готово!";
                    statusTxt.style.color = "#81c784";
                } else {
                    rowEl.classList.remove("status-done");
                    statusTxt.textContent = "Надо: x" + left;
                    statusTxt.style.color = "var(--orange-color)";
                }
            } else {
                rowEl.classList.remove("status-done");
                statusTxt.textContent = "Вне плана";
                statusTxt.style.color = "#888";
            }
        }
    });
}

window.changeWarehouseStock = function (matName, val) {
    var current = globalWarehouse[matName] || 0;
    current += val;
    if (current < 0) current = 0;
    globalWarehouse[matName] = current;
    sendDataToCloud("warehouse", globalWarehouse);
    renderMainDashboard();
};

// ============ ПАНЕЛЬ ЛИДЕРА ============
function renderLeaderEditPanel() {
    var p = document.getElementById("leader-edit-list");
    if (!p) return;

    var groupedCrafts = {};
    for (var k in craftData) {
        var loc = craftData[k].location || "bar_bench";
        if (!groupedCrafts[loc]) groupedCrafts[loc] = [];
        groupedCrafts[loc].push(k);
    }

    var totalItems = Object.keys(craftData).length;
    var currentRows = p.querySelectorAll(".recipe-item");

    if (currentRows.length !== totalItems) {
        p.innerHTML = "";
        for (var locKey in locationNames) {
            if (groupedCrafts[locKey] && groupedCrafts[locKey].length > 0) {
                var header = document.createElement("h3");
                header.style.color = "#ffb74d";
                header.style.borderBottom = "1px solid #333";
                header.style.paddingBottom = "5px";
                header.style.marginTop = "20px";
                header.style.fontSize = "14px";
                header.style.textTransform = "uppercase";
                header.textContent = locationNames[locKey];
                p.appendChild(header);

                groupedCrafts[locKey].forEach(function (k) {
                    var item = craftData[k];
                    var row = document.createElement("div");
                    row.className = "recipe-item";
                    row.innerHTML = '<div class="item-meta">'
                        + '<img class="item-icon" src="' + getItemIconSrc(k, item) + '" onerror="this.style.visibility=\'hidden\'">'
                        + '<span class="recipe-name">' + item.name + '</span>'
                        + '</div>'
                        + '<div class="controls">'
                        + '<button class="btn" onclick="changeLeaderTarget(\'' + k + '\', -1)">-</button>'
                        + '<span class="counter" id="lead-cnt-' + k + '">0</span>'
                        + '<button class="btn btn-plus" onclick="changeLeaderTarget(\'' + k + '\', 1)">+</button>'
                        + '</div>';
                    p.appendChild(row);
                });
            }
        }
    } else {
        // Обновляем src на случай подгрузки новых иконок
        for (var k in craftData) {
            var rowEl = p.querySelector('[onclick*="changeLeaderTarget(\'' + k + '\'"]');
            var container = rowEl ? rowEl.closest(".recipe-item") : null;
            if (container) {
                var img = container.querySelector(".item-icon");
                if (img) {
                    var wantSrc = getItemIconSrc(k, craftData[k]);
                    if (img.getAttribute("src") !== wantSrc) {
                        img.style.visibility = "";
                        img.setAttribute("src", wantSrc);
                    }
                }
            }
        }
    }

    for (var k in craftData) {
        var cntEl = document.getElementById("lead-cnt-" + k);
        if (cntEl) {
            var cloudVal = globalTargetCounts[k] || 0;
            if (cntEl.textContent !== String(cloudVal)) {
                cntEl.textContent = cloudVal;
            }
        }
    }
}

window.changeLeaderTarget = function (key, val) {
    if (!isLeader) return;
    var current = globalTargetCounts[key] || 0;
    current += val;
    if (current < 0) current = 0;
    globalTargetCounts[key] = current;

    var cntEl = document.getElementById("lead-cnt-" + key);
    if (cntEl) cntEl.textContent = current;

    sendDataToCloud("targets", globalTargetCounts);
    renderMainDashboard();
};
// ============================================================
// 0. ГЛОБАЛЬНОЕ СОСТОЯНИЕ
// ============================================================
var hiddenRecipes = {};       // {key: true} — рецепты, скрытые ЭТОЙ фракцией
var globalIcons = { items: {}, materials: {} };

// Снимок базовых ключей из craftdata.js — чтобы отличать их от кастомных
var baseRecipeKeys = [];
document.addEventListener("DOMContentLoaded", function () {
    if (typeof craftData !== 'undefined') {
        baseRecipeKeys = Object.keys(craftData);
    }
});

// ============================================================
// 1. УТИЛИТЫ FIREBASE
// ============================================================
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

function isRecipeHidden(key) {
    return !!hiddenRecipes[key];
}

function isCustomRecipe(key) {
    return baseRecipeKeys.indexOf(key) === -1;
}

// ============================================================
// 2. ИКОНКИ ИЗ ОБЛАКА
// ============================================================
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
            if (typeof renderMainDashboard === 'function') renderMainDashboard();
            if (typeof renderLeaderEditPanel === 'function') renderLeaderEditPanel();
        })
        .catch(function (err) {
            console.error("Ошибка синхронизации иконок:", err);
        });
}

function getItemIconSrc(craftKey, item) {
    return globalIcons.items[craftKey] || item.image;
}

function getMaterialIconSrc(matName) {
    return globalIcons.materials[matName] || getMaterialImagePath(matName);
}

function getMaterialImagePath(name) {
    var slug = name.toLowerCase().replace(/[^a-zа-я0-9\s]/g, "").trim().replace(/\s+/g, "_");
    return "img/" + slug + ".png";
}

// ============================================================
// 3. СИНХРОНИЗАЦИЯ С ОБЛАКОМ
// ============================================================
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
            hiddenRecipes = safeData.hidden_recipes || {};

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

// ============================================================
// 4. СКЛАД И ПРИКАЗЫ (главная вкладка)
// ============================================================
function renderMainDashboard() {
    var ordersPanel = document.getElementById("leader-orders-display");
    var warehousePanel = document.getElementById("global-warehouse-display");
    if (!ordersPanel || !warehousePanel) return;

    var totalRequiredMaterials = {};
    var ordersHtml = "";

    for (var k in craftData) {
        if (isRecipeHidden(k)) continue;
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
        if (isRecipeHidden(k)) continue;
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

// ============================================================
// 5. ПАНЕЛЬ ЛИДЕРА (редактирование приказов + удаление)
// ============================================================
function renderLeaderEditPanel() {
    var p = document.getElementById("leader-edit-list");
    if (!p) return;

    var groupedCrafts = {};
    var visibleCount = 0;
    for (var k in craftData) {
        if (isRecipeHidden(k)) continue;
        visibleCount++;
        var loc = craftData[k].location || "bar_bench";
        if (!groupedCrafts[loc]) groupedCrafts[loc] = [];
        groupedCrafts[loc].push(k);
    }

    var currentRows = p.querySelectorAll(".recipe-item");

    if (currentRows.length !== visibleCount) {
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
                        + '<button class="btn btn-danger" title="Удалить рецепт" onclick="deleteCraft(\'' + k + '\')">🗑</button>'
                        + '</div>';
                    p.appendChild(row);
                });
            }
        }
    } else {
        for (var k in craftData) {
            if (isRecipeHidden(k)) continue;
            var cntEl = document.getElementById("lead-cnt-" + k);
            if (cntEl) {
                var cloudVal = globalTargetCounts[k] || 0;
                if (cntEl.textContent !== String(cloudVal)) {
                    cntEl.textContent = cloudVal;
                }
            }
        }
    }

    for (var k in craftData) {
        if (isRecipeHidden(k)) continue;
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

// ============================================================
// 6. УДАЛЕНИЕ РЕЦЕПТА (custom = DELETE, built-in = hide-флаг)
// ============================================================
window.deleteCraft = function (key) {
    if (!isLeader) {
        alert("Удалять рецепты может только Лидер фракции или Администратор.");
        return;
    }
    var item = craftData[key];
    if (!item) return;

    var isCustom = isCustomRecipe(key);
    var msg = isCustom
        ? "Удалить КАСТОМНЫЙ рецепт \"" + item.name + "\"?\n\nОн будет стёрт из Firebase и исчезнет у всех фракций."
        : "Скрыть ВСТРОЕННЫЙ рецепт \"" + item.name + "\" в вашей фракции?\n\nУ других фракций он останется. Отменить можно вручную через Firebase.";

    if (!confirm(msg)) return;

    if (isCustom) {
        // 1) Удаляем сам рецепт
        fetch(FIREBASE_URL + "/rooms/" + currentRoom + "/custom_recipes/" + key + ".json", {
            method: "DELETE"
        })
            .then(function () {
                // 2) Удаляем привязанную иконку (если была)
                return fetch(FIREBASE_URL + "/icons/items/" + encodeURIComponent(key) + ".json", {
                    method: "DELETE"
                }).catch(function () { /* если иконки нет — не страшно */ });
            })
            .then(function () {
                // 3) Убираем из локального объекта
                delete craftData[key];

                // 4) Сбрасываем цель, если она была выставлена
                if (globalTargetCounts[key]) {
                    delete globalTargetCounts[key];
                    sendDataToCloud("targets", globalTargetCounts);
                }

                renderLeaderEditPanel();
                renderMainDashboard();
                alert("Рецепт удалён из облака.");
            })
            .catch(function (err) {
                alert("Ошибка удаления: " + err.message);
            });
    } else {
        // Встроенный: ставим флаг скрытия
        hiddenRecipes[key] = true;

        fetch(FIREBASE_URL + "/rooms/" + currentRoom + "/hidden_recipes.json", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(hiddenRecipes)
        })
            .then(function (res) {
                if (!res.ok) throw new Error("HTTP " + res.status);
                return res.json();
            })
            .then(function () {
                // Сбрасываем приказ, если он был
                if (globalTargetCounts[key]) {
                    delete globalTargetCounts[key];
                    sendDataToCloud("targets", globalTargetCounts);
                }

                renderLeaderEditPanel();
                renderMainDashboard();
            })
            .catch(function (err) {
                // Откатываем флаг, если Firebase ругнулась
                delete hiddenRecipes[key];
                alert("Не удалось скрыть рецепт: " + err.message);
            });
    }
};

// Восстановление встроенного рецепта (пригодится админам)
window.unhideCraft = function (key) {
    if (!isLeader) return;
    if (!hiddenRecipes[key]) return;
    delete hiddenRecipes[key];

    fetch(FIREBASE_URL + "/rooms/" + currentRoom + "/hidden_recipes.json", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(hiddenRecipes)
    }).then(function () {
        renderLeaderEditPanel();
        renderMainDashboard();
    });
};
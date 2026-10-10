// ============================================================
// 0. ГЛОБАЛЬНОЕ СОСТОЯНИЕ
// ============================================================
var craftData = (typeof craftData !== 'undefined') ? craftData : {};
var hiddenRecipes = (typeof hiddenRecipes !== 'undefined') ? hiddenRecipes : {};
var globalIcons = (typeof globalIcons !== 'undefined') ? globalIcons : { items: {}, materials: {} };
var cloudRecipeKeys = {};

// ============================================================
// 1. УТИЛИТЫ
// ============================================================
function sanitizeFirebaseKey(key) {
    return String(key).replace(/[.#$\/\[\]]/g, "_");
}

function sanitizeFirebasePayload(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    var result = {};
    for (var k in obj) result[sanitizeFirebaseKey(k)] = obj[k];
    return result;
}

function isRecipeHidden(key) {
    return !!(hiddenRecipes && hiddenRecipes[key]);
}

function getMaterialImagePath(name) {
    var slug = name.toLowerCase().replace(/[^a-zа-я0-9\s]/g, "").trim().replace(/\s+/g, "_");
    return "img/" + slug + ".png";
}

// ============================================================
// 2. ИКОНКИ ИЗ ОБЛАКА
// ============================================================
function syncIconsFromCloud() {
    fetch(FIREBASE_URL + "/icons.json?nocache=" + Date.now(), {
        method: "GET", headers: { "Accept": "application/json" }
    })
        .then(function (r) { return r.json(); })
        .then(function (data) {
            var s = data || {};
            globalIcons.items = s.items || {};
            globalIcons.materials = s.materials || {};
            renderMainDashboard();
            renderLeaderEditPanel();
            renderMaterialsCatalog();
            if (typeof refreshSlicerSelect === 'function') refreshSlicerSelect();
        })
        .catch(function (err) { console.error("Ошибка синхронизации иконок:", err); });
}

function getItemIconSrc(craftKey, item) {
    return (globalIcons.items && globalIcons.items[craftKey]) || item.image || "";
}

function getMaterialIconSrc(matName) {
    return (globalIcons.materials && globalIcons.materials[matName]) || getMaterialImagePath(matName);
}

// ============================================================
// 3. СПРАВОЧНИК МАТЕРИАЛОВ (общий для всех фракций)
// ============================================================
function syncMaterialsCatalog() {
    fetch(FIREBASE_URL + "/materials_catalog.json?nocache=" + Date.now(), {
        method: "GET", headers: { "Accept": "application/json" }
    })
        .then(function (r) { return r.json(); })
        .then(function (data) {
            globalMaterialsCatalog = data || {};
            renderMaterialsCatalog();
        })
        .catch(function (err) { console.error("Ошибка каталога материалов:", err); });
}

function getAllAvailableMaterials() {
    var set = new Set();

    if (typeof globalMaterialsCatalog !== 'undefined' && globalMaterialsCatalog) {
        for (var ck in globalMaterialsCatalog) set.add(ck);
    }

    if (typeof craftData !== 'undefined' && craftData) {
        for (var rk in craftData) {
            if (isRecipeHidden(rk)) continue;
            var mats = craftData[rk].materials;
            if (!mats) continue;
            for (var mn in mats) set.add(mn);
        }
    }

    if (typeof globalWarehouse !== 'undefined' && globalWarehouse) {
        for (var wk in globalWarehouse) set.add(wk);
    }

    return Array.from(set).sort();
}

function renderMaterialsCatalog() {
    var p = document.getElementById("materials-catalog-display");
    if (!p) return;

    var mats = getAllAvailableMaterials();
    if (mats.length === 0) {
        p.innerHTML = '<div class="empty-message">Справочник пуст. Лидер может добавить материалы кнопкой во вкладке «Записать рецепт».</div>';
        return;
    }

    var html = "";
    mats.forEach(function (m) {
        var inCatalog = !!(globalMaterialsCatalog && globalMaterialsCatalog[m]);
        html += '<div class="material-item">'
            + '<div class="item-meta">'
            + '<img class="item-icon" src="' + getMaterialIconSrc(m) + '" onerror="this.style.visibility=\'hidden\'">'
            + '<div class="mat-info">'
            + '<span class="mat-name">' + m + '</span>'
            + '<span class="mat-needed-text">' + (inCatalog ? "В общем справочнике" : "Только в рецептах") + '</span>'
            + '</div></div></div>';
    });
    p.innerHTML = html;
}

window.addMaterialToCatalog = function (name) {
    if (!name || !name.trim()) return;
    name = name.trim();

    globalMaterialsCatalog = globalMaterialsCatalog || {};
    globalMaterialsCatalog[name] = true;

    fetch(FIREBASE_URL + "/materials_catalog.json", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sanitizeFirebasePayload(globalMaterialsCatalog))
    })
        .then(function (res) {
            if (!res.ok) throw new Error("HTTP " + res.status);
            return res.json();
        })
        .then(function () {
            renderMaterialsCatalog();
            // Перестраиваем селекты в конструкторе
            var container = document.getElementById("ingredients-constructor-container");
            if (container) {
                var rows = container.children;
                for (var i = 0; i < rows.length; i++) {
                    var sel = rows[i].querySelector("select");
                    if (!sel) continue;
                    var current = sel.value;
                    sel.innerHTML = "";
                    var mats = getAllAvailableMaterials();
                    mats.forEach(function (mat) {
                        var o = document.createElement("option");
                        o.value = mat; o.textContent = mat;
                        sel.appendChild(o);
                    });
                    if (current) sel.value = current;
                }
            }
            if (typeof refreshSlicerSelect === 'function') refreshSlicerSelect();
            alert("Материал \"" + name + "\" добавлен в справочник.");
        })
        .catch(function (err) { alert("Не удалось добавить материал: " + err.message); });
};

// ============================================================
// 4. СИНХРОНИЗАЦИЯ КОМНАТЫ
// ============================================================
function syncWithCloud() {
    if (!currentRoom) return;

    fetch(FIREBASE_URL + "/rooms/" + currentRoom + ".json?nocache=" + Date.now(), {
        method: "GET", headers: { "Accept": "application/json" }
    })
        .then(function (res) {
            if (!res.ok) throw new Error("HTTP " + res.status);
            return res.json();
        })
        .then(function (data) {
            var safeData = data || {};
            globalTargetCounts = safeData.targets || {};
            globalWarehouse = safeData.warehouse || {};
            hiddenRecipes = safeData.hidden_recipes || {};
            pendingRecipes = safeData.recipes_pending || {};

            var freshRecipes = safeData.custom_recipes || {};

            for (var oldKey in cloudRecipeKeys) {
                if (!freshRecipes[oldKey]) {
                    delete craftData[oldKey];
                    delete cloudRecipeKeys[oldKey];
                }
            }
            for (var key in freshRecipes) {
                craftData[key] = freshRecipes[key];
                cloudRecipeKeys[key] = true;
            }

            renderLeaderEditPanel();
            renderMainDashboard();
            renderPendingRecipes();
            renderMaterialsCatalog();
            if (typeof refreshSlicerSelect === 'function') refreshSlicerSelect();
        })
        .catch(function (err) {
            console.error("Ошибка синхронизации данных:", err);
            renderLeaderEditPanel();
            renderMainDashboard();
            renderPendingRecipes();
            renderMaterialsCatalog();
            if (typeof refreshSlicerSelect === 'function') refreshSlicerSelect();
        });
}

function sendDataToCloud(type, updatedData) {
    if (!currentRoom) return;
    fetch(FIREBASE_URL + "/rooms/" + currentRoom + "/" + type + ".json", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sanitizeFirebasePayload(updatedData))
    }).catch(function (err) { console.error("Ошибка отправки данных:", err); });
}

// ============================================================
// 5. ГЛАВНАЯ ВКЛАДКА: ПРИКАЗЫ И СКЛАД
// ============================================================
function renderMainDashboard() {
    var ordersPanel = document.getElementById("leader-orders-display");
    var warehousePanel = document.getElementById("global-warehouse-display");
    if (!ordersPanel || !warehousePanel) return;

    if (typeof craftData === 'undefined' || !craftData) {
        ordersPanel.innerHTML = '<div class="empty-message">База рецептов не загружена.</div>';
        warehousePanel.innerHTML = '<div class="empty-message">База рецептов не загружена.</div>';
        return;
    }

    var totalRequiredMaterials = {};
    var ordersHtml = "";
    var visibleRecipes = 0;

    for (var k in craftData) {
        if (isRecipeHidden(k)) continue;
        visibleRecipes++;

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

    if (visibleRecipes === 0) {
        ordersPanel.innerHTML = '<div class="empty-message">В базе фракции пока нет рецептов. Лидер может добавить их во вкладке «Записать рецепт».</div>';
    } else {
        ordersPanel.innerHTML = ordersHtml || '<div class="empty-message">Лидер фракции еще не выдал приказов на сборку ресурсов.</div>';
    }

    // Список материалов склада = (рецепты) ∪ (склад) ∪ (каталог)
    var allMats = new Set();
    for (var k2 in craftData) {
        if (isRecipeHidden(k2)) continue;
        var mats2 = craftData[k2].materials;
        if (!mats2) continue;
        for (var m2 in mats2) allMats.add(m2);
    }
    for (var wk in globalWarehouse) allMats.add(wk);
    for (var ck in globalMaterialsCatalog) allMats.add(ck);

    var sortedMats = Array.from(allMats).sort();

    // Сортировка: сначала "в плане", потом остальные. Внутри — по алфавиту.
    sortedMats.sort(function (a, b) {
        var aReq = totalRequiredMaterials[a] || 0;
        var bReq = totalRequiredMaterials[b] || 0;
        var aInPlan = aReq > 0 ? 0 : 1;
        var bInPlan = bReq > 0 ? 0 : 1;
        if (aInPlan !== bInPlan) return aInPlan - bInPlan;
        return a.localeCompare(b, "ru");
    });

    if (sortedMats.length === 0) {
        warehousePanel.innerHTML = '<div class="empty-message">Склад пуст. Нажмите «+ Материал» в шапке или добавьте рецепт с ингредиентами.</div>';
        return;
    }

    // Проверяем, надо ли пересобрать плитки
    var existingNames = [];
    var existingTiles = warehousePanel.querySelectorAll(".material-tile");
    for (var i = 0; i < existingTiles.length; i++) existingNames.push(existingTiles[i].getAttribute("data-mat-name"));

    var needsRebuild = existingTiles.length !== sortedMats.length;
    if (!needsRebuild) {
        for (var j = 0; j < sortedMats.length; j++) {
            if (existingNames[j] !== sortedMats[j]) { needsRebuild = true; break; }
        }
    }

    if (needsRebuild) {
        warehousePanel.innerHTML = "";
        sortedMats.forEach(function (m) {
            var tile = document.createElement("div");
            tile.className = "material-tile";
            tile.setAttribute("data-mat-name", m);

            tile.innerHTML = ''
                + '<div class="tile-name" title="' + m + '">' + m + '</div>'
                + '<img class="tile-icon" src="' + getMaterialIconSrc(m) + '" onerror="this.style.visibility=\'hidden\'">'
                + '<div class="tile-controls">'
                + '<button class="btn" onclick="changeWarehouseStock(\'' + m + '\', -1)">−</button>'
                + '<span class="counter" id="mat-stock-cnt-' + m + '">0</span>'
                + '<button class="btn btn-plus" onclick="changeWarehouseStock(\'' + m + '\', 1)">+</button>'
                + '</div>'
                + '<span class="tile-status" id="mat-status-text-' + m + '">Вне плана</span>';
            warehousePanel.appendChild(tile);
        });
    } else {
        // Обновляем иконки, если прилетели из облака
        sortedMats.forEach(function (m) {
            var tileEl = warehousePanel.querySelector('[data-mat-name="' + m + '"]');
            if (!tileEl) return;
            var img = tileEl.querySelector(".tile-icon");
            if (img) {
                var wantSrc = getMaterialIconSrc(m);
                if (img.getAttribute("src") !== wantSrc) {
                    img.style.visibility = "";
                    img.setAttribute("src", wantSrc);
                }
            }
        });
    }

    // Обновляем счётчики и статусы
    sortedMats.forEach(function (m) {
        var reqQty = totalRequiredMaterials[m] || 0;
        var stockQty = globalWarehouse[m] || 0;
        var left = reqQty - stockQty;

        var tileEl = warehousePanel.querySelector('[data-mat-name="' + m + '"]');
        var stockCnt = document.getElementById("mat-stock-cnt-" + m);
        var statusTxt = document.getElementById("mat-status-text-" + m);

        if (!tileEl || !stockCnt || !statusTxt) return;

        stockCnt.textContent = stockQty;

        tileEl.classList.remove("tile-need", "tile-done");

        if (reqQty > 0) {
            if (left <= 0) {
                tileEl.classList.add("tile-done");
                statusTxt.textContent = "Готово!";
            } else {
                tileEl.classList.add("tile-need");
                statusTxt.textContent = "Надо: " + left;
            }
        } else {
            statusTxt.textContent = "Вне плана";
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
// 6. ПАНЕЛЬ ЛИДЕРА: ПРИКАЗЫ
// ============================================================
function renderLeaderEditPanel() {
    var p = document.getElementById("leader-edit-list");
    if (!p) return;

    if (typeof craftData === 'undefined' || !craftData) {
        p.innerHTML = '<div class="empty-message">База рецептов не загружена.</div>';
        return;
    }

    var groupedCrafts = {};
    var visibleCount = 0;

    for (var k in craftData) {
        if (isRecipeHidden(k)) continue;
        visibleCount++;
        var loc = craftData[k].location || "bar_bench";
        if (!groupedCrafts[loc]) groupedCrafts[loc] = [];
        groupedCrafts[loc].push(k);
    }

    if (visibleCount === 0) {
        p.innerHTML = '<div class="empty-message">В базе фракции пока нет рецептов. Добавьте их через вкладку «Записать рецепт».</div>';
        return;
    }

    var currentRows = p.querySelectorAll(".recipe-item");
    if (currentRows.length !== visibleCount) {
        p.innerHTML = "";
        for (var locKey in locationNames) {
            if (groupedCrafts[locKey] && groupedCrafts[locKey].length > 0) {
                var header = document.createElement("h3");
                header.style.cssText = "color:#ffb74d;border-bottom:1px solid #333;padding-bottom:5px;margin-top:20px;font-size:14px;text-transform:uppercase;";
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
    }

    for (var k in craftData) {
        if (isRecipeHidden(k)) continue;
        var cntEl = document.getElementById("lead-cnt-" + k);
        if (cntEl) {
            var v = globalTargetCounts[k] || 0;
            if (cntEl.textContent !== String(v)) cntEl.textContent = v;
        }
    }
}

window.changeLeaderTarget = function (key, val) {
    if (!isLeader) return;
    var current = globalTargetCounts[key] || 0;
    current += val;
    if (current < 0) current = 0;
    globalTargetCounts[key] = current;

    var el = document.getElementById("lead-cnt-" + key);
    if (el) el.textContent = current;

    sendDataToCloud("targets", globalTargetCounts);
    renderMainDashboard();
};

// ============================================================
// 7. ПРЕДЛОЖКИ ОТ БОЙЦОВ
// ============================================================
function renderPendingRecipes() {
    var p = document.getElementById("pending-recipes-display");
    var badge = document.getElementById("pending-count-badge");
    if (!p) return;

    var ids = Object.keys(pendingRecipes || {});

    if (badge) {
        if (ids.length > 0) {
            badge.style.display = "inline-block";
            badge.textContent = ids.length;
        } else {
            badge.style.display = "none";
        }
    }

    if (ids.length === 0) {
        p.innerHTML = '<div class="empty-message">Пока нет предложек от бойцов.</div>';
        return;
    }

    var html = "";
    ids.forEach(function (id) {
        var rec = pendingRecipes[id];
        if (!rec) return;

        var materialsStr = "";
        for (var m in rec.materials) {
            materialsStr += '<span style="display:inline-block; background:#2b2b2b; border-radius:3px; padding:2px 6px; margin:2px; font-size:11px;">'
                + m + ' × ' + rec.materials[m] + '</span>';
        }

        var locName = (typeof locationNames !== 'undefined' && locationNames[rec.location]) || rec.location;
        var classNameInfo = rec.className ? '<div style="font-size:11px; color:#888; margin-top:4px;">classname: <code>' + rec.className + '</code></div>' : '';

        html += '<div class="recipe-item" style="flex-direction:column; align-items:stretch; padding:14px;">'
            + '<div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">'
            + '<div style="flex:1; min-width:0;">'
            + '<div style="font-weight:600; color:#fff; font-size:14px;">' + rec.name + '</div>'
            + '<div style="font-size:11px; color:#888; margin-top:2px;">' + locName + '</div>'
            + classNameInfo
            + '</div>'
            + '<div class="controls" style="flex-shrink:0;">'
            + '<button class="btn btn-plus" title="Одобрить" onclick="approvePendingRecipe(\'' + id + '\')">✓</button>'
            + '<button class="btn btn-danger" title="Отклонить" onclick="rejectPendingRecipe(\'' + id + '\')">✗</button>'
            + '</div>'
            + '</div>'
            + '<div style="margin-top:8px;">' + materialsStr + '</div>'
            + '</div>';
    });
    p.innerHTML = html;
}

window.approvePendingRecipe = function (pendingId) {
    if (!isLeader) return;
    var rec = pendingRecipes[pendingId];
    if (!rec) return;

    var craftKey = (rec.className || rec.name)
        .toLowerCase()
        .replace(/[^a-zа-я0-9\s]/g, "")
        .trim()
        .replace(/\s+/g, "_");
    if (!craftKey) craftKey = "recipe_" + Date.now();

    var newCraft = {
        name: rec.name,
        className: rec.className || null,
        image: "img/" + craftKey + ".png",
        location: rec.location,
        materials: rec.materials
    };

    fetch(FIREBASE_URL + "/rooms/" + currentRoom + "/custom_recipes/" + craftKey + ".json", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCraft)
    })
        .then(function () {
            return fetch(FIREBASE_URL + "/rooms/" + currentRoom + "/recipes_pending/" + pendingId + ".json", { method: "DELETE" });
        })
        .then(function () {
            craftData[craftKey] = newCraft;
            cloudRecipeKeys[craftKey] = true;
            delete pendingRecipes[pendingId];

            renderPendingRecipes();
            renderLeaderEditPanel();
            renderMainDashboard();
            if (typeof refreshSlicerSelect === 'function') refreshSlicerSelect();
            alert("Рецепт \"" + rec.name + "\" одобрен.");
        })
        .catch(function (err) { alert("Ошибка одобрения: " + err.message); });
};

window.rejectPendingRecipe = function (pendingId) {
    if (!isLeader) return;
    var rec = pendingRecipes[pendingId];
    if (!rec) return;
    if (!confirm("Отклонить рецепт \"" + rec.name + "\"?")) return;

    fetch(FIREBASE_URL + "/rooms/" + currentRoom + "/recipes_pending/" + pendingId + ".json", { method: "DELETE" })
        .then(function () {
            delete pendingRecipes[pendingId];
            renderPendingRecipes();
        })
        .catch(function (err) { alert("Ошибка: " + err.message); });
};

// ============================================================
// 8. УДАЛЕНИЕ РЕЦЕПТОВ
// ============================================================
window.deleteCraft = function (key) {
    if (!isLeader) { alert("Удалять рецепты может только Лидер или Администратор."); return; }
    var item = craftData[key];
    if (!item) return;

    if (!confirm("Удалить рецепт \"" + item.name + "\"?\n\nОн исчезнет у всех фракций.")) return;

    fetch(FIREBASE_URL + "/rooms/" + currentRoom + "/custom_recipes/" + key + ".json", { method: "DELETE" })
        .then(function () {
            return fetch(FIREBASE_URL + "/icons/items/" + encodeURIComponent(key) + ".json", { method: "DELETE" }).catch(function () { });
        })
        .then(function () {
            delete craftData[key];
            delete cloudRecipeKeys[key];

            if (globalTargetCounts[key]) {
                delete globalTargetCounts[key];
                sendDataToCloud("targets", globalTargetCounts);
            }

            renderLeaderEditPanel();
            renderMainDashboard();
            if (typeof refreshSlicerSelect === 'function') refreshSlicerSelect();
        })
        .catch(function (err) { alert("Ошибка удаления: " + err.message); });
};

// ============================================================
// 9. РУЧНОЕ ДОБАВЛЕНИЕ МАТЕРИАЛА НА СКЛАД
// ============================================================
document.addEventListener("DOMContentLoaded", function () {
    var btn = document.getElementById("btn-add-warehouse-material");
    if (!btn) return;

    btn.onclick = function () {
        if (!isLeader) { alert("Добавлять материалы может только Лидер или Администратор."); return; }
        var name = prompt("Название материала:");
        if (!name) return;
        name = name.trim();
        if (!name) return;

        if (globalWarehouse[name] !== undefined) {
            alert("Такой материал уже есть на складе.");
            return;
        }

        globalWarehouse[name] = 0;
        sendDataToCloud("warehouse", globalWarehouse);
        renderMainDashboard();
    };
});

// ============================================================
// 10. ПЕРВИЧНЫЙ РЕНДЕР
// ============================================================
document.addEventListener("DOMContentLoaded", function () {
    setTimeout(function () {
        renderMainDashboard();
        renderLeaderEditPanel();
        renderMaterialsCatalog();
    }, 100);
});
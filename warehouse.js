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
    
    var hasOrders = false;
    var totalRequiredMaterials = {};

    // 1. Подсчет необходимых материалов на основе приказов
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

    // 2. Умное обновление панели приказов лидера (без полной очистки innerHTML)
    if (!hasOrders) {
        ordersPanel.innerHTML = '<div class="empty-message">Лидер фракции еще не выдал приказов на сборку ресурсов.</div>';
    } else {
        // Создаем временный контейнер, чтобы собрать структуру один раз
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

    // 3. Собираем уникальный список хлама со всей игры
    var allPossibleMaterials = new Set();
    for (var k in craftData) {
        for (var m in craftData[k].materials) { allPossibleMaterials.add(m); }
    }
    var sortedMats = Array.from(allPossibleMaterials).sort();

    // 4. ТЕХНОЛОГИЯ ТОЧЕЧНОГО ОБНОВЛЕНИЯ (Проверяем, созданы ли уже строки склада)
    var currentRows = warehousePanel.querySelectorAll(".material-item");
    
    if (currentRows.length !== sortedMats.length) {
        // Если строк еще нет (первый запуск), строим каркас склада один раз
        warehousePanel.innerHTML = "";
        sortedMats.forEach(function(m) {
            var row = document.createElement("div");
            row.className = "material-item";
            row.setAttribute("data-mat-name", m); // Привязываем метку хлама к строке
            
            row.innerHTML = '<div class="item-meta"><img class="item-icon" src="' + getMaterialImagePath(m) + '"><div class="mat-info"><span class="mat-name">' + m + '</span><span class="mat-needed-text" id="mat-req-text-' + m + '"></span></div></div><div class="controls"><button class="btn" onclick="changeWarehouseStock(\'' + m + '\', -1)">-</button><span class="counter" style="color:#ffb74d;" id="mat-stock-cnt-' + m + '">0</span><button class="btn btn-plus" onclick="changeWarehouseStock(\'' + m + '\', 1)">+</button><span class="material-count" id="mat-status-text-' + m + '"></span></div>';
            warehousePanel.appendChild(row);
        });
    }

    // 5. Меняем только цифры и классы подсветки внутри живых строк
    sortedMats.forEach(function(m) {
        var reqQty = totalRequiredMaterials[m] || 0;
        var stockQty = globalWarehouse[m] || 0;
        var left = reqQty - stockQty;

        var rowElement = warehousePanel.querySelector('[data-mat-name="' + m + '"]');
        var reqTxtElement = document.getElementById("mat-req-text-" + m);
        var stockCntElement = document.getElementById("mat-stock-cnt-" + m);
        var statusTxtElement = document.getElementById("mat-status-text-" + m);

        if (rowElement && reqTxtElement && stockCntElement && statusTxtElement) {
            // Обновляем текст плана снабжения
            reqTxtElement.textContent = reqQty > 0 ? "По плану требуется: " + reqQty : "План на этот хлам не задан";
            
            // Обновляем текущее число на складе фракции
            stockCntElement.textContent = stockQty;

            // Пересчитываем статус и меняем подсветку строки без её перезагрузки
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
        if (!groupedCrafts[loc]) {
            groupedCrafts[loc] = [];
        }
        groupedCrafts[loc].push(k);
    }

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

            groupedCrafts[locKey].forEach(function(k) {
                var item = craftData[k];
                var row = document.createElement("div");
                row.className = "recipe-item";
                
                var currentTargetVal = globalTargetCounts[k] || 0;
                
                row.innerHTML = '<div class="item-meta"><img class="item-icon" src="' + item.image + '"><span class="recipe-name">' + item.name + '</span></div><div class="controls"><button class="btn" onclick="changeLeaderTarget(\'' + k + '\', -1)">-</button><span class="counter" id="lead-cnt-' + k + '">' + currentTargetVal + '</span><button class="btn btn-plus" onclick="changeLeaderTarget(\'' + k + '\', 1)">+</button></div>';
                p.appendChild(row);
            });
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
// Функция автоматического сбора всех существующих материалов для выпадающего списка
function getAllUniqueMaterials() {
    var mats = new Set();
    for (var k in craftData) {
        for (var m in craftData[k].materials) {
            mats.add(m);
        }
    }
    return Array.from(mats).sort();
}

// Инициализация кнопок конструктора после загрузки страницы
document.addEventListener("DOMContentLoaded", function() {
    var btnAddRow = document.getElementById("btn-add-ingredient-row");
    if (btnAddRow) {
        btnAddRow.onclick = function() {
            addIngredientRowConstructor();
        };
    }
    
    // Создаем первую строку автоматически при загрузке, чтобы форма не была пустой
    setTimeout(function() {
        var container = document.getElementById("ingredients-constructor-container");
        if (container && container.children.length === 0) {
            addIngredientRowConstructor();
        }
    }, 500);
});

// Функция добавления новой строки выбора хлама
function addIngredientRowConstructor() {
    var container = document.getElementById("ingredients-constructor-container");
    if (!container) return;

    var row = document.createElement("div");
    row.className = "ingredients-constructor-row";
    row.style.display = "flex";
    row.style.gap = "8px";
    row.style.marginBottom = "10px";
    row.style.alignItems = "center";

    // Создаем выпадающий список хлама
    var select = document.createElement("select");
    select.className = "select-field";
    select.style.marginBottom = "0";
    select.style.flex = "1";

    var allMats = getAllUniqueMaterials();
    allMats.forEach(function(mat) {
        var opt = document.createElement("option");
        opt.value = mat;
        opt.textContent = mat;
        select.appendChild(opt);
    });

    // Создаем поле ввода количества
    var input = document.createElement("input");
    input.type = "number";
    input.className = "input-field";
    input.style.marginBottom = "0";
    input.style.width = "70px";
    input.value = "1";
    input.min = "1";

    // Создаем кнопку удаления строки
    var btnDel = document.createElement("button");
    btnDel.type = "button";
    btnDel.className = "btn";
    btnDel.style.background = "#b71c1c";
    btnDel.style.width = "32px";
    btnDel.style.height = "32px";
    btnDel.textContent = "x";
    btnDel.onclick = function() {
        row.remove();
    };

    row.appendChild(select);
    row.appendChild(input);
    row.appendChild(btnDel);
    container.appendChild(row);
}
// Инициализация кнопки сохранения нового крафта
document.addEventListener("DOMContentLoaded", function() {
    var btnSave = document.getElementById("btn-save-new-craft");
    if (btnSave) {
        btnSave.onclick = function() {
            saveNewCraftFromConstructor();
        };
    }
});

// Функция сборки данных из конструктора и отправки в Firebase
function saveNewCraftFromConstructor() {
    if (!isLeader) {
        alert("Ошибка: Добавлять новые рецепты может только Лидер группировки!");
        return;
    }

    var nameInput = document.getElementById("new-craft-name");
    var locationSelect = document.getElementById("new-craft-location");
    var container = document.getElementById("ingredients-constructor-container");

    if (!nameInput || !locationSelect || !container) return;

    var craftName = nameInput.value.trim();
    var craftLocation = locationSelect.value;

    if (!craftName) {
        alert("Пожалуйста, введите название предмета!");
        return;
    }

    // Собираем материалы из всех созданных строк конструктора
    var selectedMaterials = {};
    var rows = container.children;

    if (rows.length === 0) {
        alert("Пожалуйста, добавьте хотя бы один ингредиент в рецепт!");
        return;
    }

    for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        var select = row.querySelector("select");
        var input = row.querySelector("input");

        if (select && input) {
            var matName = select.value;
            var matQty = parseInt(input.value, 10);

            if (isNaN(matQty) || matQty < 1) {
                alert("Количество для материала '" + matName + "' указано неверно!");
                return;
            }

            // Если один и тот же хлам выбран дважды, суммируем количество
            if (selectedMaterials[matName]) {
                selectedMaterials[matName] += matQty;
            } else {
                selectedMaterials[matName] = matQty;
            }
        }
    }

    // Создаем системный уникальный ключ из названия предмета
    var craftKey = craftName.toLowerCase()
        .replace(/[^a-zа-я0-9\s]/g, "")
        .trim()
        .replace(/\s+/g, "_");

    // Формируем новый объект рецепта
    var newCraftObject = {
        name: craftName,
        image: "img/" + craftKey + ".png",
        location: craftLocation,
        materials: selectedMaterials
    };

    // Сохраняем локально в память страницы
    craftData[craftKey] = newCraftObject;

    // Пушим обновленный рецепт в облако Firebase в ветку рецептов этой комнаты
    fetch(FIREBASE_URL + "/rooms/" + currentRoom + "/custom_recipes/" + craftKey + ".json", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCraftObject)
    })
    .then(function(res) {
        if (!res.ok) throw new Error("Ошибка сервера");
        return res.json();
    })
    .then(function() {
        alert("Рецепт '" + craftName + "' успешно добавлен в базу верстаков!");
        
        // Очищаем форму для нового ввода
        nameInput.value = "";
        container.innerHTML = "";
        addIngredientRowConstructor(); // Создаем одну чистую строку
        
        // Перерисовываем списки на экране
        if (typeof renderLeaderEditPanel === "function") {
            // Принудительно очищаем старые списки, чтобы они перестроились с учетом нового предмета
            document.getElementById("leader-edit-list").innerHTML = "";
            renderLeaderEditPanel();
        }
        syncWithCloud();
    })
    .catch(function(err) {
        alert("Не удалось сохранить рецепт в облако: " + err.message);
    });
}
// Обновленная функция загрузки данных: скачивает планы, склад и кастомные рецепты
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
        
        // Подгружаем кастомные рецепты, созданные лидерами этой комнаты
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

// Переписанная функция отображения склада: теперь группирует хлам по локациям верстаков
function renderMainDashboard() {
    var ordersPanel = document.getElementById("leader-orders-display");
    var warehousePanel = document.getElementById("global-warehouse-display");
    if (!ordersPanel || !warehousePanel) return;
    
    ordersPanel.innerHTML = "";
    warehousePanel.innerHTML = "";
    var hasOrders = false;
    var totalRequiredMaterials = {};

    // Отрисовка текущих приказов лидера
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

    // Собираем весь хлам из базы рецептов
    var allPossibleMaterials = new Set();
    for (var k in craftData) {
        for (var m in craftData[k].materials) { allPossibleMaterials.add(m); }
    }

    // Отрисовка общего склада хлама
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

// Переписанная панель лидера: группирует доступное для заказа оружие по заголовкам верстаков
function renderLeaderEditPanel() {
    var p = document.getElementById("leader-edit-list");
    if (!p) return;

    // Группируем ключи предметов по их локациям
    var groupedCrafts = {};
    for (var k in craftData) {
        var loc = craftData[k].location || "bar_bench"; // если локация не задана, по дефолту Верстак: Бар
        if (!groupedCrafts[loc]) {
            groupedCrafts[loc] = [];
        }
        groupedCrafts[loc].push(k);
    }

    // Перерисовываем панель лидера с красивыми заголовками локаций фракций
    p.innerHTML = "";
    
    // Пробегаемся по всем известным локациям по порядку из справочника locationNames
    for (var locKey in locationNames) {
        if (groupedCrafts[locKey] && groupedCrafts[locKey].length > 0) {
            // Создаем красивый текстовый заголовок для локации верстака/обмена
            var header = document.createElement("h3");
            header.style.color = "#ffb74d";
            header.style.borderBottom = "1px solid #333";
            header.style.paddingBottom = "5px";
            header.style.marginTop = "20px";
            header.style.fontSize = "14px";
            header.style.textTransform = "uppercase";
            header.textContent = locationNames[locKey];
            p.appendChild(header);

            // Выводим строки предметов, привязанных к этой локации
            groupedCrafts[locKey].forEach(function(k) {
                var item = craftData[k];
                var row = document.createElement("div");
                row.className = "recipe-item";
                
                var currentTargetVal = globalTargetCounts[k] || 0;
                
                row.innerHTML = '<div class="item-meta"><img class="item-icon" src="' + item.image + '" onerror="this.style.display=\'none\'"><span class="recipe-name">' + item.name + '</span></div><div class="controls"><button class="btn" onclick="changeLeaderTarget(\'' + k + '\', -1)">-</button><span class="counter" id="lead-cnt-' + k + '">' + currentTargetVal + '</span><button class="btn btn-plus" onclick="changeLeaderTarget(\'' + k + '\', 1)">+</button></div>';
                p.appendChild(row);
            });
        }
    }
}

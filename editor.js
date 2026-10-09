// ============================================================
// КОНСТРУКТОР РЕЦЕПТОВ (вкладка «Записать рецепт»)
// ============================================================

function getAvailableMaterialsForSelect() {
    if (typeof getAllAvailableMaterials === 'function') {
        return getAllAvailableMaterials();
    }
    // Fallback, если warehouse.js ещё не загрузился
    var mats = new Set();
    if (typeof craftData !== 'undefined') {
        for (var k in craftData) {
            if (!craftData[k].materials) continue;
            for (var m in craftData[k].materials) mats.add(m);
        }
    }
    return Array.from(mats).sort();
}

document.addEventListener("DOMContentLoaded", function () {
    var btnAddRow = document.getElementById("btn-add-ingredient-row");
    if (btnAddRow) btnAddRow.onclick = function () { addIngredientRowConstructor(); };

    var btnAddMat = document.getElementById("btn-add-new-material");
    if (btnAddMat) {
        btnAddMat.onclick = function () {
            if (!isLeader) return;
            var name = prompt("Название нового материала:");
            if (!name) return;
            name = name.trim();
            if (!name) return;
            if (typeof addMaterialToCatalog === 'function') addMaterialToCatalog(name);
        };
    }

    var btnSave = document.getElementById("btn-save-new-craft");
    if (btnSave) btnSave.onclick = function () { saveNewCraftFromConstructor(); };

    // Первая строка материалов — через 300мс, чтобы каталог успел подгрузиться
    setTimeout(function () {
        var c = document.getElementById("ingredients-constructor-container");
        if (c && c.children.length === 0) addIngredientRowConstructor();
    }, 300);
});

function addIngredientRowConstructor() {
    var container = document.getElementById("ingredients-constructor-container");
    if (!container) return;

    var row = document.createElement("div");
    row.className = "ingredients-constructor-row";

    var select = document.createElement("select");
    select.className = "select-field";

    var mats = getAvailableMaterialsForSelect();
    if (mats.length === 0) {
        var opt = document.createElement("option");
        opt.value = ""; opt.textContent = "— Нет материалов в справочнике —";
        select.appendChild(opt);
    } else {
        mats.forEach(function (mat) {
            var o = document.createElement("option");
            o.value = mat; o.textContent = mat;
            select.appendChild(o);
        });
    }

    var input = document.createElement("input");
    input.type = "number";
    input.className = "input-field";
    input.value = "1";
    input.min = "1";

    var btnDel = document.createElement("button");
    btnDel.type = "button";
    btnDel.className = "btn btn-danger";
    btnDel.textContent = "×";
    btnDel.onclick = function () { row.remove(); };

    row.appendChild(select);
    row.appendChild(input);
    row.appendChild(btnDel);
    container.appendChild(row);
}

function saveNewCraftFromConstructor() {
    var nameInput = document.getElementById("new-craft-name");
    var classInput = document.getElementById("new-craft-classname");
    var locationSelect = document.getElementById("new-craft-location");
    var container = document.getElementById("ingredients-constructor-container");

    if (!nameInput || !locationSelect || !container) return;

    var craftName = nameInput.value.trim();
    var craftClass = classInput ? classInput.value.trim() : "";
    var craftLocation = locationSelect.value;

    if (!craftName) { alert("Введите название предмета."); return; }

    // Собираем материалы
    var selectedMaterials = {};
    var rows = container.children;
    if (rows.length === 0) { alert("Добавьте хотя бы один ингредиент."); return; }

    var hasEmpty = false;
    for (var i = 0; i < rows.length; i++) {
        var sel = rows[i].querySelector("select");
        var inp = rows[i].querySelector("input");
        if (!sel || !inp) continue;
        var matName = sel.value;
        var qty = parseInt(inp.value, 10);
        if (!matName) { hasEmpty = true; continue; }
        if (isNaN(qty) || qty < 1) {
            alert("Количество для \"" + matName + "\" указано неверно.");
            return;
        }
        if (selectedMaterials[matName]) selectedMaterials[matName] += qty;
        else selectedMaterials[matName] = qty;
    }
    if (hasEmpty) { alert("Выберите материал во всех строках."); return; }
    if (Object.keys(selectedMaterials).length === 0) { alert("Нет ни одного материала."); return; }

    // Ключ: className если есть, иначе транслит имени
    var craftKey = (craftClass || craftName)
        .toLowerCase()
        .replace(/[^a-zа-я0-9\s]/g, "")
        .trim()
        .replace(/\s+/g, "_");
    if (!craftKey) craftKey = "recipe_" + Date.now();

    var newCraft = {
        name: craftName,
        className: craftClass || null,
        image: "img/" + craftKey + ".png",
        location: craftLocation,
        materials: selectedMaterials
    };

    if (isLeader) {
        // Лидер: пишем сразу в custom_recipes
        fetch(FIREBASE_URL + "/rooms/" + currentRoom + "/custom_recipes/" + craftKey + ".json", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newCraft)
        })
            .then(function (res) {
                if (!res.ok) throw new Error("HTTP " + res.status);
                return res.json();
            })
            .then(function () {
                craftData[craftKey] = newCraft;
                alert("Рецепт \"" + craftName + "\" добавлен в базу.");
                resetConstructor();
                renderLeaderEditPanel();
                renderMainDashboard();
                syncWithCloud();
            })
            .catch(function (err) { alert("Ошибка: " + err.message); });
    } else {
        // Боец: пишем в recipes_pending
        var pendingId = "p_" + Date.now() + "_" + Math.floor(Math.random() * 9999);
        var pendingObj = {
            name: newCraft.name,
            className: newCraft.className,
            location: newCraft.location,
            materials: newCraft.materials,
            proposedAt: Date.now(),
            proposedBy: currentRoom
        };
        fetch(FIREBASE_URL + "/rooms/" + currentRoom + "/recipes_pending/" + pendingId + ".json", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(pendingObj)
        })
            .then(function (res) {
                if (!res.ok) throw new Error("HTTP " + res.status);
                return res.json();
            })
            .then(function () {
                alert("Рецепт отправлен на проверку лидеру фракции.");
                resetConstructor();
                syncWithCloud();
            })
            .catch(function (err) { alert("Ошибка отправки: " + err.message); });
    }
}

function resetConstructor() {
    var nameInput = document.getElementById("new-craft-name");
    var classInput = document.getElementById("new-craft-classname");
    var container = document.getElementById("ingredients-constructor-container");
    if (nameInput) nameInput.value = "";
    if (classInput) classInput.value = "";
    if (container) {
        container.innerHTML = "";
        addIngredientRowConstructor();
    }
}
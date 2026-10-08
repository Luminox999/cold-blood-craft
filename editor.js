function getAllUniqueMaterials() {
    if (typeof craftData === 'undefined') return [];
    var mats = new Set();
    for (var k in craftData) {
        if (!craftData[k].materials) continue;
        for (var m in craftData[k].materials) mats.add(m);
    }
    return Array.from(mats).sort();
}

document.addEventListener("DOMContentLoaded", function () {
    var btnAddRow = document.getElementById("btn-add-ingredient-row");
    if (btnAddRow) {
        btnAddRow.onclick = function () {
            addIngredientRowConstructor();
        };
    }

    setTimeout(function () {
        var container = document.getElementById("ingredients-constructor-container");
        if (container && container.children.length === 0) {
            addIngredientRowConstructor();
        }
    }, 500);
});

function addIngredientRowConstructor() {
    var container = document.getElementById("ingredients-constructor-container");
    if (!container) return;

    var row = document.createElement("div");
    row.className = "ingredients-constructor-row";

    var select = document.createElement("select");
    select.className = "select-field";
    select.style.marginBottom = "0";
    select.style.flex = "1";

    var allMats = getAllUniqueMaterials();
    allMats.forEach(function (mat) {
        var opt = document.createElement("option");
        opt.value = mat;
        opt.textContent = mat;
        select.appendChild(opt);
    });

    var input = document.createElement("input");
    input.type = "number";
    input.className = "input-field";
    input.style.marginBottom = "0";
    input.style.width = "70px";
    input.value = "1";
    input.min = "1";

    var btnDel = document.createElement("button");
    btnDel.type = "button";
    btnDel.className = "btn";
    btnDel.style.background = "#b71c1c";
    btnDel.textContent = "x";
    btnDel.onclick = function () { row.remove(); };

    row.appendChild(select);
    row.appendChild(input);
    row.appendChild(btnDel);
    container.appendChild(row);
}

document.addEventListener("DOMContentLoaded", function () {
    var btnSave = document.getElementById("btn-save-new-craft");
    if (btnSave) {
        btnSave.onclick = function () {
            saveNewCraftFromConstructor();
        };
    }
});

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

            if (selectedMaterials[matName]) {
                selectedMaterials[matName] += matQty;
            } else {
                selectedMaterials[matName] = matQty;
            }
        }
    }

    var craftKey = craftName.toLowerCase()
        .replace(/[^a-zа-я0-9\s]/g, "")
        .trim()
        .replace(/\s+/g, "_");

    var newCraftObject = {
        name: craftName,
        image: "img/" + craftKey + ".png",
        location: craftLocation,
        materials: selectedMaterials
    };

    craftData[craftKey] = newCraftObject;

    fetch(FIREBASE_URL + "/rooms/" + currentRoom + "/custom_recipes/" + craftKey + ".json", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCraftObject)
    })
        .then(function (res) {
            if (!res.ok) throw new Error("Ошибка сервера");
            return res.json();
        })
        .then(function () {
            alert("Рецепт '" + craftName + "' успешно добавлен в базу верстаков!");
            nameInput.value = "";
            container.innerHTML = "";
            addIngredientRowConstructor();

            var editList = document.getElementById("leader-edit-list");
            if (editList) editList.innerHTML = "";
            renderLeaderEditPanel();
            syncWithCloud();
        })
        .catch(function (err) {
            alert("Не удалось сохранить рецепт в облако: " + err.message);
        });
}
// ============================================================
// ИМПОРТ JSON В FIREBASE
// ============================================================

document.addEventListener("DOMContentLoaded", function () {
    var targetSelect = document.getElementById("import-target");
    var customWrapper = document.getElementById("import-custom-path-wrapper");
    var btnImport = document.getElementById("btn-import-json");
    var btnValidate = document.getElementById("btn-import-validate");
    var btnClear = document.getElementById("btn-import-clear");
    var textarea = document.getElementById("import-json-textarea");
    var statusEl = document.getElementById("import-status");

    if (!targetSelect || !btnImport || !textarea) return;

    // Показываем/скрываем поле «свой путь»
    targetSelect.addEventListener("change", function () {
        if (targetSelect.value === "custom") {
            customWrapper.style.display = "block";
        } else {
            customWrapper.style.display = "none";
        }
    });

    function setStatus(msg, color) {
        statusEl.style.color = color || "#81c784";
        statusEl.textContent = msg;
    }

    // Собираем путь из выбора
    function resolvePath() {
        var val = targetSelect.value;
        if (val === "custom") {
            var custom = document.getElementById("import-custom-path").value.trim();
            if (!custom) throw new Error("Укажи путь вручную");
            if (custom.charAt(0) !== "/") custom = "/" + custom;
            return custom;
        }
        if (val === "materials_catalog") return "/materials_catalog";
        // остальные варианты — внутри фракции
        if (!currentRoom) throw new Error("Сначала зайди в штаб под фракцией");
        return "/rooms/" + currentRoom + "/" + val;
    }

    // Проверка JSON без отправки
    btnValidate.onclick = function () {
        var raw = textarea.value.trim();
        if (!raw) { setStatus("✗ Пусто. Вставь JSON.", "#ff5252"); return; }
        try {
            var parsed = JSON.parse(raw);
            var count = 0;
            if (parsed && typeof parsed === "object") {
                count = Array.isArray(parsed) ? parsed.length : Object.keys(parsed).length;
            }
            setStatus("✓ JSON валиден. Верхнеуровневых ключей: " + count + ".", "#81c784");
        } catch (err) {
            setStatus("✗ JSON невалиден: " + err.message, "#ff5252");
        }
    };

    // Очистить
    btnClear.onclick = function () {
        textarea.value = "";
        setStatus("");
    };

    // Импорт
    btnImport.onclick = function () {
        var raw = textarea.value.trim();
        if (!raw) { setStatus("✗ Пусто. Вставь JSON.", "#ff5252"); return; }

        var parsed;
        try {
            parsed = JSON.parse(raw);
        } catch (err) {
            setStatus("✗ JSON невалиден: " + err.message, "#ff5252");
            return;
        }

        var path;
        try {
            path = resolvePath();
        } catch (err) {
            setStatus("✗ " + err.message, "#ff5252");
            return;
        }

        // Санитайзер ключей (Firebase запрещает . # $ / [ ])
        function sanitizeKeys(obj) {
            if (obj === null || typeof obj !== "object") return obj;
            if (Array.isArray(obj)) return obj.map(sanitizeKeys);
            var result = {};
            for (var k in obj) {
                var safeKey = String(k).replace(/[.#$\/\[\]]/g, "_");
                result[safeKey] = sanitizeKeys(obj[k]);
            }
            return result;
        }

        var safe = sanitizeKeys(parsed);

        var checkMsg = "PUT " + path + " ...";
        setStatus(checkMsg, "#ffb74d");

        fetch(FIREBASE_URL + path + ".json", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(safe)
        })
            .then(function (res) {
                if (!res.ok) throw new Error("HTTP " + res.status);
                return res.json();
            })
            .then(function () {
                var count = 0;
                if (safe && typeof safe === "object") {
                    count = Array.isArray(safe) ? safe.length : Object.keys(safe).length;
                }
                setStatus("✓ Успешно импортировано в " + path + ". Записей: " + count + ".", "#81c784");
                // Обновляем локальный кэш, чтобы сразу увидеть в интерфейсе
                if (typeof syncWithCloud === "function") syncWithCloud();
                if (typeof syncMaterialsCatalog === "function") syncMaterialsCatalog();
            })
            .catch(function (err) {
                setStatus("✗ Ошибка импорта: " + err.message, "#ff5252");
            });
    };
});

// Показать вкладку для лидера/админа
document.addEventListener("DOMContentLoaded", function () {
    // Вкладка появляется только после входа (когда isLeader === true)
    // Проверяем каждые 500мс, потому что isLeader меняется после логина
    var checkInterval = setInterval(function () {
        var nav = document.getElementById("import-tab-nav");
        if (nav && typeof isLeader !== "undefined" && isLeader) {
            nav.style.display = "block";
            clearInterval(checkInterval);
        }
    }, 500);
});
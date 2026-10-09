// ============================================================
// ПЕРЕХВАТ ОШИБОК
// ============================================================
window.onerror = function (message, source, lineno) {
    var logEl = document.getElementById('tester-status-log');
    if (logEl) {
        logEl.style.color = '#ff5252';
        logEl.innerHTML += '<div style="margin-top:5px; font-weight:bold;">КРИТИЧЕСКИЙ СБОЙ:</div>';
        logEl.innerHTML += '<div>Ошибка: ' + message + '</div>';
        logEl.innerHTML += '<div>Файл: ' + (source || '').split('/').pop() + ' (Строка: ' + lineno + ')</div>';
    }
    return false;
};

// ============================================================
// АВТОТЕСТЫ
// ============================================================
function runSystemAutoTests() {
    var logEl = document.getElementById('tester-status-log');
    if (!logEl) return;

    try {
        // 1. locations.js должен быть загружен
        if (typeof locationNames === 'undefined') {
            throw new Error("locations.js не загружен (нет locationNames)");
        }
        logEl.innerHTML += '<div>Тест 1: Справочник локаций загружен (' + Object.keys(locationNames).length + ' шт).</div>';

        // 2. craftData должен существовать как объект (может быть пустым — это нормально)
        if (typeof craftData === 'undefined') {
            throw new Error("craftData не объявлен. Проверь, что warehouse.js загружен.");
        }
        var recipeCount = Object.keys(craftData).length;
        logEl.innerHTML += '<div>Тест 2: craftData доступен. Рецептов в кэше сейчас: ' + recipeCount + ' (заполнится из Firebase после логина).</div>';

        // 3. FIREBASE_URL
        if (typeof FIREBASE_URL === 'undefined' || FIREBASE_URL.indexOf('firebasedatabase.app') === -1) {
            throw new Error("FIREBASE_URL не задан или указан неверно");
        }
        if (FIREBASE_URL.slice(-1) === "/") {
            logEl.innerHTML += '<div style="color:#ffb74d;">ВНИМАНИЕ: FIREBASE_URL заканчивается на слэш — будут двойные слэши в запросах.</div>';
        }
        logEl.innerHTML += '<div>Тест 3: Firebase подключён.</div>';

        // 4. Ключевые DOM-элементы
        var requiredIds = [
            'room-input', 'btn-enter-room',
            'leader-orders-display', 'global-warehouse-display',
            'leader-edit-list', 'pending-recipes-display', 'pending-count-badge',
            'suggest-tab', 'new-craft-name', 'new-craft-classname',
            'new-craft-location', 'ingredients-constructor-container',
            'btn-add-ingredient-row', 'btn-save-new-craft',
            'materials-catalog-display', 'btn-add-warehouse-material',
            'screenshot-input', 'cropper-zone'
        ];
        var missing = [];
        requiredIds.forEach(function (id) {
            if (!document.getElementById(id)) missing.push(id);
        });
        if (missing.length > 0) {
            throw new Error("Не найдены элементы: " + missing.join(", "));
        }
        logEl.innerHTML += '<div>Тест 4: Все ' + requiredIds.length + ' элементов интерфейса на месте.</div>';

        // 5. Ключевые функции
        var requiredFns = [
            'switchTab', 'syncWithCloud', 'sendDataToCloud',
            'renderMainDashboard', 'renderLeaderEditPanel',
            'renderPendingRecipes', 'renderMaterialsCatalog',
            'getAllAvailableMaterials', 'initSlicerInterface',
            'addIngredientRowConstructor', 'saveNewCraftFromConstructor'
        ];
        var missingFn = [];
        requiredFns.forEach(function (fn) {
            if (typeof window[fn] !== 'function') missingFn.push(fn);
        });
        if (missingFn.length > 0) {
            throw new Error("Не найдены функции: " + missingFn.join(", "));
        }
        logEl.innerHTML += '<div>Тест 5: Все ' + requiredFns.length + ' функций доступны.</div>';

        // 6. Проверка, что все локации в рецептах есть в справочнике (если рецепты уже подгружены)
        var missingLocs = [];
        for (var k in craftData) {
            var loc = craftData[k].location;
            if (loc && !locationNames[loc] && missingLocs.indexOf(loc) === -1) missingLocs.push(loc);
        }
        if (missingLocs.length > 0) {
            logEl.innerHTML += '<div style="color:#ffb74d;">ВНИМАНИЕ: рецепты ссылаются на неизвестные локации: ' + missingLocs.join(", ") + '</div>';
        } else {
            logEl.innerHTML += '<div>Тест 6: Все локации рецептов совпадают со справочником.</div>';
        }

        logEl.innerHTML += '<div style="color:#64b5f6; font-weight:bold; margin-top:5px;">Система готова. Заходите в штаб под фракцией.</div>';

    } catch (err) {
        logEl.style.color = '#ff5252';
        logEl.innerHTML += '<div style="margin-top:5px; font-weight:bold;">ТЕСТ НЕ ПРОЙДЕН: ' + err.message + '</div>';
    }
}

window.addEventListener('load', runSystemAutoTests);
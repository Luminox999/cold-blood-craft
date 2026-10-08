// Перехватчик ошибок
window.onerror = function (message, source, lineno) {
    var logEl = document.getElementById('tester-status-log');
    if (logEl) {
        logEl.style.color = '#ff5252';
        logEl.innerHTML += '<div style="margin-top:5px; font-weight:bold;">КРИТИЧЕСКИЙ СБОЙ В КОДЕ:</div>';
        logEl.innerHTML += '<div>Ошибка: ' + message + '</div>';
        logEl.innerHTML += '<div>Файл: ' + (source || '').split('/').pop() + ' (Строка: ' + lineno + ')</div>';
    }
    return false;
};

function runSystemAutoTests() {
    var logEl = document.getElementById('tester-status-log');
    if (!logEl) return;

    try {
        if (typeof craftData === 'undefined' || !craftData.sr25) {
            throw new Error("Файл craftdata.js не подключен или поврежден!");
        }
        logEl.innerHTML += '<div>Тест 1: База рецептов из craftdata.js успешно считана.</div>';

        if (typeof locationNames === 'undefined') {
            throw new Error("Справочник локаций locationNames не загружен!");
        }
        logEl.innerHTML += '<div>Тест 2: Справочник локаций locationNames обнаружен.</div>';

        // Проверка, что все локации рецептов есть в справочнике
        var missingLocs = [];
        for (var k in craftData) {
            var loc = craftData[k].location;
            if (loc && !locationNames[loc] && missingLocs.indexOf(loc) === -1) {
                missingLocs.push(loc);
            }
        }
        if (missingLocs.length > 0) {
            throw new Error("Рецепты ссылаются на неизвестные локации: " + missingLocs.join(", "));
        }
        logEl.innerHTML += '<div>Тест 3: Все локации рецептов совпадают со справочником.</div>';

        if (typeof FIREBASE_URL === 'undefined' || FIREBASE_URL.indexOf('firebasedatabase.app') === -1) {
            throw new Error("Ссылка на Firebase в модуле авторизации указана неверно!");
        }
        if (FIREBASE_URL.slice(-1) === "/") {
            logEl.innerHTML += '<div style="color:#ffb74d;">ВНИМАНИЕ: FIREBASE_URL заканчивается на слэш — это может сломать запросы!</div>';
        }
        logEl.innerHTML += '<div>Тест 4: Ссылка на Firebase Realtime Database вшита и проверена.</div>';

        var requiredIds = ['room-input', 'btn-enter-room', 'leader-orders-display', 'global-warehouse-display', 'leader-edit-list'];
        requiredIds.forEach(function (id) {
            if (!document.getElementById(id)) {
                throw new Error("В файле index.html потерялся обязательный элемент с id=" + id);
            }
        });
        logEl.innerHTML += '<div>Тест 5: Все элементы интерфейса в index.html обнаружены.</div>';
        logEl.innerHTML += '<div style="color: #64b5f6; font-weight:bold; margin-top:5px;">Системный статус: Все модули успешно связаны.</div>';
    } catch (err) {
        logEl.style.color = '#ff5252';
        logEl.innerHTML += '<div style="margin-top:5px; font-weight:bold;">ТЕСТ НЕ ПРОЙДЕН: ' + err.message + '</div>';
    }
}
window.addEventListener('load', runSystemAutoTests);
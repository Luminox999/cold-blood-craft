// Перехватчик ошибок для Блокнота
window.onerror = function(message, source, lineno, colno, error) {
    var logEl = document.getElementById('tester-status-log');
    if (logEl) {
        logEl.style.color = '#ff5252';
        logEl.innerHTML += '<div style="margin-top:5px; font-weight:bold;">КРИТИЧЕСКИЙ СБОЙ В КОДЕ:</div>';
        logEl.innerHTML += '<div>Ошибка: ' + message + '</div>';
        logEl.innerHTML += '<div>Файл: ' + source.split('/').pop() + ' (Строка: ' + lineno + ')</div>';
    }
    return false;
};

// Функция запуска проверок систем
function runSystemAutoTests() {
    var logEl = document.getElementById('tester-status-log');
    if (!logEl) return;
    
    try {
        if (typeof craftData === 'undefined' || !craftData.sr25) {
            throw new Error("Файл craftdata.js не подключен или поврежден!");
        }
        logEl.innerHTML += '<div>Тест 1: База рецептов из craftdata.js успешно считана.</div>';

        if (typeof FIREBASE_URL === 'undefined' || FIREBASE_URL.indexOf('firebasedatabase.app') === -1) {
            throw new Error("Ссылка на Firebase в модуле авторизации указана неверно!");
        }
        logEl.innerHTML += '<div>Тест 2: Ссылка на Firebase Realtime Database вшита и проверена.</div>';

        var requiredIds = ['room-input', 'btn-enter-room', 'leader-orders-display', 'global-warehouse-display'];
        requiredIds.forEach(function(id) {
            if (!document.getElementById(id)) {
                throw new Error("В файле index.html потерялся обязательный элемент с id=" + id);
            }
        });
        logEl.innerHTML += '<div>Тест 3: Все элементы интерфейса в index.html обнаружены.</div>';
        logEl.innerHTML += '<div style="color: #64b5f6; font-weight:bold; margin-top:5px;">Системный статус: Все модули успешно связаны фракцией.</div>';
    } catch (err) {
        logEl.style.color = '#ff5252';
        logEl.innerHTML += '<div style="margin-top:5px; font-weight:bold;">ТЕСТ НЕ ПРОЙДЕН: ' + err.message + '</div>';
    }
}
window.addEventListener('load', runSystemAutoTests);

// Точный адрес вашей облачной базы данных Firebase
const FIREBASE_URL = "https://cold-blood-calc-default-rtdb.europe-west1.firebasedatabase.app";

var currentRoom = "";
var isLeader = false;
var globalTargetCounts = {};
var globalWarehouse = {};

window.switchTab = function(tabId) {
    document.querySelectorAll('.tab-content').forEach(function(el) {
        el.style.display = 'none';
    });
    document.querySelectorAll('.tab-btn').forEach(function(el) {
        el.classList.remove('active');
    });
    
    var activeTab = document.getElementById(tabId);
    if (activeTab) {
        activeTab.style.display = 'flex';
    }
    
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    }
};

document.addEventListener("DOMContentLoaded", function() {
    const enterBtn = document.getElementById('btn-enter-room');
    const passInputFields = document.getElementById('leader-pass-input');
    if (!enterBtn) return;

    // Функция выполнения входа в штаб
    function executeLogin() {
        const roomSelect = document.getElementById('room-input');
        const roomInput = roomSelect.options[roomSelect.selectedIndex].text;
        const passInput = passInputFields.value.trim();

        currentRoom = roomSelect.value;
        document.getElementById('current-room-title').textContent = roomInput.toUpperCase();
        
        if (passInput === "свобода123") {
            isLeader = true;
            document.getElementById('leader-tab-nav').style.display = 'block';
            document.getElementById('user-status-text').textContent = "Режим ЛИДЕРА ГРУППИРОВКИ";
            document.getElementById('user-status-text').style.color = "#ffb74d";
        } else {
            document.getElementById('user-status-text').textContent = "Режим БОЙЦА";
        }

        document.getElementById('auth-screen').style.display = 'none';
        
        // Пробуждаем модуль нарезчика иконок, чтобы он работал со скриншотами
        if (typeof initSlicerInterface === 'function') {
            initSlicerInterface();
        }

        // Запуск фоновой синхронизации склада
        if (typeof syncWithCloud === 'function') {
            syncWithCloud();
            setInterval(syncWithCloud, 3000);
        }
    }

    // Вход по клику мышки на кнопку
    enterBtn.onclick = function() {
        executeLogin();
    };

    // Вход по нажатию клавиши Enter в поле ввода пароля
    passInputFields.addEventListener("keypress", function(event) {
        if (event.key === "Enter") {
            event.preventDefault();
            executeLogin();
        }
    });
});

// Точный адрес вашей облачной базы данных Firebase
const FIREBASE_URL = "https://cold-blood-calc-default-rtdb.europe-west1.firebasedatabase.app";

var currentRoom = "";
var isLeader = false;
var globalTargetCounts = {};
var globalWarehouse = {};

// Переключение окон (вкладок) интерфейса
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

// Логика нажатия на кнопку "Войти в штаб"
document.addEventListener("DOMContentLoaded", function() {
    const enterBtn = document.getElementById('btn-enter-room');
    if (!enterBtn) return;

    enterBtn.onclick = function() {
        const roomSelect = document.getElementById('room-input');
        const roomInput = roomSelect.options[roomSelect.selectedIndex].text;
        const passInput = document.getElementById('leader-pass-input').value.trim();

        currentRoom = roomSelect.value;
        document.getElementById('current-room-title').textContent = roomInput.toUpperCase();
        
        // Временная простая авторизация лидера
        if (passInput === "свобода123") {
            isLeader = true;
            document.getElementById('leader-tab-nav').style.display = 'block';
            document.getElementById('user-status-text').textContent = "Режим ЛИДЕРА ГРУППИРОВКИ";
            document.getElementById('user-status-text').style.color = "#ffb74d";
        } else {
            document.getElementById('user-status-text').textContent = "Режим БОЙЦА";
        }

        document.getElementById('auth-screen').style.display = 'none';
        
        // Запуск фоновой синхронизации с облаком
        if (typeof syncWithCloud === 'function') {
            syncWithCloud();
            setInterval(syncWithCloud, 3000);
        }
    };
});

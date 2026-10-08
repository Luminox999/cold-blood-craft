// В кавычках ниже вместо метки вставьте адрес вашей базы данных Firebase:
const FIREBASE_URL = "https://cold-blood-calc-default-rtdb.europe-west1.firebasedatabase.app/";

var currentRoom = "";
var isLeader = false;
var globalTargetCounts = {};
var globalWarehouse = {};

// Глобальный мастер-пароль для Главной Администрации сервера Cold Blood
const MASTER_ADMIN_PASSWORD = "coldblood2026admin";

window.switchTab = function(tabId) {
    document.querySelectorAll('.tab-content').forEach(function(el) {
        el.style.display = 'none';
    });
    document.querySelectorAll('.tab-btn').forEach(function(el) {
        el.classList.remove('active');
    });
    
    var activeTab = document.getElementById(tabId);
    if (activeTab) activeTab.style.display = 'flex';
    
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    }
};

document.addEventListener("DOMContentLoaded", function() {
    const enterBtn = document.getElementById('btn-enter-room');
    const passInputFields = document.getElementById('leader-pass-input');
    if (!enterBtn) return;

    function executeLogin() {
        const roomSelect = document.getElementById('room-input');
        const roomInput = roomSelect.options[roomSelect.selectedIndex].text;
        const passInput = passInputFields.value.trim();

        currentRoom = roomSelect.value;
        document.getElementById('current-room-title').textContent = roomInput.toUpperCase();
        
        // 1. ПРОВЕРКА НА МАСТЕР-ПАРОЛЬ АДМИНИСТРАТОРА
        if (passInput === MASTER_ADMIN_PASSWORD) {
            isLeader = true;
            document.getElementById('leader-tab-nav').style.display = 'block';
            document.getElementById('user-status-text').textContent = "Режим ГЛАВНОГО АДМИНИСТРАТОРА СЕРВЕРА";
            document.getElementById('user-status-text').style.color = "#ff5252";
            enterFactionШтаб();
            return;
        }

        // 2. ПРОВЕРКА ЛИЧНОГО ПАРОЛЯ ФРАКЦИИ ЧЕРЕЗ FIREBASE
        fetch(FIREBASE_URL + "/rooms/" + currentRoom + "/password.json")
        .then(function(res) { return res.json(); })
        .then(function(cloudPassword) {
            // Если фракция заходит ПЕРВЫЙ РАЗ в истории сервера, генерируем пароль по умолчанию
            if (!cloudPassword) {
                var defaultPass = currentRoom + "123"; // например: свобода123, долг123
                fetch(FIREBASE_URL + "/rooms/" + currentRoom + "/password.json", {
                    method: "PUT",
                    body: JSON.stringify(defaultPass)
                });
                cloudPassword = defaultPass;
            }

            if (passInput === cloudPassword) {
                isLeader = true;
                document.getElementById('leader-tab-nav').style.display = 'block';
                document.getElementById('user-status-text').textContent = "Режим ЛИДЕРА ГРУППИРОВКИ";
                document.getElementById('user-status-text').style.color = "#ffb74d";
            } else if (passInput !== "") {
                alert("Ошибка: Неверный пароль Лидера фракции! Вы вошли в режиме обычного Бойца.");
                document.getElementById('user-status-text').textContent = "Режим БОЙЦА";
            } else {
                document.getElementById('user-status-text').textContent = "Режим БОЙЦА";
            }

            enterFactionШтаб();
        })
        .catch(function(err) {
            console.error("Ошибка проверки пароля фракции:", err);
            document.getElementById('user-status-text').textContent = "Режим БОЙЦА (Оффлайн)";
            enterFactionШтаб();
        });
    }

    function enterFactionШтаб() {
        document.getElementById('auth-screen').style.display = 'none';
        
        if (typeof initSlicerInterface === 'function') {
            initSlicerInterface();
        }

        if (typeof syncWithCloud === 'function') {
            syncWithCloud();
            setInterval(syncWithCloud, 3000);
        }
    }

    enterBtn.onclick = function() { executeLogin(); };
    passInputFields.addEventListener("keypress", function(event) {
        if (event.key === "Enter") {
            event.preventDefault();
            executeLogin();
        }
    });
});

// 3. ЛОГИКА ДИНАМИЧЕСКОЙ СМЕНЫ ПАРОЛЯ ЛИДЕРАМИ ГП
document.addEventListener("DOMContentLoaded", function() {
    var btnChangePass = document.getElementById("btn-change-faction-password");
    if (!btnChangePass) return;

    btnChangePass.onclick = function() {
        if (!isLeader) {
            alert("Ошибка: Изменять доступы может только Администрация или Лидер фракции!");
            return;
        }

        var newPassInput = document.getElementById("change-leader-pass-input");
        if (!newPassInput) return;

        var newPassword = newPassInput.value.trim();
        if (!newPassword || newPassword.length < 4) {
            alert("Пожалуйста, введите надежный пароль (минимум 4 символа)!");
            return;
        }

        // Пушим новый измененный пароль лидера прямо в Firebase
        fetch(FIREBASE_URL + "/rooms/" + currentRoom + "/password.json", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newPassword)
        })
        .then(function(res) {
            if (!res.ok) throw new Error("Ошибка сервера базы данных");
            return res.json();
        })
        .then(function() {
            alert("Пароль штаба успешно изменен! Запишите его, чтобы не потерять: " + newPassword);
            newPassInput.value = ""; // Очищаем поле ввода
        })
        .catch(function(err) {
            alert("Не удалось обновить пароль в облаке: " + err.message);
        });
    };
});

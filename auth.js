const FIREBASE_URL = "https://cold-blood-calc-default-rtdb.europe-west1.firebasedatabase.app";

var currentRoom = "";
var isLeader = false;
var globalTargetCounts = {};
var globalWarehouse = {};

const MASTER_ADMIN_PASSWORD = "coldblood2026admin";

window.switchTab = function (tabId, ev) {
    document.querySelectorAll('.tab-content').forEach(function (el) {
        el.style.display = 'none';
    });
    document.querySelectorAll('.tab-btn').forEach(function (el) {
        el.classList.remove('active');
    });

    var activeTab = document.getElementById(tabId);
    if (activeTab) activeTab.style.display = 'flex';

    if (ev && ev.currentTarget) {
        ev.currentTarget.classList.add('active');
    }
};

document.addEventListener("DOMContentLoaded", function () {
    var enterBtn = document.getElementById('btn-enter-room');
    var passInput = document.getElementById('leader-pass-input');
    if (!enterBtn || !passInput) return;

    function executeLogin() {
        var roomSelect = document.getElementById('room-input');
        var roomText = roomSelect.options[roomSelect.selectedIndex].text;
        var pass = passInput.value.trim();

        currentRoom = roomSelect.value;
        document.getElementById('current-room-title').textContent = roomText.toUpperCase();

        if (pass === MASTER_ADMIN_PASSWORD) {
            isLeader = true;
            document.getElementById('leader-tab-nav').style.display = 'block';
            document.getElementById('user-status-text').textContent = "Режим ГЛАВНОГО АДМИНИСТРАТОРА СЕРВЕРА";
            document.getElementById('user-status-text').style.color = "#ff5252";
            enterFactionHQ();
            return;
        }

        fetch(FIREBASE_URL + "/rooms/" + currentRoom + "/password.json")
            .then(function (res) { return res.json(); })
            .then(function (cloudPass) {
                if (!cloudPass) {
                    var defaultPass = currentRoom + "123";
                    fetch(FIREBASE_URL + "/rooms/" + currentRoom + "/password.json", {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(defaultPass)
                    });
                    cloudPass = defaultPass;
                }

                if (pass === cloudPass) {
                    isLeader = true;
                    document.getElementById('leader-tab-nav').style.display = 'block';
                    document.getElementById('user-status-text').textContent = "Режим ЛИДЕРА ГРУППИРОВКИ";
                    document.getElementById('user-status-text').style.color = "#ffb74d";
                } else if (pass !== "") {
                    alert("Ошибка: Неверный пароль Лидера фракции! Вы вошли в режиме обычного Бойца.");
                    document.getElementById('user-status-text').textContent = "Режим БОЙЦА";
                } else {
                    document.getElementById('user-status-text').textContent = "Режим БОЙЦА";
                }
                enterFactionHQ();
            })
            .catch(function (err) {
                console.error("Ошибка проверки пароля фракции:", err);
                document.getElementById('user-status-text').textContent = "Режим БОЙЦА (Оффлайн)";
                enterFactionHQ();
            });
    }

    function enterFactionHQ() {
        document.getElementById('auth-screen').style.display = 'none';

        if (typeof initSlicerInterface === 'function') {
            initSlicerInterface();
        }

        // Первая загрузка иконок из облака
        if (typeof syncIconsFromCloud === 'function') {
            syncIconsFromCloud();
            // Раз в 30 секунд обновляем иконки (они меняются редко)
            setInterval(syncIconsFromCloud, 30000);
        }

        if (typeof syncWithCloud === 'function') {
            syncWithCloud();
            setInterval(syncWithCloud, 3000);
        }
    }

    enterBtn.onclick = executeLogin;
    passInput.addEventListener("keypress", function (e) {
        if (e.key === "Enter") { e.preventDefault(); executeLogin(); }
    });
});

// Смена пароля лидером
document.addEventListener("DOMContentLoaded", function () {
    var btnChange = document.getElementById("btn-change-faction-password");
    if (!btnChange) return;

    btnChange.onclick = function () {
        if (!isLeader) {
            alert("Ошибка: Изменять доступы может только Администрация или Лидер фракции!");
            return;
        }
        var input = document.getElementById("change-leader-pass-input");
        if (!input) return;
        var newPass = input.value.trim();
        if (!newPass || newPass.length < 4) {
            alert("Введите надежный пароль (минимум 4 символа)!");
            return;
        }
        fetch(FIREBASE_URL + "/rooms/" + currentRoom + "/password.json", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newPass)
        })
            .then(function (res) {
                if (!res.ok) throw new Error("Ошибка сервера базы данных");
                return res.json();
            })
            .then(function () {
                alert("Пароль штаба успешно изменен! Запишите его: " + newPass);
                input.value = "";
            })
            .catch(function (err) {
                alert("Не удалось обновить пароль в облаке: " + err.message);
            });
    };
});
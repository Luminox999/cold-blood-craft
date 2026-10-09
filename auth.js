const FIREBASE_URL = "https://cold-blood-calc-default-rtdb.europe-west1.firebasedatabase.app";

var currentRoom = "";
var isLeader = false;
var globalTargetCounts = {};
var globalWarehouse = {};
var globalMaterialsCatalog = {};
var pendingRecipes = {};

const MASTER_ADMIN_PASSWORD = "coldblood2026admin";

window.switchTab = function (tabId, ev) {
    document.querySelectorAll('.tab-content').forEach(function (el) { el.style.display = 'none'; });
    document.querySelectorAll('.tab-btn').forEach(function (el) { el.classList.remove('active'); });
    var activeTab = document.getElementById(tabId);
    if (activeTab) activeTab.style.display = 'flex';
    if (ev && ev.currentTarget) ev.currentTarget.classList.add('active');
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
                    alert("Неверный пароль Лидера. Вы вошли в режиме Бойца.");
                    document.getElementById('user-status-text').textContent = "Режим БОЙЦА";
                } else {
                    document.getElementById('user-status-text').textContent = "Режим БОЙЦА";
                }
                enterFactionHQ();
            })
            .catch(function (err) {
                console.error("Ошибка проверки пароля:", err);
                document.getElementById('user-status-text').textContent = "Режим БОЙЦА (Оффлайн)";
                enterFactionHQ();
            });
    }

    function enterFactionHQ() {
        document.getElementById('auth-screen').style.display = 'none';

        // Настройка UI под роль
        if (isLeader) {
            var leaderTools = document.getElementById("leader-material-tools");
            if (leaderTools) leaderTools.style.display = "block";
            var saveBtn = document.getElementById("btn-save-new-craft");
            if (saveBtn) saveBtn.textContent = "✓ Добавить в базу верстаков";
            var intro = document.getElementById("suggest-intro");
            if (intro) intro.textContent = "Вы Лидер — рецепт добавится сразу в базу фракции.";
        } else {
            var leaderTools2 = document.getElementById("leader-material-tools");
            if (leaderTools2) leaderTools2.style.display = "none";
            var saveBtn2 = document.getElementById("btn-save-new-craft");
            if (saveBtn2) saveBtn2.textContent = "📤 Предложить рецепт лидеру";
            var intro2 = document.getElementById("suggest-intro");
            if (intro2) intro2.textContent = "Заполните форму — рецепт уйдёт лидеру фракции на проверку.";
        }

        if (typeof initSlicerInterface === 'function') initSlicerInterface();
        if (typeof syncIconsFromCloud === 'function') {
            syncIconsFromCloud();
            setInterval(syncIconsFromCloud, 30000);
        }
        if (typeof syncMaterialsCatalog === 'function') {
            syncMaterialsCatalog();
            setInterval(syncMaterialsCatalog, 30000);
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

// Смена пароля
document.addEventListener("DOMContentLoaded", function () {
    var btnChange = document.getElementById("btn-change-faction-password");
    if (!btnChange) return;
    btnChange.onclick = function () {
        if (!isLeader) { alert("Только Лидер или Администратор."); return; }
        var input = document.getElementById("change-leader-pass-input");
        if (!input) return;
        var newPass = input.value.trim();
        if (!newPass || newPass.length < 4) { alert("Минимум 4 символа!"); return; }
        fetch(FIREBASE_URL + "/rooms/" + currentRoom + "/password.json", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newPass)
        })
            .then(function (res) { if (!res.ok) throw new Error("HTTP " + res.status); return res.json(); })
            .then(function () {
                alert("Пароль изменён. Запишите: " + newPass);
                input.value = "";
            })
            .catch(function (err) { alert("Ошибка: " + err.message); });
    };
});
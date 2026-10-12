// ============================================================
// МОДУЛЬ МЕТАЗАДАЧ
// ============================================================
// Задачи хранятся в /tasks/<id> в Firebase.
// Куратор (админ) создаёт через вкладку «🎯 Управление задачами».
// Игроки видят задачи своей фракции на первой вкладке.
// ============================================================

var tasksCache = {};           // кэш задач текущего сеанса
var lastSeenTaskTime = 0;      // для счётчика «новых»

// ---- Утилиты ----
function tasksPath(id) {
    return "/tasks" + (id ? "/" + id : "");
}

function escapeHtml(s) {
    if (s == null) return "";
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function formatDate(ts) {
    if (!ts) return "";
    var d = new Date(ts);
    var dd = String(d.getDate()).padStart(2, "0");
    var mm = String(d.getMonth() + 1).padStart(2, "0");
    var yyyy = d.getFullYear();
    var hh = String(d.getHours()).padStart(2, "0");
    var min = String(d.getMinutes()).padStart(2, "0");
    return dd + "." + mm + "." + yyyy + " " + hh + ":" + min;
}

function daysLeft(deadline) {
    if (!deadline) return null;
    var diff = deadline - Date.now();
    var days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days;
}

// ---- Синхронизация ----
function syncTasks() {
    fetch(FIREBASE_URL + "/tasks.json?nocache=" + Date.now(), {
        method: "GET", headers: { "Accept": "application/json" }
    })
        .then(function (r) { return r.json(); })
        .then(function (data) {
            tasksCache = data || {};
            renderTasksPanel();
            renderTaskAdminPanel();
            updateTasksBadge();
        })
        .catch(function (err) {
            console.error("Ошибка загрузки задач:", err);
        });
}

function saveTask(id, data) {
    fetch(FIREBASE_URL + "/tasks/" + id + ".json", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
    })
        .then(function (res) {
            if (!res.ok) throw new Error("HTTP " + res.status);
            return res.json();
        })
        .then(function () {
            tasksCache[id] = data;
            renderTasksPanel();
            renderTaskAdminPanel();
            updateTasksBadge();
        })
        .catch(function (err) {
            alert("Не удалось сохранить задачу: " + err.message);
        });
}

function deleteTask(id) {
    if (!confirm("Удалить задачу навсегда?")) return;
    fetch(FIREBASE_URL + "/tasks/" + id + ".json", { method: "DELETE" })
        .then(function () {
            delete tasksCache[id];
            renderTasksPanel();
            renderTaskAdminPanel();
            updateTasksBadge();
        })
        .catch(function (err) { alert("Ошибка удаления: " + err.message); });
}

// ---- Фильтр по фракции ----
function getVisibleTasks() {
    var result = [];
    for (var id in tasksCache) {
        var t = tasksCache[id];
        if (!t) continue;
        if (t.target === "all" || t.target === currentRoom) {
            result.push({ id: id, task: t });
        }
    }
    // Сортировка: сначала активные, потом по дате создания (новые сверху)
    result.sort(function (a, b) {
        var sa = (a.task.status === "active") ? 0 : 1;
        var sb = (b.task.status === "active") ? 0 : 1;
        if (sa !== sb) return sa - sb;
        return (b.task.createdAt || 0) - (a.task.createdAt || 0);
    });
    return result;
}

// ---- Рендер панели игрока (на первой вкладке) ----
function renderTasksPanel() {
    var panel = document.getElementById("tasks-display");
    if (!panel) return;

    var list = getVisibleTasks();
    if (list.length === 0) {
        panel.innerHTML = '<div class="empty-message">Пока нет активных задач для вашей фракции.</div>';
        return;
    }

    // Показываем только active и done (не cancelled)
    list = list.filter(function (x) { return x.task.status !== "cancelled"; });

    var html = "";
    list.forEach(function (x) {
        var t = x.task;
        var statusClass = "task-card";
        if (t.status === "done") statusClass += " task-done";
        if (t.status === "active" && t.deadline && t.deadline < Date.now()) {
            statusClass += " task-overdue";
        }

        var deadlineHtml = "";
        if (t.deadline) {
            var left = daysLeft(t.deadline);
            var leftText = "";
            if (t.status === "active" && left !== null) {
                if (left < 0) leftText = '<span style="color:#ff5252;">Просрочено</span>';
                else if (left === 0) leftText = '<span style="color:#ffb74d;">Сегодня</span>';
                else leftText = '<span style="color:#ffb74d;">Осталось: ' + left + " дн.</span>";
            }
            deadlineHtml = '<div class="task-deadline">📅 ' + formatDate(t.deadline) + " " + leftText + "</div>";
        }

        // Мини-прогресс подпунктов
        var subTotal = 0, subDone = 0;
        if (t.subtasks) {
            for (var sid in t.subtasks) {
                subTotal++;
                if (t.subtasks[sid].done) subDone++;
            }
        }
        var progressHtml = "";
        if (subTotal > 0) {
            progressHtml = '<div class="task-progress">Этапы: ' + subDone + " / " + subTotal + "</div>";
        }

        var targetHtml = "";
        if (t.target === "all") targetHtml = '<span class="task-target">Всем</span>';
        else targetHtml = '<span class="task-target">' + escapeHtml(t.target) + "</span>";

        var statusBadge = "";
        if (t.status === "done") statusBadge = '<span class="task-badge task-badge-done">Выполнено</span>';
        else if (t.status === "cancelled") statusBadge = '<span class="task-badge task-badge-cancel">Отменено</span>';
        else statusBadge = '<span class="task-badge task-badge-active">Активно</span>';

        html += '<div class="' + statusClass + '" onclick="openTaskModal(\'' + x.id + '\')">'
            + '<div class="task-card-head">'
            + '<div class="task-title">' + escapeHtml(t.title) + "</div>"
            + statusBadge
            + "</div>"
            + '<div class="task-card-body">'
            + '<div class="task-desc-preview">' + escapeHtml((t.description || "").slice(0, 160)) + "…</div>"
            + progressHtml
            + deadlineHtml
            + "</div>"
            + '<div class="task-card-foot">'
            + targetHtml
            + '<span class="task-author">от ' + escapeHtml(t.author || "Куратор") + "</span>"
            + "</div>"
            + "</div>";
    });

    panel.innerHTML = html;
}

// ---- Счётчик новых задач ----
function updateTasksBadge() {
    var badge = document.getElementById("tasks-count-badge");
    if (!badge) return;

    var list = getVisibleTasks().filter(function (x) { return x.task.status === "active"; });
    var lastSeen = parseInt(localStorage.getItem("tasks_last_seen") || "0", 10);
    var fresh = list.filter(function (x) { return (x.task.createdAt || 0) > lastSeen; });

    if (fresh.length > 0) {
        badge.textContent = fresh.length;
        badge.style.display = "inline-block";
    } else {
        badge.style.display = "none";
    }
}

// Пометить все прочитанными — вызывается при открытии модалки
function markTasksAsRead() {
    localStorage.setItem("tasks_last_seen", String(Date.now()));
    updateTasksBadge();
}

// ---- Модалка задачи ----
window.openTaskModal = function (id) {
    var t = tasksCache[id];
    if (!t) return;

    markTasksAsRead();

    var overlay = document.getElementById("task-modal-overlay");
    var content = document.getElementById("task-modal-content");
    if (!overlay || !content) return;

    // Заголовок
    var html = '<div class="task-modal-head">'
        + '<div class="task-modal-title">' + escapeHtml(t.title) + "</div>"
        + '<button class="btn" onclick="closeTaskModal()" title="Закрыть">✖</button>'
        + "</div>";

    // Мета
    html += '<div class="task-modal-meta">'
        + "Кому: <b>" + escapeHtml(t.target === "all" ? "Всем" : t.target) + "</b>"
        + " &nbsp;•&nbsp; Автор: <b>" + escapeHtml(t.author || "Куратор") + "</b>"
        + " &nbsp;•&nbsp; Создано: " + formatDate(t.createdAt);
    if (t.deadline) {
        html += " &nbsp;•&nbsp; Дедлайн: <b>" + formatDate(t.deadline) + "</b>";
    }
    html += "</div>";

    // Иллюстрация
    if (t.imageUrl) {
        html += '<div class="task-modal-image"><img src="' + t.imageUrl + '" alt="Иллюстрация"></div>';
    }

    // Описание
    if (t.description) {
        html += '<div class="task-modal-description">' + escapeHtml(t.description).replace(/\n/g, "<br>") + "</div>";
    }

    // Аудио
    if (t.audioUrl) {
        html += '<div class="task-modal-audio">'
            + '<div class="task-audio-label">🎙️ Аудиозапись:</div>'
            + '<audio controls src="' + t.audioUrl + '" style="width: 100%;"></audio>'
            + "</div>";
    }

    // Метка на карте
    if (t.mapImageUrl) {
        html += '<div class="task-modal-map">'
            + '<div class="task-map-label">📍 Метка на карте:</div>'
            + '<img src="' + t.mapImageUrl + '" alt="Карта">'
            + "</div>";
    }

    // Подпункты
    if (t.subtasks) {
        var subs = [];
        for (var sid in t.subtasks) {
            subs.push({ id: sid, sub: t.subtasks[sid] });
        }
        subs.sort(function (a, b) { return (a.sub.order || 0) - (b.sub.order || 0); });

        if (subs.length > 0) {
            html += '<div class="task-modal-subtasks"><div class="task-subtasks-label">Этапы:</div>';
            subs.forEach(function (x, i) {
                var isLeaderCheck = (typeof isLeader !== "undefined" && isLeader);
                var checked = x.sub.done ? "checked" : "";
                html += '<label class="task-subtask' + (x.sub.done ? " done" : "") + '">'
                    + '<input type="checkbox" ' + checked
                    + (isLeaderCheck ? '' : ' disabled')
                    + ' onchange="toggleSubtask(\'' + id + '\',\'' + x.id + '\', this.checked)">'
                    + '<span>' + (i + 1) + ". " + escapeHtml(x.sub.text) + "</span>"
                    + "</label>";
            });
            html += "</div>";
        }
    }

    // Награда
    if (t.rewards) {
        html += '<div class="task-modal-reward"><b>🏆 Награда:</b> ' + escapeHtml(t.rewards) + "</div>";
    }

    // Кнопки для админа
    var isAdmin = (typeof isLeader !== "undefined" && isLeader);
    if (isAdmin) {
        html += '<div class="task-modal-admin">';
        if (t.status === "active") {
            html += '<button class="btn btn-plus" style="width:auto;padding:0 15px;" onclick="markTaskDone(\'' + id + '\')">✓ Отметить выполненной</button>';
            html += '<button class="btn" style="width:auto;padding:0 15px;background:#555;" onclick="cancelTask(\'' + id + '\')">✖ Отменить</button>';
        } else if (t.status === "done" || t.status === "cancelled") {
            html += '<button class="btn" style="width:auto;padding:0 15px;background:#2e7d32;" onclick="reopenTask(\'' + id + '\')">↺ Вернуть в работу</button>';
        }
        html += '<button class="btn btn-danger" style="width:auto;padding:0 15px;" onclick="deleteTask(\'' + id + '\'); closeTaskModal();">🗑 Удалить</button>';
        html += "</div>";
    }

    content.innerHTML = html;
    overlay.style.display = "flex";
};

window.closeTaskModal = function () {
    var overlay = document.getElementById("task-modal-overlay");
    if (overlay) overlay.style.display = "none";
};

window.toggleSubtask = function (taskId, subId, done) {
    if (!isLeader) return;
    var t = tasksCache[taskId];
    if (!t || !t.subtasks || !t.subtasks[subId]) return;
    t.subtasks[subId].done = !!done;

    fetch(FIREBASE_URL + "/tasks/" + taskId + "/subtasks/" + subId + "/done.json", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(!!done)
    }).catch(function (err) { console.error("Ошибка подпункта:", err); });

    // Обновляем модалку сразу
    openTaskModal(taskId);
    renderTasksPanel();
}

window.markTaskDone = function (id) {
    var t = tasksCache[id];
    if (!t) return;
    t.status = "done";
    saveTask(id, t);
    openTaskModal(id);
};

window.cancelTask = function (id) {
    if (!confirm("Отменить задачу?")) return;
    var t = tasksCache[id];
    if (!t) return;
    t.status = "cancelled";
    saveTask(id, t);
    openTaskModal(id);
};

window.reopenTask = function (id) {
    var t = tasksCache[id];
    if (!t) return;
    t.status = "active";
    saveTask(id, t);
    openTaskModal(id);
};

// ============================================================
// АДМИНСКАЯ ВКЛАДКА
// ============================================================

function renderTaskAdminPanel() {
    var container = document.getElementById("task-admin-list");
    if (!container) return;

    var ids = Object.keys(tasksCache);
    if (ids.length === 0) {
        container.innerHTML = '<div class="empty-message">Пока нет ни одной задачи. Создайте первую через форму выше.</div>';
        return;
    }

    ids.sort(function (a, b) {
        return (tasksCache[b].createdAt || 0) - (tasksCache[a].createdAt || 0);
    });

    var html = "";
    ids.forEach(function (id) {
        var t = tasksCache[id];
        var statusText = t.status === "active" ? "Активна" :
            t.status === "done" ? "Выполнена" : "Отменена";
        var statusColor = t.status === "active" ? "#ffb74d" :
            t.status === "done" ? "#81c784" : "#888";

        html += '<div class="recipe-item" style="flex-direction:column;align-items:stretch;padding:12px;cursor:pointer;" onclick="openTaskModal(\'' + id + '\')">'
            + '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">'
            + '<div style="flex:1;min-width:0;">'
            + '<div style="font-weight:600;color:#fff;font-size:14px;">' + escapeHtml(t.title) + "</div>"
            + '<div style="font-size:11px;color:#888;margin-top:2px;">Кому: ' + escapeHtml(t.target || "—") + " • Автор: " + escapeHtml(t.author || "—") + "</div>"
            + "</div>"
            + '<div style="color:' + statusColor + ';font-weight:bold;font-size:12px;flex-shrink:0;">' + statusText + "</div>"
            + "</div>"
            + "</div>";
    });
    container.innerHTML = html;
}

// ---- Форма создания задачи ----
var tempAttachments = {
    imageUrl: null,
    audioUrl: null,
    mapImageUrl: null
};

window.addSubtaskRowAdmin = function () {
    var container = document.getElementById("task-subtasks-container");
    if (!container) return;

    var row = document.createElement("div");
    row.className = "task-subtask-row";
    row.innerHTML = ''
        + '<input type="text" class="input-field task-subtask-input" placeholder="Текст этапа">'
        + '<button type="button" class="btn btn-danger" onclick="this.parentNode.remove()">×</button>';
    container.appendChild(row);
};

// Загрузка файла → base64 (для картинок, аудио, карт)
function fileToBase64(file, callback) {
    var reader = new FileReader();
    reader.onload = function (e) { callback(e.target.result); };
    reader.readAsDataURL(file);
}

window.attachTaskFile = function (type) {
    // type: "image" | "audio" | "map"
    var input = document.createElement("input");
    input.type = "file";
    if (type === "audio") input.accept = "audio/*";
    else input.accept = "image/*";

    input.onchange = function (e) {
        var file = e.target.files && e.target.files[0];
        if (!file) return;
        if (file.size > 900 * 1024) {
            if (!confirm("Файл больше 900 КБ. Firebase может отклонить. Продолжить?")) return;
        }
        fileToBase64(file, function (dataUrl) {
            if (type === "image") tempAttachments.imageUrl = dataUrl;
            else if (type === "audio") tempAttachments.audioUrl = dataUrl;
            else if (type === "map") tempAttachments.mapImageUrl = dataUrl;

            var preview = document.getElementById("task-attach-" + type + "-preview");
            if (preview) {
                if (type === "audio") {
                    preview.innerHTML = '<audio controls src="' + dataUrl + '" style="width:100%;max-width:300px;"></audio>';
                } else {
                    preview.innerHTML = '<img src="' + dataUrl + '" style="max-width:200px;max-height:120px;border-radius:4px;border:1px solid #333;">';
                }
            }
        });
    };
    input.click();
};

window.clearTaskAttachment = function (type) {
    if (type === "image") tempAttachments.imageUrl = null;
    else if (type === "audio") tempAttachments.audioUrl = null;
    else if (type === "map") tempAttachments.mapImageUrl = null;

    var preview = document.getElementById("task-attach-" + type + "-preview");
    if (preview) preview.innerHTML = "";
};

window.publishTaskAdmin = function () {
    if (!isLeader) {
        alert("Публиковать задачи может только администрация.");
        return;
    }

    var title = document.getElementById("task-title-input").value.trim();
    var desc = document.getElementById("task-desc-input").value.trim();
    var target = document.getElementById("task-target-input").value;
    var deadlineVal = document.getElementById("task-deadline-input").value;
    var rewards = document.getElementById("task-rewards-input").value.trim();
    var author = document.getElementById("task-author-input").value.trim() || "Куратор";

    if (!title) { alert("Введите название задачи."); return; }

    var deadlineTs = deadlineVal ? new Date(deadlineVal).getTime() : null;

    // Собираем подпункты
    var subContainer = document.getElementById("task-subtasks-container");
    var subtasks = {};
    var order = 1;
    if (subContainer) {
        var rows = subContainer.querySelectorAll(".task-subtask-row");
        for (var i = 0; i < rows.length; i++) {
            var input = rows[i].querySelector(".task-subtask-input");
            if (!input) continue;
            var text = input.value.trim();
            if (!text) continue;
            var sid = "s" + (order++);
            subtasks[sid] = { text: text, done: false, order: order - 1 };
        }
    }

    var taskId = "task_" + Date.now() + "_" + Math.floor(Math.random() * 9999);

    var task = {
        title: title,
        description: desc,
        target: target,
        author: author,
        createdAt: Date.now(),
        deadline: deadlineTs,
        status: "active",
        rewards: rewards || null,
        imageUrl: tempAttachments.imageUrl || null,
        audioUrl: tempAttachments.audioUrl || null,
        mapType: "image",
        mapImageUrl: tempAttachments.mapImageUrl || null,
        mapData: null,
        subtasks: subtasks
    };

    saveTask(taskId, task);

    // Сбрасываем форму
    document.getElementById("task-title-input").value = "";
    document.getElementById("task-desc-input").value = "";
    document.getElementById("task-rewards-input").value = "";
    document.getElementById("task-deadline-input").value = "";
    if (subContainer) subContainer.innerHTML = "";
    clearTaskAttachment("image");
    clearTaskAttachment("audio");
    clearTaskAttachment("map");

    alert("Задача опубликована.");
    syncTasks();
};

// Инициализация при загрузке
document.addEventListener("DOMContentLoaded", function () {
    // Первая загрузка задач
    setTimeout(syncTasks, 300);
    // Опрос каждые 30 секунд
    setInterval(syncTasks, 30000);

    // Закрытие модалки по клику на фон
    var overlay = document.getElementById("task-modal-overlay");
    if (overlay) {
        overlay.addEventListener("click", function (e) {
            if (e.target === overlay) closeTaskModal();
        });
    }
});
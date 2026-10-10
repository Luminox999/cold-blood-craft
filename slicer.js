// Перестройка выпадающего списка в нарезчике.
// Вызывается после каждой синхронизации с облаком,
// потому что список материалов мог измениться.
function refreshSlicerSelect() {
    var selectEl = document.getElementById("material-selector");
    if (!selectEl) return;

    // Запоминаем текущее значение, чтобы вернуть его после перестройки
    var currentVal = selectEl.value;

    selectEl.innerHTML = "";

    if (typeof craftData === 'undefined' || !craftData) return;

    // Группа «Предметы»
    var itemGroup = document.createElement("optgroup");
    itemGroup.label = "Предметы (верстак)";
    var itemCount = 0;
    for (var key in craftData) {
        var opt = document.createElement("option");
        opt.value = "item:" + key;
        opt.textContent = craftData[key].name;
        itemGroup.appendChild(opt);
        itemCount++;
    }
    if (itemCount > 0) selectEl.appendChild(itemGroup);

    // Группа «Материалы» — из каталога + из рецептов + из склада
    var matGroup = document.createElement("optgroup");
    matGroup.label = "Материалы (хлам)";

    var matSet = new Set();
    if (typeof globalMaterialsCatalog !== 'undefined') {
        for (var mk in globalMaterialsCatalog) matSet.add(mk);
    }
    for (var rk in craftData) {
        var mats = craftData[rk].materials;
        if (!mats) continue;
        for (var mn in mats) matSet.add(mn);
    }
    if (typeof globalWarehouse !== 'undefined') {
        for (var wk in globalWarehouse) matSet.add(wk);
    }

    var sortedMats = Array.from(matSet).sort();
    sortedMats.forEach(function (mat) {
        var opt = document.createElement("option");
        opt.value = "mat:" + mat;
        opt.textContent = mat;
        matGroup.appendChild(opt);
    });
    if (sortedMats.length > 0) selectEl.appendChild(matGroup);

    // Восстанавливаем выбор, если он был
    if (currentVal) selectEl.value = currentVal;
}
function initSlicerInterface() {
    var fileInput = document.getElementById("screenshot-input");
    var outputZone = document.getElementById("cropper-zone");
    if (!fileInput || !outputZone) return;

    outputZone.innerHTML = '<div class="slicer-workspace">'
        + '<p style="font-size: 13px; color: #ffb74d; margin: 0;">'
        + 'Загрузите скриншот, зажмите левую кнопку мыши и растяните рамку вокруг нужной иконки. '
        + 'Рамка автоматически сожмётся в 64×64, и её можно будет загрузить в облако для всех фракций.'
        + '</p>'
        + '<div class="canvas-container"><canvas id="screenshot-canvas"></canvas><div id="crop-selector"></div></div>'
        + '<div class="slicer-controls-row">'
        + '<canvas id="preview-canvas" width="64" height="64"></canvas>'
        + '<select id="material-selector" class="slicer-select"></select>'
        + '<button id="btn-upload-icon" class="btn btn-plus" style="width: auto; padding: 0 25px; height: 40px; font-size: 14px;">📤 Загрузить в облако</button>'
        + '<button id="btn-download-crop" class="btn" style="width: auto; padding: 0 15px; height: 40px; font-size: 12px; background:#3a3a3a;">💾 Скачать PNG</button>'
        + '</div>'
        + '<div id="slicer-status" style="font-size:12px; color:#81c784; min-height: 18px;"></div>'
        + '</div>';

    var canvas = document.getElementById("screenshot-canvas");
    var ctx = canvas.getContext("2d");
    var selector = document.getElementById("crop-selector");
    var previewCanvas = document.getElementById("preview-canvas");
    var pCtx = previewCanvas.getContext("2d");
    var selectEl = document.getElementById("material-selector");
    var btnUpload = document.getElementById("btn-upload-icon");
    var btnDownload = document.getElementById("btn-download-crop");
    var statusEl = document.getElementById("slicer-status");

    var img = new Image();
    var isDragging = false;
    var selStart = null;
    var selEnd = null;

    // Заполняем выпадающий список: сначала предметы (для верстака), потом материалы
  refreshSlicerSelect();
    // ==== ВСТАВКА ИЗ БУФЕРА (Ctrl+V) ====
    document.addEventListener("paste", function (e) {
        var tag = (e.target.tagName || "").toLowerCase();
        if (tag === "input" || tag === "textarea") return;

        var cb = e.clipboardData || (e.originalEvent && e.originalEvent.clipboardData);
        if (!cb) {
            console.warn("[slicer] clipboardData недоступен");
            return;
        }

        var imageFile = null;

        // Способ 1: через items
        if (cb.items && cb.items.length > 0) {
            for (var i = 0; i < cb.items.length; i++) {
                var it = cb.items[i];
                if (it.kind === "file" && it.type && it.type.indexOf("image") === 0) {
                    imageFile = it.getAsFile();
                    if (imageFile) break;
                }
            }
        }

        // Способ 2: через files (некоторые браузеры кладут сюда)
        if (!imageFile && cb.files && cb.files.length > 0) {
            for (var j = 0; j < cb.files.length; j++) {
                if (cb.files[j].type && cb.files[j].type.indexOf("image") === 0) {
                    imageFile = cb.files[j];
                    break;
                }
            }
        }

        if (!imageFile) return;

        // Автопереключение на вкладку нарезчика
        var slicerTab = document.getElementById("slicer-tab");
        if (slicerTab && slicerTab.style.display === "none") {
            var slicerBtn = document.querySelector('.tab-btn[onclick*="slicer-tab"]');
            if (typeof switchTab === "function") {
                switchTab("slicer-tab", { currentTarget: slicerBtn });
            }
        }

        // Грузим картинку
        var reader = new FileReader();
        reader.onload = function (ev) {
            img.onload = function () {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0);
                outputZone.style.display = "block";
                selector.style.display = "none";
                selStart = null;
                selEnd = null;
                pCtx.clearRect(0, 0, 64, 64);
                statusEl.style.color = "#81c784";
                statusEl.textContent = "Вставлено из буфера: " + img.width + "×" + img.height;
            };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(imageFile);

        e.preventDefault();
        console.log("[slicer] Вставка из буфера: " + imageFile.type + ", " + imageFile.size + " байт");
    });

    // ==== Загрузка файла ====
    fileInput.addEventListener("change", function (e) {
        if (!e.target.files || e.target.files.length === 0) return;
        var reader = new FileReader();
        reader.onload = function (ev) {
            img.onload = function () {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                outputZone.style.display = "block";

                // Сброс выделения
                selector.style.display = "none";
                selStart = null;
                selEnd = null;
                pCtx.clearRect(0, 0, 64, 64);
                statusEl.textContent = "";
            };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(e.target.files[0]);
    });

    // ==== Хелперы ====
    function getCanvasPoint(e) {
        var rect = canvas.getBoundingClientRect();
        var scaleX = canvas.width / rect.width;
        var scaleY = canvas.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    }

    function getSelectionRect() {
        if (!selStart || !selEnd) return null;
        var x1 = Math.min(selStart.x, selEnd.x);
        var y1 = Math.min(selStart.y, selEnd.y);
        var x2 = Math.max(selStart.x, selEnd.x);
        var y2 = Math.max(selStart.y, selEnd.y);

        // Обрезаем по границам холста
        if (x1 < 0) x1 = 0;
        if (y1 < 0) y1 = 0;
        if (x2 > canvas.width) x2 = canvas.width;
        if (y2 > canvas.height) y2 = canvas.height;

        return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
    }

    function drawSelector() {
        var r = getSelectionRect();
        if (!r) { selector.style.display = "none"; return; }
        var cssRect = canvas.getBoundingClientRect();
        var cssScaleX = cssRect.width / canvas.width;
        var cssScaleY = cssRect.height / canvas.height;

        selector.style.left = (r.x * cssScaleX) + "px";
        selector.style.top = (r.y * cssScaleY) + "px";
        selector.style.width = (r.w * cssScaleX) + "px";
        selector.style.height = (r.h * cssScaleY) + "px";
        selector.style.display = "block";
    }

    function updatePreview() {
        var r = getSelectionRect();
        if (!r || r.w < 4 || r.h < 4) {
            pCtx.clearRect(0, 0, 64, 64);
            return;
        }
        pCtx.clearRect(0, 0, 64, 64);
        pCtx.imageSmoothingEnabled = true;
        pCtx.imageSmoothingQuality = "high";
        pCtx.drawImage(canvas, r.x, r.y, r.w, r.h, 0, 0, 64, 64);
    }

    // ==== Рисование рамки мышкой ====
    canvas.addEventListener("mousedown", function (e) {
        if (e.button !== 0) return;
        var pt = getCanvasPoint(e);
        selStart = pt;
        selEnd = pt;
        isDragging = true;
        selector.style.display = "none";
        statusEl.textContent = "";
        e.preventDefault();
    });

    canvas.addEventListener("mousemove", function (e) {
        if (!isDragging) return;
        selEnd = getCanvasPoint(e);
        drawSelector();
    });

    document.addEventListener("mouseup", function () {
        if (!isDragging) return;
        isDragging = false;
        var r = getSelectionRect();
        if (!r || r.w < 4 || r.h < 4) {
            selector.style.display = "none";
            selStart = null;
            selEnd = null;
            pCtx.clearRect(0, 0, 64, 64);
            return;
        }
        updatePreview();
    });

    // ==== Экспорт выделенной области в 64×64 ====
    function exportTo64() {
        var r = getSelectionRect();
        if (!r || r.w < 4 || r.h < 4) return null;
        var exportCanvas = document.createElement("canvas");
        exportCanvas.width = 64;
        exportCanvas.height = 64;
        var ectx = exportCanvas.getContext("2d");
        ectx.imageSmoothingEnabled = true;
        ectx.imageSmoothingQuality = "high";
        ectx.drawImage(canvas, r.x, r.y, r.w, r.h, 0, 0, 64, 64);
        return exportCanvas;
    }

    // ==== Загрузка в Firebase ====
    btnUpload.onclick = function () {
        if (!isLeader) {
            alert("Загружать иконки в общее облако может только Лидер фракции или Администратор.");
            return;
        }

        var selected = selectEl.value;
        if (!selected) {
            alert("Выберите предмет или материал из списка справа.");
            return;
        }

        var r = getSelectionRect();
        if (!r || r.w < 4 || r.h < 4) {
            alert("Сначала выделите мышкой область на скриншоте.");
            return;
        }

        var exp = exportTo64();
        if (!exp) return;
        var dataUrl = exp.toDataURL("image/png");

        // Разбираем значение: "item:sr25" или "mat:Медный слиток"
        var parts = selected.split(":");
        var kind = parts[0];
        var name = parts.slice(1).join(":");

        var path;
        if (kind === "item") {
            path = "/icons/items/" + encodeURIComponent(name) + ".json";
        } else {
            path = "/icons/materials/" + encodeURIComponent(name) + ".json";
        }

        statusEl.style.color = "#ffb74d";
        statusEl.textContent = "Отправка в облако...";

        fetch(FIREBASE_URL + path, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(dataUrl)
        })
            .then(function (res) {
                if (!res.ok) throw new Error("HTTP " + res.status);
                return res.json();
            })
            .then(function () {
                // Обновляем локальный кэш и перерисовываем всё
                if (kind === "item") {
                    globalIcons.items[name] = dataUrl;
                } else {
                    globalIcons.materials[name] = dataUrl;
                }

                statusEl.style.color = "#81c784";
                statusEl.textContent = "✓ Иконка загружена в облако. Её увидят все фракции после обновления страницы.";

                if (typeof renderMainDashboard === 'function') renderMainDashboard();
                if (typeof renderLeaderEditPanel === 'function') renderLeaderEditPanel();
            })
            .catch(function (err) {
                statusEl.style.color = "#ff5252";
                statusEl.textContent = "✗ Ошибка: " + err.message;
            });
    };

    // ==== Скачивание в PNG (на всякий случай оставил) ====
    btnDownload.onclick = function () {
        var exp = exportTo64();
        if (!exp) {
            alert("Сначала выделите область мышкой.");
            return;
        }
        var selected = selectEl.value || "";
        var parts = selected.split(":");
        var kind = parts[0];
        var name = parts.slice(1).join(":");
        var fileName = name ? name + ".png" : "icon.png";

        var link = document.createElement("a");
        link.download = fileName;
        link.href = exp.toDataURL("image/png");
        link.click();
    };
}

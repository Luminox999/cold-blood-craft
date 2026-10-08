function initSlicerInterface() {
    var fileInput = document.getElementById("screenshot-input");
    var outputZone = document.getElementById("cropper-zone");
    if (!fileInput || !outputZone) return;

    outputZone.innerHTML = '<div class="slicer-workspace">'
        + '<p style="font-size: 13px; color: #ffb74d; margin: 0;">'
        + 'Загрузите скриншот файлом ИЛИ сделайте скрин в буфер (PrtScn / Win+Shift+S) и нажмите <b>Ctrl+V</b> на этой странице. '
        + 'Затем зажмите ЛКМ и растяните рамку вокруг нужной иконки.'
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

    // Заполняем список
    if (typeof craftData !== 'undefined') {
        var itemGroup = document.createElement("optgroup");
        itemGroup.label = "Предметы (верстак)";
        for (var key in craftData) {
            var opt = document.createElement("option");
            opt.value = "item:" + key;
            opt.textContent = craftData[key].name;
            itemGroup.appendChild(opt);
        }
        selectEl.appendChild(itemGroup);

        var matGroup = document.createElement("optgroup");
        matGroup.label = "Материалы (хлам)";
        var matSet = new Set();
        for (var k in craftData) {
            for (var m in craftData[k].materials) matSet.add(m);
        }
        Array.from(matSet).sort().forEach(function (mat) {
            var opt = document.createElement("option");
            opt.value = "mat:" + mat;
            opt.textContent = mat;
            matGroup.appendChild(opt);
        });
        selectEl.appendChild(matGroup);
    }

    // ==== Общая функция: загрузить картинку в canvas ====
    function loadImageIntoCanvas(imageSrc) {
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
            statusEl.textContent = "Изображение загружено: " + img.width + "×" + img.height;
        };
        img.onerror = function () {
            statusEl.style.color = "#ff5252";
            statusEl.textContent = "Не удалось загрузить изображение.";
        };
        img.src = imageSrc;
    }

    // ==== Загрузка из файла ====
    fileInput.addEventListener("change", function (e) {
        if (!e.target.files || e.target.files.length === 0) return;
        var reader = new FileReader();
        reader.onload = function (ev) { loadImageIntoCanvas(ev.target.result); };
        reader.readAsDataURL(e.target.files[0]);
    });

    // ==== ВСТАВКА ИЗ БУФЕРА (Ctrl+V) ====
    document.addEventListener("paste", function (e) {
        // Не перехватываем вставку текста в поля ввода
        var tag = (e.target.tagName || "").toLowerCase();
        if (tag === "input" || tag === "textarea") return;

        var items = (e.clipboardData || e.originalEvent.clipboardData).items;
        if (!items) return;

        for (var i = 0; i < items.length; i++) {
            if (items[i].type && items[i].type.indexOf("image") === 0) {
                var blob = items[i].getAsFile();
                if (!blob) continue;

                var reader = new FileReader();
                reader.onload = function (ev) {
                    // Переключаемся на вкладку нарезчика, чтобы пользователь увидел результат
                    if (typeof switchTab === 'function') {
                        var slicerTab = document.getElementById("slicer-tab");
                        var slicerBtn = document.querySelector('.tab-btn[onclick*="slicer-tab"]');
                        if (slicerTab && slicerTab.style.display === "none") {
                            switchTab("slicer-tab", { currentTarget: slicerBtn });
                        }
                    }
                    loadImageIntoCanvas(ev.target.result);
                };
                reader.readAsDataURL(blob);
                e.preventDefault();
                return;
            }
        }
    });

    // ==== Хелперы для рамки ====
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
        if (!r || r.w < 4 || r.h < 4) { pCtx.clearRect(0, 0, 64, 64); return; }
        pCtx.clearRect(0, 0, 64, 64);
        pCtx.imageSmoothingEnabled = true;
        pCtx.imageSmoothingQuality = "high";
        pCtx.drawImage(canvas, r.x, r.y, r.w, r.h, 0, 0, 64, 64);
    }

    // ==== Рисование рамки мышкой ====
    canvas.addEventListener("mousedown", function (e) {
        if (e.button !== 0) return;
        selStart = getCanvasPoint(e);
        selEnd = selStart;
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
        if (!selected) { alert("Выберите предмет или материал из списка."); return; }
        var r = getSelectionRect();
        if (!r || r.w < 4 || r.h < 4) { alert("Сначала выделите область на скриншоте."); return; }

        var exp = exportTo64();
        if (!exp) return;
        var dataUrl = exp.toDataURL("image/png");

        var parts = selected.split(":");
        var kind = parts[0];
        var name = parts.slice(1).join(":");
        var path = (kind === "item")
            ? "/icons/items/" + encodeURIComponent(name) + ".json"
            : "/icons/materials/" + encodeURIComponent(name) + ".json";

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
                if (kind === "item") globalIcons.items[name] = dataUrl;
                else globalIcons.materials[name] = dataUrl;

                statusEl.style.color = "#81c784";
                statusEl.textContent = "✓ Иконка загружена. Обновите страницу, чтобы увидеть её во всех фракциях.";

                if (typeof renderMainDashboard === 'function') renderMainDashboard();
                if (typeof renderLeaderEditPanel === 'function') renderLeaderEditPanel();
            })
            .catch(function (err) {
                statusEl.style.color = "#ff5252";
                statusEl.textContent = "✗ Ошибка: " + err.message;
            });
    };

    // ==== Скачивание PNG ====
    btnDownload.onclick = function () {
        var exp = exportTo64();
        if (!exp) { alert("Сначала выделите область мышкой."); return; }
        var selected = selectEl.value || "";
        var parts = selected.split(":");
        var name = parts.slice(1).join(":");
        var fileName = name ? name + ".png" : "icon.png";

        var link = document.createElement("a");
        link.download = fileName;
        link.href = exp.toDataURL("image/png");
        link.click();
    };
}

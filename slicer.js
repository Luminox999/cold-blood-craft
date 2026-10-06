// Ждем загрузки страницы, чтобы прочитать базу данных из script.js
window.addEventListener('DOMContentLoaded', () => {
    initVisualSlicer();
});

function initVisualSlicer() {
    const fileInput = document.getElementById('screenshot-input');
    const outputZone = document.getElementById('cropper-zone');
    
    if (!fileInput || !outputZone) return;

    // Перестраиваем разметку внутри оранжевой зоны для визуального режима
    outputZone.innerHTML = `
        <div class="slicer-workspace">
            <p style="font-size: 13px; color: #ffb74d; margin: 0;">
                🖱️ <strong>Инструкция:</strong> Зажмите левую кнопку мыши на скриншоте и растяните рамку вокруг нужной иконки.
            </p>
            
            <div class="canvas-container">
                <canvas id="screenshot-canvas"></canvas>
                <div id="crop-selector"></div>
            </div>

            <div class="slicer-controls-row">
                <div style="text-align: center;">
                    <div style="font-size: 11px; color: #aaa; margin-bottom: 4px;">Превью:</div>
                    <canvas id="preview-canvas" width="64" height="64"></canvas>
                </div>
                
                <div style="flex: 1; min-width: 250px;">
                    <div style="font-size: 12px; color: #fff; margin-bottom: 5px;">Что это за предмет/хлам?</div>
                    <select id="material-selector" class="slicer-select"></select>
                </div>

                <button id="btn-download-crop" class="btn btn-plus" style="width: auto; padding: 0 20px; height: 40px; font-size: 14px;">
                    💾 Скачать иконку
                </button>
            </div>
        </div>
    `;

    const canvas = document.getElementById('screenshot-canvas');
    const ctx = canvas.getContext('2d');
    const selector = document.getElementById('crop-selector');
    const previewCanvas = document.getElementById('preview-canvas');
    const pCtx = previewCanvas.getContext('2d');
    const selectEl = document.getElementById('material-selector');
    const btnDownload = document.getElementById('btn-download-crop');

    let img = new Image();
    let isDrawing = false;
    let startX = 0, startY = 0;
    let cropX = 0, cropY = 0, cropW = 0, cropH = 0;

    // 1. Собираем ВСЕ уникальные имена материалов из базы данных script.js
    const allMaterials = new Set();
    // Добавим сначала сами крафтовые предметы (винтовки, ящики)
    if (typeof craftData !== 'undefined') {
        for (let key in craftData) {
            allMaterials.add(craftData[key].name);
            // Добавляем все ингредиенты из их рецептов
            for (let mat in craftData[key].materials) {
                allMaterials.add(mat);
            }
        }
    }

    // Заполняем выпадающий список (сортируем по алфавиту)
    const sortedMaterials = Array.from(allMaterials).sort();
    selectEl.innerHTML = '';
    sortedMaterials.forEach(mat => {
        const opt = document.createElement('option');
        opt.value = mat;
        opt.textContent = mat;
        selectEl.appendChild(opt);
    });

    // 2. Загрузка скриншота на холст
    fileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(event) {
            img.onload = function() {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                outputZone.style.display = 'block';
                selector.style.display = 'none';
                // Очищаем превью
                pCtx.clearRect(0, 0, 64, 64);
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });

    // 3. Логика выделения рамкой мыши
    canvas.addEventListener('mousedown', function(e) {
        isDrawing = true;
        const rect = canvas.getBoundingClientRect();
        // Расчет координат с учетом масштабирования холста на экране
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        startX = (e.clientX - rect.left) * scaleX;
        startY = (e.clientY - rect.top) * scaleY;

        // Позиционирование визуальной рамки в браузере
        selector.style.left = (e.clientX - rect.left + canvas.parentElement.scrollLeft) + 'px';
        selector.style.top = (e.clientY - rect.top + canvas.parentElement.scrollTop) + 'px';
        selector.style.width = '0px';
        selector.style.height = '0px';
        selector.style.display = 'block';
    });

    canvas.addEventListener('mousemove', function(e) {
        if (!isDrawing) return;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const currentX = (e.clientX - rect.left) * scaleX;
        const currentY = (e.clientY - rect.top) * scaleY;

        cropX = Math.min(startX, currentX);
        cropY = Math.min(startY, currentY);
        cropW = Math.abs(startX - currentX);
        cropH = Math.abs(startY - currentY);

        // Обновляем визуальную рамку
        const scrollContainer = canvas.parentElement;
        const viewX = (cropX / scaleX);
        const viewY = (cropY / scaleY);
        
        selector.style.left = viewX + 'px';
        selector.style.top = viewY + 'px';
        selector.style.width = (cropW / scaleX) + 'px';
        selector.style.height = (cropH / scaleY) + 'px';

        // Обновляем маленькое окошко превью на лету
        if (cropW > 5 && cropH > 5) {
            pCtx.clearRect(0, 0, 64, 64);
            pCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, 64, 64);
        }
    });

    window.addEventListener('mouseup', function() {
        isDrawing = false;
    });

    // 4. Скачивание выделенного фрагмента с правильным именем
    btnDownload.onclick = function() {
        if (cropW < 5 || cropH < 5) {
            alert('Пожалуйста, выделите сначала область иконки на скриншоте!');
            return;
        }

        const selectedMatName = selectEl.value;
        if (!selectedMatName) return;

        // Создаем временный канвас нужного размера для чистого сохранения (например, 64х64 пикселя)
        const saveCanvas = document.createElement('canvas');
        saveCanvas.width = 64;
        saveCanvas.height = 64;
        const sCtx = saveCanvas.getContext('2d');
        
        // Вырезаем кусок из основного холста и подгоняем под размер 64х64
        sCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, 64, 64);

        // Генерируем правильное имя файла в зависимости от того, хлам это или сам предмет крафта
        let fileName = "";
        
        // Ищем, есть ли это имя в ключах основного крафта (box_4, sr25 и т.д.)
        let foundKey = null;
        if (typeof craftData !== 'undefined') {
            for (let key in craftData) {
                if (craftData[key].name === selectedMatName) {
                    foundKey = key;
                    break;
                }
            }
        }

        if (foundKey) {
            // Если это целевой предмет крафта, сохраняем как box_4.png, sr25.png
            fileName = foundKey + ".png";
        } else {
            // Если это материал/хлам, переводим имя через встроенную функцию
            fileName = selectedMatName.toLowerCase().replace(/[^a-zа-я0-9\s]/g, '').trim().replace(/\s+/g, '_') + ".png";
        }

        // Скачиваем файл через виртуальную ссылку
        const link = document.createElement('a');
        link.download = fileName;
        link.href = saveCanvas.toDataURL('image/png');
        link.click();
    };
}

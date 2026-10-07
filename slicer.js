function initSlicerInterface() {
    var fileInput = document.getElementById("screenshot-input");
    var outputZone = document.getElementById("cropper-zone");
    if (!fileInput || !outputZone) return;

    outputZone.innerHTML = '<div class="slicer-workspace"><p style="font-size: 13px; color: #ffb74d; margin: 0;">Наведите рамку на нужный предмет на скриншоте и кликните левой кнопкой мыши для захвата.</p><div class="canvas-container"><canvas id="screenshot-canvas"></canvas><div id="crop-selector"></div></div><div class="slicer-controls-row"><canvas id="preview-canvas" width="64" height="64"></canvas><select id="material-selector" class="slicer-select"></select><button id="btn-download-crop" class="btn btn-plus" style="width: auto; padding: 0 25px; height: 40px; font-size: 14px;">Скачать иконку</button></div></div>';

    var canvas = document.getElementById("screenshot-canvas");
    var ctx = canvas.getContext("2d");
    var selector = document.getElementById("crop-selector");
    var previewCanvas = document.getElementById("preview-canvas");
    var pCtx = previewCanvas.getContext("2d");
    var selectEl = document.getElementById("material-selector");
    var btnDownload = document.getElementById("btn-download-crop");

    var img = new Image();
    var itemSize = 64; 
    var cropX = 0, cropY = 0;

    selector.style.width = itemSize + "px";
    selector.style.height = itemSize + "px";

    var allMaterials = new Set();
    for (var key in craftData) {
        allMaterials.add(craftData[key].name);
        for (var mat in craftData[key].materials) { allMaterials.add(mat); }
    }
    Array.from(allMaterials).sort().forEach(function(mat) {
        var opt = document.createElement("option");
        opt.value = mat; opt.textContent = mat; selectEl.appendChild(opt);
    });

    fileInput.onchange = function(e) {
        var files = e.target.files;
        if (!files || files.length === 0) return;
        
        var reader = new FileReader();
        reader.onload = function(ev) {
            img.onload = function() {
                canvas.width = img.width; canvas.height = img.height;
                ctx.drawImage(img, 0, 0); outputZone.style.display = "block";
                selector.style.display = "none"; pCtx.clearRect(0, 0, 64, 64);
            };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(files[0]);
    };

    canvas.addEventListener("mousemove", function(e) {
        var rect = canvas.getBoundingClientRect();
        var scaleX = canvas.width / rect.width;
        var scaleY = canvas.height / rect.height;

        var mouseX = (e.clientX - rect.left) * scaleX;
        var mouseY = (e.clientY - rect.top) * scaleY;

        cropX = Math.round(mouseX - itemSize / 2);
        cropY = Math.round(mouseY - itemSize / 2);

        if (cropX < 0) cropX = 0;
        if (cropY < 0) cropY = 0;
        if (cropX + itemSize > canvas.width) cropX = canvas.width - itemSize;
        if (cropY + itemSize > canvas.height) cropY = canvas.height - itemSize;

        selector.style.left = (cropX / scaleX) + "px";
        selector.style.top = (cropY / scaleY) + "px";
        selector.style.display = "block";
    });

    canvas.addEventListener("click", function() {
        pCtx.clearRect(0, 0, 64, 64);
        pCtx.drawImage(canvas, cropX, cropY, itemSize, itemSize, 0, 0, 64, 64);
    });

    btnDownload.onclick = function() {
        var targetName = selectEl.value;
        var foundKey = Object.keys(craftData).find(function(k) { return craftData[k].name === targetName; });
        var fn = foundKey ? foundKey + ".png" : targetName.toLowerCase().replace(/[^a-zа-я0-9\s]/g, "").trim().replace(/\s+/g, "_") + ".png";

        var saveCanvas = document.createElement("canvas");
        saveCanvas.width = 64; saveCanvas.height = 64;
        saveCanvas.getContext("2d").drawImage(canvas, cropX, cropY, itemSize, itemSize, 0, 0, 64, 64);

        var link = document.createElement("a");
        link.download = fn; link.href = saveCanvas.toDataURL("image/png"); link.click();
    };
}

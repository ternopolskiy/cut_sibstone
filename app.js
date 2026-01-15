// Глобальные переменные
let details = [];
let cuttingResult = null;
let currentSheetIndex = 0;
let canvas, ctx;
let scale = 0.2;
let offsetX = 0;
let offsetY = 0;
let hoveredDetail = null;

// Материалы
const materials = {
    acrylic_standard: { name: 'Акрил стандартный', length: 3680, width: 760, thickness: 12, price: 15000, type: 'acrylic' },
    acrylic_premium: { name: 'Акрил премиум', length: 3680, width: 760, thickness: 12, price: 20000, type: 'acrylic' },
    quartz_standard: { name: 'Кварц стандартный', length: 3050, width: 1440, thickness: 20, price: 25000, type: 'quartz' },
    quartz_premium: { name: 'Кварц премиум', length: 3200, width: 1600, thickness: 20, price: 35000, type: 'quartz' },
    acrylic_thin: { name: 'Акрил тонкий 6мм', length: 3680, width: 760, thickness: 6, price: 12000, type: 'acrylic' }
};

// Переключение вкладок
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tabName = btn.dataset.tab;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(tabName).classList.add('active');
    });
});

// Добавление детали
function addDetail() {
    const length = parseInt(document.getElementById('detailLength').value);
    const width = parseInt(document.getElementById('detailWidth').value);
    const qty = parseInt(document.getElementById('detailQty').value);
    const name = document.getElementById('detailName').value || `Деталь ${details.length + 1}`;
    const notes = document.getElementById('detailNotes').value;
    const rotate = document.getElementById('detailRotate').checked;

    if (!length || !width || !qty) {
        alert('Заполните размеры и количество');
        return;
    }

    details.push({ length, width, qty, name, notes, rotate });
    updateDetailsTable();
    clearDetailForm();
}

function clearDetailForm() {
    document.getElementById('detailLength').value = '';
    document.getElementById('detailWidth').value = '';
    document.getElementById('detailQty').value = '1';
    document.getElementById('detailName').value = '';
    document.getElementById('detailNotes').value = '';
}

function updateDetailsTable() {
    const tbody = document.getElementById('detailsBody');
    tbody.innerHTML = '';
    details.forEach((detail, index) => {
        const area = ((detail.length * detail.width) / 1000000).toFixed(4);
        const row = tbody.insertRow();
        row.innerHTML = `
            <td><strong>#${index + 1}</strong></td>
            <td>${detail.name}</td>
            <td>${detail.length}×${detail.width}</td>
            <td>${detail.qty}</td>
            <td>${area} м²</td>
            <td>${detail.notes || '-'}</td>
            <td><i class="fas fa-${detail.rotate ? 'check text-success' : 'times text-danger'}"></i></td>
            <td><button class="btn btn-danger" onclick="deleteDetail(${index})"><i class="fas fa-trash"></i></button></td>
        `;
    });
    updateProjectPreview();
}

function updateProjectPreview() {
    const preview = document.getElementById('projectPreview');
    
    if (details.length === 0) {
        preview.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-cube"></i>
                <p>Добавьте детали для просмотра</p>
            </div>
        `;
        return;
    }
    
    // Создаем мини-визуализацию всех деталей
    preview.innerHTML = '';
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 400;
    preview.appendChild(canvas);
    
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f9fafb';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Находим максимальные размеры для масштабирования
    let maxLength = 0;
    let maxWidth = 0;
    details.forEach(d => {
        maxLength = Math.max(maxLength, d.length);
        maxWidth = Math.max(maxWidth, d.width);
    });
    
    const scaleX = (canvas.width - 100) / maxLength;
    const scaleY = (canvas.height - 100) / maxWidth;
    const scale = Math.min(scaleX, scaleY, 0.15);
    
    // Рисуем детали в ряд
    let offsetX = 50;
    let offsetY = 50;
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
    
    details.forEach((detail, idx) => {
        const w = detail.length * scale;
        const h = detail.width * scale;
        
        // Проверяем, помещается ли деталь
        if (offsetX + w > canvas.width - 50) {
            offsetX = 50;
            offsetY += 100;
        }
        
        if (offsetY + h > canvas.height - 50) {
            return; // Не помещается
        }
        
        // Рисуем деталь
        ctx.fillStyle = colors[idx % colors.length] + '40';
        ctx.fillRect(offsetX, offsetY, w, h);
        
        ctx.strokeStyle = colors[idx % colors.length];
        ctx.lineWidth = 2;
        ctx.strokeRect(offsetX, offsetY, w, h);
        
        // Текст
        ctx.fillStyle = '#1f2937';
        ctx.font = 'bold 11px Inter';
        ctx.textAlign = 'center';
        ctx.fillText(detail.name, offsetX + w / 2, offsetY + h / 2 - 5);
        ctx.font = '10px Inter';
        ctx.fillText(`${detail.length}×${detail.width}`, offsetX + w / 2, offsetY + h / 2 + 8);
        ctx.fillText(`×${detail.qty}`, offsetX + w / 2, offsetY + h / 2 + 20);
        
        offsetX += w + 20;
    });
}

function deleteDetail(index) {
    details.splice(index, 1);
    updateDetailsTable();
}

// Импорт CSV - поддержка двух форматов
document.getElementById('csvImport').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
        const content = event.target.result;
        const lines = content.split('\n');
        
        // Определяем формат файла
        const isFullReport = content.includes('CUTTING REPORT') || content.includes('PARTS LIST');
        
        if (isFullReport) {
            // Импорт из полного отчета
            importFromFullReport(lines);
        } else {
            // Импорт из простого формата
            importFromSimpleFormat(lines);
        }
        
        updateDetailsTable();
        
        if (details.length > 0) {
            alert(`Импортировано деталей: ${details.length}`);
        } else {
            alert('Не удалось импортировать детали. Проверьте формат файла.');
        }
    };
    reader.readAsText(file);
    
    // Сбрасываем input
    e.target.value = '';
});

// Импорт из простого формата CSV
function importFromSimpleFormat(lines) {
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const parts = parseCSVLine(line);
        
        if (parts.length >= 4) {
            const name = parts[0].trim();
            const length = parseInt(parts[1]);
            const width = parseInt(parts[2]);
            const qty = parseInt(parts[3]);
            
            if (!isNaN(length) && !isNaN(width) && !isNaN(qty) && length > 0 && width > 0 && qty > 0) {
                const notes = parts.length > 4 ? parts[4].trim() : '';
                const rotate = parts.length > 5 ? (parts[5].toLowerCase().includes('true') || parts[5].toLowerCase().includes('yes')) : true;
                
                details.push({
                    name: name || `Деталь ${details.length + 1}`,
                    length: length,
                    width: width,
                    qty: qty,
                    notes: notes,
                    rotate: rotate
                });
            }
        }
    }
}

// Импорт из полного отчета
function importFromFullReport(lines) {
    let inPartsSection = false;
    let headerFound = false;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (!line) continue;
        
        // Ищем секцию PARTS LIST
        if (line.includes('PARTS LIST')) {
            inPartsSection = true;
            headerFound = false;
            continue;
        }
        
        // Пропускаем заголовок таблицы
        if (inPartsSection && !headerFound) {
            if (line.includes('Number,Name') || line.includes('Number,') || line.includes('#,')) {
                headerFound = true;
                continue;
            }
        }
        
        // Останавливаемся на следующей секции
        if (line.includes('PLACEMENT BY SHEETS') || line.includes('COST BREAKDOWN')) {
            break;
        }
        
        // Парсим строку с деталью
        if (inPartsSection && headerFound) {
            const parts = parseCSVLine(line);
            
            if (parts.length >= 4) {
                // Формат: Number, Name, Length, Width, Quantity, Area, Notes
                const length = parseInt(parts[2]);
                const width = parseInt(parts[3]);
                const qty = parseInt(parts[4]);
                
                if (!isNaN(length) && !isNaN(width) && !isNaN(qty) && length > 0 && width > 0 && qty > 0) {
                    const name = parts[1].trim() || `Деталь ${details.length + 1}`;
                    const notes = parts.length > 6 ? parts[6].replace(/"/g, '').trim() : '';
                    
                    details.push({
                        name: name,
                        length: length,
                        width: width,
                        qty: qty,
                        notes: notes === '-' ? '' : notes,
                        rotate: true
                    });
                }
            }
        }
    }
}

// Парсинг CSV строки с учетом кавычек
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    
    result.push(current);
    return result;
}

// Экспорт простого CSV (только детали) для импорта
function exportSimpleCSV() {
    if (details.length === 0) {
        alert('Нет деталей для экспорта');
        return;
    }
    
    let csv = 'Название,Длина,Ширина,Количество,Примечания,Поворот\n';
    details.forEach(d => {
        const notes = (d.notes || '').replace(/"/g, '""'); // Экранируем кавычки
        csv += `${d.name},${d.length},${d.width},${d.qty},"${notes}",${d.rotate}\n`;
    });
    
    const date = new Date().toISOString().split('T')[0];
    downloadFileUTF8(csv, `details_${date}.csv`, 'text/csv');
}

// Экспорт полного CSV отчета с результатами раскроя
function exportFullCSV() {
    if (details.length === 0 && !cuttingResult) {
        alert('Нет данных для экспорта');
        return;
    }
    
    let csv = '';
    
    if (cuttingResult) {
        // Расширенный экспорт с результатами раскроя - на английском
        csv += 'CUTTING REPORT\n\n';
        csv += `Material,${translateMaterialName(cuttingResult.material.name)}\n`;
        csv += `Sheet size,"${cuttingResult.material.length}x${cuttingResult.material.width}x${cuttingResult.material.thickness} mm"\n`;
        csv += `Sheets used,${cuttingResult.totalSheets}\n\n`;
        
        const totalArea = cuttingResult.sheets.reduce((sum, s) => sum + s.usedArea, 0);
        const sheetArea = cuttingResult.material.length * cuttingResult.material.width;
        const totalSheetArea = sheetArea * cuttingResult.totalSheets;
        const efficiency = ((totalArea / totalSheetArea) * 100).toFixed(2);
        
        csv += `Efficiency,${efficiency}%\n`;
        csv += `Parts area,"${(totalArea / 1000000).toFixed(2)} sq.m"\n`;
        csv += `Waste area,"${((totalSheetArea - totalArea) / 1000000).toFixed(2)} sq.m"\n\n`;
        
        csv += 'PARTS LIST\n';
        csv += 'Number,Name,Length,Width,Quantity,Area (sq.m),Notes\n';
        details.forEach((d, i) => {
            const area = ((d.length * d.width * d.qty) / 1000000).toFixed(4);
            csv += `${i + 1},Part ${i + 1},${d.length},${d.width},${d.qty},${area},"${d.notes || '-'}"\n`;
        });
        
        csv += '\nPLACEMENT BY SHEETS\n';
        cuttingResult.sheets.forEach((sheet, idx) => {
            csv += `\nSheet ${idx + 1}\n`;
            csv += 'Number,Name,Size,Position X,Position Y,Rotated\n';
            sheet.details.forEach((detail, detailIdx) => {
                csv += `${detailIdx + 1},Part,${detail.length}x${detail.width},${detail.x},${detail.y},${detail.rotated ? 'Yes' : 'No'}\n`;
            });
        });
        
        // Стоимость если есть
        const costPrice = document.getElementById('costPrice').textContent;
        if (costPrice !== '0 ₽') {
            csv += '\nCOST BREAKDOWN\n';
            const costPriceNum = parseFloat(costPrice.replace(/[^\d.]/g, ''));
            const clientPriceNum = parseFloat(document.getElementById('clientPrice').textContent.replace(/[^\d.]/g, ''));
            csv += `Cost Price,${costPriceNum.toFixed(2)} RUB\n`;
            csv += `Client Price,${clientPriceNum.toFixed(2)} RUB\n`;
        }
    } else {
        // Простой экспорт деталей
        csv += 'Name,Length,Width,Quantity,Notes,Rotation\n';
        details.forEach(d => {
            csv += `Part,${d.length},${d.width},${d.qty},"${d.notes || '-'}",${d.rotate ? 'Yes' : 'No'}\n`;
        });
    }
    
    const date = new Date().toISOString().split('T')[0];
    downloadFileUTF8(csv, `cutting_report_${date}.csv`, 'text/csv');
}

function downloadFileUTF8(content, filename, type) {
    // Добавляем UTF-8 BOM для правильного отображения в Excel
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + content], { type: type + ';charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function downloadFile(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

// Алгоритм раскроя
function calculateCutting() {
    if (details.length === 0) {
        alert('Добавьте детали для раскроя');
        return;
    }

    const materialType = document.getElementById('materialType').value;
    const material = materials[materialType];
    const cutWidth = parseFloat(document.getElementById('cutWidth').value);
    const minMargin = parseFloat(document.getElementById('minMargin').value);

    // Подготовка деталей с учетом количества
    const allDetails = [];
    details.forEach((detail, idx) => {
        for (let i = 0; i < detail.qty; i++) {
            allDetails.push({
                ...detail,
                id: `${idx}-${i}`,
                placed: false
            });
        }
    });

    // Сортировка по площади (большие первыми)
    allDetails.sort((a, b) => (b.length * b.width) - (a.length * a.width));

    const sheets = [];
    let currentSheet = null;

    // Простой алгоритм First Fit Decreasing Height
    allDetails.forEach(detail => {
        let placed = false;

        // Попытка разместить на существующих листах
        for (let sheet of sheets) {
            if (tryPlaceDetail(sheet, detail, material, cutWidth, minMargin)) {
                placed = true;
                break;
            }
        }

        // Если не удалось, создаем новый лист
        if (!placed) {
            currentSheet = {
                material: material,
                details: [],
                usedArea: 0
            };
            sheets.push(currentSheet);
            tryPlaceDetail(currentSheet, detail, material, cutWidth, minMargin);
        }
    });

    cuttingResult = {
        sheets,
        material,
        totalSheets: sheets.length,
        cutWidth,
        minMargin
    };

    displayCuttingResults();
    calculateRemnants();
}

function tryPlaceDetail(sheet, detail, material, cutWidth, minMargin) {
    const sheetWidth = material.width;
    const sheetLength = material.length;

    // Пробуем разместить деталь в разных ориентациях
    const orientations = detail.rotate ? 
        [[detail.length, detail.width], [detail.width, detail.length]] : 
        [[detail.length, detail.width]];

    for (let [detailL, detailW] of orientations) {
        // Проверяем размеры с учетом отступов
        if (detailL + 2 * minMargin > sheetLength || detailW + 2 * minMargin > sheetWidth) {
            continue;
        }

        // Простое размещение: ищем свободное место
        let x = minMargin;
        let y = minMargin;
        let canPlace = true;

        // Проверка пересечений с уже размещенными деталями
        for (let placed of sheet.details) {
            if (!(x + detailL + cutWidth <= placed.x || 
                  x >= placed.x + placed.length + cutWidth ||
                  y + detailW + cutWidth <= placed.y || 
                  y >= placed.y + placed.width + cutWidth)) {
                canPlace = false;
                break;
            }
        }

        if (canPlace) {
            // Ищем оптимальную позицию
            let bestX = minMargin;
            let bestY = minMargin;

            // Пробуем разместить рядом с существующими деталями
            for (let placed of sheet.details) {
                // Справа от детали
                let testX = placed.x + placed.length + cutWidth;
                let testY = placed.y;
                if (testX + detailL + minMargin <= sheetLength && testY + detailW + minMargin <= sheetWidth) {
                    if (checkPosition(sheet, testX, testY, detailL, detailW, cutWidth)) {
                        bestX = testX;
                        bestY = testY;
                        break;
                    }
                }

                // Снизу от детали
                testX = placed.x;
                testY = placed.y + placed.width + cutWidth;
                if (testX + detailL + minMargin <= sheetLength && testY + detailW + minMargin <= sheetWidth) {
                    if (checkPosition(sheet, testX, testY, detailL, detailW, cutWidth)) {
                        bestX = testX;
                        bestY = testY;
                        break;
                    }
                }
            }

            sheet.details.push({
                ...detail,
                x: bestX,
                y: bestY,
                length: detailL,
                width: detailW,
                rotated: detailL !== detail.length
            });
            sheet.usedArea += detailL * detailW;
            return true;
        }
    }

    return false;
}

function checkPosition(sheet, x, y, length, width, cutWidth) {
    for (let placed of sheet.details) {
        if (!(x + length + cutWidth <= placed.x || 
              x >= placed.x + placed.length + cutWidth ||
              y + width + cutWidth <= placed.y || 
              y >= placed.y + placed.width + cutWidth)) {
            return false;
        }
    }
    return true;
}

function displayCuttingResults() {
    const resultsDiv = document.getElementById('cuttingResults');
    const statsDiv = document.getElementById('cuttingStats');

    resultsDiv.style.display = 'block';

    const totalArea = cuttingResult.sheets.reduce((sum, s) => sum + s.usedArea, 0);
    const sheetArea = cuttingResult.material.length * cuttingResult.material.width;
    const totalSheetArea = sheetArea * cuttingResult.totalSheets;
    const efficiency = ((totalArea / totalSheetArea) * 100).toFixed(2);
    const wasteArea = totalSheetArea - totalArea;

    statsDiv.innerHTML = `
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-label">Материал</div>
                <div class="stat-value">${cuttingResult.material.name}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Использовано листов</div>
                <div class="stat-value">${cuttingResult.totalSheets}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Эффективность</div>
                <div class="stat-value">${efficiency}%</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Площадь деталей</div>
                <div class="stat-value">${(totalArea / 1000000).toFixed(2)} м²</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Площадь отходов</div>
                <div class="stat-value">${(wasteArea / 1000000).toFixed(2)} м²</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Всего деталей</div>
                <div class="stat-value">${cuttingResult.sheets.reduce((sum, s) => sum + s.details.length, 0)}</div>
            </div>
        </div>
        
        <div class="legend">
            <div class="legend-item">
                <div class="legend-color" style="background: rgba(0, 123, 255, 0.3);"></div>
                <span>Детали</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background: rgba(255, 193, 7, 0.3);"></div>
                <span>Остатки</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background: rgba(40, 167, 69, 0.3);"></div>
                <span>Выделенная деталь</span>
            </div>
        </div>
    `;

    // Инициализация Canvas
    initCanvas();
    createSheetSelector();
    drawSheet(0);
}

function initCanvas() {
    canvas = document.getElementById('cuttingCanvas');
    ctx = canvas.getContext('2d');
    
    // Установка размера canvas
    const material = cuttingResult.material;
    canvas.width = material.length * scale + 100;
    canvas.height = material.width * scale + 100;
    
    // События мыши
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('click', handleCanvasClick);
    canvas.addEventListener('wheel', handleWheel);
}

function createSheetSelector() {
    const selector = document.getElementById('sheetSelector');
    selector.innerHTML = '<strong>Выберите лист:</strong>';
    
    cuttingResult.sheets.forEach((sheet, idx) => {
        const btn = document.createElement('button');
        btn.className = 'sheet-btn' + (idx === 0 ? ' active' : '');
        btn.textContent = `Лист ${idx + 1} (${sheet.details.length} дет.)`;
        btn.onclick = () => {
            document.querySelectorAll('.sheet-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            drawSheet(idx);
        };
        selector.appendChild(btn);
    });
}

function drawSheet(sheetIndex) {
    currentSheetIndex = sheetIndex;
    const sheet = cuttingResult.sheets[sheetIndex];
    const material = sheet.material;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Фон
    ctx.fillStyle = '#fafafa';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Сетка (если включена)
    if (document.getElementById('showGrid').checked) {
        drawGrid(material);
    }
    
    // Контур листа
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 3;
    ctx.strokeRect(50, 50, material.length * scale, material.width * scale);
    
    // Размеры листа
    ctx.fillStyle = '#333';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`${material.length} мм`, 50 + (material.length * scale) / 2, 35);
    ctx.save();
    ctx.translate(30, 50 + (material.width * scale) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`${material.width} мм`, 0, 0);
    ctx.restore();
    
    // Детали
    sheet.details.forEach((detail, idx) => {
        drawDetail(detail, idx);
    });
    
    // Информация о листе
    ctx.fillStyle = '#007bff';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Лист ${sheetIndex + 1} / ${cuttingResult.totalSheets}`, 10, 20);
    
    const efficiency = ((sheet.usedArea / (material.length * material.width)) * 100).toFixed(1);
    ctx.fillText(`Заполнение: ${efficiency}%`, canvas.width - 200, 20);
}

function drawGrid(material) {
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 0.5;
    
    const gridSize = 100; // 100мм
    
    // Вертикальные линии
    for (let x = 0; x <= material.length; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(50 + x * scale, 50);
        ctx.lineTo(50 + x * scale, 50 + material.width * scale);
        ctx.stroke();
    }
    
    // Горизонтальные линии
    for (let y = 0; y <= material.width; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(50, 50 + y * scale);
        ctx.lineTo(50 + material.length * scale, 50 + y * scale);
        ctx.stroke();
    }
}

function drawDetail(detail, idx) {
    const x = 50 + detail.x * scale;
    const y = 50 + detail.y * scale;
    const w = detail.length * scale;
    const h = detail.width * scale;
    
    // Определяем цвет
    let fillColor = 'rgba(0, 123, 255, 0.3)';
    let strokeColor = '#007bff';
    
    if (hoveredDetail === idx) {
        fillColor = 'rgba(40, 167, 69, 0.5)';
        strokeColor = '#28a745';
    }
    
    // Рисуем деталь
    ctx.fillStyle = fillColor;
    ctx.fillRect(x, y, w, h);
    
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    
    // Текст
    if (document.getElementById('showDimensions').checked) {
        ctx.fillStyle = '#333';
        ctx.font = 'bold 11px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const text = detail.name;
        const sizeText = `${detail.length}×${detail.width}`;
        
        ctx.fillText(text, x + w / 2, y + h / 2 - 6);
        ctx.font = '10px Arial';
        ctx.fillText(sizeText, x + w / 2, y + h / 2 + 6);
        
        if (detail.rotated) {
            ctx.fillStyle = '#dc3545';
            ctx.font = 'bold 9px Arial';
            ctx.fillText('↻', x + 5, y + 10);
        }
    }
    
    // Номер детали
    ctx.fillStyle = strokeColor;
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`#${idx + 1}`, x + 3, y + 12);
}

function handleMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const sheet = cuttingResult.sheets[currentSheetIndex];
    let found = false;
    
    sheet.details.forEach((detail, idx) => {
        const x = 50 + detail.x * scale;
        const y = 50 + detail.y * scale;
        const w = detail.length * scale;
        const h = detail.width * scale;
        
        if (mouseX >= x && mouseX <= x + w && mouseY >= y && mouseY <= y + h) {
            if (hoveredDetail !== idx) {
                hoveredDetail = idx;
                drawSheet(currentSheetIndex);
                showDetailInfo(detail, idx);
            }
            found = true;
        }
    });
    
    if (!found && hoveredDetail !== null) {
        hoveredDetail = null;
        drawSheet(currentSheetIndex);
        hideDetailInfo();
    }
}

function handleCanvasClick(e) {
    if (hoveredDetail !== null) {
        const detail = cuttingResult.sheets[currentSheetIndex].details[hoveredDetail];
        alert(`Деталь: ${detail.name}\nРазмер: ${detail.length}×${detail.width} мм\nПовернута: ${detail.rotated ? 'Да' : 'Нет'}\nПримечания: ${detail.notes || 'Нет'}`);
    }
}

function handleWheel(e) {
    e.preventDefault();
    if (e.deltaY < 0) {
        zoomIn();
    } else {
        zoomOut();
    }
}

function showDetailInfo(detail, idx) {
    const infoDiv = document.getElementById('detailInfoContent');
    infoDiv.innerHTML = `
        <div class="detail-info-item">
            <span>Номер детали:</span>
            <strong>#${idx + 1}</strong>
        </div>
        <div class="detail-info-item">
            <span>Название:</span>
            <strong>${detail.name}</strong>
        </div>
        <div class="detail-info-item">
            <span>Размер:</span>
            <strong>${detail.length} × ${detail.width} мм</strong>
        </div>
        <div class="detail-info-item">
            <span>Площадь:</span>
            <strong>${((detail.length * detail.width) / 1000000).toFixed(4)} м²</strong>
        </div>
        <div class="detail-info-item">
            <span>Позиция:</span>
            <strong>X: ${detail.x} мм, Y: ${detail.y} мм</strong>
        </div>
        <div class="detail-info-item">
            <span>Повернута:</span>
            <strong>${detail.rotated ? 'Да ↻' : 'Нет'}</strong>
        </div>
        ${detail.notes ? `<div class="detail-info-item">
            <span>Примечания:</span>
            <strong>${detail.notes}</strong>
        </div>` : ''}
    `;
}

function hideDetailInfo() {
    const infoDiv = document.getElementById('detailInfoContent');
    infoDiv.innerHTML = 'Наведите на деталь для просмотра информации';
}

function zoomIn() {
    scale *= 1.2;
    updateZoom();
}

function zoomOut() {
    scale /= 1.2;
    updateZoom();
}

function resetView() {
    scale = 0.2;
    updateZoom();
}

function updateZoom() {
    const material = cuttingResult.material;
    canvas.width = material.length * scale + 100;
    canvas.height = material.width * scale + 100;
    document.getElementById('zoomLevel').textContent = Math.round(scale * 500) + '%';
    drawSheet(currentSheetIndex);
}

// Расчет полезных остатков
function calculateRemnants() {
    const remnantsDiv = document.getElementById('remnantsContent');
    remnantsDiv.innerHTML = '';
    
    const minUsefulLength = 300; // Минимальный полезный размер
    const minUsefulWidth = 200;
    
    cuttingResult.sheets.forEach((sheet, sheetIdx) => {
        const material = sheet.material;
        const remnants = findRemnants(sheet, material, minUsefulLength, minUsefulWidth);
        
        remnants.forEach((remnant, idx) => {
            const isUseful = remnant.length >= minUsefulLength && remnant.width >= minUsefulWidth;
            const area = ((remnant.length * remnant.width) / 1000000).toFixed(4);
            
            const remnantDiv = document.createElement('div');
            remnantDiv.className = `remnant-item ${isUseful ? 'remnant-useful' : 'remnant-waste'}`;
            remnantDiv.innerHTML = `
                <h5><i class="fas fa-${isUseful ? 'check-circle' : 'times-circle'}"></i> Лист ${sheetIdx + 1}, Остаток ${idx + 1}</h5>
                <p><strong>Размер:</strong> ${remnant.length} × ${remnant.width} мм</p>
                <p><strong>Площадь:</strong> ${area} м²</p>
                <p><strong>Статус:</strong> ${isUseful ? 'Полезный остаток' : 'Отход'}</p>
            `;
            remnantsDiv.appendChild(remnantDiv);
        });
    });
    
    if (remnantsDiv.children.length === 0) {
        remnantsDiv.innerHTML = '<p style="text-align:center;color:#6b7280;">Остатков не обнаружено</p>';
    }
}

function findRemnants(sheet, material, minLength, minWidth) {
    const remnants = [];
    const occupied = [];
    
    // Собираем все занятые области
    sheet.details.forEach(detail => {
        occupied.push({
            x: detail.x,
            y: detail.y,
            x2: detail.x + detail.length,
            y2: detail.y + detail.width
        });
    });
    
    // Простой алгоритм поиска прямоугольных остатков
    // Проверяем правую сторону каждой детали
    sheet.details.forEach(detail => {
        const rightX = detail.x + detail.length + cuttingResult.cutWidth;
        const rightWidth = material.length - rightX;
        
        if (rightWidth >= minWidth) {
            remnants.push({
                x: rightX,
                y: detail.y,
                length: rightWidth,
                width: detail.width
            });
        }
        
        // Проверяем нижнюю сторону
        const bottomY = detail.y + detail.width + cuttingResult.cutWidth;
        const bottomHeight = material.width - bottomY;
        
        if (bottomHeight >= minWidth) {
            remnants.push({
                x: detail.x,
                y: bottomY,
                length: detail.length,
                width: bottomHeight
            });
        }
    });
    
    return remnants;
}

// Расчет стоимости
function calculateCost() {
    if (!cuttingResult) {
        alert('Сначала выполните раскрой');
        return;
    }

    const costResultsDiv = document.getElementById('costResults');
    costResultsDiv.style.display = 'block';

    const material = cuttingResult.material;
    const totalSheets = cuttingResult.totalSheets;
    const cutSpeed = parseFloat(document.getElementById('cutSpeed').value);

    // Расчет стоимости материала
    const materialCost = material.price * totalSheets;

    // Расчет длины реза
    let totalCutLength = 0;
    cuttingResult.sheets.forEach(sheet => {
        sheet.details.forEach(detail => {
            totalCutLength += 2 * (detail.length + detail.width);
        });
    });

    // Стоимость резки (руб/мин * время)
    const cuttingTime = totalCutLength / cutSpeed; // минуты
    const cuttingCostPerMin = 50; // руб/мин
    const cuttingCost = cuttingTime * cuttingCostPerMin;

    // Стоимость кромки (примерно)
    const edgeCost = totalCutLength * 0.5; // 0.5 руб/мм

    // Стоимость работы
    const laborCost = totalSheets * 2000;

    // Отходы (стоимость неиспользованного материала)
    const sheetArea = material.length * material.width;
    const totalSheetArea = sheetArea * totalSheets;
    const usedArea = cuttingResult.sheets.reduce((sum, s) => sum + s.usedArea, 0);
    const wasteArea = totalSheetArea - usedArea;
    const wasteCost = (wasteArea / sheetArea) * material.price;

    // Себестоимость
    const costPrice = materialCost + cuttingCost + edgeCost + laborCost;

    // Наценка 30%
    const markup = costPrice * 0.3;
    const clientPrice = costPrice + markup;

    // Отображение
    document.getElementById('costPrice').textContent = costPrice.toFixed(2) + ' ₽';
    document.getElementById('clientPrice').textContent = clientPrice.toFixed(2) + ' ₽';

    // Детализация
    const costDetails = document.getElementById('costDetails');
    costDetails.innerHTML = `
        <div class="cost-detail-item">
            <span>Материал (${totalSheets} листов)</span>
            <strong>${materialCost.toFixed(2)} ₽</strong>
        </div>
        <div class="cost-detail-item">
            <span>Резка (${cuttingTime.toFixed(1)} мин)</span>
            <strong>${cuttingCost.toFixed(2)} ₽</strong>
        </div>
        <div class="cost-detail-item">
            <span>Кромка (${(totalCutLength / 1000).toFixed(2)} м)</span>
            <strong>${edgeCost.toFixed(2)} ₽</strong>
        </div>
        <div class="cost-detail-item">
            <span>Работа</span>
            <strong>${laborCost.toFixed(2)} ₽</strong>
        </div>
        <div class="cost-detail-item">
            <span>Отходы (${((wasteArea / 1000000).toFixed(2))} м²)</span>
            <strong>${wasteCost.toFixed(2)} ₽</strong>
        </div>
        <div class="cost-detail-item" style="border-top: 2px solid #007bff; margin-top: 10px; padding-top: 10px;">
            <span><strong>Наценка (30%)</strong></span>
            <strong>${markup.toFixed(2)} ₽</strong>
        </div>
    `;

    // График
    drawCostChart(materialCost, cuttingCost, edgeCost, laborCost, wasteCost, markup);

    // Метрики
    const metrics = document.getElementById('projectMetrics');
    const efficiency = ((usedArea / totalSheetArea) * 100).toFixed(2);
    metrics.innerHTML = `
        <div class="metric-card">
            <div>Всего деталей</div>
            <div class="metric-value">${details.reduce((sum, d) => sum + d.qty, 0)}</div>
        </div>
        <div class="metric-card">
            <div>Использовано листов</div>
            <div class="metric-value">${totalSheets}</div>
        </div>
        <div class="metric-card">
            <div>Эффективность</div>
            <div class="metric-value">${efficiency}%</div>
        </div>
        <div class="metric-card">
            <div>Время резки</div>
            <div class="metric-value">${cuttingTime.toFixed(1)} мин</div>
        </div>
        <div class="metric-card">
            <div>Длина реза</div>
            <div class="metric-value">${(totalCutLength / 1000).toFixed(2)} м</div>
        </div>
        <div class="metric-card">
            <div>Рентабельность</div>
            <div class="metric-value">${((markup / costPrice) * 100).toFixed(1)}%</div>
        </div>
    `;
}

// Рисование графика
function drawCostChart(material, cutting, edge, labor, waste, markup) {
    const canvas = document.getElementById('costChart');
    const ctx = canvas.getContext('2d');
    
    canvas.width = 400;
    canvas.height = 400;

    const total = material + cutting + edge + labor + waste + markup;
    const data = [
        { label: 'Материал', value: material, color: '#007bff' },
        { label: 'Резка', value: cutting, color: '#28a745' },
        { label: 'Кромка', value: edge, color: '#ffc107' },
        { label: 'Работа', value: labor, color: '#17a2b8' },
        { label: 'Отходы', value: waste, color: '#dc3545' },
        { label: 'Наценка', value: markup, color: '#6c757d' }
    ];

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = 120;

    let currentAngle = -Math.PI / 2;

    data.forEach(item => {
        const sliceAngle = (item.value / total) * 2 * Math.PI;
        
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
        ctx.closePath();
        ctx.fillStyle = item.color;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Подписи
        const labelAngle = currentAngle + sliceAngle / 2;
        const labelX = centerX + Math.cos(labelAngle) * (radius + 40);
        const labelY = centerY + Math.sin(labelAngle) * (radius + 40);
        
        ctx.fillStyle = '#333';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(item.label, labelX, labelY);
        ctx.fillText(((item.value / total) * 100).toFixed(1) + '%', labelX, labelY + 15);

        currentAngle += sliceAngle;
    });
}

// Экспорт в PDF - полностью на английском
function exportPDF() {
    if (!cuttingResult) {
        alert('Нет данных для экспорта');
        return;
    }

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');
    
    let yPos = 20;
    
    // Заголовок
    pdf.setFontSize(24);
    pdf.setTextColor(37, 99, 235);
    pdf.text('CUTTING REPORT', 105, yPos, { align: 'center' });
    yPos += 15;
    
    // Линия
    pdf.setDrawColor(37, 99, 235);
    pdf.setLineWidth(0.5);
    pdf.line(20, yPos, 190, yPos);
    yPos += 10;
    
    // Информация о материале - переводим на английский
    pdf.setFontSize(12);
    pdf.setTextColor(0, 0, 0);
    const materialNameEn = translateMaterialName(cuttingResult.material.name);
    pdf.text(`Material: ${materialNameEn}`, 20, yPos);
    yPos += 7;
    pdf.text(`Sheet size: ${cuttingResult.material.length} x ${cuttingResult.material.width} x ${cuttingResult.material.thickness} mm`, 20, yPos);
    yPos += 7;
    pdf.text(`Sheets used: ${cuttingResult.totalSheets}`, 20, yPos);
    yPos += 12;
    
    // Статистика
    const totalArea = cuttingResult.sheets.reduce((sum, s) => sum + s.usedArea, 0);
    const sheetArea = cuttingResult.material.length * cuttingResult.material.width;
    const totalSheetArea = sheetArea * cuttingResult.totalSheets;
    const efficiency = ((totalArea / totalSheetArea) * 100).toFixed(2);
    
    pdf.setFontSize(14);
    pdf.setTextColor(37, 99, 235);
    pdf.text('STATISTICS', 20, yPos);
    yPos += 8;
    
    pdf.setFontSize(11);
    pdf.setTextColor(0, 0, 0);
    pdf.text(`Efficiency: ${efficiency}%`, 25, yPos);
    yPos += 6;
    pdf.text(`Parts area: ${(totalArea / 1000000).toFixed(2)} sq.m`, 25, yPos);
    yPos += 6;
    pdf.text(`Waste area: ${((totalSheetArea - totalArea) / 1000000).toFixed(2)} sq.m`, 25, yPos);
    yPos += 12;
    
    // Таблица деталей - все на английском
    pdf.setFontSize(14);
    pdf.setTextColor(37, 99, 235);
    pdf.text('PARTS LIST', 20, yPos);
    yPos += 8;
    
    const tableData = details.map((d, i) => [
        `${i + 1}`,
        `Part ${i + 1}`, // Просто "Part 1", "Part 2" и т.д.
        `${d.length} x ${d.width}`,
        `${d.qty}`,
        `${((d.length * d.width * d.qty) / 1000000).toFixed(4)}`,
        d.notes ? 'Yes' : 'No'
    ]);
    
    pdf.autoTable({
        startY: yPos,
        head: [['#', 'Name', 'Size (mm)', 'Qty', 'Area (sq.m)', 'Notes']],
        body: tableData,
        theme: 'striped',
        headStyles: { 
            fillColor: [37, 99, 235], 
            fontSize: 10,
            fontStyle: 'bold',
            halign: 'center'
        },
        bodyStyles: { fontSize: 9 },
        columnStyles: {
            0: { halign: 'center', cellWidth: 10 },
            2: { halign: 'center' },
            3: { halign: 'center', cellWidth: 15 },
            4: { halign: 'right', cellWidth: 25 }
        },
        margin: { left: 20, right: 20 }
    });
    
    yPos = pdf.lastAutoTable.finalY + 15;
    
    // Стоимость
    const costPriceText = document.getElementById('costPrice').textContent;
    const clientPriceText = document.getElementById('clientPrice').textContent;
    
    if (costPriceText !== '0 ₽') {
        if (yPos > 240) {
            pdf.addPage();
            yPos = 20;
        }
        
        // Извлекаем числа из текста
        const costPrice = parseFloat(costPriceText.replace(/[^\d.]/g, ''));
        const clientPrice = parseFloat(clientPriceText.replace(/[^\d.]/g, ''));
        
        pdf.setFontSize(14);
        pdf.setTextColor(37, 99, 235);
        pdf.text('COST BREAKDOWN', 20, yPos);
        yPos += 10;
        
        // Основные цены
        pdf.setFontSize(12);
        pdf.setTextColor(0, 0, 0);
        pdf.setFont('helvetica', 'bold');
        pdf.text(`Cost Price: ${costPrice.toFixed(2)} RUB`, 25, yPos);
        yPos += 8;
        pdf.text(`Client Price: ${clientPrice.toFixed(2)} RUB`, 25, yPos);
        yPos += 12;
        
        pdf.setFont('helvetica', 'normal');
        
        // Детализация - вручную создаем данные на английском
        const materialCost = cuttingResult.material.price * cuttingResult.totalSheets;
        
        let totalCutLength = 0;
        cuttingResult.sheets.forEach(sheet => {
            sheet.details.forEach(detail => {
                totalCutLength += 2 * (detail.length + detail.width);
            });
        });
        
        const cutSpeed = parseFloat(document.getElementById('cutSpeed').value);
        const cuttingTime = totalCutLength / cutSpeed;
        const cuttingCost = cuttingTime * 50;
        const edgeCost = totalCutLength * 0.5;
        const laborCost = cuttingResult.totalSheets * 2000;
        const wasteCost = ((totalSheetArea - totalArea) / sheetArea) * cuttingResult.material.price;
        const markup = (costPrice - wasteCost) * 0.3;
        
        const costTableData = [
            [`Material (${cuttingResult.totalSheets} sheets)`, `${materialCost.toFixed(2)} RUB`],
            [`Cutting (${cuttingTime.toFixed(1)} min)`, `${cuttingCost.toFixed(2)} RUB`],
            [`Edge (${(totalCutLength / 1000).toFixed(2)} m)`, `${edgeCost.toFixed(2)} RUB`],
            [`Labor`, `${laborCost.toFixed(2)} RUB`],
            [`Waste (${((totalSheetArea - totalArea) / 1000000).toFixed(2)} sq.m)`, `${wasteCost.toFixed(2)} RUB`],
            [`Markup (30%)`, `${markup.toFixed(2)} RUB`]
        ];
        
        pdf.autoTable({
            startY: yPos,
            head: [['Item', 'Cost']],
            body: costTableData,
            theme: 'grid',
            headStyles: { 
                fillColor: [37, 99, 235], 
                fontSize: 10,
                fontStyle: 'bold'
            },
            bodyStyles: { fontSize: 10 },
            columnStyles: {
                0: { cellWidth: 120 },
                1: { halign: 'right', cellWidth: 50, fontStyle: 'bold' }
            },
            margin: { left: 20, right: 20 }
        });
        
        yPos = pdf.lastAutoTable.finalY + 10;
    }
    
    // Метрики проекта
    if (yPos > 220) {
        pdf.addPage();
        yPos = 20;
    }
    
    pdf.setFontSize(14);
    pdf.setTextColor(37, 99, 235);
    pdf.text('PROJECT METRICS', 20, yPos);
    yPos += 10;
    
    const totalCutLength = cuttingResult.sheets.reduce((sum, s) => {
        return sum + s.details.reduce((dSum, d) => dSum + 2 * (d.length + d.width), 0);
    }, 0);
    
    const metricsData = [
        ['Total parts', details.reduce((sum, d) => sum + d.qty, 0).toString()],
        ['Sheets used', cuttingResult.totalSheets.toString()],
        ['Efficiency', efficiency + '%'],
        ['Total cut length', (totalCutLength / 1000).toFixed(2) + ' m']
    ];
    
    pdf.autoTable({
        startY: yPos,
        body: metricsData,
        theme: 'plain',
        bodyStyles: { fontSize: 11 },
        columnStyles: {
            0: { cellWidth: 80, fontStyle: 'bold' },
            1: { cellWidth: 90, halign: 'right', textColor: [37, 99, 235], fontStyle: 'bold' }
        },
        margin: { left: 20 }
    });
    
    yPos = pdf.lastAutoTable.finalY + 15;
    
    // Визуализация
    pdf.addPage();
    yPos = 20;
    pdf.setFontSize(16);
    pdf.setTextColor(37, 99, 235);
    pdf.text('CUTTING VISUALIZATION', 105, yPos, { align: 'center' });
    yPos += 10;
    
    const canvasElement = document.getElementById('cuttingCanvas');
    
    cuttingResult.sheets.forEach((sheet, idx) => {
        if (idx > 0) {
            pdf.addPage();
            yPos = 20;
        }
        
        pdf.setFontSize(12);
        pdf.setTextColor(0, 0, 0);
        pdf.setFont('helvetica', 'bold');
        pdf.text(`Sheet ${idx + 1} of ${cuttingResult.totalSheets}`, 20, yPos);
        
        const sheetEfficiency = ((sheet.usedArea / (sheet.material.length * sheet.material.width)) * 100).toFixed(1);
        pdf.setFont('helvetica', 'normal');
        pdf.text(`Parts: ${sheet.details.length} | Efficiency: ${sheetEfficiency}%`, 20, yPos + 6);
        yPos += 12;
        
        drawSheet(idx);
        
        const imgData = canvasElement.toDataURL('image/png');
        const imgWidth = 170;
        const imgHeight = (canvasElement.height * imgWidth) / canvasElement.width;
        
        if (yPos + imgHeight > 270) {
            pdf.addPage();
            yPos = 20;
        }
        
        pdf.addImage(imgData, 'PNG', 20, yPos, imgWidth, imgHeight);
        yPos += imgHeight + 10;
    });
    
    // Футер на каждой странице
    const pageCount = pdf.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setFontSize(9);
        pdf.setTextColor(128, 128, 128);
        pdf.text(`Page ${i} of ${pageCount}`, 105, 287, { align: 'center' });
        pdf.text(`Generated: ${new Date().toLocaleDateString('en-US')}`, 190, 287, { align: 'right' });
    }
    
    const date = new Date().toISOString().split('T')[0];
    pdf.save(`cutting_report_${date}.pdf`);
    
    alert('PDF отчет успешно создан!');
}

// Перевод названий материалов
function translateMaterialName(name) {
    const translations = {
        'Акрил стандартный': 'Acrylic Standard',
        'Акрил премиум': 'Acrylic Premium',
        'Кварц стандартный': 'Quartz Standard',
        'Кварц премиум': 'Quartz Premium',
        'Акрил тонкий 6мм': 'Acrylic Thin 6mm'
    };
    return translations[name] || name;
}

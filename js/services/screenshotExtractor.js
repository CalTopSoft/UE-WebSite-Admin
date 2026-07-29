// js/services/screenshotExtractor.js
// OCR local con Tesseract.js para capturas de Free Fire
// RESOLUCIÓN BASE 2400x1080 - Nombres ajustados 25px a la izquierda

const ScreenshotExtractor = (() => {
  const BASE_WIDTH  = 2400;
  const BASE_HEIGHT = 1080;
  
  // COORDENADAS ESCALADAS - NOMBRES DESPLAZADOS A LA IZQUIERDA (-25px en X)
  const REGIONS = {
    mapName: {
      x: 196, y: 61, w: 330, h: 77,
      type: 'text', hint: 'map'
    },
    position: {
      x: 951, y: 120, w: 240, h: 115,
      type: 'number', hint: 'position'
    },
    totalTeams: {
      x: 1227, y: 131, w: 240, h: 115,
      type: 'number', hint: 'total'
    },
    
    // ==========================================================
    // JUGADOR 1 - Nombre movido 25px a la izquierda (X: 425)
    // ==========================================================
    player1_name:    { x: 425, y: 446, w: 270, h: 89, type: 'name' },
    player1_kills:   { x: 765, y: 477, w: 140, h: 77, type: 'number' },
    player1_assists: { x: 918, y: 472, w: 97,  h: 80, type: 'number' },
    player1_revives: { x: 1215, y: 477, w: 119, h: 68, type: 'number' },
    player1_damage:  { x: 1036, y: 475, w: 140, h: 75, type: 'number' },
    player1_time:    { x: 1419, y: 479, w: 115, h: 77, type: 'time' },
    
    // ==========================================================
    // JUGADOR 2 - Nombre movido 25px a la izquierda (X: 425)
    // ==========================================================
    player2_name:    { x: 425, y: 546, w: 270, h: 89, type: 'name' },
    player2_kills:   { x: 766, y: 566, w: 136, h: 78, type: 'number' },
    player2_assists: { x: 918, y: 571, w: 105, h: 75, type: 'number' },
    player2_revives: { x: 1210, y: 575, w: 119, h: 63, type: 'number' },
    player2_damage:  { x: 1036, y: 569, w: 135, h: 86, type: 'number' },
    player2_time:    { x: 1413, y: 578, w: 129, h: 69, type: 'time' },
    
    // ==========================================================
    // JUGADOR 3 - Nombre movido 25px a la izquierda (X: 425)
    // ==========================================================
    player3_name:    { x: 425, y: 646, w: 270, h: 89, type: 'name' },
    player3_kills:   { x: 757, y: 651, w: 142, h: 83, type: 'number' },
    player3_assists: { x: 918, y: 663, w: 106, h: 71, type: 'number' },
    player3_revives: { x: 1206, y: 658, w: 124, h: 75, type: 'number' },
    player3_damage:  { x: 1038, y: 661, w: 132, h: 75, type: 'number' },
    player3_time:    { x: 1411, y: 658, w: 130, h: 77, type: 'time' },
    
    // ==========================================================
    // JUGADOR 4 - Nombre movido 25px a la izquierda (X: 425)
    // ==========================================================
    player4_name:    { x: 425, y: 746, w: 270, h: 89, type: 'name' },
    player4_kills:   { x: 756, y: 748, w: 147, h: 75, type: 'number' },
    player4_assists: { x: 913, y: 751, w: 112, h: 75, type: 'number' },
    player4_revives: { x: 1216, y: 754, w: 123, h: 75, type: 'number' },
    player4_damage:  { x: 1033, y: 749, w: 141, h: 74, type: 'number' },
    player4_time:    { x: 1416, y: 757, w: 127, h: 68, type: 'time' },
  };

  const DEBUG_COLORS = {
    map: '#00FFFF',
    position: '#FF0000',
    totalTeams: '#00FF00',
    name: '#0000FF',
    number: '#FFFF00',
    time: '#FF00FF'
  };

  let _worker = null;
  let _isProcessing = false;

  function createCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  function showDebugRegions(img, scaleX, scaleY) {
    const canvas = createCanvas(img.naturalWidth, img.naturalHeight);
    const ctx = canvas.getContext('2d');
    
    ctx.drawImage(img, 0, 0);
    ctx.lineWidth = 3;
    ctx.font = 'bold 14px Arial';
    
    for (const [key, region] of Object.entries(REGIONS)) {
      const sx = Math.round(region.x * scaleX);
      const sy = Math.round(region.y * scaleY);
      const sw = Math.round(region.w * scaleX);
      const sh = Math.round(region.h * scaleY);
      
      const color = DEBUG_COLORS[region.type] || '#FFFFFF';
      
      ctx.strokeStyle = color;
      ctx.strokeRect(sx, sy, sw, sh);
      
      ctx.fillStyle = color;
      const label = key.replace('player', 'P').replace('_', ' ');
      const textWidth = ctx.measureText(label).width;
      ctx.fillRect(sx, sy - 25, textWidth + 10, 25);
      
      ctx.fillStyle = '#000000';
      ctx.fillText(label, sx + 5, sy - 8);
    }
    
    const existingDebug = document.getElementById('debug-overlay');
    if (existingDebug) existingDebug.remove();
    
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay show';
    overlay.id = 'debug-overlay';
    overlay.innerHTML = `
      <div class="modal modal-xl" style="max-width:1200px">
        <div class="modal-header">
          <span class="modal-title">🔍 Debug - Regiones de Extracción</span>
          <button class="modal-close" onclick="document.getElementById('debug-overlay').remove()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="modal-body">
          <div style="margin-bottom:1rem;padding:1rem;background:var(--bg-secondary);border-radius:var(--radius);font-size:0.85rem">
            <strong style="color:var(--text-primary)">Leyenda de colores:</strong><br><br>
            <span style="display:inline-flex;align-items:center;gap:0.5rem;margin-right:1rem">
              <span style="width:20px;height:20px;background:#00FFFF;border:2px solid #000"></span><span>Mapa</span>
            </span>
            <span style="display:inline-flex;align-items:center;gap:0.5rem;margin-right:1rem">
              <span style="width:20px;height:20px;background:#FF0000;border:2px solid #000"></span><span>Posición</span>
            </span>
            <span style="display:inline-flex;align-items:center;gap:0.5rem;margin-right:1rem">
              <span style="width:20px;height:20px;background:#00FF00;border:2px solid #000"></span><span>Total equipos</span>
            </span>
            <span style="display:inline-flex;align-items:center;gap:0.5rem;margin-right:1rem">
              <span style="width:20px;height:20px;background:#0000FF;border:2px solid #000"></span><span>Nombres</span>
            </span>
            <span style="display:inline-flex;align-items:center;gap:0.5rem;margin-right:1rem">
              <span style="width:20px;height:20px;background:#FFFF00;border:2px solid #000"></span><span>Números</span>
            </span>
            <span style="display:inline-flex;align-items:center;gap:0.5rem">
              <span style="width:20px;height:20px;background:#FF00FF;border:2px solid #000"></span><span>Tiempo</span>
            </span>
          </div>
          <div style="overflow:auto;max-height:70vh">
            <img src="${canvas.toDataURL()}" style="width:100%;border-radius:var(--radius);border:2px solid var(--border)" />
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.remove();
    });
  }

  function showLoadingModal(message = 'Procesando captura...') {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay show';
    overlay.id = 'loading-overlay';
    overlay.style.pointerEvents = 'all';
    overlay.innerHTML = `
      <div class="modal" style="max-width:400px">
        <div class="modal-body" style="text-align:center;padding:3rem">
          <div style="width:64px;height:64px;border:4px solid var(--border);border-top-color:var(--primary);border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 1.5rem"></div>
          <div style="font-family:var(--font-display);font-size:1.25rem;font-weight:700;color:var(--text-primary);margin-bottom:0.5rem">${message}</div>
          <div style="font-size:0.85rem;color:var(--text-muted)">Esto puede tomar unos segundos...</div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  function hideLoadingModal() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.remove();
  }

  // ==========================================================
  // PROCESAMIENTO DE IMAGEN OPTIMIZADO
  // ==========================================================
  
  function cropAndProcess(img, region, scaleX, scaleY) {
    const UPSCALE = 3;
    const sx = Math.round(region.x * scaleX);
    const sy = Math.round(region.y * scaleY);
    const sw = Math.round(region.w * scaleX);
    const sh = Math.round(region.h * scaleY);
    const dw = sw * UPSCALE;
    const dh = sh * UPSCALE;
    const canvas = createCanvas(dw, dh);
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, dw, dh);
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh);
    
    const imageData = ctx.getImageData(0, 0, dw, dh);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      let gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      let contrastGray = (gray - 128) * 1.2 + 128;
      contrastGray = Math.min(255, Math.max(0, contrastGray));
      const binary = contrastGray > 130 ? 255 : 0;
      data[i] = data[i + 1] = data[i + 2] = binary;
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas;
  }

  function cropAndProcessInverted(img, region, scaleX, scaleY) {
    const UPSCALE = 3;
    const sx = Math.round(region.x * scaleX);
    const sy = Math.round(region.y * scaleY);
    const sw = Math.round(region.w * scaleX);
    const sh = Math.round(region.h * scaleY);
    const dw = sw * UPSCALE;
    const dh = sh * UPSCALE;
    const canvas = createCanvas(dw, dh);
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, dw, dh);
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh);
    
    const imageData = ctx.getImageData(0, 0, dw, dh);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      let gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      let contrastGray = (gray - 128) * 1.2 + 128;
      contrastGray = Math.min(255, Math.max(0, contrastGray));
      const binary = contrastGray > 110 ? 0 : 255;
      data[i] = data[i + 1] = data[i + 2] = binary;
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas;
  }

  function cleanNumber(raw) {
    if (!raw) return '';
    let s = raw
      .replace(/[^0-9OoIilSs]/g, '')
      .replace(/[Oo]/g, '0')
      .replace(/[Iil]/g, '1')
      .replace(/[S]/g, '5');
    const n = parseInt(s, 10);
    if (isNaN(n)) return '';
    return String(n);
  }

  function cleanName(raw) {
    if (!raw) return '';
    return raw
      .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ _.\-'#!@$%^&*()\[\]{}+=|<>?/\\]/g, '')
      .trim()
      .replace(/\s{2,}/g, ' ');
  }

  function cleanTime(raw) {
    if (!raw) return '';
    let s = raw.replace(/[^0-9'":]/g, '');
    s = s.replace(/[Iil]/g, '1').replace(/[Oo]/g, '0');
    
    let match = s.match(/(\d{1,2})['"`](\d{2})/);
    if (match) {
      const mm = match[1].padStart(2, '0');
      const ss = match[2].padStart(2, '0');
      return `${mm}:${ss}`;
    }
    
    match = s.match(/(\d{1,2}):(\d{2})/);
    if (match) {
      const mm = match[1].padStart(2, '0');
      const ss = match[2].padStart(2, '0');
      return `${mm}:${ss}`;
    }
    
    const digits = s.replace(/\D/g, '');
    if (digits.length >= 3 && digits.length <= 4) {
      let mm = digits.slice(0, -2);
      let ss = digits.slice(-2);
      mm = mm.padStart(2, '0');
      ss = ss.padStart(2, '0');
      return `${mm}:${ss}`;
    }
    
    return '';
  }

  function cleanPosition(raw) {
    if (!raw) return '';
    const m = raw.match(/#?\s*(\d{1,2})\s*[/\\]/);
    if (m) return m[1];
    const m2 = raw.match(/#?\s*(\d{1,2})/);
    if (m2) return m2[1];
    return cleanNumber(raw);
  }

  function cleanTotal(raw) {
    if (!raw) return '12';
    const m = raw.match(/[/\\]\s*(\d{1,2})/);
    if (m) return m[1];
    return cleanNumber(raw) || '12';
  }

  async function getWorker() {
    if (_worker) return _worker;
    if (typeof Tesseract === 'undefined') {
      throw new Error('Tesseract.js no está cargado');
    }
    _worker = await Tesseract.createWorker('eng', 1, {
      logger: () => {},
    });
    await _worker.setParameters({
      tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#!_.-\':/ ',
      preserve_interword_spaces: '0',
    });
    return _worker;
  }

  async function ocrCanvas(canvas) {
    const worker = await getWorker();
    const { data: { text } } = await worker.recognize(canvas);
    return text.trim();
  }

  async function ocrCanvasNumbers(canvas) {
    const worker = await getWorker();
    await worker.setParameters({
      tessedit_char_whitelist: '0123456789OoIilSs#/: ',
    });
    const { data: { text } } = await worker.recognize(canvas);
    await worker.setParameters({
      tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#!_.-\':/ ',
    });
    return text.trim();
  }

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo cargar la imagen')); };
      img.src = url;
    });
  }

  async function extractScrimData(imageFile) {
    if (_isProcessing) {
      throw new Error('Ya hay un proceso en curso');
    }
    _isProcessing = true;

    try {
      showLoadingModal('Analizando captura...');
      
      const img = await loadImage(imageFile);
      const scaleX = img.naturalWidth / BASE_WIDTH;
      const scaleY = img.naturalHeight / BASE_HEIGHT;
      
      const result = {
        position: 4,
        totalTeams: 12,
        players: [],
      };

      try {
        const posCanvas = cropAndProcessInverted(img, REGIONS.position, scaleX, scaleY);
        const posRaw = await ocrCanvasNumbers(posCanvas);
        const pos = parseInt(cleanPosition(posRaw), 10);
        if (!isNaN(pos) && pos >= 1 && pos <= 20) result.position = pos;
      } catch (e) {
        console.warn('Error extrayendo posición:', e);
      }

      try {
        const totCanvas = cropAndProcessInverted(img, REGIONS.totalTeams, scaleX, scaleY);
        const totRaw = await ocrCanvasNumbers(totCanvas);
        const tot = parseInt(cleanTotal(totRaw), 10);
        if (!isNaN(tot) && tot >= 2 && tot <= 20) result.totalTeams = tot;
      } catch (e) {
        console.warn('Error extrayendo total:', e);
      }

      for (let i = 1; i <= 4; i++) {
        const prefix = `player${i}_`;
        const player = {
          gameName: '',
          kills: 0,
          assists: 0,
          damage: 0,
          revives: 0,
          survivalTime: '00:00',
        };

        try {
          const nameCanvas = cropAndProcess(img, REGIONS[prefix + 'name'], scaleX, scaleY);
          const nameRaw = await ocrCanvas(nameCanvas);
          player.gameName = cleanName(nameRaw);
        } catch (e) {
          console.warn(`Error extrayendo nombre jugador ${i}:`, e);
        }

        for (const field of ['kills', 'assists', 'damage', 'revives']) {
          try {
            const canvas = cropAndProcess(img, REGIONS[prefix + field], scaleX, scaleY);
            const raw = await ocrCanvasNumbers(canvas);
            const clean = cleanNumber(raw);
            let val = parseInt(clean, 10);
            if (!isNaN(val)) {
              if (field === 'kills' && val > 40) val = NaN;
              if (field === 'assists' && val > 40) val = NaN;
              if (field === 'damage' && val > 15000) val = NaN;
              if (field === 'revives' && val > 20) val = NaN;
              if (!isNaN(val)) player[field] = val;
            }
          } catch (e) {
            console.warn(`Error extrayendo ${field} jugador ${i}:`, e);
          }
        }

        try {
          const timeCanvas = cropAndProcessInverted(img, REGIONS[prefix + 'time'], scaleX, scaleY);
          const timeRaw = await ocrCanvasNumbers(timeCanvas);
          const timeCleaned = cleanTime(timeRaw);
          if (timeCleaned) {
            player.survivalTime = timeCleaned;
          }
        } catch (e) {
          console.warn(`Error extrayendo tiempo jugador ${i}:`, e);
        }

        result.players.push(player);
      }

      result.players = result.players.filter(p => p.gameName.length > 0);
      return result;
    } finally {
      _isProcessing = false;
      hideLoadingModal();
    }
  }

  function fillForm(data) {
    const posEl = document.getElementById('me-pos');
    const totalEl = document.getElementById('me-total');
    if (posEl && data.position) posEl.value = data.position;
    if (totalEl && data.totalTeams) totalEl.value = data.totalTeams;

    data.players.forEach((p, i) => {
      const nameEl = document.getElementById(`me-name-${i}`);
      const killsEl = document.getElementById(`me-k-${i}`);
      const assistsEl = document.getElementById(`me-a-${i}`);
      const damageEl = document.getElementById(`me-d-${i}`);
      const revivesEl = document.getElementById(`me-r-${i}`);
      const timeEl = document.getElementById(`me-t-${i}`);
      
      if (nameEl && p.gameName) nameEl.value = p.gameName;
      if (killsEl && p.kills != null) killsEl.value = p.kills;
      if (assistsEl && p.assists != null) assistsEl.value = p.assists;
      if (damageEl && p.damage != null) damageEl.value = p.damage;
      if (revivesEl && p.revives != null) revivesEl.value = p.revives;
      if (timeEl && p.survivalTime) timeEl.value = p.survivalTime;
    });
  }

  async function process(imageFile) {
    const data = await extractScrimData(imageFile);
    fillForm(data);
    return data;
  }

  async function debug(imageFile) {
    const img = await loadImage(imageFile);
    const scaleX = img.naturalWidth / BASE_WIDTH;
    const scaleY = img.naturalHeight / BASE_HEIGHT;
    showDebugRegions(img, scaleX, scaleY);
  }

  return { extractScrimData, fillForm, process, debug };
})();
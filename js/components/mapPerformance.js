// js/components/mapPerformance.js
// Componente único de "Rendimiento por mapa".

const MapPerformance = (() => {
  const MAPS = ['BERMUDA', 'PURGATORIO', 'KALAHARI', 'NEXTERRA'];

  const MAP_META = {
    BERMUDA:    { color: '#10b981', art: 'mp-art-BERMUDA' },
    PURGATORIO: { color: '#ef4444', art: 'mp-art-PURGATORIO' },
    KALAHARI:   { color: '#f59e0b', art: 'mp-art-KALAHARI' },
    NEXTERRA:   { color: '#3b82f6', art: 'mp-art-NEXTERRA' },
  };

  const MAP_ICON = {
    BERMUDA:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
    PURGATORIO:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>`,
    KALAHARI:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/></svg>`,
    NEXTERRA:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
  };

  const _overviewCache = new Map();
  const _playerCache = new Map();

  // ============================================================
  // CONFIGURACIÓN CENTRALIZADA DE SQUADS (colores y fondos)
  // Ahora usa ROSTER_CONFIG si está disponible
  // ============================================================
  function getSquadConfig(squadId) {
    // Intentar obtener desde ROSTER_CONFIG
    if (typeof ROSTER_CONFIG !== 'undefined') {
      const roster = ROSTER_CONFIG.get(squadId);
      if (roster) {
        return {
          color: roster.color || '#10b981',
          bgImage: getSquadBgImage(squadId)
        };
      }
    }

    // Fallback: configuración por defecto
    const defaultConfigs = {
      'OFICIAL': { color: '#10b981', bgImage: 'player-bg.png' },
      'TIER':    { color: '#3b82f6', bgImage: 'player-bg-tier.png' },
      'GIRLS':   { color: '#ec4899', bgImage: 'player-bg-girls.png' },
      'GOLD':    { color: '#f59e0b', bgImage: 'player-bg-gold.png' }
    };

    return defaultConfigs[squadId] || defaultConfigs['OFICIAL'];
  }

  function getSquadBgImage(squadId) {
    // Mapeo de squad a imagen de fondo
    const bgMap = {
      'OFICIAL': 'player-bg.png',
      'TIER': 'player-bg-tier.png',
      'GIRLS': 'player-bg-girls.png',
      'GOLD': 'player-bg-gold.png'
    };
    return bgMap[squadId] || 'player-bg.png';
  }

  function esc(str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function fmtDate(d) {
    return new Date(d).toLocaleDateString('es', { day: '2-digit', month: 'short' });
  }

  function fmtDateLong(d) {
    return new Date(d).toLocaleDateString('es', { day: '2-digit', month: 'long', year: 'numeric' });
  }

  function groupBreakdownByScrim(breakdown) {
    const grouped = new Map();
    for (const item of breakdown) {
      const key = item.scrimId;
      if (!grouped.has(key)) {
        grouped.set(key, {
          scrimId: item.scrimId,
          dateUtc: item.dateUtc,
          opponent: item.opponent,
          maps: [],
          totalKills: 0,
          totalDamage: 0,
          performances: [],
        });
      }
      const group = grouped.get(key);
      group.maps.push(item);
      group.totalKills += item.kills;
      group.totalDamage += item.damage;
      group.performances.push(item.performanceScore);
    }
    return Array.from(grouped.values());
  }

  // ============================================================
  // 1. OVERVIEW
  // ============================================================
  async function mountOverview(container, squad, opts = {}) {
    const topN = opts.topN || 3;
    const defaultAvatar = opts.defaultAvatar || null;
    container.innerHTML = `<div class="mp-loading-block">Cargando rendimiento por mapa...</div>`;
  
    try {
      const cacheKey = squad || 'ALL';
      let data = _overviewCache.get(cacheKey);
      if (!data) {
        const res = await API.aGet(`/admin/scrims/map-overview${squad ? `?squad=${squad}` : ''}`);
        data = res.data;
        _overviewCache.set(cacheKey, data);
      }
      
      // OBTENER SOLO LOS JUGADORES DEL SQUAD ACTIVO
      let playersCache = null;
      try {
        const playersRes = await API.aGet(`/admin/players?squad=${squad}`);
        playersCache = playersRes.data;
      } catch (e) {
        console.warn('No se pudieron cargar los jugadores:', e);
      }
      
      // 🔥 FILTRAR: Solo incluir jugadores del squad activo
      if (playersCache && playersCache.length > 0) {
        const squadPlayerIds = new Set(playersCache.map(p => p.id));
        data = data.map(entry => ({
          ...entry,
          topPlayers: (entry.topPlayers || []).filter(p => squadPlayerIds.has(p.playerId))
        }));
      }
      
      renderOverview(container, data, topN, defaultAvatar, playersCache);
    } catch (e) {
      container.innerHTML = `<div class="empty-state"><p style="color:var(--danger)">${esc(e.message)}</p></div>`;
    }
  }

  function renderOverview(container, entries, topN, defaultAvatar = null, playersCache = null) {
    if (!Array.isArray(entries)) entries = [];
    const byMap = new Map(entries.map(e => [e.mapName, e]));
  
    container.innerHTML = `
      <div class="mp-overview-grid">
        ${MAPS.map(mapName => {
          const meta = MAP_META[mapName];
          const entry = byMap.get(mapName);
          const players = (entry?.topPlayers || [])
            .slice()
            .sort((a, b) => b.avgPerformance - a.avgPerformance)
            .slice(0, topN);
          const totalGames = players.reduce((s, p) => s + (p.gamesPlayed || 0), 0);
  
          return `
          <div class="mp-map-card" style="--mp-accent:${meta.color}">
            <div class="mp-map-banner ${meta.art}">
              <div class="mp-map-label">
                <span class="mp-map-name">${mapName}</span>
                <span class="mp-map-count">${MAP_ICON[mapName]} ${totalGames} partidas</span>
              </div>
            </div>
            <div class="mp-rank-list">
              ${players.length === 0
                ? `<div class="mp-empty-row">Sin datos registrados</div>`
                : players.map((p, i) => {
                    // BUSCAR LA FOTO DEL JUGADOR EN EL CACHE
                    let playerPhoto = null;
                    if (playersCache && playersCache.length > 0) {
                      const foundPlayer = playersCache.find(fp => fp.id === p.playerId);
                      if (foundPlayer) {
                        playerPhoto = foundPlayer.photo || null;
                      }
                    }
                    
                    // Si el jugador tiene foto, usarla; si no, usar defaultAvatar o inicial
                    const photoUrl = playerPhoto || defaultAvatar;
                    const showInitial = !playerPhoto && !defaultAvatar;
                    
                    return `
                    <div class="mp-rank-row" data-rank="${i + 1}">
                      <div class="mp-rank-pos">${i + 1}</div>
                      ${showInitial
                        ? `<div class="mp-rank-avatar-fallback">${esc((p.gameName || '?').charAt(0).toUpperCase())}</div>`
                        : `<img src="${photoUrl}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;flex-shrink:0;" onerror="this.style.display='none';this.parentElement.innerHTML+='<div class=\\'mp-rank-avatar-fallback\\'>${esc((p.gameName || '?').charAt(0).toUpperCase())}</div>'" />`
                      }
                      <div>
                        <div class="mp-rank-name">${esc(p.gameName || 'Desconocido')}</div>
                        <div class="mp-rank-games">${p.gamesPlayed || 0} partida${p.gamesPlayed === 1 ? '' : 's'}</div>
                      </div>
                      <div class="mp-rank-score">${p.avgPerformance || 0}%</div>
                    </div>`;
                  }).join('')
              }
            </div>
          </div>`;
        }).join('')}
      </div>
    `;
  }

  // ============================================================
  // 2. PLAYER DRILLDOWN
  // ============================================================
  async function mountPlayerDetail(container, playerId, opts = {}) {
    container.innerHTML = `<div class="mp-loading-block">Cargando rendimiento del jugador...</div>`;

    try {
      let data = _playerCache.get(playerId);
      if (!data) {
        const res = await API.aGet(`/admin/scrims/players/${playerId}/map-performance`);
        data = res.data;
        _playerCache.set(playerId, data);
      }
      renderPlayerDetail(container, data, opts);
    } catch (e) {
      container.innerHTML = `<div class="empty-state"><p style="color:var(--danger)">${esc(e.message)}</p></div>`;
    }
  }

  function renderPlayerDetail(container, data, opts = {}) {
    const { player, mapStats, scrimBreakdown } = data || {};
    const photo = opts.photo || null;
    const statsByMap = new Map((mapStats || []).map(s => [s.mapName, s]));

    // Obtener configuración del squad usando la función centralizada
    const squadConfig = player?.squad ? getSquadConfig(player.squad) : getSquadConfig('OFICIAL');

    // Actualizar título del modal con el equipo
    const titleEl = document.getElementById('mp-modal-title');
    if (titleEl && player?.squad) {
      const color = squadConfig.color;
      titleEl.innerHTML = `Rendimiento por Mapa — Equipo: <span style="color:${color}">UZX ${esc(player.squad)}</span>`;
    }

    const bgImage = squadConfig.bgImage;

    const headerHTML = opts.hideHeader ? '' : `
      <div class="mp-player-hero">
        <div class="mp-player-hero-left" style="background-image: url('../assets/${bgImage}')">
          <div class="mp-player-hero-photo">
            ${photo
              ? `<img src="${photo}" alt="${esc(player?.gameName || '')}" />`
              : `<div class="mp-player-hero-avatar">${esc((player?.gameName || '?').charAt(0).toUpperCase())}</div>`
            }
          </div>
          <div class="mp-player-hero-name">${esc(player?.gameName || 'Desconocido')}</div>
          ${player?.role ? `<div class="mp-player-hero-role">${esc(player.role)}</div>` : ''}
        </div>
        
        <div class="mp-player-hero-right">
          <div class="mp-stat-cards">
            ${MAPS.map(mapName => {
              const meta = MAP_META[mapName];
              const s = statsByMap.get(mapName);
              if (!s) {
                return `
                <div class="mp-stat-card ${meta.art}" style="--mp-accent:${meta.color}">
                  <div class="mp-stat-card-body">
                    <div class="mp-stat-card-map">${mapName}</div>
                    <div style="font-size:0.68rem;color:rgba(255,255,255,0.7);position:relative;z-index:1">Sin datos</div>
                  </div>
                </div>`;
              }
              return `
              <div class="mp-stat-card ${meta.art}" style="--mp-accent:${meta.color}">
                <span class="mp-stat-card-range">${s.worstPerformance || 0}–${s.bestPerformance || 0}%</span>
                <div class="mp-stat-card-body">
                  <div class="mp-stat-card-map">${mapName}</div>
                  <div class="mp-stat-card-grid">
                    <div class="mp-stat-card-metric">
                      <div class="mp-stat-card-val">${s.avgPerformance || 0}%</div>
                      <div class="mp-stat-card-lbl">Rendim.</div>
                    </div>
                    <div class="mp-stat-card-metric">
                      <div class="mp-stat-card-val">${s.totalKills || 0}</div>
                      <div class="mp-stat-card-lbl">Kills</div>
                    </div>
                    <div class="mp-stat-card-metric">
                      <div class="mp-stat-card-val">${s.gamesPlayed || 0}</div>
                      <div class="mp-stat-card-lbl">Mapas</div>
                    </div>
                  </div>
                </div>
              </div>`;
            }).join('')}
          </div>
        </div>
      </div>
    `;

    const breakdownHTML = renderCollapsibleBreakdown(scrimBreakdown || []);
    container.innerHTML = headerHTML + breakdownHTML;
  }

  // ============================================================
  // 3. COLAPSABLE DEL HISTORIAL
  // ============================================================
  function renderCollapsibleBreakdown(breakdown) {
    if (!breakdown || breakdown.length === 0) {
      return `
        <div class="mp-breakdown-wrap">
          <div class="mp-breakdown-head">Historial por scrim</div>
          <div class="mp-empty-row">Este jugador todavia no tiene scrims registradas</div>
        </div>`;
    }

    const grouped = groupBreakdownByScrim(breakdown);
    grouped.sort((a, b) => new Date(b.dateUtc) - new Date(a.dateUtc));

    const scrimsHTML = grouped.map((scrim, index) => {
      const avgPerf = scrim.performances.length > 0
        ? Math.round(scrim.performances.reduce((a, b) => a + b, 0) / scrim.performances.length)
        : 0;
      
      const perfClass = avgPerf >= 65 ? 'hi' : avgPerf >= 40 ? 'md' : 'lo';
      const scrimId = `scrim-group-${index}`;

      const sortedMaps = MAPS.map(mapName => 
        scrim.maps.find(m => m.mapName === mapName)
      ).filter(Boolean);

      return `
        <div class="mp-scrim-accordion">
          <div class="mp-scrim-accordion-header" onclick="document.getElementById('${scrimId}').classList.toggle('open'); this.querySelector('.mp-accordion-arrow').classList.toggle('rotated')">
            <div class="mp-scrim-accordion-left">
              <div class="mp-scrim-accordion-date">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                <span>${fmtDateLong(scrim.dateUtc)}</span>
              </div>
              <div class="mp-scrim-accordion-maps-count">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>
                ${sortedMaps.length} mapa${sortedMaps.length !== 1 ? 's' : ''}
              </div>
              ${scrim.opponent ? `<div class="mp-scrim-accordion-opponent">vs ${esc(scrim.opponent)}</div>` : ''}
            </div>
            <div class="mp-scrim-accordion-right">
              <div class="mp-scrim-accordion-stats">
                <div class="mp-scrim-accordion-stat">
                  <span class="mp-scrim-accordion-stat-val">${scrim.totalKills}</span>
                  <span class="mp-scrim-accordion-stat-lbl">Kills</span>
                </div>
                <div class="mp-scrim-accordion-stat">
                  <span class="mp-scrim-accordion-stat-val">${(scrim.totalDamage / 1000).toFixed(1)}K</span>
                  <span class="mp-scrim-accordion-stat-lbl">Daño</span>
                </div>
                <div class="mp-scrim-accordion-stat">
                  <span class="perf-pill ${perfClass}">${avgPerf}%</span>
                  <span class="mp-scrim-accordion-stat-lbl">Rend.</span>
                </div>
              </div>
              <div class="mp-accordion-arrow">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><polyline points="6 9 12 15 18 9"/></svg>
              </div>
            </div>
          </div>
          
          <div class="mp-scrim-accordion-body" id="${scrimId}">
            <table class="mp-scrim-table">
              <thead>
                <tr>
                  <th>Mapa</th><th>Pos.</th><th>Kills</th><th>Asist.</th><th>Daño</th><th>Tiempo</th><th>Rend.</th>
                </tr>
              </thead>
              <tbody>
                ${sortedMaps.map(m => {
                  const meta = MAP_META[m.mapName] || { color: 'var(--text-muted)' };
                  const pfClass = (m.performanceScore || 0) >= 65 ? 'hi' : (m.performanceScore || 0) >= 40 ? 'md' : 'lo';
                  return `
                  <tr>
                    <td><span class="mp-scrim-map-badge" style="color:${meta.color}"><span class="dot" style="background:${meta.color}"></span>${m.mapName}</span></td>
                    <td style="color:var(--text-muted)">#${m.position || '-'}</td>
                    <td style="font-weight:700;color:var(--green)">${m.kills || 0}</td>
                    <td>${m.assists || 0}</td>
                    <td>${(m.damage || 0).toLocaleString()}</td>
                    <td style="color:var(--text-muted)">${m.survivalTime || '00:00'}</td>
                    <td><span class="perf-pill ${pfClass}">${m.performanceScore || 0}%</span></td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="mp-breakdown-wrap">
        <div class="mp-breakdown-head">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          Historial por scrim
          <span style="font-size:0.75rem;color:var(--text-muted);font-weight:400;margin-left:auto">${grouped.length} scrim${grouped.length !== 1 ? 's' : ''}</span>
        </div>
        ${scrimsHTML}
      </div>
    `;
  }

  // ============================================================
  // 4. MODAL
  // ============================================================
  function openPlayerModal(playerId, opts = {}) {
    const existing = document.getElementById('mp-player-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay show mp-modal-overlay';
    overlay.id = 'mp-player-overlay';
    overlay.innerHTML = `
      <div class="modal modal-xl">
        <div class="modal-header">
          <span class="modal-title" id="mp-modal-title">Rendimiento por Mapa</span>
          <button class="modal-close" id="mp-modal-close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="modal-body" id="mp-modal-body"></div>
      </div>
    `;
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    function close() {
      overlay.remove();
      document.body.style.overflow = '';
    }
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    overlay.querySelector('#mp-modal-close').addEventListener('click', close);
    document.addEventListener('keydown', function escHandler(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', escHandler); }
    });

    mountPlayerDetail(document.getElementById('mp-modal-body'), playerId, opts);
  }

  function invalidateCache() {
    _overviewCache.clear();
    _playerCache.clear();
  }

  return {
    mountOverview,
    mountPlayerDetail,
    openPlayerModal,
    invalidateCache,
    MAPS,
    MAP_META,
  };
})();
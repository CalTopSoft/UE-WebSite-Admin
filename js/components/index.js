// js/components/index.js

// Toast Notifications
const Toast = (() => {
  function show(message, type = 'success', duration = 4000) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${Icons[type === 'success' ? 'check' : type === 'error' ? 'error' : type === 'warning' ? 'warning' : 'info']}</span>
      <span class="toast-msg">${message}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }
  
  return {
    show,
    success: (msg) => show(msg, 'success'),
    error: (msg) => show(msg, 'error'),
    warning: (msg) => show(msg, 'warning'),
    info: (msg) => show(msg, 'info')
  };
})();

// ============================================================
// SIDEBAR COMPONENT - MODIFICADO PARA USAR ROSTER_CONFIG CENTRAL
// ============================================================
const Sidebar = (() => {
  const SQUAD_KEY = 'uzx_active_squad';
  let _statusCache = null;

  function getAvailableSquads() {
    if (typeof RosterPermissions === 'undefined') {
      console.warn('RosterPermissions no disponible, usando fallback');
      if (typeof ROSTER_CONFIG !== 'undefined') {
        return ROSTER_CONFIG.getAll();
      }
      return [
        { id: 'OFICIAL', label: 'UZX OFICIAL', logo: 'logo-oficial.png', activeClass: 'active-oficial' },
        { id: 'TIER', label: 'UZX TIER', logo: 'logo-tier.png', activeClass: 'active-tier' },
        { id: 'GIRLS', label: 'UZX GIRLS', logo: 'logo-girls.png', activeClass: 'active-girls' },
        { id: 'GOLD', label: 'UZX GOLD', logo: 'logo-gold.png', activeClass: 'active-gold' }
      ];
    }

    const accessibleRosters = RosterPermissions.getAccessibleRosters();
    
    if (accessibleRosters.length === 0 || RosterPermissions.isGlobalAdmin()) {
      return ROSTER_CONFIG.getAll();
    }

    return accessibleRosters;
  }

  function getActiveSquad() {
    const stored = localStorage.getItem(SQUAD_KEY);
    const available = getAvailableSquads();
    
    if (available.length > 0) {
      const exists = available.some(s => s.id === stored);
      if (exists && stored) {
        return stored;
      }
      return available[0].id;
    }
    
    return 'OFICIAL';
  }

  function setActiveSquad(id) {
    localStorage.setItem(SQUAD_KEY, id);
  }

  function canSeeBackups() {
    if (typeof RosterPermissions !== 'undefined') {
      return RosterPermissions.canSeeBackups();
    }
    return true;
  }

  function getCachedRosterStatus(rosterId) {
    if (_statusCache && _statusCache[rosterId] !== undefined) {
      return _statusCache[rosterId];
    }
    return null;
  }

  function getStatusBadge(isActive) {
    if (isActive === true) {
      return {
        label: 'Activo',
        class: 'status-badge-active',
        icon: '🟢'
      };
    } else if (isActive === false) {
      return {
        label: 'Inactivo',
        class: 'status-badge-inactive',
        icon: '🔴'
      };
    }
    return {
      label: '...',
      class: 'status-badge-unknown',
      icon: '⏳'
    };
  }

  // 🔥 Refrescar estados de rosters
  async function refreshRosterStatus() {
    if (typeof RosterStatus === 'undefined') return;
    try {
      const statusMap = await RosterStatus.fetchStatus();
      _statusCache = statusMap;
      const currentSquad = getActiveSquad();
      updateStatusIndicators(currentSquad);
    } catch (e) {
      console.warn('Error refreshing roster status:', e);
    }
  }

  // 🔥 Actualizar indicadores de estado sin re-renderizar
  function updateStatusIndicators(currentSquad) {
    const sidebarEl = document.getElementById('sidebar');
    if (!sidebarEl) return;

    // Actualizar el badge del roster actual (cuando solo hay 1)
    const currentRosterBadge = sidebarEl.querySelector('.sidebar-current-roster .squad-status-badge');
    if (currentRosterBadge) {
      const isActive = getCachedRosterStatus(currentSquad);
      const badge = getStatusBadge(isActive);
      currentRosterBadge.textContent = `${badge.icon} ${badge.label}`;
      currentRosterBadge.className = `squad-status-badge ${badge.class}`;
    }

    // Actualizar los botones de squad
    sidebarEl.querySelectorAll('.squad-btn').forEach(btn => {
      const squadId = btn.dataset.squad;
      const statusBadge = btn.querySelector('.squad-status-badge');
      if (statusBadge) {
        const isActive = getCachedRosterStatus(squadId);
        const badge = getStatusBadge(isActive);
        statusBadge.textContent = `${badge.icon} ${badge.label}`;
        statusBadge.className = `squad-status-badge ${badge.class}`;
      }
    });
  }

  // 🔥 Escuchar cambios en localStorage
  function listenForRosterChanges() {
    let lastUpdateCheck = 0;

    // Guardar timestamp inicial
    const lastUpdate = localStorage.getItem('uzx_roster_status_updated');
    lastUpdateCheck = lastUpdate ? parseInt(lastUpdate) : 0;

    // Escuchar evento storage (cuando otra pestaña cambia)
    window.addEventListener('storage', (e) => {
      if (e.key === 'uzx_roster_status_updated') {
        console.log('🔄 Roster status changed (storage event), refreshing...');
        refreshRosterStatus();
      }
    });

    // También verificar periódicamente (para cambios en la misma pestaña)
    setInterval(() => {
      const lastUpdate = localStorage.getItem('uzx_roster_status_updated');
      if (lastUpdate) {
        const timestamp = parseInt(lastUpdate);
        if (timestamp > lastUpdateCheck) {
          lastUpdateCheck = timestamp;
          console.log('🔄 Roster status changed (interval), refreshing...');
          refreshRosterStatus();
        }
      }
    }, 3000);
  }

  function render(activePage, onSquadChange) {
    const squad = getActiveSquad();
    const sidebarEl = document.getElementById('sidebar');
    if (!sidebarEl) return;

    const availableSquads = getAvailableSquads();
    
    let squadInfo = null;
    if (typeof ROSTER_CONFIG !== 'undefined') {
      squadInfo = ROSTER_CONFIG.get(squad);
    }
    if (!squadInfo) {
      squadInfo = availableSquads.find(s => s.id === squad) || availableSquads[0] || null;
    }
    
    if (!squadInfo) {
      squadInfo = { id: 'OFICIAL', label: 'UZX OFICIAL', logo: 'logo-oficial.png', activeClass: 'active-oficial' };
    }

    const logoPath = `assets/${squadInfo.logo}`;
    const canSeeBackupsOption = canSeeBackups();

    const isActive = getCachedRosterStatus(squad);
    const statusBadge = getStatusBadge(isActive);

    let sidebarHTML = `
      <div class="sidebar-header">
        <img src="${logoPath}" alt="UZX" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🎮</text></svg>'" />
        <div class="brand">UZX <span>ADMIN</span></div>
      </div>
    `;

    if (availableSquads.length > 1) {
      sidebarHTML += `
        <div class="sidebar-squad-selector">
          ${availableSquads.map(s => {
            const sIsActive = getCachedRosterStatus(s.id);
            const sBadge = getStatusBadge(sIsActive);
            const isActiveSquad = squad === s.id;
            const inactiveClass = sIsActive === false ? 'squad-inactive' : '';
            return `
              <button class="squad-btn ${isActiveSquad ? s.activeClass : ''} ${inactiveClass}" data-squad="${s.id}">
                <img src="assets/${s.logo}" alt="${s.label}" onerror="this.style.display='none'" />
                <span class="squad-label">${s.label}</span>
                <span class="squad-status-badge ${sBadge.class}">${sBadge.icon} ${sBadge.label}</span>
              </button>
            `;
          }).join('')}
        </div>
      `;
    } else if (availableSquads.length === 1) {
      const s = availableSquads[0];
      const sIsActive = getCachedRosterStatus(s.id);
      const sBadge = getStatusBadge(sIsActive);
      sidebarHTML += `
        <div class="sidebar-current-roster" style="padding: 0.75rem 1.25rem; border-bottom: 1px solid var(--border);">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <img src="assets/${s.logo}" alt="${s.label}" style="width: 28px; height: 28px; border-radius: 50%; object-fit: cover;" onerror="this.style.display='none'" />
            <span style="font-weight: 700; font-size: 0.82rem; color: var(--text-primary); text-transform: uppercase; letter-spacing: 0.5px;">${s.label}</span>
            <span class="squad-status-badge ${sBadge.class}">${sBadge.icon} ${sBadge.label}</span>
          </div>
        </div>
      `;
    }

    sidebarHTML += `
      <nav class="sidebar-nav">
        <div class="nav-section">Principal</div>
        <div class="nav-item ${activePage === 'dashboard' ? 'active' : ''}" data-page="dashboard">
          <span class="icon">${Icons.dashboard}</span>
          <span>Dashboard</span>
        </div>
        
        <div class="nav-section">Gestión</div>
        <div class="nav-item ${activePage === 'players' ? 'active' : ''}" data-page="players">
          <span class="icon">${Icons.players}</span>
          <span>Jugadores</span>
        </div>
        <div class="nav-item ${activePage === 'scrims' ? 'active' : ''}" data-page="scrims">
          <span class="icon">${Icons.scrims}</span>
          <span>Scrims</span>
        </div>
        
        <div class="nav-section">Comunicación</div>
        <div class="nav-item ${activePage === 'announcements' ? 'active' : ''}" data-page="announcements">
          <span class="icon">${Icons.announcements}</span>
          <span>Comunicados</span>
        </div>
    `;

    if (canSeeBackupsOption) {
      sidebarHTML += `
        <div class="nav-section">Sistema</div>
        <div class="nav-item ${activePage === 'rosters' ? 'active' : ''}" data-page="rosters">
          <span class="icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
              <line x1="8" y1="21" x2="16" y2="21"/>
              <line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
          </span>
          <span>Rosters</span>
        </div>
        <div class="nav-item ${activePage === 'backups' ? 'active' : ''}" data-page="backups">
          <span class="icon">${Icons.backup || Icons.database}</span>
          <span>Backups</span>
        </div>
      `;
    }

    sidebarHTML += `
      </nav>

      <div class="sidebar-footer">
        <button class="logout-btn" id="logout-btn">
          <span class="icon">${Icons.logout}</span>
          <span>Cerrar sesión</span>
        </button>
      </div>
    `;

    sidebarEl.innerHTML = sidebarHTML;

    // Squad change handlers
    sidebarEl.querySelectorAll('.squad-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const newSquad = btn.dataset.squad;
        setActiveSquad(newSquad);
        if (onSquadChange) onSquadChange(newSquad);
        render(activePage, onSquadChange);
      });
    });

    // Nav item handlers
    sidebarEl.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const page = item.dataset.page;
        const pageMap = {
          dashboard: 'dashboard.html',
          players: 'players.html',
          scrims: 'scrims.html',
          announcements: 'announcements.html',
          rosters: 'rosters.html',
          backups: 'backups.html'
        };
        
        if (pageMap[page]) {
          if (page === 'backups' && !canSeeBackups()) {
            Toast.error('No tienes permisos para acceder a Backups');
            return;
          }
          window.location.href = pageMap[page];
        }
      });
    });

    // Logout handler
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('uzx_admin_token');
        localStorage.removeItem('uzx_admin_user');
        localStorage.removeItem('uzx_active_squad');
        window.location.href = 'index.html';
      });
    }

    // 🔥 Iniciar listener de cambios si no está activo
    if (!window._rosterListenerActive) {
      window._rosterListenerActive = true;
      listenForRosterChanges();
    }

    // Cargar estados de rosters
    refreshRosterStatus();
  }

  return { render, getActiveSquad, setActiveSquad };
})();
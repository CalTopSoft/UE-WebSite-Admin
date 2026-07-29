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

// Sidebar Component
const Sidebar = (() => {
  const SQUAD_KEY = 'uzx_active_squad';
  const squads = [
    { id: 'OFICIAL', label: 'UZX OFICIAL', logo: 'logo-oficial.png', activeClass: 'active-oficial' },
    { id: 'TIER', label: 'UZX TIER', logo: 'logo-tier.png', activeClass: 'active-tier' },
    { id: 'GIRLS', label: 'UZX GIRLS', logo: 'logo-girls.png', activeClass: 'active-girls' }
  ];

  function getActiveSquad() {
    return localStorage.getItem(SQUAD_KEY) || 'OFICIAL';
  }

  function setActiveSquad(id) {
    localStorage.setItem(SQUAD_KEY, id);
  }

  function render(activePage, onSquadChange) {
    const squad = getActiveSquad();
    const sidebarEl = document.getElementById('sidebar');
    if (!sidebarEl) return;

    const squadInfo = squads.find(s => s.id === squad) || squads[0];
    const logoPath = `assets/${squadInfo.logo}`;

    sidebarEl.innerHTML = `
      <div class="sidebar-header">
        <img src="${logoPath}" alt="UZX" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🎮</text></svg>'" />
        <div class="brand">UZX <span>ADMIN</span></div>
      </div>

      <div class="sidebar-squad-selector">
        ${squads.map(s => `
          <button class="squad-btn ${squad === s.id ? s.activeClass : ''}" data-squad="${s.id}">
            <img src="assets/${s.logo}" alt="${s.label}" onerror="this.style.display='none'" />
            ${s.label}
          </button>
        `).join('')}
      </div>

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

        <div class="nav-section">Sistema</div>
        <div class="nav-item ${activePage === 'backups' ? 'active' : ''}" data-page="backups">
          <span class="icon">${Icons.backup || Icons.database}</span>
          <span>Backups</span>
        </div>
      </nav>

      <div class="sidebar-footer">
        <button class="logout-btn" id="logout-btn">
          <span class="icon">${Icons.logout}</span>
          <span>Cerrar sesión</span>
        </button>
      </div>
    `;

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
          backups: 'backups.html'
        };
        if (pageMap[page]) {
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
  }

  return { render, getActiveSquad, setActiveSquad };
})();
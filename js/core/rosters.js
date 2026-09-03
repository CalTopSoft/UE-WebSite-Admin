// js/core/rosters.js
// ============================================================
// CONFIGURACIÓN CENTRAL DE ROSTERS
// ============================================================

const ROSTER_CONFIG = {
    DEFINITIONS: {
        'OFICIAL': {
            id: 'OFICIAL',
            label: 'UZX OFICIAL',
            slug: 'oficial',
            logo: 'logo-oficial.png',
            activeClass: 'active-oficial',
            color: '#FFD700',
            icon: Icons.players
        },
        'TIER': {
            id: 'TIER',
            label: 'UZX TIER',
            slug: 'tier',
            logo: 'logo-tier.png',
            activeClass: 'active-tier',
            color: '#00BFFF',
            icon: Icons.players
        },
        'GIRLS': {
            id: 'GIRLS',
            label: 'UZX GIRLS',
            slug: 'girls',
            logo: 'logo-girls.png',
            activeClass: 'active-girls',
            color: '#FF69B4',
            icon: Icons.players
        },
        'GOLD': {
            id: 'GOLD',
            label: 'UZX GOLD',
            slug: 'gold',
            logo: 'logo-gold.png',
            activeClass: 'active-gold',
            color: '#FFD700',
            icon: Icons.players
        }
    },

    // Orden de visualización
    ORDER: ['OFICIAL', 'TIER', 'GIRLS', 'GOLD'],

    // Obtener un roster por ID
    get(id) {
        return this.DEFINITIONS[id] || null;
    },

    // Obtener todos los rosters en orden
    getAll() {
        return this.ORDER.map(id => this.DEFINITIONS[id]).filter(Boolean);
    },

    // Obtener rosters por IDs
    getByIds(ids) {
        return ids.map(id => this.get(id)).filter(Boolean);
    },

    // Obtener roster por slug
    getBySlug(slug) {
        return Object.values(this.DEFINITIONS).find(r => r.slug === slug) || null;
    }
};

// ============================================================
// SISTEMA DE PERMISOS
// ============================================================

const RosterPermissions = {
    // Mapeo de roles a rosters (para compatibilidad)
    ROLE_ROSTER_MAP: {
        'admin': null,
        'admintier': 'TIER',
        'admingold': 'GOLD',
        'admingirls': 'GIRLS'
    },

    // Obtiene el objeto de usuario completo guardado en login.
    _getUserData() {
        try {
            const raw = localStorage.getItem('uzx_admin_user');
            if (!raw) return null;
            return JSON.parse(raw);
        } catch {
            return null;
        }
    },

    // Obtener el rol del usuario (mapeado para el frontend)
    getUserRole() {
        const user = this._getUserData();
        if (!user) return 'admin';
        
        // 🔥 PRIMERO: buscar mappedRole (mapeado desde el backend)
        if (user.mappedRole) {
            return user.mappedRole;
        }
        
        // Si no hay mappedRole, usar role directamente
        const role = user.role || 'ADMIN';
        
        // Si es ROSTER_ADMIN, mapear según rosterId
        if (role === 'ROSTER_ADMIN') {
            const rosterId = user.rosterId || '';
            const rosterRoleMap = {
                'tier': 'admintier',
                'gold': 'admingold',
                'girls': 'admingirls'
            };
            return rosterRoleMap[rosterId] || 'admin';
        }
        
        // ADMIN → admin
        if (role === 'ADMIN') return 'admin';
        
        // Otros roles
        return role.toLowerCase();
    },

    // Obtener el rosterId del usuario (normalizado a MAYÚSCULAS)
    getUserRosterId() {
        const user = this._getUserData();
        if (!user) return null;
        
        // Buscar en rosterId primero
        if (user.rosterId) {
            return String(user.rosterId).toUpperCase();
        }
        
        // Si no, intentar inferir del mappedRole
        const role = this.getUserRole();
        const reverseMap = {
            'admintier': 'TIER',
            'admingold': 'GOLD',
            'admingirls': 'GIRLS'
        };
        return reverseMap[role] || null;
    },

    // Verificar si es admin global
    isGlobalAdmin() {
        const role = this.getUserRole();
        return role === 'admin';
    },

    // Obtener rosters accesibles para el usuario
    getAccessibleRosters() {
        if (this.isGlobalAdmin()) {
            return ROSTER_CONFIG.getAll();
        }

        const rosterId = this.getUserRosterId();
        if (rosterId) {
            const roster = ROSTER_CONFIG.get(rosterId);
            return roster ? [roster] : [];
        }

        return [];
    },

    // Verificar si el usuario puede acceder a un roster específico
    canAccessRoster(rosterId) {
        if (this.isGlobalAdmin()) return true;
        return this.getUserRosterId() === rosterId;
    },

    // Verificar si el usuario puede ver backups
    canSeeBackups() {
        return this.isGlobalAdmin();
    },

    // Verificar si el usuario puede ver un roster en la UI
    shouldShowRoster(rosterId) {
        const accessible = this.getAccessibleRosters();
        return accessible.some(r => r.id === rosterId);
    }
};

// ============================================================
// ESTADO DE ROSTERS (desde backend)
// ============================================================

const RosterStatus = {
    // Cache de estados
    _cache: null,
    _lastFetch: 0,
    _ttl: 60000, // 1 minuto

    async fetchStatus() {
        try {
            const now = Date.now();
            if (this._cache && (now - this._lastFetch) < this._ttl) {
                return this._cache;
            }

            const response = await API.get('/rosters');
            const list = response.data || [];
            const map = {};
            for (const r of list) {
                map[String(r.id).toUpperCase()] = r.active !== false;
            }
            for (const known of ROSTER_CONFIG.ORDER) {
                if (!(known in map)) map[known] = false;
            }

            this._cache = map;
            this._lastFetch = now;
            return this._cache;
        } catch (error) {
            console.warn('Error fetching roster status:', error);
            return ROSTER_CONFIG.getAll().reduce((acc, r) => {
                acc[r.id] = true;
                return acc;
            }, {});
        }
    },

    async isActive(rosterId) {
        const status = await this.fetchStatus();
        return status[rosterId] !== false;
    },

    async getActiveRosters() {
        const status = await this.fetchStatus();
        return ROSTER_CONFIG.getAll().filter(r => status[r.id] !== false);
    },

    async getInactiveRosters() {
        const status = await this.fetchStatus();
        return ROSTER_CONFIG.getAll().filter(r => status[r.id] === false);
    },

    async updateStatus(rosterId, active) {
        if (!RosterPermissions.isGlobalAdmin()) {
            throw new Error('Solo administradores globales pueden modificar estados');
        }
        const response = await API.aPatch(`/admin/rosters/${rosterId.toLowerCase()}/active`, { active });
        this._cache = null;
        return response;
    }
};

// ============================================================
// EXPORTAR PARA USO GLOBAL
// ============================================================

window.RosterConfig = ROSTER_CONFIG;
window.RosterPermissions = RosterPermissions;
window.RosterStatus = RosterStatus;
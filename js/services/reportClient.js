// js/services/reportClient.js
// Cliente compartido de reportes (lo usan analytics.html y el atajo de scrims.html).
const ReportClient = (() => {
    // Las scrims se cargan en hora de México (UTC-6 fijo), igual que scrims.html.
    const TZ = -360;
    const PROGRESS = ['Analizando jornadas...', 'Analizando jugadores...', 'Evaluando rendimiento...', 'Analizando patrones...', 'Construyendo reporte...', 'Generando PDF...'];
    const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  
    function canUse() {
      try { const u = JSON.parse(localStorage.getItem('uzx_admin_user') || 'null'); return !!u && (u.role === 'ADMIN' || u.role === 'ROSTER_ADMIN'); }
      catch { return false; }
    }
  
    // El PDF no puede pasar por API.js (siempre hace res.json()).
    async function postPdf(body, signal) {
      const res = await fetch(CONFIG.API_BASE + '/reports/generate', {
        method: 'POST', signal,
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + AUTH.getToken() },
        body: JSON.stringify(body),
      });
      if (res.ok && (res.headers.get('Content-Type') || '').includes('application/pdf')) return res.blob();
      let msg = `Error ${res.status}`, code;
      try { const j = await res.json(); msg = j.message || msg; code = j.code; } catch (_) {}
      if (res.status === 401) { localStorage.removeItem('uzx_admin_token'); window.location.href = 'index.html'; }
      const err = new Error(msg); err.status = res.status; err.code = code; throw err;
    }
  
    function explain(e, timedOut) {
      if (e.name === 'AbortError') return timedOut ? { msg: 'El reporte tardó más de 90 segundos. Intenta con un rango menor.', kind: 'err' } : null;
      if (e.status === 404 && e.code === 'NO_DATA') return { msg: 'No hay jornadas registradas para esos filtros.', kind: 'warn' };
      if (e.status === 429) return { msg: 'Hay reportes en proceso. Intenta de nuevo en unos segundos.', kind: 'warn' };
      return { msg: e.message || 'No se pudo generar el reporte', kind: 'err' };
    }
  
    function startProgress(msgEl) {
      let i = 0; msgEl.textContent = PROGRESS[0];
      const t = setInterval(() => { i = Math.min(i + 1, PROGRESS.length - 1); msgEl.textContent = PROGRESS[i]; }, 1200);
      return () => clearInterval(t);
    }
  
    // ── Atajo: ventana de análisis de UNA jornada (todo preconfigurado) ──
    function openQuick(scrimId, rosterId, label) {
      const old = document.getElementById('rc-quick'); if (old) old.remove();
      const ov = document.createElement('div');
      ov.className = 'modal-overlay show'; ov.id = 'rc-quick';
      ov.innerHTML = `
        <div class="modal" style="max-width:520px">
          <div class="modal-header"><span class="modal-title">Análisis de la jornada</span>
            <button class="modal-close" id="rc-x"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>
          <div class="modal-body">
            <div style="padding:.75rem 1rem;background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius);margin-bottom:1rem;font-size:.88rem">
              <strong>${esc(label)}</strong><div style="color:var(--text-muted);font-size:.78rem;margin-top:.15rem">Roster: UZX ${esc(String(rosterId).toUpperCase())} · solo esta jornada</div></div>
            <div class="form-group"><label class="form-label" for="rc-mode">Tipo de análisis</label>
              <select class="form-control" id="rc-mode">
                <option value="complete">Completo</option><option value="general">General</option><option value="individual">Individual</option>
                <option value="performance">Rendimiento</option><option value="deaths">Muertes</option><option value="roles">Roles</option><option value="consistency">Consistencia</option>
              </select></div>
            <div id="rc-prog" style="display:none" role="status" aria-live="polite">
              <div id="rc-msg" style="font-size:.88rem;font-weight:600;color:var(--text-secondary);margin-bottom:.4rem"></div>
              <div style="height:6px;background:var(--bg-tertiary);border-radius:3px;overflow:hidden;position:relative"><div style="position:absolute;top:0;bottom:0;width:35%;background:var(--primary);border-radius:3px;animation:rcSlide 1.1s ease-in-out infinite"></div></div></div>
            <div id="rc-status" role="alert" style="display:none;margin-top:.75rem;padding:.7rem 1rem;border-radius:var(--radius);font-size:.85rem"></div>
            <div id="rc-result" style="display:none;margin-top:1rem;padding:1rem;border:1.5px solid var(--success);background:var(--success-bg);border-radius:var(--radius-lg)">
              <div style="font-weight:800;color:var(--success);margin-bottom:.6rem;text-transform:uppercase">Reporte listo</div>
              <div style="display:flex;gap:.6rem;flex-wrap:wrap"><a class="btn btn-primary btn-sm" id="rc-dl" href="#" download="reporte.pdf">Descargar PDF</a>
                <button class="btn btn-secondary btn-sm" id="rc-open">Abrir en pestaña nueva</button></div></div>
            <style>@keyframes rcSlide{0%{left:-35%}100%{left:100%}}</style>
          </div>
          <div class="modal-footer"><button class="btn btn-ghost" id="rc-close">Cerrar</button>
            <button class="btn btn-primary" id="rc-go">Generar PDF</button></div>
        </div>`;
      document.body.appendChild(ov); document.body.style.overflow = 'hidden';
  
      const $ = (id) => ov.querySelector('#' + id);
      let ctrl = null, url = null, stop = null, timedOut = false, busy = false;
      function close() {
        if (ctrl) ctrl.abort(); if (stop) stop(); if (url) URL.revokeObjectURL(url);
        ov.remove(); document.body.style.overflow = ''; document.removeEventListener('keydown', esc_);
      }
      function esc_(e) { if (e.key === 'Escape') close(); }
      document.addEventListener('keydown', esc_);
      $('rc-x').onclick = close; $('rc-close').onclick = close;
      $('rc-open').onclick = () => { if (url) window.open(url, '_blank'); };
      function status(msg, kind) {
        const el = $('rc-status'); el.style.display = msg ? 'block' : 'none'; el.textContent = msg || '';
        el.style.background = kind === 'err' ? 'var(--danger-bg)' : 'var(--warning-bg)'; el.style.color = kind === 'err' ? 'var(--danger)' : 'var(--warning)';
      }
      $('rc-go').onclick = async () => {
        if (busy) return; busy = true; $('rc-go').disabled = true; status(''); $('rc-result').style.display = 'none';
        if (url) { URL.revokeObjectURL(url); url = null; }
        $('rc-prog').style.display = 'block'; stop = startProgress($('rc-msg'));
        ctrl = new AbortController(); timedOut = false; const to = setTimeout(() => { timedOut = true; ctrl.abort(); }, 90000);
        try {
          const blob = await postPdf({ type: 'journey', scrimId, rosterId, analysis: $('rc-mode').value, tzOffsetMinutes: TZ }, ctrl.signal);
          url = URL.createObjectURL(blob);
          const a = $('rc-dl'); a.href = url; a.download = `UZX-reporte-jornada-${scrimId.slice(-6)}.pdf`;
          $('rc-result').style.display = 'block';
        } catch (e) { const x = explain(e, timedOut); if (x) status(x.msg, x.kind); }
        finally { clearTimeout(to); stop(); $('rc-prog').style.display = 'none'; busy = false; $('rc-go').disabled = false; }
      };
    }
  
    return { TZ, PROGRESS, esc, canUse, postPdf, explain, startProgress, openQuick };
  })();
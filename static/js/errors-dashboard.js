(() => {
  'use strict'
  const $ = id => document.getElementById(id)
  const login = $('login'), dashboard = $('dashboard'), errors = $('errors')
  let password = sessionStorage.getItem('error-dashboard-password') || '', offset = 0, total = 0
  const limit = 25
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
  function headers(mutation = false) { const h = {'X-Director-Password': password}; if (mutation) Object.assign(h, {'Content-Type':'application/json','X-Requested-With':'ErrorDashboard'}); return h }
  async function api(path = '', options = {}) {
    const response = await fetch('/api/admin/client-errors' + path, {...options, headers: {...headers(options.method && options.method !== 'GET'), ...(options.headers || {})}, cache:'no-store'})
    if (response.status === 401) { logout(); throw new Error('Passwort ungültig') }
    if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || `HTTP ${response.status}`)
    return response.json()
  }
  function browser(ua) { const match = String(ua).match(/(Firefox|Edg|Chrome|Version)\/([\d.]+)/); return match ? `${match[1] === 'Version' ? 'Safari' : match[1]} ${match[2]}` : (ua || '–') }
  function showDashboard() { login.hidden = true; dashboard.hidden = false; $('logout').hidden = false }
  function logout() { password = ''; sessionStorage.removeItem('error-dashboard-password'); dashboard.hidden = true; login.hidden = false; $('logout').hidden = true }
  async function load() {
    const query = new URLSearchParams({status:$('status').value, search:$('search').value, limit, offset})
    try {
      const data = await api('?' + query); total = data.total; showDashboard()
      const s = data.summary; $('summary').innerHTML = [['Gruppen',s.total],['Offen',s.open],['Gelöst',s.resolved],['Vorkommen',s.occurrences]].map(x => `<div class="card"><strong>${x[1] || 0}</strong>${x[0]}</div>`).join('')
      errors.innerHTML = data.items.length ? data.items.map(render).join('') : '<div class="panel">Keine Fehler gefunden.</div>'
      $('page').textContent = `${total ? offset + 1 : 0}–${Math.min(offset + limit,total)} von ${total}`; $('previous').disabled = !offset; $('next').disabled = offset + limit >= total
    } catch (error) { $('notice').textContent = error.message }
  }
  function render(e) {
    const actor = e.actorRole || e.clientId || '–', versions = [e.appVersion && `App ${e.appVersion}`, e.serviceWorkerVersion && `SW ${e.serviceWorkerVersion}`].filter(Boolean).join(' · ') || '–'
    return `<article class="error-card ${escape(e.status)}"><div class="row"><h2>${escape(e.message)} <small>(${escape(e.type)})</small></h2><span class="badge">${e.status === 'open' ? 'offen' : 'gelöst'} · ×${e.occurrenceCount}</span></div><div class="meta"><span>Zuletzt: ${escape(new Date(e.lastSeen).toLocaleString())}</span><span>Erstmals: ${escape(new Date(e.firstSeen).toLocaleString())}</span><span>Akteur: ${escape(actor)}</span><span>Stück: ${escape(e.playId || '–')}</span><span>Pfad: ${escape(e.pathname)}</span><span>Browser: ${escape(browser(e.userAgent))}</span><span>Version: ${escape(versions)}</span></div><details><summary>Stack & Details</summary><pre>${escape(e.stack || 'Kein Stacktrace')}</pre><pre>${escape(JSON.stringify(e.details,null,2))}</pre></details><div class="actions"><button data-action="status" data-id="${e.id}" data-status="${e.status === 'open' ? 'resolved' : 'open'}">${e.status === 'open' ? 'Als gelöst markieren' : 'Wieder öffnen'}</button><button class="danger" data-action="delete" data-id="${e.id}">Löschen</button></div></article>`
  }
  login.addEventListener('submit', async event => { event.preventDefault(); password = $('password').value; try { await api('?limit=1'); sessionStorage.setItem('error-dashboard-password', password); $('login-error').textContent = ''; load() } catch (e) { $('login-error').textContent = e.message } })
  errors.addEventListener('click', async event => { const b = event.target.closest('button[data-action]'); if (!b) return; if (b.dataset.action === 'delete' && !confirm('Diesen Fehler endgültig löschen?')) return; const options = b.dataset.action === 'status' ? {method:'PATCH',body:JSON.stringify({status:b.dataset.status})} : {method:'DELETE',body:'{}'}; try { await api('/'+b.dataset.id,options); load() } catch(e) {$('notice').textContent=e.message} })
  let timer; $('search').addEventListener('input', () => { clearTimeout(timer); timer=setTimeout(()=>{offset=0;load()},250) }); $('status').addEventListener('change',()=>{offset=0;load()}); $('refresh').onclick=load; $('logout').onclick=logout
  $('previous').onclick=()=>{offset=Math.max(0,offset-limit);load()}; $('next').onclick=()=>{offset+=limit;load()}
  $('clear').onclick=async()=>{if(confirm('Alle gelösten Fehler löschen?')){await api('',{method:'DELETE',body:'{}'});offset=0;load()}}
  if (password) load()
})()

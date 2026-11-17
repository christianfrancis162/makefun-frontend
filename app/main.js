export const API_ORIGIN = 'https://make.fun';
const API = 'https://make.fun/api';
const responseCache = new Map(), retainedViews = new Map();
const CACHE_MS = 60_000, PAGE_SIZE = 8;
let activeView, navigationId = 0, refreshing = false, staleResponse = false;

export async function cachedGet(path, force = refreshing) {
  const previous = responseCache.get(path);
  if (previous?.pending) return previous.pending;
  if (!force && previous?.data && Date.now() - previous.time < CACHE_MS) return previous.data;
  if (responseCache.size > 100) {
    for (const [key, item] of responseCache) { if (!item.pending && key !== path) { responseCache.delete(key); break; } }
  }
  const pending = (async () => {
    try {
      const response = await fetch(API + path, {
        method: 'GET', credentials: 'omit', cache: 'no-store',
        headers: previous?.etag ? { 'If-None-Match': previous.etag } : {},
        signal: AbortSignal.timeout(15000)
      });
      if (response.status === 304 && previous?.data) {
        responseCache.set(path, { ...previous, time: Date.now(), pending: null });
        return previous.data;
      }
      if (!response.ok) throw new Error(response.status === 404 ? 'This page could not be found.' : `The live API returned ${response.status}. Please try again.`);
      const data = await response.json();
      responseCache.set(path, { data, time: Date.now(), etag: response.headers.get('ETag') });
      return data;
    } catch (error) {
      if (previous?.data) { staleResponse = true; return previous.data; }
      throw error;
    } finally {
      const item = responseCache.get(path);
      if (item?.pending) item.pending = null;
    }
  })();
  responseCache.set(path, { ...previous, pending });
  return pending;
}

async function boardView(view) {
  const data = await cachedGet('/competitions?status=open&activity=times&limit=100');
  view.data = data;
  view.items = data.items;
  view.state ||= { query: '', category: 'All', sort: 'pot', scope: 'live', page: 0 };
  if (!view.ready) {
    view.node.innerHTML = `<div class="page-heading"><div><span class="eyebrow">BUILD. COMPETE. GET PAID.</span><h1>The bounty board</h1><p>A good place to put your next big idea to work.</p></div><span class="badge open">Live opportunities</span></div><div class="feature-slot"></div><div class="tools"><label class="search-box"><span aria-hidden="true">⌕</span><input type="search" data-action="search" placeholder="Find your next challenge…" aria-label="Search bounties"></label><select data-action="sort" aria-label="Sort bounties"><option value="pot">Highest reward</option><option value="deadline">Ending soonest</option><option value="entries">Most entries</option><option value="newest">Newest first</option></select></div><div class="chips" aria-label="Filter by category"></div><div class="list-heading"><strong class="result-count"></strong><select class="chip" data-action="scope" aria-label="Filter by entry status"><option value="live">Taking entries</option><option value="upcoming">Opening soon</option><option value="ended">Awaiting results</option><option value="all">All listed</option></select></div><div class="board-grid"></div><div class="pagination"></div>`;
  }
  updateBoard(view);
}

let detailViews;
async function bountyView(view, slug) { detailViews ||= await import('./detail.js'); return detailViews.bountyView(view, slug); }
async function leaderboardView(view, slug) { detailViews ||= await import('./detail.js'); return detailViews.leaderboardView(view, slug); }
async function profileView(view, handle) { detailViews ||= await import('./detail.js'); return detailViews.profileView(view, handle); }

export const escapeText = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
export const dollars = value => Number(value ?? 0).toLocaleString('en-US', { style:'currency', currency:'USD', minimumFractionDigits: Number.isInteger(Number(value)) ? 0 : 2, maximumFractionDigits:2 });
export const count = value => Number(value || 0).toLocaleString('en-US');
export const potAmount = bounty => Number(bounty.potUsd ?? bounty.rewardAmount ?? 0);
export const bountyRoute = slug => '#/bounty/' + encodeURIComponent(slug);
export const profileRoute = handle => '#/u/' + encodeURIComponent(handle);
export const dateLabel = value => value ? new Date(value).toLocaleString('en-GB', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit', timeZone:'UTC' }) + ' UTC' : 'Not announced';
export function entryState(bounty) {
  if (bounty.status === 'resolved') return 'resolved';
  if (Date.parse(bounty.deadline) <= Date.now()) return 'ended';
  if (Date.parse(bounty.opensAt || bounty.publishedAt) > Date.now()) return 'upcoming';
  return bounty.status === 'open' ? 'live' : 'ended';
}
function remaining(deadline) {
  if (!Number.isFinite(Date.parse(deadline))) return 'Deadline pending';
  const minutes = Math.max(0, Math.ceil((Date.parse(deadline) - Date.now()) / 60000));
  if (!minutes) return 'Entries closed';
  if (minutes < 60) return `${minutes}m left`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ${minutes % 60}m left`;
  return `${Math.floor(minutes / 1440)}d ${Math.floor(minutes % 1440 / 60)}h left`;
}
export function statusBadge(bounty) {
  const state = entryState(bounty);
  return `<span class="badge ${state === 'live' ? 'open' : state === 'upcoming' ? 'upcoming' : 'closed'}" data-deadline="${escapeText(bounty.deadline)}">${({live:'Taking entries',upcoming:'Opening soon',ended:'Entries closed',resolved:'Resolved'})[state]}</span>`;
}
export function timeMarkup(bounty) {
  const upcoming = entryState(bounty) === 'upcoming';
  return `<time class="time ${Date.parse(bounty.deadline) - Date.now() < 86400000 ? 'urgent' : ''}" datetime="${escapeText(upcoming ? bounty.opensAt || bounty.publishedAt : bounty.deadline)}" title="${escapeText(dateLabel(upcoming ? bounty.opensAt || bounty.publishedAt : bounty.deadline))}" ${upcoming ? '' : `data-time="${escapeText(bounty.deadline)}"`}>${upcoming ? 'Opens ' + new Date(bounty.opensAt || bounty.publishedAt).toLocaleString('en-GB', {day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'UTC'}) + ' UTC' : remaining(bounty.deadline)}</time>`;
}
export function categoryMarkup(category) {
  const symbols = { Code:'⌘', Games:'♧', Trading:'↗', Growth:'✳', Forecasting:'◴', Security:'◇', Automation:'⚙' };
  return `<span class="category"><span aria-hidden="true" class="category-icon ${escapeText(String(category).toLowerCase())}">${symbols[category] || '◇'}</span>${escapeText(category || 'Open challenge')}</span>`;
}
export function pagination(view, total, size = PAGE_SIZE) {
  const pages = Math.max(1, Math.ceil(total / size));
  view.state.page = Math.min(view.state.page, pages - 1);
  return `<span>${total ? `${view.state.page * size + 1}–${Math.min(total, (view.state.page + 1) * size)} of ${count(total)}` : '0 results'}</span><div><button class="button" data-action="previous" ${view.state.page === 0 ? 'disabled' : ''} aria-label="Previous page">← Previous</button><button class="button" data-action="next" ${view.state.page + 1 >= pages ? 'disabled' : ''} aria-label="Next page">Next →</button></div>`;
}
function updateBoard(view) {
  const { state, items, node } = view;
  const live = items.filter(item => entryState(item) === 'live');
  const featured = items.find(item => item.slug === 'makefun-frontend-01') || live[0];
  if (view.featured !== featured) {
    view.featured = featured;
  node.querySelector('.feature-slot').innerHTML = featured ? `<article class="featured"><span class="feature-flower" aria-hidden="true">✳</span><a href="${bountyRoute(featured.slug)}"><span class="eyebrow">IN THE SPOTLIGHT &nbsp; ↗</span><h2>${escapeText(featured.title)}</h2><p>${escapeText(featured.summary)}</p></a><div class="featured-stats"><div><small>LIVE REWARD POT</small><div class="pot">${dollars(potAmount(featured))}</div></div><p><strong>${timeMarkup(featured)}</strong><br>${Number(featured.entryFeeUsd) ? dollars(featured.entryFeeUsd) + ' entry fee' : 'Free entry'} · ${count(featured.submissionCount)} entries</p></div></article>` : '';
  }
  const categories = ['All', ...new Set(items.map(item => item.category).filter(Boolean))];
  if (view.categories !== categories.join(',')) {
    view.categories = categories.join(',');
  node.querySelector('.chips').innerHTML = categories.map(category => `<button class="chip ${state.category === category ? 'active' : ''}" data-category="${escapeText(category)}" aria-pressed="${state.category === category}">${escapeText(category)}</button>`).join('');
  }
  node.querySelectorAll('[data-category]').forEach(button => { const selected = button.dataset.category === state.category; button.classList.toggle('active',selected); button.setAttribute('aria-pressed',String(selected)); });
  const filtered = items.filter(item => (state.scope === 'all' || entryState(item) === state.scope) && (state.category === 'All' || item.category === state.category) && `${item.title} ${item.summary} ${(item.skills || []).join(' ')}`.toLowerCase().includes(state.query.toLowerCase()));
  filtered.sort(({pot:(a,b)=>potAmount(b)-potAmount(a),deadline:(a,b)=>Date.parse(a.deadline)-Date.parse(b.deadline),entries:(a,b)=>b.submissionCount-a.submissionCount,newest:(a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt)})[state.sort]);
  const pager = pagination(view, filtered.length);
  node.querySelector('.result-count').textContent = `${filtered.length} ${state.scope === 'live' ? 'open ' : ''}bounties`;
  node.querySelector('.board-grid').innerHTML = filtered.slice(state.page * PAGE_SIZE, (state.page + 1) * PAGE_SIZE).map(bounty => `<article class="bounty-card"><div class="card-top">${categoryMarkup(bounty.category)}${statusBadge(bounty)}</div><h2><a href="${bountyRoute(bounty.slug)}">${escapeText(bounty.title)}</a></h2><p class="card-summary">${escapeText(bounty.summary)}</p><div class="card-money"><div class="pot">${dollars(potAmount(bounty))}<small>USDC pot</small></div><span class="fee">${Number(bounty.entryFeeUsd) ? dollars(bounty.entryFeeUsd) + ' entry fee' : 'Free entry'}</span></div><div class="card-meta"><span>◷ &nbsp;${timeMarkup(bounty)}</span><span>${count(bounty.submissionCount)} entries ↗</span></div></article>`).join('') || `<div class="empty"><h2>No matches this time.</h2><p>Try another category or a broader search.</p><button class="button" data-action="reset">Clear filters</button></div>`;
  node.querySelector('.pagination').innerHTML = pager;
}

async function navigate() {
  window.__shotReady = false;
  staleResponse = false;
  const id = ++navigationId;
  let route = location.hash || '#/';
  if (route === '#content') { document.querySelector('#content').focus(); route = activeView?.route || '#/'; }
  const match = route.match(/^#\/(bounty|u)\/([^/]+)(\/leaderboard)?$/);
  const kind = route === '#/' ? 'board' : match ? match[1] === 'u' ? 'profile' : match[3] ? 'leaderboard' : 'bounty' : 'missing';
  const oldView = activeView;
  if (oldView) { oldView.scroll = window.scrollY; oldView.node.hidden = true; }
  let view = retainedViews.get(route);
  if (!view) {
    view = { node: document.createElement('section'), route, kind, ready: false };
    view.node.className = 'route-view';
    view.node.dataset.route = route;
    retainedViews.set(route, view);
    document.querySelector('#views').append(view.node);
    if (retainedViews.size > 12) {
      const oldest = retainedViews.keys().next().value;
      retainedViews.get(oldest).node.remove();
      retainedViews.delete(oldest);
    }
  }
  activeView = view;
  view.node.hidden = false;
  view.node.setAttribute('aria-busy', 'true');
  if (!view.ready) view.node.innerHTML = '<div class="loading">Finding the good stuff on make.fun…</div>';
  document.querySelectorAll('[data-nav]').forEach(link => link.dataset.nav === kind ? link.setAttribute('aria-current', 'page') : link.removeAttribute('aria-current'));
  document.querySelector('#crumb').textContent = 'Explore / ' + ({board:'Bounties',bounty:'Bounty details',leaderboard:'Leaderboard',profile:'Builder profile',missing:'Page not found'})[kind];
  try {
    const identifier = match ? decodeURIComponent(match[2]) : '';
    if (kind === 'board') await boardView(view);
    else if (kind === 'bounty') await bountyView(view, identifier);
    else if (kind === 'leaderboard') await leaderboardView(view, identifier);
    else if (kind === 'profile') await profileView(view, identifier);
    else throw new Error(kind === 'missing' ? 'This page could not be found.' : 'This surface is being built.');
    if (id !== navigationId) return;
    view.ready = true;
    refreshTimes(view);
    document.title = `make.fun · ${view.data?.title || (kind === 'board' ? 'The bounty board' : identifier)}`;
    document.querySelector('#announcer').textContent = `${document.title} loaded`;
    const notice = document.querySelector('#notice');
    notice.hidden = !staleResponse;
    notice.textContent = 'The API is temporarily unavailable. Showing the last loaded data; refresh to try again.';
    document.querySelector('#connection').textContent = staleResponse ? 'Cached data' : 'Live from make.fun';
  } catch (error) {
    if (id !== navigationId) return;
    view.node.innerHTML = `<div class="error" role="alert"><h2>We couldn’t load this page.</h2><p>${escapeText(error.message)}</p><button class="button" data-action="retry">Try again</button> <a class="button" href="#/">Bounty board</a></div>`;
    view.ready = false;
  } finally {
    view.node.setAttribute('aria-busy', 'false');
    if (id === navigationId) {
      window.scrollTo(0, view.scroll || 0);
      if (oldView && oldView !== view) document.querySelector('#content').focus({preventScroll:true});
      window.__shotReady = true;
      window.__shotRoute = route;
    }
  }
}
function updateActiveList() {
  if (activeView.kind === 'board') updateBoard(activeView);
  if (activeView.kind === 'leaderboard') detailViews.updateLeaderboard(activeView);
  if (activeView.kind === 'profile') detailViews.updateProfile(activeView);
}
document.querySelector('#views').addEventListener('input', async event => {
  if (event.target.dataset.action === 'leader-search') { const view = activeView; view.state.query = event.target.value; view.state.page = 0; try { await detailViews.loadFullLeaderboard(view); if (view === activeView) updateActiveList(); } catch (error) { showNotice(error.message); } }
  if (event.target.dataset.action === 'search') { activeView.state.query = event.target.value; activeView.state.page = 0; updateActiveList(); }
});
document.querySelector('#views').addEventListener('change', event => {
  const key = event.target.dataset.action;
  if (key === 'phase') { activeView.state.phase = event.target.value; activeView.state.page = 0; activeView.state.full = false; activeView.ready = false; navigate(); }
  if (['sort','scope'].includes(key)) { activeView.state[key] = event.target.value; activeView.state.page = 0; updateActiveList(); }
});
document.querySelector('#views').addEventListener('click', async event => {
  const button = event.target.closest('button');
  if (!button) return;
  const action = button.dataset.action;
  if (button.dataset.category) { activeView.state.category = button.dataset.category; activeView.state.page = 0; updateActiveList(); }
  if (action === 'previous' || action === 'next') {
    const view = activeView;
    button.disabled = true;
    try {
      if (view.kind === 'leaderboard') await detailViews.loadFullLeaderboard(view);
      if (view !== activeView) return;
      view.state.page += action === 'next' ? 1 : -1;
      updateActiveList();
      view.node.querySelector('.pagination button:not(:disabled)')?.focus({preventScroll:true});
    } catch (error) { showNotice(error.message); button.disabled = false; }
  }
  if (action === 'reset') { Object.assign(activeView.state, {query:'',category:'All',page:0}); activeView.node.querySelector('input').value = ''; updateActiveList(); }
  if (action === 'copy-wallet') { try { await navigator.clipboard.writeText(activeView.data.wallet.address); button.textContent = 'Address copied'; } catch { button.textContent = 'Select the address above to copy'; } }
  if (action === 'retry') await navigate();
  if (action === 'more-entries') {
    const view = activeView;
    button.disabled = true;
    try {
      const page = await cachedGet(`/competitions/${encodeURIComponent(view.data.slug)}/submissions?limit=6&cursor=${encodeURIComponent(view.entries.next_cursor)}`);
      view.node.querySelector('.entry-list').insertAdjacentHTML('beforeend', page.items.map(detailViews.entryMarkup).join(''));
      view.entries = { ...view.entries, items:[...view.entries.items,...page.items], next_cursor:page.next_cursor };
      if (!page.next_cursor) button.hidden = true;
    } catch { button.textContent = 'Could not load entries. Try again'; }
    finally { button.disabled = false; }
  }
});
document.querySelector('.builder-search').addEventListener('submit', event => { event.preventDefault(); const handle = event.target.elements.handle.value.trim().replace(/^@/, ''); if (handle) location.hash = profileRoute(handle); });
document.querySelector('#refresh').addEventListener('click', async event => { refreshing = true; staleResponse = false; event.currentTarget.disabled = true; try { await navigate(); } finally { refreshing = false; document.querySelector('#refresh').disabled = false; } });
function showNotice(message) { const notice = document.querySelector('#notice'); notice.textContent = message; notice.hidden = false; }
function refreshTimes(view) {
  view.node.querySelectorAll('[data-time]').forEach(element => { element.textContent = remaining(element.dataset.time); });
  view.node.querySelectorAll('[data-deadline]').forEach(element => {
    if (Date.parse(element.dataset.deadline) <= Date.now() && element.textContent !== 'Resolved') { element.textContent = 'Entries closed'; element.classList.remove('open','upcoming'); element.classList.add('closed'); }
  });
}
setInterval(() => {
  if (document.hidden) return;
  if (activeView?.ready) refreshTimes(activeView);
  if (activeView?.kind === 'board' && activeView.ready && activeView.items.some(item => entryState(item) !== item._lastState)) {
    activeView.items.forEach(item => { item._lastState = entryState(item); }); updateBoard(activeView);
  }
}, 60000);
document.addEventListener('error', event => { if (event.target instanceof HTMLImageElement) { const avatar = event.target.closest('[data-initials]'); if (avatar) avatar.textContent = avatar.dataset.initials; } }, true);
addEventListener('hashchange', navigate);
navigate();

/* recorded rewrite */
/* recorded rewrite 2 */
/* recorded rewrite 3 */

import { API_ORIGIN, cachedGet, escapeText, dollars, count, potAmount, bountyRoute, profileRoute, dateLabel, entryState, statusBadge, timeMarkup, categoryMarkup, pagination } from './main.js';

await new Promise((resolve, reject) => {
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = new URL('./detail.css', import.meta.url).href;
  stylesheet.onload = resolve;
  stylesheet.onerror = () => reject(new Error('The detail styles could not be loaded. Please refresh.'));
  document.head.append(stylesheet);
});

export async function profileView(view, handle) {
  const profile = await cachedGet(`/profiles/${encodeURIComponent(handle)}`);
  if (view.ready && view.data === profile) return;
  view.data = profile;
  view.state ||= {page:0};
  const record = profile.record || {};
  const links = [profile.github_login && ['GitHub','https://github.com/'+encodeURIComponent(profile.github_login)],profile.x?.url && ['X',profile.x.url],profile.discord?.url && ['Discord',profile.discord.url]].filter(Boolean);
  view.node.innerHTML = `<div class="breadcrumb"><a href="#/">Bounty board</a><span>/</span><span>Builder profile</span></div><div class="profile-heading">${avatarMarkup(profile.handle,profile.avatar?.url || profile.image,true)}<div><span class="eyebrow">MEET THE BUILDER</span><h1>${escapeText(profile.display_name || profile.handle)}</h1><p>@${escapeText(profile.handle)}${profile.joined_at ? ' · Joined ' + new Date(profile.joined_at).toLocaleDateString('en-GB',{month:'short',year:'numeric',timeZone:'UTC'}) : ''}</p></div></div>${profile.bio ? `<div class="prose profile-bio">${markdown(profile.bio)}</div>` : ''}<div class="score-strip"><div><small>BOUNTIES ENTERED</small><strong>${count(record.competitions_entered)}</strong></div><div><small>BOUNTIES WON</small><strong>${count(record.competitions_won)}</strong></div><div><small>PLACEMENTS</small><strong>${count(record.competitions_placed)}</strong></div><div><small>PRIZE MONEY PAID</small><strong>${dollars(record.prize_usd)}</strong></div></div><div class="detail-grid profile-grid"><div><div class="panel-title"><h2>Entries & results</h2><span>${count(profile.solutions?.length)} public entries</span></div><div class="profile-table-slot"></div><div class="pagination"></div></div><aside><section class="panel"><div class="panel-title"><h2>Public wallet</h2><span>Solana</span></div>${profile.wallet?.address ? `<code class="wallet">${escapeText(profile.wallet.address)}</code>${safeURL(profile.wallet.explorer_url) ? `<a class="button" target="_blank" rel="noopener" href="${escapeText(safeURL(profile.wallet.explorer_url))}">View on explorer ↗</a>` : ''}<button class="button" data-action="copy-wallet">Copy address</button>` : '<p class="muted wallet">No wallet shared publicly.</p>'}</section><section class="panel"><div class="panel-title"><h2>The track record</h2></div><div class="fact"><span>Podium finishes</span><strong>${count(record.podium_finishes)}</strong></div><div class="fact"><span>Other placements</span><strong>${count(record.other_placements)}</strong></div><div class="fact"><span>Best place</span><strong>${record.best_placement ? '#' + record.best_placement : 'Pending'}</strong></div><p class="reward-note">Places count once a bounty is resolved.</p>${links.length ? `<div class="profile-links">${links.map(([title,url]) => `<a href="${escapeText(safeURL(url))}" target="_blank" rel="noopener">${title} ↗</a>`).join('')}</div>` : ''}</section></aside></div>`;
  updateProfile(view);
}
export function updateProfile(view) {
  const solutions = view.data.solutions || [];
  const pager = pagination(view,solutions.length,10);
  view.node.querySelector('.profile-table-slot').innerHTML = `<div class="table-scroll"><table class="profile-table"><caption class="sr-only">Public entries by ${escapeText(view.data.handle)}</caption><thead><tr><th scope="col">Bounty / Entry</th><th scope="col" class="num">Score</th><th scope="col" class="num">Place</th><th scope="col" class="num">Prize</th></tr></thead><tbody>${solutions.slice(view.state.page*10,(view.state.page+1)*10).map(solution => `<tr><td><a href="${bountyRoute(solution.competition.slug)}/leaderboard">${escapeText(solution.competition.title)}</a><span class="entry-title" title="${escapeText(solution.title)}">${escapeText(solution.title)}</span></td><td class="num">${solution.score ? metricValue(solution.score.column,{values:{[solution.score.column.key]:solution.score.value},display:{[solution.score.column.key]:solution.score.display}}) : 'Pending'}</td><td class="num">${solution.placement ? '#' + solution.placement : '—'}</td><td class="num">${solution.prize_usd == null ? '—' : dollars(solution.prize_usd)}</td></tr>`).join('') || '<tr><td colspan="4"><div class="empty"><h2>A clean slate.</h2><p>No public entries yet.</p><a class="button" href="#/">Explore the bounties</a></div></td></tr>'}</tbody></table></div>`;
  view.node.querySelector('.pagination').innerHTML = pager;
}

export async function leaderboardView(view, slug) {
  view.state ||= {page:0,query:'',phase:'',full:false};
  const phase = view.state.phase ? '&phase=' + view.state.phase : '';
  const [bounty, leaderboard] = await Promise.all([
    cachedGet(`/competitions/${encodeURIComponent(slug)}?submissions=summary`),
    cachedGet(`/competitions/${encodeURIComponent(slug)}/leaderboard?rows=${view.state.full ? 'all' : 'first'}&ties=runs${phase}`)
  ]);
  if (view.ready && view.data === bounty && view.leaderboard === leaderboard) return;
  view.data = bounty;
  view.leaderboard = leaderboard;
  view.state.phase = leaderboard.phase.key;
  const total = leaderboard.entries.length + (leaderboard.rest?.length || 0);
  const best = leaderboard.entries.find(entry => !entry.house && !entry.baseline);
  const rankColumn = leaderboard.columns.find(column => column.key === leaderboard.rank_key);
  view.node.innerHTML = `<div class="breadcrumb"><a href="#/">Bounty board</a><span>/</span><a href="${bountyRoute(slug)}">${escapeText(bounty.title)}</a></div><div class="page-heading"><div><span class="eyebrow">THE WORK SPEAKS FOR ITSELF.</span><h1>Leaderboard</h1><p>${escapeText(bounty.title)}</p></div>${statusBadge(bounty)}</div><div class="score-strip"><div><small>LIVE REWARD POT</small><strong>${dollars(potAmount(bounty))}</strong></div><div><small>RANKED ENTRIES</small><strong>${count(total)}</strong></div><div><small>${escapeText(rankColumn?.title || 'Leading score').toUpperCase()}</small><strong>${best ? metricValue(rankColumn || {key:leaderboard.rank_key}, best) : 'Pending'}</strong></div><div><small>ENTRY DEADLINE</small><strong class="deadline-stat">${timeMarkup(bounty)}</strong></div></div><nav class="tabs" aria-label="Bounty navigation"><a href="${bountyRoute(slug)}">Overview</a><a href="${bountyRoute(slug)}/leaderboard" aria-current="page">Leaderboard</a></nav><div class="leader-notice"><p>${leaderboard.phase.finalized_at ? 'Final results' : 'Provisional standings'} · Ranked by ${escapeText(rankColumn?.title || leaderboard.rank_key)}${leaderboard.phase.placements_held ? '. Prize places become official when results publish.' : ''}</p><select class="chip" data-action="phase" aria-label="Leaderboard phase"><option value="dev" ${view.state.phase === 'dev' ? 'selected' : ''}>Development</option><option value="final" ${view.state.phase === 'final' ? 'selected' : ''}>Final results</option></select></div><label class="search-box leader-search"><span aria-hidden="true">⌕</span><input type="search" data-action="leader-search" placeholder="Find a builder or entry…" aria-label="Search leaderboard" value="${escapeText(view.state.query)}"></label><div class="leader-table-slot"></div><div class="pagination"></div>`;
  updateLeaderboard(view);
}
export function metricValue(column, entry) {
  const value = entry.values?.[column.key];
  const display = entry.display?.[column.key] ?? value;
  if (display === undefined || display === null || display === '') return '—';
  const number = Number(value ?? display);
  if (/^judge(?:_low|_high)?$/.test(column.key) || /win_rate_micro|interval_(?:low|high)_micro/.test(column.source || '')) return Number.isFinite(number) ? (number / 10000).toFixed(4) + '%' : escapeText(display);
  if (column.key === 'bytes') return Number.isFinite(number) ? (number / 1024).toFixed(1) + ' KiB' : '—';
  if (/elo/i.test(column.key + ' ' + column.title)) return Number.isFinite(number) ? number.toLocaleString('en-US', {maximumFractionDigits:2}) + ' Elo' : escapeText(display);
  return Number.isFinite(Number(display)) ? Number(display).toLocaleString('en-US', { maximumFractionDigits:Math.min(6,column.precision ?? 3) }) : escapeText(display);
}
export function updateLeaderboard(view) {
  const leaderboard = view.leaderboard;
  const columns = (leaderboard.columns || []).filter(column => !column.hidden);
  const entries = leaderboard.entries.filter(entry => `${entry.handle} ${entry.title}`.toLowerCase().includes(view.state.query.toLowerCase()));
  const total = view.state.query ? entries.length : entries.length + (leaderboard.rest?.length || 0);
  const pager = pagination(view,total,10);
  const rows = entries.slice(view.state.page * 10, (view.state.page + 1) * 10);
  view.node.querySelector('.leader-table-slot').innerHTML = `<div class="table-scroll"><table class="leaderboard-table"><caption class="sr-only">${escapeText(leaderboard.phase.title)} leaderboard for ${escapeText(view.data.title)}</caption><thead><tr><th scope="col">Rank</th><th scope="col">Builder / Entry</th>${columns.map(column => `<th scope="col" class="num">${escapeText(column.title)}</th>`).join('')}</tr></thead><tbody>${rows.map(entry => `<tr><td class="rank ${entry.rank <= 3 ? 'top' : ''}">${entry.rank ? String(entry.rank).padStart(2,'0') : '—'}</td><td><div class="builder-cell">${avatarMarkup(entry.handle,entry.image)}<div><a href="${profileRoute(entry.handle)}">@${escapeText(entry.handle)}</a>${entry.house || entry.baseline ? ' <span class="badge">House</span>' : ''}<span class="entry-title" title="${escapeText(entry.title)}">${escapeText(entry.title)}</span></div></div></td>${columns.map(column => `<td class="num ${column.key === leaderboard.rank_key ? 'metric-rate' : ''}">${metricValue(column,entry)}${column.key === 'judge' && entry.values?.judge != null ? `<div class="rate-track" aria-hidden="true"><span style="width:${Math.max(0,Math.min(100,Number(entry.values.judge)/10000))}%"></span></div>` : ''}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${columns.length + 2}"><div class="empty"><h2>${view.state.query ? 'No matching entries.' : 'Results are still ahead.'}</h2><p>${view.state.query ? 'Try a different handle or entry title.' : leaderboard.phase.scores_visible ? 'No scored entries in this phase yet. The overview lists the latest submissions.' : 'Scores for this phase have not been published yet. Visit the overview to see the entries.'}</p><a class="button" href="${bountyRoute(view.data.slug)}">View bounty & entries</a></div></td></tr>`}</tbody></table></div>`;
  view.node.querySelector('.pagination').innerHTML = pager;
}
export async function loadFullLeaderboard(view) {
  if (!view.leaderboard.rest?.length) return;
  const full = await cachedGet(`/competitions/${encodeURIComponent(view.data.slug)}/leaderboard?rows=all&ties=runs&phase=${view.state.phase}`);
  view.leaderboard = full;
  view.state.full = true;
}

export async function bountyView(view, slug) {
  const [bounty, entries] = await Promise.all([
    cachedGet(`/competitions/${encodeURIComponent(slug)}?submissions=summary`),
    cachedGet(`/competitions/${encodeURIComponent(slug)}/submissions?limit=6`)
  ]);
  if (view.ready && view.data === bounty && view.entries === entries) return;
  view.data = bounty;
  view.entries = entries;
  view.node.innerHTML = bountyHeader(bounty, 'overview') + `<div class="detail-grid"><div><section class="panel"><div class="panel-title"><h2>The brief</h2><span>${escapeText(bounty.category)} challenge</span></div><div class="prose">${briefMarkup(bounty.description)}</div>${bounty.skills?.length ? `<div class="skills">${bounty.skills.map(skill => `<span>${escapeText(skill)}</span>`).join('')}</div>` : ''}</section><section class="panel"><div class="panel-title"><h2>Latest entries</h2><a href="${bountyRoute(slug)}/leaderboard">See the rankings ↗</a></div><div class="entry-list">${entries.items.map(entry => entryMarkup(entry)).join('') || '<p class="muted">The first entry could be yours.</p>'}</div>${entries.next_cursor ? '<button class="button" data-action="more-entries">Load older entries ↓</button>' : ''}</section><section class="panel"><div class="panel-title"><h2>Rules & judging</h2></div><div class="prose">${bounty.resolution?.summary ? `<p>${escapeText(bounty.resolution.summary)}</p>` : ''}${rulesMarkup(bounty.rules)}${bounty.rulesNote?.text ? `<p>${escapeText(bounty.rulesNote.text)}</p>` : ''}</div></section></div><aside><section class="panel pot-panel"><span class="eyebrow">LIVE REWARD POT</span><div class="pot">${dollars(potAmount(bounty))}</div><p>USDC · ${count((bounty.rewardsNow || []).length)} rewarded places</p><div class="pot-breakdown"><div class="fact"><span>Base reward</span><strong>${dollars(bounty.rewardAmount)}</strong></div><div class="fact"><span>Entry fees added</span><strong>+ ${dollars(bounty.entryFeesUsd)}</strong></div><div class="fact"><span>Entry fee</span><strong>${Number(bounty.entryFeeUsd) ? dollars(bounty.entryFeeUsd) + ' / account' : 'Free entry'}</strong></div></div></section><section class="panel rewards"><div class="panel-title"><h2>Rewards right now</h2><span>USDC</span></div>${rewardsMarkup(bounty)}<p class="reward-note">Entry fees grow the pot. Shares follow the bounty’s payout rules.</p></section><section class="panel"><div class="panel-title"><h2>The timeline</h2></div><dl class="facts"><dt>Entries open</dt><dd>${dateLabel(bounty.opensAt || bounty.publishedAt)}</dd><dt>Entry deadline</dt><dd><strong>${dateLabel(bounty.deadline)}</strong><br>${timeMarkup(bounty)}</dd>${bounty.resolvedAt ? `<dt>Results published</dt><dd>${dateLabel(bounty.resolvedAt)}</dd>` : ''}<dt>Sponsor</dt><dd>${escapeText(bounty.sponsor?.name || 'make.fun')}</dd></dl></section></aside></div>`;
}
function bountyHeader(bounty, tab) {
  return `<div class="breadcrumb"><a href="#/">Bounty board</a><span>/</span><span>${escapeText(bounty.category)}</span></div><div class="bounty-heading"><div>${categoryMarkup(bounty.category)}<h1>${escapeText(bounty.title)}</h1></div>${statusBadge(bounty)}</div><p class="bounty-summary">${escapeText(bounty.summary)}</p><div class="bounty-dates"><span>◷ &nbsp;${timeMarkup(bounty)} <span class="muted">· ${dateLabel(bounty.deadline)}</span></span><span>${count(bounty.submissionCount)} entries</span></div><nav class="tabs" aria-label="Bounty navigation"><a href="${bountyRoute(bounty.slug)}" ${tab === 'overview' ? 'aria-current="page"' : ''}>Overview</a><a href="${bountyRoute(bounty.slug)}/leaderboard" ${tab === 'leaderboard' ? 'aria-current="page"' : ''}>Leaderboard ↗</a></nav>`;
}
function safeURL(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  try { const url = new URL(value, API_ORIGIN); return ['https:','http:'].includes(url.protocol) ? url.href : ''; } catch { return ''; }
}
function avatarMarkup(handle, source, large = false) {
  const url = safeURL(source || '');
  return `<span class="avatar" aria-hidden="true" data-initials="${escapeText(String(handle || '?').slice(0,2).toUpperCase())}">${source && url ? `<img crossorigin="anonymous" src="${escapeText(url)}" alt="" loading="lazy" decoding="async" width="${large ? 78 : 30}" height="${large ? 78 : 30}">` : escapeText(String(handle || '?').slice(0,2).toUpperCase())}</span>`;
}
export function entryMarkup(entry) {
  return `<div class="entry-row">${avatarMarkup(entry.handle, entry.image)}<div><a href="${profileRoute(entry.handle)}">@${escapeText(entry.handle)}</a><p title="${escapeText(entry.title)}">${escapeText(entry.title)}</p></div><span class="badge">${escapeText(entry.status === 'running' ? entry.grade_stage || 'Grading' : entry.status)}</span></div>`;
}
function inlineMarkdown(value) {
  return escapeText(value).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\[([^\]]+)\]\(([^\s)]+)\)/g, (_, title, href) => {
    const url = safeURL(href);
    return url ? `<a href="${escapeText(url)}" target="_blank" rel="noopener">${title} ↗</a>` : title;
  });
}
function markdown(value) {
  let output = '', paragraph = [], list = '', code = null;
  const flush = () => { if (paragraph.length) { output += `<p>${inlineMarkdown(paragraph.join(' '))}</p>`; paragraph = []; } if (list) { output += `</${list}>`; list = ''; } };
  for (const line of String(value || '').split('\n')) {
    if (/^\s*```/.test(line)) { flush(); if (code !== null) { output += `<pre><code>${escapeText(code.join('\n'))}</code></pre>`; code = null; } else code = []; continue; }
    if (code !== null) { code.push(line); continue; }
    const heading = line.match(/^#{1,6}\s+(.+)/), bullet = line.match(/^\s*(?:[-*]|\d+\.)\s+(.+)/);
    if (heading) { flush(); output += `<h3>${inlineMarkdown(heading[1])}</h3>`; }
    else if (bullet) { if (paragraph.length) { output += `<p>${inlineMarkdown(paragraph.join(' '))}</p>`; paragraph = []; } const type = /^\s*\d/.test(line) ? 'ol' : 'ul'; if (list !== type) { if (list) output += `</${list}>`; output += `<${type}>`; list = type; } output += `<li>${inlineMarkdown(bullet[1])}</li>`; }
    else if (!line.trim()) flush();
    else { if (list) { output += `</${list}>`; list = ''; } paragraph.push(line); }
  }
  flush();
  if (code !== null) output += `<pre>${escapeText(code.join('\n'))}</pre>`;
  return output;
}
function briefMarkup(value) {
  const source = String(value || '');
  const firstParagraph = source.split(/\n\s*\n/)[0];
  const cut = firstParagraph.length > 550 ? firstParagraph.lastIndexOf('. ', 550) + 1 : firstParagraph.length;
  const preview = source.slice(0, cut > 80 ? cut : firstParagraph.length);
  return markdown(preview) + (source.length > preview.length ? `<details><summary>Read the full brief</summary>${markdown(source.slice(preview.length))}</details>` : '');
}
function rulesMarkup(value) {
  const parts = String(value || '').split(/\n(?=##\s)/);
  return parts.map((part, index) => {
    const heading = part.match(/^##\s+([^\n]+)/);
    return `<details ${index === 0 ? 'open' : ''}><summary>${escapeText(heading ? heading[1] : 'Competition rules')}</summary>${markdown(heading ? part.slice(heading[0].length) : part)}</details>`;
  }).join('');
}
function rewardsMarkup(bounty) {
  const rewards = bounty.rewardsNow?.length ? bounty.rewardsNow : Object.entries(bounty.rewards || {}).map(([place, amount]) => ({place,baseUsd:amount,amountUsd:amount,feeShareUsd:0}));
  const table = rows => `<table><thead><tr><th scope="col">Place</th><th scope="col" class="num">Base</th><th scope="col" class="num">+ Fees</th><th scope="col" class="num">Payout</th></tr></thead><tbody>${rows.map(row => `<tr><td>${row.place === 1 ? '①' : row.place === 2 ? '②' : row.place === 3 ? '③' : '#' + row.place}</td><td class="num">${dollars(row.baseUsd)}</td><td class="num">${dollars(row.feeShareUsd)}</td><td class="num"><strong>${dollars(row.amountUsd)}</strong></td></tr>`).join('')}</tbody></table>`;
  return rewards.length ? table(rewards.slice(0,3)) + (rewards.length > 3 ? `<details><summary>See all ${rewards.length} rewarded places ↓</summary>${table(rewards.slice(3))}</details>` : '') : '<p class="muted">Payout details have not been published.</p>';
}


/* recorded rewrite */
/* recorded rewrite 2 */
/* recorded rewrite 3 */

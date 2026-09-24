import { update, getState, levelInfo, streak, BADGES, LEVEL_TITLES, xpToReach, AVATARS } from '../store.js';
import { esc, todayISO, addDays, startOfWeek, parseISO, fmtDate, fmtDuration, dateISO } from '../util.js';
import { icon, modal, toast, progressBar, empty } from '../ui.js';
import { ago } from './home.js';

export default {
  title: 'Progress & Badges',
  render(s) {
    const lv = levelInfo(s.xp);
    const st = streak(s);
    const earned = BADGES.filter((b) => s.badges[b.id]).length;
    const totalMin = s.sessions.reduce((a, x) => a + x.minutes, 0);

    // 16-week activity heatmap, Monday-first columns.
    const today = todayISO();
    const first = addDays(startOfWeek(today), -15 * 7);
    const minsByDay = {};
    s.sessions.forEach((x) => (minsByDay[x.date] = (minsByDay[x.date] || 0) + x.minutes));
    const cells = Array.from({ length: 16 * 7 }, (_, i) => addDays(first, i));
    const levelOf = (iso) => {
      const m = minsByDay[iso] || 0;
      if (m === 0) return s.activeDays[iso] ? 1 : 0;
      return m < 20 ? 1 : m < 45 ? 2 : m < 90 ? 3 : 4;
    };

    return `
    <header class="page-head">
      <div><p class="eyebrow">You</p><h1>Progress & Badges</h1><p class="lede">XP comes from finishing work, focused study, and playing study games.</p></div>
      <div class="hero-actions"><button class="btn" data-action="profile">${icon('user', 18)}Edit profile</button></div>
    </header>

    <section class="card level-hero">
      <div class="level-avatar" aria-hidden="true">${s.profile.avatar}<span class="level-num">${lv.level}</span></div>
      <div class="level-main">
        <p class="eyebrow">${esc(s.profile.name || 'Student')}</p>
        <h2>Level ${lv.level} · ${lv.title}</h2>
        ${progressBar(lv.pct, { tone: 'xp', label: 'Progress to next level' })}
        <p class="small muted">${s.xp} XP total · ${lv.need - lv.into} XP to level ${lv.level + 1} (${LEVEL_TITLES[Math.min(lv.level, LEVEL_TITLES.length - 1)]})</p>
      </div>
      <dl class="level-stats">
        <div><dt>Streak</dt><dd>🔥 ${st}</dd></div>
        <div><dt>Studied</dt><dd>${fmtDuration(totalMin)}</dd></div>
        <div><dt>Badges</dt><dd>${earned}/${BADGES.length}</dd></div>
        <div><dt>Cards right</dt><dd>${s.stats.cardsCorrect}</dd></div>
      </dl>
    </section>

    <section class="card card-pad" aria-labelledby="h-heat">
      <div class="card-head"><h2 id="h-heat">Study activity</h2><span class="small muted">Last 16 weeks</span></div>
      <div class="heatmap-wrap">
        <div class="heatmap-days" aria-hidden="true"><span>Mon</span><span></span><span>Wed</span><span></span><span>Fri</span><span></span><span></span></div>
        <div class="heatmap" role="img" aria-label="Study activity heatmap">
          ${cells.map((iso) => `<span class="heat heat-${iso > today ? 'future' : levelOf(iso)}" title="${fmtDate(iso, { weekday: 'short', month: 'short', day: 'numeric' })}: ${fmtDuration(minsByDay[iso] || 0)}"></span>`).join('')}
        </div>
      </div>
      <div class="heat-legend small muted">Less <span class="heat heat-0"></span><span class="heat heat-1"></span><span class="heat heat-2"></span><span class="heat heat-3"></span><span class="heat heat-4"></span> More</div>
    </section>

    <section aria-labelledby="h-badges">
      <div class="section-head"><h2 id="h-badges">Badges</h2><span class="small muted">${earned} of ${BADGES.length} unlocked</span></div>
      <ul class="badge-grid">
        ${BADGES.map((b) => {
          const at = s.badges[b.id];
          return `<li class="card badge-card ${at ? 'is-earned' : 'is-locked'}">
            <span class="badge-medal" aria-hidden="true">${at ? b.emoji : '🔒'}</span>
            <strong>${b.name}</strong>
            <span class="small muted">${b.desc}</span>
            ${at ? `<span class="tiny text-success">Unlocked ${fmtDate(dateISO(new Date(at)))}</span>` : ''}
          </li>`;
        }).join('')}
      </ul>
    </section>

    <div class="dash-grid">
      <section class="card card-pad" aria-labelledby="h-ladder">
        <div class="card-head"><h2 id="h-ladder">Level ladder</h2></div>
        <ol class="ladder">
          ${LEVEL_TITLES.map((t, i) => {
            const l = i + 1;
            const state = l < lv.level ? 'is-past' : l === lv.level ? 'is-current' : '';
            return `<li class="${state}"><span class="ladder-num">${l}</span><span>${t}</span><span class="small muted">${xpToReach(l)} XP</span></li>`;
          }).join('')}
        </ol>
      </section>
      <section class="card card-pad" aria-labelledby="h-xp">
        <div class="card-head"><h2 id="h-xp">XP history</h2></div>
        ${s.xpLog.length ? `<ul class="activity">${s.xpLog.slice(0, 14).map((x) => `
          <li><span class="activity-amt ${x.amount < 0 ? 'is-neg' : ''}">${x.amount > 0 ? '+' : ''}${x.amount}</span><span>${esc(x.reason)}</span><span class="muted small">${ago(x.at)}</span></li>`).join('')}</ul>` : empty({ emoji: '⭐', title: 'No XP yet' })}
        <div class="xp-guide">
          <h3 class="h4">How to earn XP</h3>
          <ul class="small">
            <li>Homework +20 · Quiz +30 · Test +50 · Project +60 · Study block +15</li>
            <li>Finish 2+ days early: +10 bonus</li>
            <li>Every focused minute: +2</li>
            <li>Flashcard recalled: +2 · Games: +10 to +60</li>
            <li>Add a note: +10 (5 per day) · Daily quests: +20 to +30</li>
          </ul>
        </div>
      </section>
    </div>`;
  },
  mount(el) {
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-action=profile]')) openProfile();
    });
  },
};

export function openProfile() {
  const s = getState();
  modal({
    title: 'Your profile',
    body: `<form class="modal-form"><div class="modal-body stack">
      <label class="field"><span class="label">Display name</span><input class="input" name="displayName" maxlength="40" value="${esc(s.profile.name)}" placeholder="What should we call you?"></label>
      <fieldset class="field"><legend class="label">Avatar</legend>
        <div class="emoji-picker emoji-picker-lg">${AVATARS.map((a) => `<label class="emoji-opt"><input type="radio" name="avatar" value="${a}" ${s.profile.avatar === a ? 'checked' : ''}><span>${a}</span></label>`).join('')}</div>
      </fieldset>
    </div><footer class="modal-foot"><button type="button" class="btn" data-close>Cancel</button><button class="btn btn-primary">Save</button></footer></form>`,
    onMount(el, close) {
      el.querySelector('form').addEventListener('submit', (e) => {
        e.preventDefault();
        const f = e.target.elements;
        update((st) => Object.assign(st.profile, { name: f.displayName.value.trim(), avatar: f.avatar.value }));
        toast('Profile saved', { kind: 'success', emoji: s.profile.avatar });
        close();
      });
    },
  });
}

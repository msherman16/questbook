import { levelInfo, streak, QUESTS, claimQuest, minutesOn, subjectById, GETTING_STARTED, claimGettingStarted, update } from '../store.js';
import { esc, todayISO, daysBetween, fmtTime, fmtDate, addDays, startOfWeek, DAYS_LONG, plural, fmtDuration } from '../util.js';
import { icon, empty, progressBar } from '../ui.js';
import { assignmentRow, colorVar, openAssignmentForm, handleTaskAction, typeBadge } from '../components.js';

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};

export default {
  title: 'Home',
  render(s) {
    const today = todayISO();
    const lv = levelInfo(s.xp);
    const st = streak(s);
    const dow = new Date().getDay();
    const classes = s.subjects
      .flatMap((sub) => (sub.meetings || []).filter((m) => +m.day === dow).map((m) => ({ sub, m })))
      .sort((a, b) => a.m.start.localeCompare(b.m.start));
    const open = s.assignments.filter((a) => !a.done).sort((a, b) => a.due.localeCompare(b.due));
    const dueSoon = open.filter((a) => daysBetween(today, a.due) <= 7).slice(0, 6);
    const big = open.filter((a) => ['test', 'quiz', 'project', 'keydate'].includes(a.type) && a.due >= today).slice(0, 4);
    const weekStart = startOfWeek(today);
    const weekMin = s.sessions.filter((x) => x.date >= weekStart).reduce((t, x) => t + x.minutes, 0);
    const doneWeek = s.assignments.filter((a) => a.doneAt && a.doneAt >= weekStart).length;
    const nextBig = big[0];
    const nowMin = new Date().getHours() * 60 + new Date().getMinutes();

    return `
    <header class="page-head hero">
      <div class="hero-avatar" aria-hidden="true">${s.profile.avatar}</div>
      <div>
        <p class="eyebrow">${DAYS_LONG[dow]} · ${fmtDate(today, { month: 'long', day: 'numeric' })}</p>
        <h1>${greeting()}${s.profile.name ? `, ${esc(s.profile.name)}` : ''}</h1>
        <p class="lede">${dueSoon.length ? `${plural(dueSoon.length, 'thing')} due this week` : 'Nothing due this week'}${nextBig ? ` · ${esc(nextBig.title)} in ${plural(daysBetween(today, nextBig.due), 'day')}` : ''}.</p>
      </div>
      <div class="hero-actions">
        <a class="btn btn-primary" href="#/timer">${icon('play', 18)}Start focusing</a>
        <button class="btn" data-action="add">${icon('plus', 18)}Add</button>
      </div>
    </header>

    <section class="stats" aria-label="Your stats">
      <a class="card stat stat-level" href="#/progress">
        <div class="stat-top"><span class="stat-label">Level ${lv.level}</span><span class="stat-icon tone-xp">${icon('star', 18)}</span></div>
        <div class="stat-value">${lv.title}</div>
        ${progressBar(lv.pct, { tone: 'xp', label: 'Progress to next level' })}
        <div class="stat-foot">${lv.into} / ${lv.need} XP to level ${lv.level + 1}</div>
      </a>
      <div class="card stat">
        <div class="stat-top"><span class="stat-label">Streak</span><span class="stat-icon tone-ember">${icon('flame', 18)}</span></div>
        <div class="stat-value">${plural(st, 'day')}</div>
        <div class="stat-foot">${s.activeDays[today] ? 'Today counts ✓' : 'Study today to keep it going'}</div>
      </div>
      <div class="card stat">
        <div class="stat-top"><span class="stat-label">Focus this week</span><span class="stat-icon tone-sea">${icon('timer', 18)}</span></div>
        <div class="stat-value">${fmtDuration(weekMin)}</div>
        <div class="stat-foot">${fmtDuration(minutesOn(s, today))} today</div>
      </div>
      <div class="card stat">
        <div class="stat-top"><span class="stat-label">Finished this week</span><span class="stat-icon tone-moss">${icon('check', 18)}</span></div>
        <div class="stat-value">${plural(doneWeek, 'task')}</div>
        <div class="stat-foot">${open.filter((a) => a.due < today).length || 'None'} overdue</div>
      </div>
    </section>

    ${!s.settings.checklistDismissed && !s.isDemo ? gettingStarted(s) : ''}

    <div class="dash-grid">
      <section class="card card-pad" aria-labelledby="h-due">
        <div class="card-head"><h2 id="h-due">Due soon</h2><a class="link" href="#/assignments">See all</a></div>
        ${dueSoon.length ? `<ul class="task-list">${dueSoon.map((a) => assignmentRow(s, a, { compact: true })).join('')}</ul>`
          : empty({ emoji: '🏝️', title: 'All clear', text: 'Nothing due in the next 7 days.' })}
      </section>

      <section class="card card-pad" aria-labelledby="h-quests">
        <div class="card-head"><h2 id="h-quests">Daily quests</h2><span class="muted small">Resets at midnight</span></div>
        <ul class="quest-list">
          ${QUESTS.map((q) => {
            const p = Math.min(q.target, q.progress(s, today));
            const claimed = s.questClaims[`${today}:${q.id}`];
            const ready = p >= q.target && !claimed;
            return `<li class="quest ${claimed ? 'is-claimed' : ''}">
              <span class="quest-emoji" aria-hidden="true">${q.emoji}</span>
              <div class="quest-main">
                <div class="quest-label">${q.label}</div>
                ${progressBar((p / q.target) * 100, { tone: ready || claimed ? 'success' : 'primary', label: q.label })}
                <div class="small muted">${p} / ${q.target}</div>
              </div>
              ${claimed ? `<span class="xp-tag is-earned">Claimed</span>`
                : `<button class="btn btn-sm ${ready ? 'btn-xp' : ''}" data-action="claim" data-id="${q.id}" ${ready ? '' : 'disabled'}>+${q.xp} XP</button>`}
            </li>`;
          }).join('')}
        </ul>
      </section>

      <section class="card card-pad" aria-labelledby="h-today">
        <div class="card-head"><h2 id="h-today">Today’s classes</h2><a class="link" href="#/schedule">Week view</a></div>
        ${classes.length ? `<ul class="agenda">${classes.map(({ sub, m }) => {
          const now = nowMin >= toM(m.start) && nowMin < toM(m.end);
          const past = nowMin >= toM(m.end);
          return `<li class="agenda-item ${now ? 'is-now' : ''} ${past ? 'is-past' : ''}" style="--c:${colorVar(sub.color)}">
            <span class="agenda-time">${fmtTime(m.start)}<small>${fmtTime(m.end)}</small></span>
            <span class="agenda-bar" aria-hidden="true"></span>
            <span class="agenda-main"><strong>${sub.icon} ${esc(sub.name)}</strong><small>${[sub.room, sub.teacher].filter(Boolean).map(esc).join(' · ')}</small></span>
            ${now ? '<span class="badge badge-now">Now</span>' : ''}
          </li>`;
        }).join('')}</ul>` : empty({ emoji: '🌤️', title: 'No classes today', text: 'A good day to get ahead.' })}
      </section>

      <section class="card card-pad" aria-labelledby="h-key">
        <div class="card-head"><h2 id="h-key">Key dates</h2><a class="link" href="#/assignments/calendar">Calendar</a></div>
        ${big.length ? `<ul class="countdowns">${big.map((a) => {
          const n = daysBetween(today, a.due);
          const sub = subjectById(s, a.subjectId);
          return `<li class="countdown" style="--c:${colorVar(sub?.color)}">
            <span class="countdown-num"><strong>${n}</strong><small>${n === 1 ? 'day' : 'days'}</small></span>
            <span class="countdown-main"><strong>${esc(a.title)}</strong><span class="task-meta">${typeBadge(a.type)}<span class="small muted">${fmtDate(a.due, { weekday: 'short', month: 'short', day: 'numeric' })}</span></span></span>
          </li>`;
        }).join('')}</ul>` : empty({ emoji: '📅', title: 'No key dates yet', text: 'Add tests, projects and events to see countdowns.' })}
      </section>

      <section class="card card-pad span-2" aria-labelledby="h-activity">
        <div class="card-head"><h2 id="h-activity">Recent XP</h2><a class="link" href="#/progress">Progress</a></div>
        ${s.xpLog.length ? `<ul class="activity">${s.xpLog.slice(0, 5).map((x) => `
          <li><span class="activity-amt ${x.amount < 0 ? 'is-neg' : ''}">${x.amount > 0 ? '+' : ''}${x.amount}</span><span>${esc(x.reason)}</span><span class="muted small">${ago(x.at)}</span></li>`).join('')}</ul>`
          : empty({ emoji: '⭐', title: 'No XP yet', text: 'Finish a task or a focus block to start earning.' })}
      </section>
    </div>`;
  },
  mount(el) {
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-action]');
      if (!b) return;
      if (b.dataset.action === 'add') openAssignmentForm();
      else if (b.dataset.action === 'claim') claimQuest(b.dataset.id);
      else if (b.dataset.action === 'claim-start') claimGettingStarted();
      else if (b.dataset.action === 'dismiss-start') update((s) => (s.settings.checklistDismissed = true));
      else handleTaskAction(b.dataset.action, b.dataset.id);
    });
  },
};

const toM = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

export function ago(ts) {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? 'yesterday' : `${d}d ago`;
}

function gettingStarted(s) {
  const done = GETTING_STARTED.filter((g) => g.done(s)).length;
  const all = done === GETTING_STARTED.length;
  return `
  <section class="card card-pad getting-started" aria-labelledby="h-start">
    <div class="card-head">
      <div><h2 id="h-start">Getting started</h2><p class="small muted">${all ? 'All done — claim your bonus!' : `${done} of ${GETTING_STARTED.length} done · finish them all for +50 XP`}</p></div>
      <button class="btn btn-sm btn-ghost" data-action="dismiss-start">Hide</button>
    </div>
    ${progressBar((done / GETTING_STARTED.length) * 100, { tone: all ? 'success' : 'primary', label: 'Getting started progress' })}
    <ul class="start-list">
      ${GETTING_STARTED.map((g) => {
        const ok = g.done(s);
        return `<li class="${ok ? 'is-done' : ''}"><a href="${g.href}">
          <span class="start-check" aria-hidden="true">${ok ? icon('check', 14) : g.emoji}</span>
          <span>${g.label}</span>${ok ? '<span class="sr-only">(done)</span>' : icon('chevronRight', 16)}
        </a></li>`;
      }).join('')}
    </ul>
    ${all ? `<button class="btn btn-xp" data-action="claim-start">${icon('star', 16)}Claim +50 XP</button>` : ''}
  </section>`;
}

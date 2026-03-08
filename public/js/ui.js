// public/js/ui.js — DOM manipulation: screen transitions, card rendering

// ── Screen management ─────────────────────────────────────────────────────────

const screens = {
  idle:      document.getElementById('idle-screen'),
  listening: document.getElementById('listening-screen'),
  thinking:  document.getElementById('thinking-screen'),
  response:  document.getElementById('response-screen'),
};

export function showScreen(name) {
  Object.values(screens).forEach(s => s?.classList.remove('screen--active'));
  screens[name]?.classList.add('screen--active');
}

// ── Status bar ────────────────────────────────────────────────────────────────

const connectionBadge = document.getElementById('connection-badge');
const drivingBadge    = document.getElementById('driving-badge');
const clock           = document.getElementById('clock');

export function setConnectionStatus(connected) {
  if (connected) {
    connectionBadge.className = 'badge badge--connected';
    connectionBadge.innerHTML = '<span class="badge__dot"></span><span class="badge__label">Connected</span>';
  } else {
    connectionBadge.className = 'badge badge--disconnected';
    connectionBadge.innerHTML = '<span class="badge__dot"></span><span class="badge__label">Connecting…</span>';
  }
}

export function setDrivingMode(enabled) {
  drivingBadge.style.display = enabled ? 'flex' : 'none';
}

export function startClock() {
  const update = () => {
    const now = new Date();
    clock.textContent = now.toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', hour12: true,
    });
  };
  update();
  setInterval(update, 10000);
}

// ── Transcript display ────────────────────────────────────────────────────────

const interimEl  = document.getElementById('interim-transcript');
const userQueryEl = document.getElementById('user-query');

export function setInterimTranscript(text) {
  if (interimEl) interimEl.textContent = text;
}

export function setUserQuery(text) {
  if (userQueryEl) userQueryEl.textContent = `"${text}"`;
}

// ── Response display ──────────────────────────────────────────────────────────

const spokenTextEl   = document.getElementById('spoken-text');
const cardContainer  = document.getElementById('card-container');

export function showResponse(spokenText, card) {
  if (spokenTextEl) spokenTextEl.textContent = spokenText || '';
  clearCards();
  if (card) renderCard(card);
  showScreen('response');
}

export function clearCards() {
  if (cardContainer) cardContainer.innerHTML = '';
}

// ── Card rendering ────────────────────────────────────────────────────────────

function renderCard(card) {
  const el = document.createElement('div');
  el.className = 'card';

  const badgeClass = {
    navigation:       'card__badge--nav',
    weather:          'card__badge--wx',
    restaurant_list:  'card__badge--food',
    restaurant_detail:'card__badge--food',
    calendar_list:    'card__badge--cal',
    calendar_new:     'card__badge--cal',
    contact_call:     'card__badge--nav',
    reminder_set:     'card__badge--cal',
    generic:          '',
  }[card.cardType] ?? '';

  const badgeLabel = {
    navigation:       'Navigation',
    weather:          'Weather',
    restaurant_list:  'Nearby',
    restaurant_detail:'Restaurant',
    calendar_list:    'Calendar',
    calendar_new:     'Event Added',
    contact_call:     'Call',
    reminder_set:     'Reminder',
    generic:          '',
  }[card.cardType] ?? '';

  let html = `
    <div class="card__header">
      <div>
        <div class="card__title">${escHtml(card.title)}</div>
        ${card.subtitle ? `<div class="card__subtitle">${escHtml(card.subtitle)}</div>` : ''}
      </div>
      ${badgeLabel ? `<span class="card__badge ${badgeClass}">${badgeLabel}</span>` : ''}
    </div>
  `;

  // List items
  if (card.items?.length) {
    html += '<ul class="card__items">';
    card.items.forEach((item, i) => {
      html += `
        <li class="card__item" data-index="${i}" ${item.value ? `data-value="${escHtml(item.value)}"` : ''}>
          <div>
            <div class="card__item-label">${escHtml(item.label)}</div>
            ${item.sublabel ? `<div class="card__item-sub">${escHtml(item.sublabel)}</div>` : ''}
          </div>
          ${item.value ? `<svg viewBox="0 0 24 24" width="20" height="20" fill="none"><path d="M9 6l6 6-6 6" stroke="var(--accent)" stroke-width="2" stroke-linecap="round"/></svg>` : ''}
        </li>
      `;
    });
    html += '</ul>';
  }

  // Action buttons
  if (card.actions?.length) {
    html += '<div class="card__actions">';
    card.actions.forEach(action => {
      html += `
        <button class="card__action-btn card__action-btn--${action.style}"
                data-action="${escHtml(action.action)}"
                data-deeplink="${card.deeplink ? escHtml(card.deeplink) : ''}">
          ${escHtml(action.label)}
        </button>
      `;
    });
    html += '</div>';
  }

  el.innerHTML = html;

  // Action button handlers
  el.querySelectorAll('.card__action-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      const deeplink = btn.dataset.deeplink;

      if (action === 'open_deeplink' && deeplink) {
        // Try to open as Android intent — Android browser will route to Maps
        window.location.href = deeplink.startsWith('google.navigation:')
          ? `intent:${deeplink}#Intent;scheme=google.navigation;package=com.google.android.apps.maps;end`
          : deeplink;
      }
    });
  });

  // Item tap handlers (for list items with deeplinks)
  el.querySelectorAll('.card__item').forEach(item => {
    item.addEventListener('click', () => {
      const value = item.dataset.value;
      if (value?.startsWith('tel:')) {
        window.location.href = value;
      }
    });
  });

  cardContainer.appendChild(el);

  // Auto-dismiss navigation cards after 15 seconds
  if (card.cardType === 'navigation' && card.expiresIn) {
    setTimeout(() => el.remove(), card.expiresIn);
  }
}

// ── Auth overlay ──────────────────────────────────────────────────────────────

const authOverlay  = document.getElementById('auth-overlay');
const tokenInput   = document.getElementById('token-input');
const tokenSubmit  = document.getElementById('token-submit');

export function showAuthOverlay(onSubmit) {
  authOverlay?.classList.remove('hidden');
  tokenInput?.focus();

  const submit = () => {
    const token = tokenInput?.value.trim();
    if (token) onSubmit(token);
  };

  tokenSubmit?.addEventListener('click', submit);
  tokenInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
}

export function hideAuthOverlay() {
  authOverlay?.classList.add('hidden');
}

// ── Reminder alert ────────────────────────────────────────────────────────────

export function showReminderAlert(message) {
  // Show as a temporary card at the top
  const alertCard = {
    cardType: 'reminder_set',
    title: 'Reminder',
    subtitle: message,
    actions: [{ label: 'Dismiss', action: 'dismiss', style: 'secondary' }],
  };

  showScreen('response');
  if (spokenTextEl) spokenTextEl.textContent = '';
  renderCard(alertCard);

  // Auto-dismiss after 30s
  setTimeout(() => {
    clearCards();
    showScreen('idle');
  }, 30000);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

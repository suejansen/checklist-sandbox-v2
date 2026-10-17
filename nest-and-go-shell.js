/*
 * Nest & Go app shell (shared by index.html and every plan page).
 *
 * Owns: per-plan storage registry, last-location persistence, Start Over / Erase All Data,
 * the Home + plan-management (…) top bar, and the shared confirmation dialog.
 *
 * Data safety rules:
 * - Never call localStorage.clear(). Only keys that belong to a plan are ever removed.
 * - Purchase entitlement keys (development-prototype-*) and Downsizing free-use state are never removed.
 *   Those are temporary prototype scaffolding and will be replaced by verified App Store entitlements.
 * - Plan data is keyed by stable task/area IDs and is never pruned when setup answers change,
 *   so hidden tasks get their completion and notes back if they become relevant again.
 */
(() => {
	'use strict';

	const APP_VERSION = '1.0.0';
	const locationKeyFor = (planId) => `nest-go-location-${planId}`;

	// Any key starting with a plan's prefix is that plan's user data (setup, progress, notes, areas, ...),
	// so content added in future updates is covered without changes here.
	const plans = {
		'moving-house': {
			name: 'Moving House',
			prefix: 'moving-house-',
			clearedSummary: 'your setup answers, task progress and notes',
			hasActivity: () => localStorage.getItem('moving-house-setup') !== null
		},
		'bringing-home-a-dog': {
			name: 'Bringing Home a Dog',
			prefix: 'bringing-home-a-dog-',
			clearedSummary: 'your setup answers, task progress and notes',
			hasActivity: () => localStorage.getItem('bringing-home-a-dog-setup') !== null
		},
		'downsizing-decluttering': {
			name: 'Downsizing & Decluttering',
			prefix: 'downsizing-decluttering-',
			clearedSummary: 'your setup answers, areas, finished areas and Decide Later piles',
			hasActivity: () => {
				try {
					const areas = JSON.parse(localStorage.getItem('downsizing-decluttering-areas') || '[]');
					return Array.isArray(areas) && areas.length > 0;
				} catch (error) {
					return false;
				}
			}
		}
	};

	const isProtectedKey = (key) => key.startsWith('development-prototype-') || /entitlement|free-use/.test(key);

	const listKeys = () => Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index));

	const clearPlanData = (planId) => {
		const plan = plans[planId];
		if (!plan) return;
		listKeys()
			.filter((key) => key && key.startsWith(plan.prefix) && !isProtectedKey(key))
			.forEach((key) => localStorage.removeItem(key));
		localStorage.removeItem(locationKeyFor(planId));
	};

	const eraseAllPlanData = () => Object.keys(plans).forEach(clearPlanData);

	const hasActivity = (planId) => Boolean(plans[planId] && plans[planId].hasActivity());

	const saveLocation = (planId, location) => {
		localStorage.setItem(locationKeyFor(planId), JSON.stringify({ v: 1, ...location }));
	};

	const getLocation = (planId) => {
		try {
			const location = JSON.parse(localStorage.getItem(locationKeyFor(planId)) || 'null');
			return location && typeof location === 'object' && location.v === 1 ? location : null;
		} catch (error) {
			return null;
		}
	};

	const styles = `
		.ng-topbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 22px; }
		.ng-topbar .home-link { margin: 0; min-height: 44px; padding: 0 14px; border: 1px solid var(--line); border-radius: 12px; color: var(--ink); background: var(--panel); }
		.ng-topbar .home-link:hover { background: #fff2ed; }
		.ng-menu-wrap { position: relative; }
		.ng-icon-button, .ng-icon-button:hover { display: inline-grid; place-items: center; width: 44px; min-height: 44px; height: 44px; padding: 0; border: 1px solid var(--line); border-radius: 12px; color: var(--ink); background: var(--panel); box-shadow: none; font-size: 1.3rem; line-height: 1; }
		.ng-icon-button:hover { background: #fff2ed; }
		.ng-menu { position: absolute; right: 0; top: calc(100% + 6px); z-index: 20; display: grid; gap: 2px; width: 210px; max-width: calc(100vw - 40px); padding: 6px; border: 1px solid var(--line); border-radius: 14px; background: var(--panel); box-shadow: var(--shadow); }
		.ng-menu[hidden] { display: none; }
		.ng-menu button { min-height: 48px; padding: 10px 14px; border: 0; border-radius: 10px; color: var(--ink); background: transparent; box-shadow: none; font: inherit; font-size: 0.95rem; font-weight: 600; text-align: left; }
		.ng-menu button:hover { color: var(--ink); background: #fff2ed; }
		.ng-overlay { position: fixed; inset: 0; z-index: 100; display: flex; align-items: center; justify-content: center; padding: 20px; background: rgba(32, 59, 58, 0.4); overflow-y: auto; }
		.ng-dialog { width: min(100%, 420px); max-height: 100%; overflow-y: auto; padding: 22px 20px; border: 1px solid var(--line); border-radius: 18px; color: var(--ink); background: var(--panel); box-shadow: var(--shadow); }
		.ng-dialog h2 { margin: 0 0 10px; font-family: 'Fraunces', Georgia, serif; font-size: 1.5rem; font-weight: 600; line-height: 1.1; }
		.ng-dialog p { margin: 0 0 18px; color: var(--muted); font-size: 0.96rem; line-height: 1.55; }
		.ng-actions { display: grid; gap: 10px; }
		.ng-btn { min-height: 52px; padding: 12px 16px; border: 1px solid transparent; border-radius: 12px; font: inherit; font-size: 1rem; font-weight: 700; cursor: pointer; }
		.ng-btn-primary, .ng-btn-primary:hover { color: #fff; background: var(--accent); box-shadow: 0 8px 16px rgba(189, 78, 53, 0.18); }
		.ng-btn-primary:hover { background: var(--accent-dark); }
		.ng-btn-secondary, .ng-btn-secondary:hover { color: var(--ink); border-color: var(--line); background: var(--panel); box-shadow: none; }
		.ng-btn-secondary:hover { background: #fff2ed; }
		.ng-btn:focus-visible, .ng-icon-button:focus-visible, .ng-menu button:focus-visible { outline: 3px solid rgba(229, 109, 79, 0.35); outline-offset: 3px; }
		.ng-toast { position: fixed; right: 16px; bottom: max(16px, env(safe-area-inset-bottom)); left: 16px; z-index: 101; width: min(calc(100% - 32px), 420px); margin: 0 auto; padding: 13px 16px; border: 1px solid var(--line); border-radius: 13px; color: var(--ink); background: var(--panel); box-shadow: var(--shadow); font-size: 0.9rem; line-height: 1.45; text-align: center; }
		.ng-toast[hidden] { display: none; }
		@media (min-width: 600px) { .ng-actions { grid-template-columns: 1fr 1fr; } }
	`;

	const ensureStyles = () => {
		if (document.querySelector('#nest-go-shell-styles')) return;
		const style = document.createElement('style');
		style.id = 'nest-go-shell-styles';
		style.textContent = styles;
		document.head.append(style);
	};

	const createElement = (tag, className, text) => {
		const element = document.createElement(tag);
		if (className) element.className = className;
		if (text !== undefined) element.textContent = text;
		return element;
	};

	// Resolves true only if the user picks the confirm action. The safe (cancel) action is first, primary and focused.
	const confirmDialog = ({ title, message, confirmLabel, cancelLabel }) => new Promise((resolve) => {
		ensureStyles();
		const previouslyFocused = document.activeElement;
		const overlay = createElement('div', 'ng-overlay');
		const dialog = createElement('div', 'ng-dialog');
		dialog.setAttribute('role', 'alertdialog');
		dialog.setAttribute('aria-modal', 'true');
		const heading = createElement('h2', '', title);
		heading.id = 'ng-dialog-title';
		const body = createElement('p', '', message);
		body.id = 'ng-dialog-message';
		dialog.setAttribute('aria-labelledby', heading.id);
		dialog.setAttribute('aria-describedby', body.id);

		const cancelButton = createElement('button', 'ng-btn ng-btn-primary', cancelLabel);
		cancelButton.type = 'button';
		const confirmButton = createElement('button', 'ng-btn ng-btn-secondary', confirmLabel);
		confirmButton.type = 'button';
		const actions = createElement('div', 'ng-actions');
		actions.append(cancelButton, confirmButton);
		dialog.append(heading, body, actions);
		overlay.append(dialog);

		const close = (result) => {
			document.removeEventListener('keydown', onKeyDown, true);
			overlay.remove();
			if (previouslyFocused && previouslyFocused.focus) previouslyFocused.focus();
			resolve(result);
		};

		const onKeyDown = (event) => {
			if (event.key === 'Escape') {
				event.preventDefault();
				close(false);
			} else if (event.key === 'Tab') {
				const focusable = [cancelButton, confirmButton];
				const index = focusable.indexOf(document.activeElement);
				const nextIndex = event.shiftKey ? (index <= 0 ? focusable.length - 1 : index - 1) : (index === focusable.length - 1 ? 0 : index + 1);
				event.preventDefault();
				focusable[nextIndex].focus();
			}
		};

		cancelButton.addEventListener('click', () => close(false));
		confirmButton.addEventListener('click', () => close(true));
		document.addEventListener('keydown', onKeyDown, true);
		document.body.append(overlay);
		cancelButton.focus();
	});

	let toastTimer;
	const notify = (message) => {
		ensureStyles();
		let toast = document.querySelector('.ng-toast');
		if (!toast) {
			toast = createElement('p', 'ng-toast');
			toast.setAttribute('role', 'status');
			toast.setAttribute('aria-live', 'polite');
			document.body.append(toast);
		}
		toast.textContent = message;
		toast.hidden = false;
		window.clearTimeout(toastTimer);
		toastTimer = window.setTimeout(() => { toast.hidden = true; }, 4000);
	};

	const initPlanShell = ({ planId, onEditSetup }) => {
		const plan = plans[planId];
		const homeLink = document.querySelector('.home-link');
		if (!plan || !homeLink) return;
		ensureStyles();

		const bar = createElement('div', 'ng-topbar');
		homeLink.before(bar);
		bar.append(homeLink);

		const wrap = createElement('div', 'ng-menu-wrap');
		const menuButton = createElement('button', 'ng-icon-button', '…');
		menuButton.type = 'button';
		menuButton.setAttribute('aria-label', `${plan.name} options`);
		menuButton.setAttribute('aria-haspopup', 'menu');
		menuButton.setAttribute('aria-expanded', 'false');

		const menu = createElement('div', 'ng-menu');
		menu.setAttribute('role', 'menu');
		menu.hidden = true;

		const closeMenu = (returnFocus) => {
			menu.hidden = true;
			menuButton.setAttribute('aria-expanded', 'false');
			if (returnFocus) menuButton.focus();
		};

		const addItem = (label, handler) => {
			const item = createElement('button', '', label);
			item.type = 'button';
			item.setAttribute('role', 'menuitem');
			item.addEventListener('click', () => {
				closeMenu(false);
				handler();
			});
			menu.append(item);
		};

		addItem('Edit setup', () => { if (onEditSetup) onEditSetup(); });
		addItem('Start over', async () => {
			const confirmed = await confirmDialog({
				title: 'Start over?',
				message: `This will clear ${plan.clearedSummary} for ${plan.name} only. Your purchases will not be affected.`,
				confirmLabel: 'Start over',
				cancelLabel: 'Cancel'
			});
			if (!confirmed) return;
			clearPlanData(planId);
			window.location.assign(window.location.pathname);
		});

		menuButton.addEventListener('click', () => {
			if (menu.hidden) {
				menu.hidden = false;
				menuButton.setAttribute('aria-expanded', 'true');
				menu.querySelector('button').focus();
			} else {
				closeMenu(true);
			}
		});

		document.addEventListener('click', (event) => {
			if (!menu.hidden && !wrap.contains(event.target)) closeMenu(false);
		});
		menu.addEventListener('keydown', (event) => {
			if (event.key === 'Escape') {
				event.stopPropagation();
				closeMenu(true);
			}
		});

		wrap.append(menuButton, menu);
		bar.append(wrap);
	};

	window.NestGo = {
		version: APP_VERSION,
		plans,
		hasActivity,
		saveLocation,
		getLocation,
		clearPlanData,
		eraseAllPlanData,
		confirmDialog,
		notify,
		initPlanShell
	};
})();

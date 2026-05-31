/* ============================================================
   tanzyOS — a tiny web desktop. Vanilla JS, no dependencies.
   Drives: boot, window manager, dock, spotlight, terminal,
   playground (live feature flags), and a pixel mascot.
   ============================================================ */
(function () {
	"use strict";

	var root = document.documentElement;
	var prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	var isTouch = window.matchMedia("(max-width: 620px)").matches || ("ontouchstart" in window);
	// "phone" = narrow viewport → show the iOS home screen instead of the desktop
	var isPhone = window.matchMedia("(max-width: 620px)").matches;
	if (isTouch) document.body.classList.add("is-mobile");
	if (isPhone) document.body.classList.add("is-phone");

	/* ---------- theme (persisted, respects system) ---------- */
	var stored = localStorage.getItem("theme");
	if (stored) root.setAttribute("data-theme", stored);
	else if (window.matchMedia("(prefers-color-scheme: dark)").matches) root.setAttribute("data-theme", "dark");

	var themeBtn = document.getElementById("theme-toggle");
	function toggleTheme() {
		var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
		root.setAttribute("data-theme", next);
		localStorage.setItem("theme", next);
	}
	if (themeBtn) themeBtn.addEventListener("click", toggleTheme);

	/* ---------- clock (drives both the menu bar and the iOS status bar) ---------- */
	var clock = document.getElementById("clock");
	var iosTime = document.getElementById("ios-time");
	function tickClock() {
		var d = new Date();
		var t = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
		if (clock) clock.textContent = t;
		if (iosTime) iosTime.textContent = t;
	}
	tickClock();
	setInterval(tickClock, 10000);

	/* ============================================================
	   APP REGISTRY
	   ============================================================ */
	var APPS = {
		readme:     { title: "README.txt",   icon: "📄", w: 560, h: 420, color: "#8e8e93" },
		about:      { title: "About Me",      icon: "🙋", w: 600, h: 440, color: "#34c759" },
		thinking:   { title: "How I Think",   icon: "🧠", w: 600, h: 500, color: "#af52de" },
		projects:   { title: "Projects",      icon: "🛠️", w: 640, h: 480, color: "#ff9500" },
		playground: { title: "Playground",    icon: "🎛️", w: 680, h: 520, color: "#1d4aff" },
		terminal:   { title: "Terminal",      icon: "⌨️", w: 600, h: 380, color: "#1c1c1e" },
		contact:    { title: "Contact",       icon: "✉️", w: 460, h: 360, color: "#ff3b30" }
	};

	var surface = document.getElementById("surface");
	var openWins = {};   // appId -> win element
	var zTop = 10;
	var spawnIdx = 0;

	function bringToFront(win) {
		zTop += 1;
		win.style.zIndex = zTop;
		Object.keys(openWins).forEach(function (id) { openWins[id].classList.remove("focused"); });
		win.classList.add("focused");
	}

	function markDock(appId, running) {
		document.querySelectorAll('.dock-item[data-app="' + appId + '"]').forEach(function (d) {
			d.classList.toggle("running", running);
		});
	}

	function openApp(appId) {
		var meta = APPS[appId];
		if (!meta) return;
		if (isPhone) return openPhoneApp(appId);    // iOS-style full-screen sheet
		if (openWins[appId]) {                      // already open → focus / un-minimise
			var existing = openWins[appId];
			existing.classList.remove("min");
			bringToFront(existing);
			focusAppInput(existing, appId);
			return;
		}

		var tpl = document.getElementById("app-" + appId);
		var win = document.createElement("div");
		win.className = "win";
		win.dataset.app = appId;

		var startW = Math.min(meta.w, window.innerWidth - 40);
		var startH = Math.min(meta.h, surface.clientHeight - 40);
		if (!isTouch) {
			win.style.width = startW + "px";
			win.style.height = startH + "px";
			var off = (spawnIdx % 6) * 28;
			win.style.left = Math.max(20, (window.innerWidth - startW) / 2 - 60 + off) + "px";
			win.style.top = Math.max(12, (surface.clientHeight - startH) / 2 - 40 + off) + "px";
			spawnIdx++;
		}

		win.innerHTML =
			'<div class="win-bar">' +
				'<div class="lights">' +
					'<button class="light c" title="close" aria-label="close"></button>' +
					'<button class="light m" title="minimise" aria-label="minimise"></button>' +
					'<button class="light z" title="zoom" aria-label="zoom"></button>' +
				'</div>' +
				'<div class="win-title">' + meta.icon + ' ' + meta.title + '</div>' +
				'<div class="win-spacer"></div>' +
			'</div>' +
			'<div class="win-body"></div>' +
			'<div class="win-resize" aria-hidden="true"></div>';

		win.querySelector(".win-body").appendChild(tpl.content.cloneNode(true));
		surface.appendChild(win);
		openWins[appId] = win;
		markDock(appId, true);
		bringToFront(win);

		/* traffic lights */
		win.querySelector(".light.c").addEventListener("click", function (e) { e.stopPropagation(); closeApp(appId); });
		win.querySelector(".light.m").addEventListener("click", function (e) { e.stopPropagation(); win.classList.add("min"); });
		win.querySelector(".light.z").addEventListener("click", function (e) { e.stopPropagation(); toggleZoom(win); });
		win.addEventListener("mousedown", function () { bringToFront(win); });

		if (!isTouch) {
			makeDraggable(win, win.querySelector(".win-bar"));
			makeResizable(win, win.querySelector(".win-resize"));
		}

		/* per-app wiring */
		if (appId === "playground") wirePlayground(win);
		if (appId === "terminal") wireTerminal(win);
		focusAppInput(win, appId);
	}

	function closeApp(appId) {
		var win = openWins[appId];
		if (!win) return;
		win.remove();
		delete openWins[appId];
		markDock(appId, false);
	}

	function toggleZoom(win) {
		if (isTouch) return;
		if (win.classList.contains("zoom")) {
			win.classList.remove("zoom");
			win.style.left = win._pre.left; win.style.top = win._pre.top;
			win.style.width = win._pre.w; win.style.height = win._pre.h;
		} else {
			win._pre = { left: win.style.left, top: win.style.top, width: win.style.width, height: win.style.height, w: win.style.width, h: win.style.height };
			win.classList.add("zoom");
			win.style.left = "0px"; win.style.top = "0px";
			win.style.width = "100%"; win.style.height = "100%";
		}
	}

	function focusAppInput(win, appId) {
		var sel = appId === "terminal" ? "[data-term-in]" : null;
		if (sel) { var el = win.querySelector(sel); if (el) setTimeout(function () { el.focus(); }, 30); }
	}

	/* ---------- drag & resize ---------- */
	function makeDraggable(win, handle) {
		var sx, sy, ox, oy, drag = false;
		handle.addEventListener("mousedown", function (e) {
			if (e.target.closest(".light")) return;
			if (win.classList.contains("zoom")) return;
			drag = true;
			sx = e.clientX; sy = e.clientY;
			ox = win.offsetLeft; oy = win.offsetTop;
			document.body.style.userSelect = "none";
		});
		window.addEventListener("mousemove", function (e) {
			if (!drag) return;
			var nx = ox + (e.clientX - sx);
			var ny = oy + (e.clientY - sy);
			nx = Math.max(-win.offsetWidth + 80, Math.min(window.innerWidth - 80, nx));
			ny = Math.max(0, Math.min(surface.clientHeight - 36, ny));
			win.style.left = nx + "px"; win.style.top = ny + "px";
		});
		window.addEventListener("mouseup", function () { drag = false; document.body.style.userSelect = ""; });
	}

	function makeResizable(win, handle) {
		var sx, sy, ow, oh, rez = false;
		handle.addEventListener("mousedown", function (e) {
			rez = true; sx = e.clientX; sy = e.clientY;
			ow = win.offsetWidth; oh = win.offsetHeight;
			e.preventDefault(); e.stopPropagation();
			document.body.style.userSelect = "none";
		});
		window.addEventListener("mousemove", function (e) {
			if (!rez) return;
			win.style.width = Math.max(280, ow + (e.clientX - sx)) + "px";
			win.style.height = Math.max(160, oh + (e.clientY - sy)) + "px";
		});
		window.addEventListener("mouseup", function () { rez = false; document.body.style.userSelect = ""; });
	}

	/* ============================================================
	   iOS HOME SCREEN (phones) — build grid + dock, open as sheets
	   ============================================================ */
	// each inner array is one home-screen page (max ~8 per page looks right on a phone)
	var iosPages = [
		["about", "thinking", "projects", "playground", "terminal", "contact", "readme"]
	];
	var iosDock = ["about", "projects", "terminal", "contact"];
	var PER_PAGE = 8;   // if a page array grows past this, it auto-splits

	function makeIcon(appId) {
		var meta = APPS[appId];
		var btn = document.createElement("button");
		btn.className = "ios-icon";
		btn.setAttribute("aria-label", meta.title);
		btn.innerHTML =
			'<span class="ios-icon-tile" style="--tile:' + meta.color + '">' + meta.icon + '</span>' +
			'<span class="ios-icon-label">' + meta.title.replace(".txt", "") + '</span>';
		// remember the tapped tile so the sheet can zoom out of it
		btn.addEventListener("click", function () { openPhoneApp(appId, btn.querySelector(".ios-icon-tile")); });
		return btn;
	}

	function buildPhone() {
		var pagesEl = document.getElementById("ios-pages");
		var dotsEl = document.getElementById("ios-dots");
		var dock = document.getElementById("ios-dock");
		if (!pagesEl || !dock) return;

		// flatten + chunk into pages of PER_PAGE
		var flat = iosPages.reduce(function (a, p) { return a.concat(p); }, []);
		var chunks = [];
		for (var i = 0; i < flat.length; i += PER_PAGE) chunks.push(flat.slice(i, i + PER_PAGE));

		chunks.forEach(function (ids, pi) {
			var page = document.createElement("div");
			page.className = "ios-page";
			ids.forEach(function (id) { page.appendChild(makeIcon(id)); });
			pagesEl.appendChild(page);

			if (dotsEl && chunks.length > 1) {
				var dot = document.createElement("button");
				dot.className = "ios-dot" + (pi === 0 ? " active" : "");
				dot.setAttribute("aria-label", "Page " + (pi + 1));
				dot.addEventListener("click", function () {
					pagesEl.scrollTo({ left: pi * pagesEl.clientWidth, behavior: "smooth" });
				});
				dotsEl.appendChild(dot);
			}
		});

		// keep dots in sync with swipe position
		if (dotsEl && chunks.length > 1) {
			pagesEl.addEventListener("scroll", function () {
				var idx = Math.round(pagesEl.scrollLeft / pagesEl.clientWidth);
				[].forEach.call(dotsEl.children, function (d, i) { d.classList.toggle("active", i === idx); });
			}, { passive: true });
		}

		iosDock.forEach(function (id) { dock.appendChild(makeIcon(id)); });
	}

	var iosSheet = document.getElementById("ios-app");
	var iosBody = document.getElementById("ios-appbody");
	var iosTitle = document.getElementById("ios-apptitle");
	var iosCurrent = null;

	function openPhoneApp(appId, tileEl) {
		var meta = APPS[appId];
		if (!meta || !iosSheet) return;
		iosCurrent = appId;
		iosTitle.textContent = meta.title.replace(".txt", "");   // clean large title, iOS-style
		iosBody.innerHTML = "";
		var tpl = document.getElementById("app-" + appId);
		iosBody.appendChild(tpl.content.cloneNode(true));

		// zoom out of the tapped icon: set transform-origin to its center
		if (tileEl && !prefersReduced) {
			var r = tileEl.getBoundingClientRect();
			iosSheet.style.setProperty("--ox", (r.left + r.width / 2) + "px");
			iosSheet.style.setProperty("--oy", (r.top + r.height / 2) + "px");
		} else {
			iosSheet.style.setProperty("--ox", "50%");
			iosSheet.style.setProperty("--oy", "50%");
		}

		iosSheet.hidden = false;
		iosSheet.classList.remove("closing");
		iosBody.scrollTop = 0;

		if (appId === "playground") wirePlayground(iosBody);
		if (appId === "terminal") wireTerminal(iosBody);
	}

	function closePhoneApp() {
		if (!iosSheet || iosSheet.hidden) return;
		if (prefersReduced) { iosSheet.hidden = true; iosCurrent = null; return; }
		iosSheet.classList.add("closing");
		setTimeout(function () { iosSheet.hidden = true; iosSheet.classList.remove("closing"); iosCurrent = null; }, 230);
	}

	if (isPhone) {
		buildPhone();
		var iosBack = document.getElementById("ios-back");
		var iosHI = document.getElementById("ios-home-indicator");
		if (iosBack) iosBack.addEventListener("click", closePhoneApp);
		if (iosHI) iosHI.addEventListener("click", closePhoneApp);
		// swipe down on the app bar to dismiss, like iOS
		if (iosSheet) {
			var ty0 = null;
			iosSheet.addEventListener("touchstart", function (e) {
				if (iosBody.scrollTop > 4) { ty0 = null; return; }   // let content scroll
				ty0 = e.touches[0].clientY;
			}, { passive: true });
			iosSheet.addEventListener("touchmove", function (e) {
				if (ty0 == null) return;
				var dy = e.touches[0].clientY - ty0;
				if (dy > 6) iosSheet.style.transform = "translateY(" + Math.min(dy, 200) + "px)";
			}, { passive: true });
			iosSheet.addEventListener("touchend", function (e) {
				if (ty0 == null) return;
				var dy = (e.changedTouches[0].clientY - ty0);
				iosSheet.style.transform = "";
				if (dy > 90) closePhoneApp();
				ty0 = null;
			});
		}
	}

	/* ---------- launchers: icons, dock, menu (desktop) ---------- */
	document.querySelectorAll(".dicon[data-app]").forEach(function (ic) {
		var fire = function () { openApp(ic.dataset.app); };
		ic.addEventListener("dblclick", fire);
		ic.addEventListener("click", function () {
			document.querySelectorAll(".dicon").forEach(function (d) { d.classList.remove("sel"); });
			ic.classList.add("sel");
			if (isTouch) fire();                    // single-tap opens on mobile
		});
	});
	document.querySelectorAll(".dock-item[data-app]").forEach(function (d) {
		d.addEventListener("click", function () { openApp(d.dataset.app); });
	});
	document.querySelectorAll(".mb-menu[data-open]").forEach(function (m) {
		m.addEventListener("click", function () { openApp(m.dataset.open); });
	});

	/* ============================================================
	   BOOT SEQUENCE
	   ============================================================ */
	(function boot() {
		var boot = document.getElementById("boot");
		var tip = document.getElementById("boot-tip");
		var skip = document.getElementById("boot-skip");
		if (!boot) return;

		var tips = [
			"mounting /home/tanzy …", "loading product taste …",
			"shipping to learn …", "warming up the terminal …", "almost there …"
		];
		var ti = 0, tiTimer;
		if (tip && !prefersReduced) {
			tiTimer = setInterval(function () { tip.textContent = tips[ti % tips.length]; ti++; }, 360);
		}

		var done = false;
		function finish() {
			if (done) return; done = true;
			clearInterval(tiTimer);
			boot.classList.add("gone");
			setTimeout(function () { boot.style.display = "none"; }, 520);
			if (!isPhone) openApp("readme");         // greet desktop visitors; phones land on the home screen
		}
		if (skip) skip.addEventListener("click", finish);
		setTimeout(finish, prefersReduced ? 200 : 1900);
	})();

	/* ============================================================
	   SPOTLIGHT LAUNCHER (⌘K / Ctrl+K)
	   ============================================================ */
	(function () {
		var backdrop = document.getElementById("launcher");
		if (!backdrop) return;
		var input = document.getElementById("launcher-input");
		var list = document.getElementById("launcher-list");
		var openBtn = document.getElementById("launcher-btn");

		var commands = [
			{ icon: "📄", label: "Open README", hint: "app", run: function () { openApp("readme"); } },
			{ icon: "🙋", label: "About Me", hint: "app", run: function () { openApp("about"); } },
			{ icon: "🧠", label: "How I Think", hint: "app", run: function () { openApp("thinking"); } },
			{ icon: "🛠️", label: "Projects", hint: "app", run: function () { openApp("projects"); } },
			{ icon: "🎛️", label: "Playground — feature flags", hint: "app", run: function () { openApp("playground"); } },
			{ icon: "⌨️", label: "Terminal", hint: "app", run: function () { openApp("terminal"); } },
			{ icon: "✉️", label: "Contact", hint: "app", run: function () { openApp("contact"); } },
			{ icon: "🌗", label: "Toggle dark mode", hint: "action", run: toggleTheme },
			{ icon: "🐾", label: "Wake / sleep the mascot", hint: "action", run: function () { window.__toggleMascot && window.__toggleMascot(); } },
			{ icon: "🎉", label: "Throw confetti", hint: "fun", run: function () { confetti(); } },
			{ icon: "🐙", label: "GitHub", hint: "link", run: function () { window.open("https://github.com/tanzyy96", "_blank", "noopener"); } },
			{ icon: "💼", label: "LinkedIn", hint: "link", run: function () { window.open("https://www.linkedin.com/in/zhi-yang-tan-265815166/", "_blank", "noopener"); } }
		];

		var filtered = commands.slice(), active = 0;

		function draw() {
			list.innerHTML = "";
			filtered.forEach(function (c, i) {
				var li = document.createElement("li");
				if (i === active) li.className = "active";
				li.innerHTML = '<span class="li-ic">' + c.icon + '</span><span>' + c.label + '</span><small>' + c.hint + '</small>';
				li.addEventListener("click", function () { runCmd(c); });
				li.addEventListener("mousemove", function () { active = i; paint(); });
				list.appendChild(li);
			});
		}
		function paint() { [].forEach.call(list.children, function (li, i) { li.className = i === active ? "active" : ""; }); }
		function filt() {
			var q = input.value.toLowerCase().trim();
			filtered = commands.filter(function (c) { return c.label.toLowerCase().indexOf(q) > -1; });
			active = 0; draw();
		}
		function runCmd(c) { close(); c.run(); }
		function openL() { backdrop.hidden = false; input.value = ""; filtered = commands.slice(); active = 0; draw(); setTimeout(function () { input.focus(); }, 20); }
		function close() { backdrop.hidden = true; }
		window.__openLauncher = openL;

		input.addEventListener("input", filt);
		if (openBtn) openBtn.addEventListener("click", function () { backdrop.hidden ? openL() : close(); });
		backdrop.addEventListener("click", function (e) { if (e.target === backdrop) close(); });

		window.addEventListener("keydown", function (e) {
			if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) { e.preventDefault(); backdrop.hidden ? openL() : close(); return; }
			if (backdrop.hidden) return;
			if (e.key === "Escape") close();
			else if (e.key === "ArrowDown") { e.preventDefault(); active = Math.min(filtered.length - 1, active + 1); paint(); ensureVisible(); }
			else if (e.key === "ArrowUp") { e.preventDefault(); active = Math.max(0, active - 1); paint(); ensureVisible(); }
			else if (e.key === "Enter") { e.preventDefault(); if (filtered[active]) runCmd(filtered[active]); }
		});
		function ensureVisible() { var el = list.children[active]; if (el) el.scrollIntoView({ block: "nearest" }); }
	})();

	/* ============================================================
	   PLAYGROUND — live feature flags / fake A/B test
	   (wired per-window since markup lives in a template)
	   ============================================================ */
	function wirePlayground(win) {
		var cta = win.querySelector(".lab-cta");
		if (!cta) return;
		var caption = win.querySelector(".lab-caption");
		var urgency = win.querySelector(".lab-urgency");
		var convEl = win.querySelector(".lab-conv");
		var barEl = win.querySelector(".lab-bar");
		var planEl = win.querySelector(".lab-plan");
		var totEl = win.querySelector(".lab-tot");
		var switches = {};
		win.querySelectorAll(".switch[data-flag]").forEach(function (s) { switches[s.dataset.flag] = s; });

		var base = 3.1;
		var lift = { copy: 0.6, urgency: 1.4, color: -0.3, price: 0.9 };

		function render() {
			var on = Object.keys(switches).filter(function (k) { return switches[k].checked; });
			cta.textContent = switches.copy && switches.copy.checked ? "Get started — it's $0 to try" : "Buy now";
			cta.classList.toggle("is-green", !!(switches.color && switches.color.checked));
			urgency.classList.toggle("show", !!(switches.urgency && switches.urgency.checked));

			if (switches.price && switches.price.checked) { planEl.textContent = "$39"; totEl.textContent = "$42.12"; }
			else { planEl.textContent = "$49"; totEl.textContent = "$52.92"; }

			caption.innerHTML = on.length ? "variant: <b>" + on.join(" + ") + "</b>" : "variant: <b>control</b>";

			var conv = base;
			on.forEach(function (k) { conv += lift[k]; });
			conv = Math.max(0.4, conv);
			convEl.textContent = conv.toFixed(1) + "%";
			barEl.style.width = Math.min(100, conv * 9) + "%";

			cta.classList.remove("pulse"); void cta.offsetWidth; cta.classList.add("pulse");
		}
		Object.keys(switches).forEach(function (k) { switches[k].addEventListener("change", render); });
		cta.addEventListener("click", function () { confetti(); });
		render();
	}

	/* ============================================================
	   TERMINAL — a small but real shell
	   ============================================================ */
	function wireTerminal(win) {
		var term = win.querySelector("[data-term]");
		var out = win.querySelector("[data-term-out]");
		var inp = win.querySelector("[data-term-in]");
		if (!term || !out || !inp) return;
		var history = [], hp = 0;

		function print(html) { var d = document.createElement("div"); d.innerHTML = html; out.appendChild(d); term.scrollTop = term.scrollHeight; }

		var FILES = {
			"about.txt": "Product engineer. Lover of the messy 0->1. Happiest near the user.",
			"contact.txt": "email: tan.zy096@gmail.com\ngithub: github.com/tanzyy96\nlinkedin: /in/zhi-yang-tan-265815166"
		};

		var CMDS = {
			help: function () {
				return '<span class="ac">available commands</span>\n' +
					'  <span class="b2">help</span>      this list\n' +
					'  <span class="b2">about</span>     who am i\n' +
					'  <span class="b2">projects</span>  open the projects window\n' +
					'  <span class="b2">ls</span>        list files\n' +
					'  <span class="b2">cat</span> <i>file</i>  read a file\n' +
					'  <span class="b2">theme</span>     toggle light/dark\n' +
					'  <span class="b2">confetti</span>  🎉\n' +
					'  <span class="b2">social</span>    my links\n' +
					'  <span class="b2">clear</span>     clear the screen';
			},
			about: function () { return APP_ABOUT; },
			whoami: function () { return "tanzy — product engineer"; },
			ls: function () { return Object.keys(FILES).map(function (f) { return '<span class="b2">' + f + '</span>'; }).join("  "); },
			cat: function (a) {
				if (!a) return '<span class="err">usage: cat &lt;file&gt;</span>';
				return FILES[a] ? FILES[a] : '<span class="err">cat: ' + a + ': no such file</span>';
			},
			projects: function () { openApp("projects"); return '<span class="ok">opening Projects…</span>'; },
			theme: function () { toggleTheme(); return '<span class="ok">theme toggled.</span>'; },
			confetti: function () { confetti(); return "🎉"; },
			social: function () {
				return 'github   <a href="https://github.com/tanzyy96" target="_blank" rel="noopener">github.com/tanzyy96</a>\n' +
					'linkedin <a href="https://www.linkedin.com/in/zhi-yang-tan-265815166/" target="_blank" rel="noopener">/in/zhi-yang-tan</a>\n' +
					'email    <a href="mailto:tan.zy096@gmail.com">tan.zy096@gmail.com</a>';
			},
			echo: function (a, rest) { return rest; },
			clear: function () { out.innerHTML = ""; return null; },
			sudo: function () { return '<span class="err">nice try 😉</span>'; }
		};
		var APP_ABOUT = "I'm Tanzy, a product engineer who cares about the whole arc —\nfrom the messy problem to the last pixel. Type <span class=\"b2\">help</span> to explore.";

		function run(raw) {
			var line = raw.trim();
			print('<span class="dim">tanzy@web:~$</span> ' + escapeHtml(raw));
			if (!line) return;
			history.push(line); hp = history.length;
			var parts = line.split(/\s+/);
			var cmd = parts[0].toLowerCase();
			var arg = parts[1];
			var rest = parts.slice(1).join(" ");
			if (CMDS[cmd]) { var r = CMDS[cmd](arg, rest); if (r !== null && r !== undefined) print(r); }
			else print('<span class="err">' + escapeHtml(cmd) + ': command not found</span> — try <span class="b2">help</span>');
		}

		inp.addEventListener("keydown", function (e) {
			if (e.key === "Enter") { run(inp.value); inp.value = ""; }
			else if (e.key === "ArrowUp") { if (hp > 0) { hp--; inp.value = history[hp] || ""; } e.preventDefault(); }
			else if (e.key === "ArrowDown") { if (hp < history.length) { hp++; inp.value = history[hp] || ""; } e.preventDefault(); }
		});
		term.addEventListener("click", function () { inp.focus(); });

		print('<span class="ac">tanzyOS terminal</span> — type <span class="b2">help</span> to begin.');
	}

	function escapeHtml(s) { return s.replace(/[&<>]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]; }); }

	/* ============================================================
	   CONFETTI (used by playground, terminal, launcher, konami)
	   ============================================================ */
	function confetti() {
		if (prefersReduced) return;
		var colors = ["#f25c29", "#1d4aff", "#f9bd2b", "#22c55e", "#ff6b3d"];
		for (var k = 0; k < 90; k++) {
			var p = document.createElement("div");
			var size = 6 + Math.random() * 8;
			p.style.cssText = "position:fixed;z-index:9999;pointer-events:none;top:-20px;border-radius:2px;width:" +
				size + "px;height:" + size + "px;left:" + (Math.random() * 100) + "vw;background:" + colors[k % colors.length] + ";";
			document.body.appendChild(p);
			(function (el) {
				var dur = 1800 + Math.random() * 1600;
				el.animate([
					{ transform: "translate(0,0) rotate(0deg)", opacity: 1 },
					{ transform: "translate(" + (Math.random() * 200 - 100) + "px," + (window.innerHeight + 40) + "px) rotate(" + (Math.random() * 720 - 360) + "deg)", opacity: 1 }
				], { duration: dur, easing: "cubic-bezier(.3,.7,.4,1)" });
				setTimeout(function () { el.remove(); }, dur);
			})(p);
		}
	}

	/* ---------- konami code ---------- */
	var seq = [38, 38, 40, 40, 37, 39, 37, 39, 66, 65], kp = 0;
	window.addEventListener("keydown", function (e) {
		kp = (e.keyCode === seq[kp]) ? kp + 1 : 0;
		if (kp === seq.length) { kp = 0; confetti(); window.__toggleMascot && window.__toggleMascot(); }
	});

	/* ============================================================
	   WALKING MASCOT — original pixel critter on a canvas
	   ============================================================ */
	(function () {
		var canvas = document.getElementById("mascot");
		if (!canvas) return;
		var ctx = canvas.getContext("2d");
		var bubble = document.getElementById("mascot-bubble");
		var btn = document.getElementById("mascot-toggle");
		var P = 6;

		function pal() {
			var dark = root.getAttribute("data-theme") === "dark";
			return { O: "#f25c29", W: "#ffffff", E: "#1d1f27", Y: "#f9bd2b", B: dark ? "#f3f1e9" : "#1d1f27" };
		}
		var FR = [
			["  OOOO  ", " OOOOOO ", "OOWOWOOO", "OOEOEOOO", "OOOOOOOO", "OOOOOOOO", " OO  OO ", " B B B  "],
			["  OOOO  ", " OOOOOO ", "OOWOWOOO", "OOEOEOOO", "OOOOOOOO", "OOOOOOOO", "  OOOO  ", " B B  B "]
		];
		function drawFrame(fi, flip) {
			ctx.clearRect(0, 0, 48, 48);
			var c = pal(), grid = FR[fi];
			ctx.save();
			if (flip) { ctx.translate(48, 0); ctx.scale(-1, 1); }
			for (var y = 0; y < 8; y++) for (var x = 0; x < 8; x++) {
				var ch = grid[y][x];
				if (ch === " ") continue;
				ctx.fillStyle = ch === "O" ? c.O : ch === "W" ? c.W : ch === "E" ? c.E : ch === "Y" ? c.Y : c.B;
				ctx.fillRect(x * P, y * P, P, P);
			}
			ctx.restore();
		}

		var state = { on: false, x: 90, targetX: 90, dir: 1, frame: 0, mode: "walk", t: 0, sleepT: 0 };
		var bottom = 70;          // sit just above the dock
		var mouseX = null;
		window.addEventListener("mousemove", function (e) { mouseX = e.clientX; });

		function say(msg, ms) {
			if (!bubble) return;
			bubble.textContent = msg; bubble.hidden = false;
			bubble.style.left = Math.min(window.innerWidth - 210, state.x) + "px";
			bubble.style.bottom = (bottom + 52) + "px";
			clearTimeout(say._t);
			say._t = setTimeout(function () { bubble.hidden = true; }, ms || 2600);
		}
		var quips = ["product taste, applied 🎨", "ship it, then learn 🚀", "the details matter ✨",
			"talk to your users! 💬", "open the Terminal 👀", "wanna build something? ✉️"];

		var last = 0;
		function step(ts) {
			if (!state.on) return;
			var dt = ts - last; last = ts; state.t += dt;
			if (state.mode === "walk") {
				if (mouseX != null && Math.random() < 0.008) state.targetX = Math.max(20, Math.min(window.innerWidth - 60, mouseX - 24));
				if (Math.abs(state.x - state.targetX) < 4) {
					if (Math.random() < 0.01) { state.mode = "sleep"; state.sleepT = 0; say("zzz… 😴", 1800); }
					else state.targetX = 30 + Math.random() * (window.innerWidth - 90);
				}
				state.dir = state.targetX > state.x ? 1 : -1;
				state.x += state.dir * Math.min(1.2, Math.abs(state.targetX - state.x)) * (dt / 16);
				if (state.t > 140) { state.frame ^= 1; state.t = 0; drawFrame(state.frame, state.dir < 0); }
				canvas.style.left = state.x + "px"; canvas.style.bottom = bottom + "px";
			} else {
				state.sleepT += dt; drawFrame(0, state.dir < 0);
				if (state.sleepT > 2600) { state.mode = "walk"; state.targetX = 30 + Math.random() * (window.innerWidth - 90); }
			}
			requestAnimationFrame(step);
		}

		function start() {
			if (prefersReduced) { canvas.hidden = false; drawFrame(0, false); canvas.style.left = state.x + "px"; canvas.style.bottom = bottom + "px"; state.on = true; btn && btn.classList.add("active"); return; }
			state.on = true; canvas.hidden = false; btn && btn.classList.add("active");
			last = performance.now(); drawFrame(0, false);
			canvas.style.left = state.x + "px"; canvas.style.bottom = bottom + "px";
			say("hi! i'm your guide 🐾", 2600);
			requestAnimationFrame(step);
		}
		function stop() { state.on = false; canvas.hidden = true; if (bubble) bubble.hidden = true; btn && btn.classList.remove("active"); }
		window.__toggleMascot = function () { state.on ? stop() : start(); };
		if (btn) btn.addEventListener("click", window.__toggleMascot);

		var dragging = false, dox = 0;
		canvas.addEventListener("mousedown", function (e) { dragging = true; dox = e.clientX - state.x; e.preventDefault(); });
		window.addEventListener("mousemove", function (e) {
			if (!dragging) return;
			state.x = state.targetX = Math.max(0, Math.min(window.innerWidth - 48, e.clientX - dox));
			canvas.style.left = state.x + "px";
		});
		window.addEventListener("mouseup", function () { dragging = false; });
		canvas.addEventListener("click", function () { say(quips[Math.floor(Math.random() * quips.length)], 2400); });

		new MutationObserver(function () { if (state.on) drawFrame(state.frame, state.dir < 0); })
			.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
	})();

	/* ---------- a hello for the curious ---------- */
	console.log("%c👋 hey, fellow builder — welcome to tanzyOS.", "font-size:15px;font-weight:bold;color:#f25c29;");
	console.log("%cBuilt from scratch, no frameworks. Poking around? Let's talk: tan.zy096@gmail.com", "font-size:12px;color:#1d4aff;");
	console.log("%cTry: ⌘K / Ctrl+K · open the Terminal · ↑↑↓↓←→←→BA", "font-size:12px;color:#54576a;");
})();

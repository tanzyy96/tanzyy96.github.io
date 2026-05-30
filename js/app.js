/* ============================================================
   Tan Zhi Yang — site interactions (vanilla, no deps)
   ============================================================ */
(function () {
	"use strict";

	var root = document.documentElement;
	var prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

	/* ---------- theme toggle (persisted, respects system) ---------- */
	var stored = localStorage.getItem("theme");
	if (stored) {
		root.setAttribute("data-theme", stored);
	} else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
		root.setAttribute("data-theme", "dark");
	}
	var toggle = document.getElementById("theme-toggle");
	if (toggle) {
		toggle.addEventListener("click", function () {
			var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
			root.setAttribute("data-theme", next);
			localStorage.setItem("theme", next);
		});
	}

	/* ---------- nav shadow on scroll ---------- */
	var nav = document.getElementById("nav");
	function onScroll() {
		if (window.scrollY > 8) nav.classList.add("scrolled");
		else nav.classList.remove("scrolled");
	}
	window.addEventListener("scroll", onScroll, { passive: true });
	onScroll();

	/* ---------- reveal on scroll ---------- */
	var reveals = document.querySelectorAll(".reveal");
	if ("IntersectionObserver" in window && !prefersReduced) {
		var io = new IntersectionObserver(function (entries) {
			entries.forEach(function (e) {
				if (e.isIntersecting) {
					e.target.classList.add("in");
					io.unobserve(e.target);
				}
			});
		}, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
		reveals.forEach(function (el) { io.observe(el); });
	} else {
		reveals.forEach(function (el) { el.classList.add("in"); });
	}

	/* ---------- word rotator ---------- */
	var rotator = document.getElementById("rotator");
	if (rotator && !prefersReduced) {
		var words = ["products", "interfaces", "0→1 ideas", "side projects", "delightful details", "the right thing"];
		var i = 0;
		setInterval(function () {
			i = (i + 1) % words.length;
			rotator.style.opacity = "0";
			rotator.style.transition = "opacity .25s";
			setTimeout(function () {
				rotator.textContent = words[i];
				rotator.style.opacity = "1";
			}, 250);
		}, 2400);
	}

	/* ---------- cursor spotlight ---------- */
	var spot = document.getElementById("spotlight");
	if (spot && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
		var sx = 0, sy = 0, cx = 0, cy = 0, raf;
		window.addEventListener("mousemove", function (e) { sx = e.clientX; sy = e.clientY; });
		function loop() {
			cx += (sx - cx) * 0.12;
			cy += (sy - cy) * 0.12;
			spot.style.transform = "translate(" + cx + "px," + cy + "px)";
			raf = requestAnimationFrame(loop);
		}
		loop();
	}

	/* ---------- draggable sticky note ---------- */
	var sticky = document.getElementById("sticky");
	if (sticky) {
		var dragging = false, ox = 0, oy = 0, startX = 0, startY = 0, tx = 0, ty = 0;
		function down(e) {
			dragging = true;
			var p = e.touches ? e.touches[0] : e;
			startX = p.clientX; startY = p.clientY;
			ox = tx; oy = ty;
			sticky.style.transition = "none";
		}
		function move(e) {
			if (!dragging) return;
			var p = e.touches ? e.touches[0] : e;
			tx = ox + (p.clientX - startX);
			ty = oy + (p.clientY - startY);
			sticky.style.transform = "translate(" + tx + "px," + ty + "px) rotate(7deg)";
		}
		function up() { dragging = false; }
		sticky.addEventListener("mousedown", down);
		window.addEventListener("mousemove", move);
		window.addEventListener("mouseup", up);
		sticky.addEventListener("touchstart", down, { passive: true });
		window.addEventListener("touchmove", move, { passive: true });
		window.addEventListener("touchend", up);
	}

	/* ---------- footer year ---------- */
	var yr = document.getElementById("year");
	if (yr) yr.textContent = new Date().getFullYear();

	/* ---------- confetti (button + konami code) ---------- */
	function confetti() {
		var colors = ["#f25c29", "#1d4aff", "#f9bd2b", "#22c55e", "#ff6b3d"];
		var n = 90;
		for (var k = 0; k < n; k++) {
			var p = document.createElement("div");
			var size = 6 + Math.random() * 8;
			p.style.cssText =
				"position:fixed;z-index:9999;pointer-events:none;top:-20px;border-radius:2px;" +
				"width:" + size + "px;height:" + size + "px;" +
				"left:" + (Math.random() * 100) + "vw;" +
				"background:" + colors[k % colors.length] + ";";
			document.body.appendChild(p);
			(function (el) {
				var dur = 1800 + Math.random() * 1600;
				var rot = Math.random() * 720 - 360;
				var drift = (Math.random() * 200 - 100);
				el.animate([
					{ transform: "translate(0,0) rotate(0deg)", opacity: 1 },
					{ transform: "translate(" + drift + "px," + (window.innerHeight + 40) + "px) rotate(" + rot + "deg)", opacity: 1 }
				], { duration: dur, easing: "cubic-bezier(.3,.7,.4,1)" });
				setTimeout(function () { el.remove(); }, dur);
			})(p);
		}
	}
	var cbtn = document.getElementById("confetti-btn");
	if (cbtn) cbtn.addEventListener("click", confetti);

	var seq = [38, 38, 40, 40, 37, 39, 37, 39, 66, 65]; // ↑↑↓↓←→←→ B A
	var pos = 0;
	window.addEventListener("keydown", function (e) {
		pos = (e.keyCode === seq[pos]) ? pos + 1 : 0;
		if (pos === seq.length) {
			pos = 0;
			confetti();
			if (sticky) sticky.querySelector("span").innerHTML = "you found it!<br>nice 🎉";
		}
	});

	/* ---------- a little hello for the curious ---------- */
	console.log(
		"%c👋 hey, fellow builder.",
		"font-size:16px;font-weight:bold;color:#f25c29;"
	);
	console.log(
		"%cPoking around the source? I like you already. Let's talk: tan.zy096@gmail.com",
		"font-size:12px;color:#1d4aff;"
	);
})();

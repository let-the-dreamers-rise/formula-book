// Formula Book site. Motion follows one metaphor: pigment dropping into a bowl and blooming,
// so everything eases in and settles (power3 / sine), never snaps.
(function () {
  "use strict";
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (s, root) { return (root || document).querySelector(s); };
  var $$ = function (s, root) { return Array.prototype.slice.call((root || document).querySelectorAll(s)); };

  function fmt(n) {
    var r = Math.round(n * 10) / 10;
    return String(r);
  }

  // Interactive pieces work without GSAP.
  function compare() {
    var input = $(".cut input");
    var after = $(".pane.after");
    if (!input || !after) return;
    var update = function () { after.style.setProperty("--cut", input.value + "%"); };
    input.addEventListener("input", update);
    update();
  }

  function toy() {
    var input = $("#factor");
    if (!input) return;
    var update = function () {
      var f = Number(input.value);
      var a = 40 * f, b = 10 * f, dev = (a + b) * 1, total = a + b + dev;
      $("#factor-out").textContent = "x" + fmt(f);
      $("#r-5n").textContent = fmt(a) + " g";
      $("#r-63").textContent = fmt(b) + " g";
      $("#r-dev").textContent = fmt(dev) + " g";
      $("#r-total").textContent = fmt(total) + " g";
      $("#r-said").textContent = "“Lena Okafor: " + fmt(a) + " grams 5N, " + fmt(b) + " grams 6.3, with " + fmt(dev) +
        " grams of 20 volume developer. Total " + fmt(total) + " grams.”";
    };
    input.addEventListener("input", update);
    update();
  }

  function setStep(i) {
    $$(".step").forEach(function (el, n) { el.classList.toggle("on", n === i); });
    $$(".frame").forEach(function (el, n) { el.classList.toggle("on", n === i); });
  }

  // Loops pause when offscreen, so only visible motion costs frames.
  function pauseOffscreen() {
    var targets = $$(".tile, .marquee, .foot");
    if (!("IntersectionObserver" in window)) return;
    targets.forEach(function (el) { el.classList.add("paused"); });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { e.target.classList.toggle("paused", !e.isIntersecting); });
    }, { threshold: 0.1 });
    targets.forEach(function (el) { io.observe(el); });
  }

  compare();
  toy();
  pauseOffscreen();

  if (!window.gsap || !window.ScrollTrigger) {
    document.documentElement.classList.remove("js");
    $$(".step").forEach(function (el) { el.classList.add("on"); });
    return;
  }
  var gsap = window.gsap;
  var ST = window.ScrollTrigger;
  gsap.registerPlugin(ST);

  if (reduced) {
    setStep(0);
    $$(".step").forEach(function (el, i) {
      ST.create({ trigger: el, start: "top 60%", onEnter: function () { setStep(i); }, onEnterBack: function () { setStep(i); } });
    });
    return;
  }

  // Scroll-scrubbed reading progress.
  gsap.to(".progress span", { scaleX: 1, ease: "none", scrollTrigger: { start: 0, end: "max", scrub: 0.3 } });

  // Masked word reveals on every headline (text only, built with DOM nodes).
  $$("[data-split]").forEach(function (el) {
    var words = el.textContent.trim().split(/\s+/);
    el.setAttribute("aria-label", el.textContent.trim());
    el.textContent = "";
    words.forEach(function (w, i) {
      var outer = document.createElement("span");
      outer.className = "word";
      outer.setAttribute("aria-hidden", "true");
      var inner = document.createElement("span");
      inner.textContent = w;
      outer.appendChild(inner);
      el.appendChild(outer);
      if (i < words.length - 1) el.appendChild(document.createTextNode(" "));
    });
    gsap.from($$(".word > span", el), {
      yPercent: 110, duration: 0.9, ease: "power3.out", stagger: 0.06,
      scrollTrigger: { trigger: el, start: "top 88%", once: true },
    });
  });

  // Staggered entrances.
  gsap.set("[data-rise]", { opacity: 0, y: 24 });
  ST.batch("[data-rise]", {
    start: "top 90%", once: true,
    onEnter: function (batch) { gsap.to(batch, { opacity: 1, y: 0, duration: 0.8, ease: "power3.out", stagger: 0.08 }); },
  });

  heroBloom(gsap, ST);
  story(gsap, ST);
  counts(gsap, ST);

  // The hero: scattered notes drop into the bowl, the pigment blooms, one clean card settles.
  function heroBloom(gsap, ST) {
    var stage = $(".stage");
    var bowl = $(".bowl");
    var scraps = $$(".scrap");
    var card = $(".hero-card");
    if (!stage || !bowl) return;
    var toBowl = function (axis) {
      return function (i, el) {
        var b = bowl.getBoundingClientRect(), s = el.getBoundingClientRect();
        return axis === "x" ? b.left + b.width / 2 - (s.left + s.width / 2) : b.top + b.height / 2 - (s.top + s.height / 2);
      };
    };
    var tl = gsap.timeline({ repeat: -1, repeatDelay: 0.6, paused: true });
    tl.set(card, { opacity: 0, y: 30 })
      .to(scraps, { x: toBowl("x"), y: toBowl("y"), scale: 0.3, opacity: 0, duration: 1.1, ease: "power3.in", stagger: 0.12 }, 0.8)
      .to(".bloom", { scale: 1.15, opacity: 1, duration: 1.2, ease: "sine.out" }, "-=0.45")
      .to(card, { opacity: 1, y: 0, duration: 0.9, ease: "power3.out" }, "-=0.7")
      .from(".hero-card p", { opacity: 0, x: -10, duration: 0.5, ease: "power3.out", stagger: 0.08 }, "<0.15")
      .to({}, { duration: 2.6 })
      .to(card, { opacity: 0, y: 20, duration: 0.6, ease: "power3.in" })
      .to(".bloom", { scale: 0.2, opacity: 0.25, duration: 0.8, ease: "sine.inOut" }, "<")
      .to(scraps, { x: 0, y: 0, scale: 1, opacity: 1, duration: 0.9, ease: "power3.out", stagger: 0.06 }, "<0.2");
    ST.create({ trigger: stage, start: "top bottom", end: "bottom top", onToggle: function (self) { self.isActive ? tl.play() : tl.pause(); } });
    window.addEventListener("resize", function () { tl.invalidate(); });

    // Cursor-reactive depth: notes float nearer, the card sits deeper.
    var hero = $(".hero");
    if (window.matchMedia("(hover: hover)").matches) {
      hero.addEventListener("pointermove", function (e) {
        var r = hero.getBoundingClientRect();
        var nx = (e.clientX - r.left) / r.width - 0.5, ny = (e.clientY - r.top) / r.height - 0.5;
        gsap.to(".scrap-layer", { x: nx * 26, y: ny * 26, duration: 0.9, ease: "power3.out" });
        gsap.to(".said", { x: nx * -10, duration: 0.9, ease: "power3.out" });
      });
    }
  }

  // Pinned step-by-step stage on wide screens; plain scroll triggers on phones.
  function story(gsap, ST) {
    setStep(0);
    var mm = gsap.matchMedia();
    mm.add("(min-width: 901px)", function () {
      ST.create({
        trigger: ".story", start: "top top", end: "+=2200", pin: true, scrub: 0.5,
        onUpdate: function (self) {
          setStep(Math.min(3, Math.floor(self.progress * 4)));
          gsap.set(".story-line span", { scaleX: self.progress });
        },
      });
    });
    mm.add("(max-width: 900px)", function () {
      $$(".step").forEach(function (el, i) {
        ST.create({ trigger: el, start: "top 65%", end: "bottom 35%", onToggle: function (self) { if (self.isActive) setStep(i); } });
      });
    });
  }

  function counts(gsap, ST) {
    $$(".stats [data-count]").forEach(function (el) {
      var target = Number(el.getAttribute("data-count"));
      var state = { v: 0 };
      el.textContent = "0";
      gsap.to(state, {
        v: target, duration: 1.4, ease: "power2.out",
        scrollTrigger: { trigger: el, start: "top 90%", once: true },
        onUpdate: function () { el.textContent = String(Math.round(state.v)); },
      });
    });
  }
})();

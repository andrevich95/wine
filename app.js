/* ==========================================================================
   Подорож трансформацій — page behaviour
   Plain ES2020, no modules, no dependencies. Loaded with `defer`.
   ========================================================================== */

(function () {
  "use strict";

  /* ------------------------------------------------------------------------
     Checkout — the only form on the page.

     Everything a shop owner has to supply lives here. Nothing below is a
     guess: a price of `null` means "not set yet" and the page says so.

       variants[…].price        unit price in the variant's own `currency`
                                (number, or null = not set yet)
       shipping.countries       [{ code: "PL", label: { UA: "…", EN: "…" } }]
                                empty → delivery country is a free-text field
       shipping.methods         [{ id, label: { UA, EN },
                                   cost: { UAH: 150, EUR: 5 },   // per currency
                                   countries: ["PL"] — omit for everywhere }]
                                empty → "shipping to be confirmed"
       paymentUrl               Stripe Payment Link opened right after the order
                                has been submitted. One link for every edition
                                for now (it is a TEST-mode link).
       orderForm                the Google Form every order is submitted to:
                                its formResponse URL, the entry.<id> of each
                                question, and the exact option text of the two
                                multiple-choice questions.
     ------------------------------------------------------------------------ */
  var CHECKOUT = {
    maxQuantity: 10,
    variants: {
      "physical-UA": { id: "physical-ua", format: "physical", language: "UA", currency: "UAH", price: 1000 },
      "physical-EN": { id: "physical-en", format: "physical", language: "EN", currency: "EUR", price: 35 },
      "ebook-UA": { id: "ebook-ua", format: "ebook", language: "UA", currency: "UAH", price: 800 },
      "ebook-EN": { id: "ebook-en", format: "ebook", language: "EN", currency: "EUR", price: 25 },
    },
    shipping: { countries: [], methods: [] },
    paymentUrl: "https://buy.stripe.com/test_fZucN6f3B1ujbYPdsu2VG00",

    /* Read from the live form (…/viewform) on 2026-10-14. The form has no
       questions for shipping method, price or total, so those are not sent.
       NB: its language option is literally spelled "Uktainian" — Google drops
       any value that doesn't match an option verbatim, so it is reproduced
       here. If the typo is fixed in the form, fix it below too. */
    orderForm: {
      action:
        "https://docs.google.com/forms/d/e/1FAIpQLSc8IWq3CWgAxZwEnPX8pIs2lKtqGttoG-Y3lFVru-TMgRXzTA/formResponse",
      entry: {
        format: "entry.98576471",
        language: "entry.1749631150",
        quantity: "entry.532400014",
        name: "entry.1111998998",
        email: "entry.105707259",
        phone: "entry.1174171599",
        country: "entry.721268897",
        address: "entry.500068369",
        city: "entry.968632309",
        postal: "entry.819539795",
      },
      options: {
        format: { physical: "Physical", ebook: "E-book" },
        language: { UA: "Uktainian", EN: "English" },
      },
    },
  };

  /* ------------------------------------------------------------------------
     Scrolling
     ------------------------------------------------------------------------ */

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function scrollToSection(id) {
    var target = document.getElementById(id);
    if (!target) return;
    target.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }

  /* ------------------------------------------------------------------------
     Nav — scroll state, mobile menu, anchor interception
     ------------------------------------------------------------------------ */

  var nav = document.getElementById("site-nav");
  var navToggle = document.getElementById("nav-toggle");
  var navToggleLabel = document.getElementById("nav-toggle-label");
  var mobileNav = document.getElementById("mobile-navigation");

  var scrolled = false;
  var menuOpen = false;

  function syncNav() {
    /* No full-bleed hero any more, so the bar is always solid. */
    nav.classList.toggle("is-lifted", true);
    nav.classList.toggle("is-open", menuOpen);
    mobileNav.hidden = !menuOpen;
    navToggle.setAttribute("aria-expanded", String(menuOpen));
    var copy = window.CHECKOUT_COPY && window.CHECKOUT_COPY[Lang ? Lang.get() : "UA"];
    navToggleLabel.textContent = copy ? copy[menuOpen ? "navClose" : "navOpen"] : menuOpen ? "Закрити навігацію" : "Відкрити навігацію";
  }

  function onScroll() {
    var next = window.scrollY > 8;
    if (next === scrolled) return;
    scrolled = next;
    syncNav();
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  syncNav();

  navToggle.addEventListener("click", function () {
    menuOpen = !menuOpen;
    syncNav();
  });

  /* Every in-page link carries data-scroll so the menu closes on the way. */
  document.querySelectorAll("[data-scroll]").forEach(function (link) {
    link.addEventListener("click", function (event) {
      event.preventDefault();
      menuOpen = false;
      syncNav();
      scrollToSection(link.dataset.scroll);
    });
  });

  /* ------------------------------------------------------------------------
     Site language — UA / EN. The choice is remembered, and every language-
     aware component listens for "sitelangchange". Only the book preview has
     EN copy so far; the rest of the page is still Ukrainian.
     ------------------------------------------------------------------------ */

  var Lang = (function () {
    var current = "UA";
    try {
      if (window.localStorage.getItem("site-lang") === "EN") current = "EN";
    } catch (error) {
      /* storage blocked — fall back to UA for this visit */
    }

    var buttons = document.querySelectorAll("[data-lang]");

    function sync() {
      buttons.forEach(function (button) {
        button.setAttribute("aria-pressed", String(button.dataset.lang === current));
      });
    }

    function set(next) {
      if (next === current) return;
      current = next;
      try {
        window.localStorage.setItem("site-lang", current);
      } catch (error) {
        /* ignore */
      }
      sync();
      document.dispatchEvent(new CustomEvent("sitelangchange", { detail: current }));
      syncNav();
    }

    buttons.forEach(function (button) {
      button.addEventListener("click", function () {
        set(button.dataset.lang);
      });
    });
    sync();

    return {
      get: function () {
        return current;
      },
    };
  })();

  /* ------------------------------------------------------------------------
     Book reader — click the cover, it swings open onto a two-page spread
     (one page on narrow screens). Text is paginated at runtime: every page is
     measured in an off-screen copy of itself, so page breaks follow the real
     typography and the real page size.

     Break rules: a heading never ends a page (keepNext), paragraphs of three
     lines or fewer are never split, a split leaves at least two lines on both
     sides, and the verse only ever breaks between its lines (two or more on
     each side).

     The reader's place is stored as `pos` — a position in the *text*
     ((block + fraction of its words) / block count) — and mapped back onto
     whatever pagination exists after a resize or a language switch.
     ------------------------------------------------------------------------ */

  var reader = document.getElementById("reader");

  if (reader && window.BOOK_PREVIEW) {
    var rBook = document.getElementById("reader-book");
    var rSpread = document.getElementById("reader-spread");
    var rPageL = document.getElementById("page-l");
    var rPageR = document.getElementById("page-r");
    var rLeaf = document.getElementById("leaf");
    var rLeafFront = document.getElementById("leaf-front");
    var rLeafBack = document.getElementById("leaf-back");
    var rCover = document.getElementById("reader-cover");
    var rHint = document.getElementById("reader-hint");
    var rBar = document.getElementById("reader-bar");
    var rPrev = document.getElementById("reader-prev");
    var rNext = document.getElementById("reader-next");
    var rStatus = document.getElementById("reader-status");
    var rClose = document.getElementById("reader-close");
    var rBuy = document.getElementById("reader-buy");

    /* Page shape = shape of assets/book.png (1060 × 1484), so the cover fits exactly. */
    var PAGE_RATIO = 1060 / 1484;
    var PAGE_RATIO_SINGLE = 1060 / 1484;
    var BODY_W = 0.82; // .bpage__body: 9% inset either side
    var BODY_H = 0.79; // 9% top, 12% bottom
    var OPEN_MS = 1000;
    var TURN_MS = 750;

    var rs = {
      open: false,
      busy: false,
      single: false,
      dims: null,
      pages: [],
      paginatedFor: "",
      spread: 0,
      pos: 0,
    };

    var measure = document.createElement("div");
    measure.className = "page-measure";
    measure.setAttribute("aria-hidden", "true");
    reader.appendChild(measure);

    var fontsReady = (document.fonts && document.fonts.load
      ? Promise.all([
          document.fonts.load('400 1em "EB Garamond"', "Яа Aa"),
          document.fonts.load('600 1em "EB Garamond"', "Яа Aa"),
          document.fonts.load('italic 400 1em "EB Garamond"', "Яа Aa"),
        ])
      : Promise.resolve()
    ).catch(function () {});

    function content() {
      return window.BOOK_PREVIEW[Lang.get()];
    }

    /* --- text preparation ----------------------------------------------- */

    /* Non-breaking spaces only: they bind short Ukrainian words and dashes to
       their neighbours and change nothing visible in the copy itself. */
    function prep(html, lang) {
      html = html.replace(/ ([—–-]) /g, " $1 ");
      if (lang === "uk") {
        var short = /(^|[\s«(])([А-ЩЬЮЯҐЄІЇа-щьюяґєії]{1,2}) (?=\S)/g;
        html = html.replace(short, "$1$2 ").replace(short, "$1$2 ");
      }
      return html;
    }

    function escapeHtml(text) {
      return text.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    }

    function fragHtml(frag) {
      var u = frag.u;
      if (u.type === "verse") {
        return (
          '<div class="bk-verse">' +
          u.words
            .slice(frag.from, frag.to)
            .map(function (line) {
              return "<p>" + escapeHtml(line) + "</p>";
            })
            .join("") +
          "</div>"
        );
      }
      var text = u.words.slice(frag.from, frag.to).join(" ");
      if (u.type === "title") return '<h3 class="bk-title">' + text + "</h3>";
      if (u.type === "closing") return '<p class="bk-closing">' + text + "</p>";
      var cls = "bk-p";
      if (frag.from > 0) cls += " is-cont";
      if (frag.to < u.words.length) cls += " is-cut";
      return '<p class="' + cls + '">' + text + "</p>";
    }

    function listHtml(frags) {
      return '<div class="bk">' + frags.map(fragHtml).join("") + "</div>";
    }

    /* --- pagination ------------------------------------------------------ */

    function paginate(data) {
      var d = rs.dims;
      measure.lang = data.lang;
      measure.style.width = d.pw * BODY_W + "px";
      measure.style.fontSize = d.fs + "px";

      var limit = d.ph * BODY_H;
      var lineHeight = parseFloat(window.getComputedStyle(measure).lineHeight);
      if (!(lineHeight > 0)) lineHeight = d.fs * 1.52;

      function fits(frags) {
        measure.innerHTML = listHtml(frags);
        return measure.offsetHeight <= limit + 0.5;
      }

      function lines(frag) {
        measure.innerHTML = listHtml([frag]);
        return Math.round(measure.offsetHeight / lineHeight);
      }

      var units = data.blocks.map(function (block, i) {
        var unit = { i: i, type: block.type, keepNext: !!block.keepNext };
        unit.words = block.type === "verse" ? block.lines : prep(block.html, data.lang).split(" ");
        return unit;
      });

      function whole(u) {
        return { u: u, from: 0, to: u.words.length };
      }

      function isOpenEnded(frag) {
        return frag.u.keepNext && frag.to === frag.u.words.length;
      }

      /* Largest first half that fits, leaving >= 2 lines on each side (for the
         verse: >= 2 of its lines, so a stanza is never cut to a single line). */
      function bestSplit(frag, cur) {
        var u = frag.u;
        var isVerse = u.type === "verse";
        if (!isVerse && (u.type !== "p" || lines(frag) < 4)) return null;
        if (isVerse && frag.to - frag.from < 4) return null;
        var lo = 1;
        var hi = frag.to - frag.from - 1;
        var best = 0;
        while (lo <= hi) {
          var mid = (lo + hi) >> 1;
          if (fits(cur.concat([{ u: u, from: frag.from, to: frag.from + mid }]))) {
            best = mid;
            lo = mid + 1;
          } else {
            hi = mid - 1;
          }
        }
        while (best > 0) {
          var a = { u: u, from: frag.from, to: frag.from + best };
          var b = { u: u, from: frag.from + best, to: frag.to };
          var aOk = isVerse ? best >= 2 : lines(a) >= 2;
          var bOk = isVerse ? frag.to - frag.from - best >= 2 : lines(b) >= 2;
          if (!aOk) return null;
          if (bOk) return [a, b];
          best -= 1;
        }
        return null;
      }

      var pages = [];
      var cur = [];
      var queue = units.map(whole);

      function endPage() {
        var carry = [];
        while (cur.length > 1 && isOpenEnded(cur[cur.length - 1])) carry.unshift(cur.pop());
        pages.push(cur);
        cur = carry;
      }

      while (queue.length) {
        var frag = queue.shift();
        cur.push(frag);
        if (fits(cur)) continue;
        cur.pop();

        var split = bestSplit(frag, cur);
        if (split) {
          cur.push(split[0]);
          queue.unshift(split[1]);
          endPage();
          continue;
        }
        if (cur.length === 0) {
          cur.push(frag); // taller than a page on its own — nothing better to do
          endPage();
          continue;
        }
        endPage();
        queue.unshift(frag);
      }
      if (cur.length) pages.push(cur);

      measure.innerHTML = "";

      return pages.map(function (frags, index) {
        var first = frags[0];
        var total = first.u.words.length;
        return {
          html: listHtml(frags),
          pos: (first.u.i + first.from / total) / units.length,
          number: index + 1,
        };
      });
    }

    /* --- sizing ---------------------------------------------------------- */

    function computeDims() {
      var host = reader.clientWidth;
      var single = host < 800;
      var maxH = Math.max(420, Math.min(window.innerHeight - (single ? 210 : 150), 780));
      var ratio = single ? PAGE_RATIO_SINGLE : PAGE_RATIO;
      var pw = single
        ? Math.min(host - 24, maxH * ratio, 460)
        : Math.min((host - 48) / 2, maxH * ratio);
      pw = Math.floor(pw);
      return {
        single: single,
        pw: pw,
        ph: Math.round(pw / ratio),
        fs: Math.round(Math.max(15, Math.min(20.5, pw * 0.043)) * 10) / 10,
      };
    }

    function sameDims(a, b) {
      return a && b && a.single === b.single && a.pw === b.pw && a.ph === b.ph && a.fs === b.fs;
    }

    /* --- rendering ------------------------------------------------------- */

    function totalSpreads() {
      var count = rs.pages.length;
      return rs.single ? count : Math.floor(count / 2) + 1;
    }

    function fillPage(el, n) {
      var count = rs.pages.length;
      el.lang = content().lang;
      el.classList.toggle("bpage--endpaper", n === 0);
      el.classList.toggle("bpage--blank", n < 0 || n > count + 1);
      if (n >= 1 && n <= count) {
        el.innerHTML =
          '<div class="bpage__body">' +
          rs.pages[n - 1].html +
          '</div><div class="bpage__num">' +
          n +
          "</div>";
      } else if (n === count + 1) {
        el.innerHTML = '<div class="bpage__end" aria-hidden="true">◆</div>';
      } else {
        el.innerHTML = "";
      }
    }

    /* Page numbers on the left/right of a spread; one-page mode only uses R. */
    function spreadPages(s) {
      return rs.single ? { l: -1, r: s + 1 } : { l: 2 * s, r: 2 * s + 1 };
    }

    function anchorPage(s) {
      if (rs.single) return s + 1;
      return s === 0 ? 1 : 2 * s;
    }

    function renderStatic() {
      var p = spreadPages(rs.spread);
      fillPage(rPageL, p.l);
      fillPage(rPageR, p.r);
      updateControls();
    }

    function updateControls() {
      var ui = content().ui;
      var count = rs.pages.length;
      var p = spreadPages(rs.spread);
      var label;
      if (!rs.single && p.l >= 1 && p.r <= count) {
        label = ui.pagesPlural + " " + p.l + "–" + p.r;
      } else {
        label = ui.pages + " " + anchorPage(rs.spread);
      }
      rStatus.textContent = label + " " + ui.of + " " + count;
      rPrev.disabled = rs.spread <= 0;
      rNext.disabled = rs.spread >= totalSpreads() - 1;
    }

    /* Called only when the reader moves; re-pagination must not touch it, or
       the place would creep backwards on every language switch or resize. */
    function rememberPosition() {
      rs.pos = rs.pages[anchorPage(rs.spread) - 1].pos;
    }

    function applyDims() {
      var d = rs.dims;
      reader.classList.toggle("is-single", d.single);
      reader.style.setProperty("--pw", d.pw + "px");
      reader.style.setProperty("--ph", d.ph + "px");
      reader.style.setProperty("--fs", d.fs + "px");
    }

    /* (Re)paginate and put the reader back where `rs.pos` says they were. */
    function repaginate() {
      var data = content();
      rs.single = rs.dims.single;
      rs.pages = paginate(data);

      var target = 1;
      rs.pages.forEach(function (page) {
        if (page.pos <= rs.pos + 1e-6) target = page.number;
      });
      rs.spread = rs.single ? target - 1 : Math.floor(target / 2);
      rs.spread = Math.max(0, Math.min(rs.spread, totalSpreads() - 1));
      renderStatic();
    }

    function applyLanguage() {
      var ui = content().ui;
      reader.lang = content().lang;
      reader.setAttribute("role", "region");
      reader.setAttribute("aria-label", ui.region);
      rHint.textContent = ui.coverHint;
      rCover.setAttribute("aria-label", ui.coverLabel);
      rPrev.setAttribute("aria-label", ui.prev);
      rNext.setAttribute("aria-label", ui.next);
      rClose.textContent = ui.close;
      rBuy.textContent = ui.buy;
      document.getElementById("fq-lead").textContent = content().quote.lead;
      document.getElementById("fq-strong").textContent = content().quote.strong;
      document.getElementById("nav-buy").textContent = ui.buy;
      if (rs.open) repaginate();
    }

    function relayout() {
      var next = computeDims();
      if (sameDims(next, rs.dims)) return;
      rs.dims = next;
      applyDims();
      if (rs.open && !rs.busy) fontsReady.then(repaginate);
    }

    /* --- open / close ---------------------------------------------------- */

    function reduced() {
      return prefersReducedMotion();
    }

    function openBook() {
      if (rs.open || rs.busy) return;
      rs.busy = true;
      rs.pos = 0;
      fontsReady.then(function () {
        rs.dims = computeDims();
        applyDims();
        repaginate();
        rs.open = true;
        reader.dataset.state = "open";
        rCover.setAttribute("aria-expanded", "true");
        rBar.hidden = false;
        rClose.hidden = false;
        rBook.classList.remove("is-closed");
        window.setTimeout(
          function () {
            rBook.classList.add("is-settled");
            rs.busy = false;
            rNext.focus({ preventScroll: true });
          },
          reduced() ? 0 : OPEN_MS
        );
      });
    }

    function closeBook() {
      if (!rs.open || rs.busy) return;
      rs.busy = true;
      var wait = 0;
      if (rs.spread !== 0) {
        rSpread.classList.add("is-fading");
        wait = reduced() ? 0 : 240;
      }
      window.setTimeout(function () {
        rs.spread = 0;
        rs.pos = 0;
        renderStatic();
        rSpread.classList.remove("is-fading");
        rBook.classList.remove("is-settled");
        void rBook.offsetWidth;
        rBook.classList.add("is-closed");
        rs.open = false;
        reader.dataset.state = "closed";
        rCover.setAttribute("aria-expanded", "false");
        rBar.hidden = true;
        rClose.hidden = true;
        window.setTimeout(
          function () {
            rs.busy = false;
            rCover.focus({ preventScroll: true });
          },
          reduced() ? 0 : OPEN_MS
        );
      }, wait);
    }

    /* --- page turns ------------------------------------------------------ */

    function go(delta) {
      if (!rs.open || rs.busy) return;
      var from = rs.spread;
      var to = Math.max(0, Math.min(from + delta, totalSpreads() - 1));
      if (to === from) return;

      if (reduced()) {
        rs.spread = to;
        rememberPosition();
        renderStatic();
        return;
      }

      rs.busy = true;
      var forward = to > from;
      var a = spreadPages(from);
      var b = spreadPages(to);
      var done;

      rLeaf.hidden = false;
      rLeaf.classList.remove("is-turning");
      rLeaf.classList.toggle("is-back", !forward && !rs.single);
      rLeaf.style.transition = "none";
      rLeaf.style.opacity = "1";

      if (rs.single) {
        if (forward) {
          fillPage(rLeafFront, a.r);
          fillPage(rPageR, b.r);
          rLeaf.style.transform = "rotateY(0deg)";
          done = function () {};
        } else {
          fillPage(rLeafFront, b.r);
          rLeaf.style.transform = "rotateY(-100deg)";
          rLeaf.style.opacity = "0";
          done = function () {
            fillPage(rPageR, b.r);
          };
        }
      } else if (forward) {
        fillPage(rLeafFront, a.r);
        fillPage(rLeafBack, b.l);
        fillPage(rPageR, b.r);
        rLeaf.style.transform = "rotateY(0deg)";
        done = function () {
          fillPage(rPageL, b.l);
        };
      } else {
        fillPage(rLeafFront, a.l);
        fillPage(rLeafBack, b.r);
        fillPage(rPageL, b.l);
        rLeaf.style.transform = "rotateY(0deg)";
        done = function () {
          fillPage(rPageR, b.r);
        };
      }

      void rLeaf.offsetWidth;
      rLeaf.classList.add("is-turning");
      rLeaf.style.transition =
        "transform " + TURN_MS + "ms cubic-bezier(0.5, 0, 0.25, 1), opacity " + TURN_MS + "ms";

      if (rs.single) {
        rLeaf.style.transform = forward ? "rotateY(-100deg)" : "rotateY(0deg)";
        rLeaf.style.opacity = forward ? "0" : "1";
      } else {
        rLeaf.style.transform = forward ? "rotateY(-180deg)" : "rotateY(180deg)";
      }

      rs.spread = to;
      rememberPosition();
      updateControls();

      window.setTimeout(function () {
        done();
        rLeaf.hidden = true;
        rLeaf.classList.remove("is-turning");
        renderStatic();
        rs.busy = false;
      }, TURN_MS + 40);
    }

    /* --- events ---------------------------------------------------------- */

    rCover.addEventListener("click", openBook);

    /* "Read a Preview" in the hero: bring the book into view, then open it. */
    document.querySelectorAll("[data-open-preview]").forEach(function (button) {
      button.addEventListener("click", function () {
        scrollToSection("reader");
        if (!rs.open) window.setTimeout(openBook, reduced() ? 0 : 600);
      });
    });
    rClose.addEventListener("click", closeBook);
    rPrev.addEventListener("click", function () {
      go(-1);
    });
    rNext.addEventListener("click", function () {
      go(1);
    });

    document.addEventListener("keydown", function (event) {
      if (!rs.open) return;
      if (/^(INPUT|SELECT|TEXTAREA)$/.test(event.target.tagName)) return;
      var box = reader.getBoundingClientRect();
      if (box.bottom < 0 || box.top > window.innerHeight) return;
      if (event.key === "ArrowRight") go(1);
      else if (event.key === "ArrowLeft") go(-1);
      else if (event.key === "Escape") closeBook();
      else return;
      event.preventDefault();
    });

    var swipe = null;
    rSpread.addEventListener("pointerdown", function (event) {
      if (event.pointerType === "mouse") return;
      swipe = { x: event.clientX, y: event.clientY };
    });
    rSpread.addEventListener("pointerup", function (event) {
      if (!swipe) return;
      var dx = event.clientX - swipe.x;
      var dy = event.clientY - swipe.y;
      swipe = null;
      if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
      go(dx < 0 ? 1 : -1);
    });
    rSpread.addEventListener("pointercancel", function () {
      swipe = null;
    });

    var resizeTimer = 0;
    window.addEventListener("resize", function () {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(relayout, 150);
    });

    document.addEventListener("sitelangchange", applyLanguage);

    if (document.fonts && document.fonts.addEventListener) {
      document.fonts.addEventListener("loadingdone", function () {
        if (rs.open && !rs.busy) repaginate();
      });
    }

    rs.dims = computeDims();
    applyDims();
    applyLanguage();
  }

  /* ------------------------------------------------------------------------
     Checkout form behaviour
     ------------------------------------------------------------------------ */

  var coForm = document.getElementById("co-form");

  if (coForm && window.CHECKOUT_COPY) {
    var coPay = document.getElementById("co-pay");
    var coError = document.getElementById("co-error");
    var coThanks = document.getElementById("co-thanks");
    var coQuantity = document.getElementById("co-quantity");
    var coQuantityWrap = document.getElementById("co-quantity-wrap");
    var coPhoneWrap = document.getElementById("co-phone-wrap");
    var coPhone = document.getElementById("co-phone");
    var coPhysical = document.getElementById("co-physical");
    var coEbookNote = document.getElementById("co-ebook-note");
    var coShippingWrap = document.getElementById("co-shipping-wrap");
    var coShipping = document.getElementById("co-shipping");
    var coShippingNone = document.getElementById("co-shipping-none");
    var coCountrySlot = document.getElementById("co-country-slot");
    var coSecure = document.getElementById("co-secure");

    var co = {
      langTouched: false,
      sending: false,
      sent: null,
    };

    function t(key) {
      return window.CHECKOUT_COPY[Lang.get()][key];
    }

    function checked(name) {
      return coForm.querySelector('input[name="' + name + '"]:checked').value;
    }

    function currentVariant() {
      return CHECKOUT.variants[checked("format") + "-" + checked("language")];
    }

    function money(amount, currency) {
      try {
        return new Intl.NumberFormat(t("locale"), {
          style: "currency",
          currency: currency,
          minimumFractionDigits: amount % 1 ? 2 : 0,
        }).format(amount);
      } catch (error) {
        return amount + " " + currency;
      }
    }

    /* Shipping cost of a method in a given currency; null = not configured. */
    function shipCost(method, currency) {
      if (!method || !method.cost || typeof method.cost[currency] !== "number") return null;
      return method.cost[currency];
    }

    function label(entry) {
      return entry.label[Lang.get()] || entry.label.EN;
    }

    function countryField() {
      return document.getElementById("co-country");
    }

    /* --- selects built from config ------------------------------------ */

    function buildQuantity() {
      var fragment = document.createDocumentFragment();
      for (var n = 1; n <= CHECKOUT.maxQuantity; n += 1) {
        var option = document.createElement("option");
        option.value = String(n);
        option.textContent = String(n);
        fragment.appendChild(option);
      }
      coQuantity.appendChild(fragment);
    }

    function buildCountry() {
      var countries = CHECKOUT.shipping.countries;
      var previous = countryField() ? countryField().value : "";
      var field;
      if (countries.length) {
        field = document.createElement("select");
        var blank = document.createElement("option");
        blank.value = "";
        blank.textContent = t("countrySelect");
        field.appendChild(blank);
        countries.forEach(function (country) {
          var option = document.createElement("option");
          option.value = country.code;
          option.textContent = label(country);
          field.appendChild(option);
        });
      } else {
        field = document.createElement("input");
        field.type = "text";
        field.maxLength = 80;
        field.autocomplete = "country-name";
        field.placeholder = t("countryPh");
      }
      field.id = "co-country";
      field.name = "country";
      field.required = true;
      field.value = previous;
      coCountrySlot.replaceChildren(field);
      field.addEventListener("input", onCountryChange);
      field.addEventListener("change", onCountryChange);
    }

    function availableMethods() {
      var country = countryField() ? countryField().value : "";
      return CHECKOUT.shipping.methods.filter(function (method) {
        if (!method.countries || !method.countries.length) return true;
        return method.countries.indexOf(country) !== -1;
      });
    }

    function buildShipping() {
      var methods = availableMethods();
      var previous = coShipping.value;
      coShipping.replaceChildren();
      var blank = document.createElement("option");
      blank.value = "";
      blank.textContent = t("shippingSelect");
      coShipping.appendChild(blank);
      methods.forEach(function (method) {
        var option = document.createElement("option");
        option.value = method.id;
        var cost = shipCost(method, currentVariant().currency);
        option.textContent = label(method) + (cost === null ? "" : " — " + money(cost, currentVariant().currency));
        coShipping.appendChild(option);
      });
      var keep = methods.some(function (method) {
        return method.id === previous;
      });
      coShipping.value = keep ? previous : methods.length === 1 ? methods[0].id : "";
    }

    function selectedMethod() {
      var id = coShipping.value;
      var found = null;
      CHECKOUT.shipping.methods.forEach(function (method) {
        if (method.id === id) found = method;
      });
      return found;
    }

    /* --- copy ----------------------------------------------------------- */

    function applyCopy() {
      var section = document.getElementById("buy");
      section.lang = Lang.get() === "EN" ? "en" : "uk";
      document.querySelectorAll("[data-i18n]").forEach(function (el) {
        el.textContent = t(el.dataset.i18n);
      });
      document.querySelectorAll("[data-i18n-alt]").forEach(function (el) {
        el.alt = t(el.dataset.i18nAlt);
      });
      document.querySelectorAll("[data-i18n-aria]").forEach(function (el) {
        el.setAttribute("aria-label", t(el.dataset.i18nAria));
      });
      document.documentElement.lang = Lang.get() === "EN" ? "en" : "uk";
      document.title = t("docTitle");
      document.querySelector('meta[name="description"]').content = t("docDescription");
      document.querySelector('meta[property="og:title"]').content = t("bookTitle");
      document.querySelector('meta[property="og:description"]').content = t("lead2");
      document.querySelectorAll("[data-i18n-placeholder]").forEach(function (el) {
        el.placeholder = t(el.dataset.i18nPlaceholder);
      });
      buildCountry();
      buildShipping();
      coPay.textContent = co.sending ? t("paying") : t("pay");
      if (!coThanks.hidden) {
        document.getElementById("co-thanks-body").textContent = t(
          co.sent === "ebook" ? "thanksEbook" : "thanksPhysical"
        );
      }
      clearErrors();
      render();
    }

    /* --- state → UI ----------------------------------------------------- */

    function render() {
      var physical = checked("format") === "physical";
      coPhysical.disabled = !physical;
      coQuantityWrap.hidden = !physical;
      coQuantity.disabled = !physical;
      coPhoneWrap.hidden = !physical;
      coPhone.disabled = !physical;
      coEbookNote.hidden = physical;
      coSecure.hidden = physical;

      var hasMethods = CHECKOUT.shipping.methods.length > 0;
      var methods = availableMethods();
      var showShipping = physical && hasMethods && methods.length > 0;
      coShippingWrap.hidden = !showShipping;
      coShipping.disabled = !showShipping;
      coShippingNone.hidden = !(physical && !showShipping);

      var variant = currentVariant();
      var quantity = physical ? Number(coQuantity.value) : 1;
      var method = physical && showShipping ? selectedMethod() : null;

      document.getElementById("os-format").textContent = t(variant.format);
      document.getElementById("os-language").textContent = t(variant.language === "UA" ? "langUA" : "langEN");
      document.getElementById("os-quantity").textContent = String(quantity);
      document.getElementById("os-unit").textContent =
        variant.price === null ? t("priceTbd") : money(variant.price, variant.currency);

      var deliveryRow = document.getElementById("os-delivery-row");
      deliveryRow.hidden = !physical;
      var delivery = document.getElementById("os-delivery");
      var shipping = shipCost(method, variant.currency);
      if (shipping === null) delivery.textContent = t("deliveryTbd");
      else delivery.textContent = shipping > 0 ? money(shipping, variant.currency) : t("deliveryFree");

      var total = document.getElementById("os-total");
      if (variant.price === null) {
        total.textContent = t("priceTbd");
      } else {
        var sum = variant.price * quantity + (shipping || 0);
        total.textContent =
          money(sum, variant.currency) + (physical && shipping === null ? " " + t("plusDelivery") : "");
      }
    }

    function onCountryChange() {
      buildShipping();
      render();
    }

    /* --- validation ------------------------------------------------------ */

    function errorSlot(el) {
      return coForm.querySelector('[data-error-for="' + el.id + '"]');
    }

    function setError(el, message) {
      var slot = errorSlot(el);
      if (slot) slot.textContent = message;
      if (message) el.setAttribute("aria-invalid", "true");
      else el.removeAttribute("aria-invalid");
    }

    function clearErrors() {
      coForm.querySelectorAll("[aria-invalid]").forEach(function (el) {
        setError(el, "");
      });
      coError.hidden = true;
      coError.textContent = "";
    }

    function problemWith(el) {
      var value = el.value.trim();
      if (el.required && !value) return t("required");
      if (el.type === "email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
        return t("invalidEmail");
      }
      if (el.type === "tel" && value) {
        var digits = value.replace(/\D/g, "").length;
        if (!/^[+\d\s().-]+$/.test(value) || digits < 7 || digits > 15) return t("invalidPhone");
      }
      return "";
    }

    function validate() {
      var first = null;
      coForm.querySelectorAll("input[type=text], input[type=email], input[type=tel], select").forEach(function (el) {
        if (!el.willValidate) {
          setError(el, "");
          return;
        }
        var message = problemWith(el);
        setError(el, message);
        if (message && !first) first = el;
      });
      if (first) first.focus();
      return !first;
    }

    coForm.addEventListener("input", function (event) {
      if (event.target.getAttribute && event.target.getAttribute("aria-invalid")) {
        setError(event.target, problemWith(event.target));
      }
    });

    /* --- order ------------------------------------------------- */

    function field(id) {
      return document.getElementById(id).value.trim();
    }

    /* The order as the form receives it. */
    function buildOrder() {
      var variant = currentVariant();
      var physical = variant.format === "physical";
      var method = physical ? selectedMethod() : null;
      var quantity = physical ? Number(coQuantity.value) : 1;
      var order = {
        variantId: variant.id,
        format: variant.format,
        bookLanguage: variant.language,
        siteLanguage: Lang.get(),
        quantity: quantity,
        currency: variant.currency,
        unitPrice: variant.price,
        deliveryCost: shipCost(method, variant.currency),
        total: variant.price === null ? null : variant.price * quantity + (shipCost(method, variant.currency) || 0),
        customer: { name: field("co-name"), email: field("co-email") },
        shipping: null,
      };
      if (physical) {
        order.customer.phone = field("co-phone");
        order.shipping = {
          country: field("co-country"),
          address: field("co-address"),
          city: field("co-city"),
          postalCode: field("co-postal"),
          methodId: method ? method.id : null,
        };
      }
      return order;
    }

    function showError(message) {
      coError.textContent = message;
      coError.hidden = false;
    }

    function setSending(on) {
      co.sending = on;
      coPay.disabled = on;
      coPay.textContent = on ? t("paying") : t("pay");
      coForm.setAttribute("aria-busy", String(on));
    }

    /* Google Forms sends no CORS headers, so the response is opaque: a
       resolved promise means the request left the browser, not that Google
       accepted it. Only a genuine network failure is reported as an error. */
    function submitOrder(order) {
      var cfg = CHECKOUT.orderForm;
      var body = new URLSearchParams();
      body.set(cfg.entry.format, cfg.options.format[order.format]);
      body.set(cfg.entry.language, cfg.options.language[order.bookLanguage]);
      body.set(cfg.entry.quantity, String(order.quantity));
      body.set(cfg.entry.name, order.customer.name);
      body.set(cfg.entry.email, order.customer.email);
      if (order.shipping) {
        body.set(cfg.entry.phone, order.customer.phone);
        body.set(cfg.entry.country, order.shipping.country);
        body.set(cfg.entry.address, order.shipping.address);
        body.set(cfg.entry.city, order.shipping.city);
        body.set(cfg.entry.postal, order.shipping.postalCode);
      }
      setSending(true);
      return fetch(cfg.action, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: body.toString(),
      })
        .then(function () {
          co.sent = order.format;
          showThanks();
          openPayment(order);
        })
        .catch(function () {
          setSending(false);
          showError(t("sendError"));
        });
    }

    /* Same tab: a new window opened after an async request is blocked by
       popup blockers. The e-mail is passed on so Stripe can prefill it. */
    function openPayment(order) {
      var url = new URL(CHECKOUT.paymentUrl);
      url.searchParams.set("prefilled_email", order.customer.email);
      window.location.assign(url.toString());
    }

    /* The form is replaced, not reset, so an order can't be sent twice. */
    function showThanks() {
      coForm.hidden = true;
      document.getElementById("co-thanks-body").textContent = t(
        co.sent === "ebook" ? "thanksEbook" : "thanksPhysical"
      );
      coThanks.hidden = false;
      scrollToSection("buy");
    }

    coForm.addEventListener("submit", function (event) {
      event.preventDefault();
      if (co.sending) return;
      clearErrors();

      if (!validate()) {
        showError(t("checkFields"));
        return;
      }
      var order = buildOrder();
      if (order.total === null) {
        showError(t("priceMissing"));
        return;
      }
      submitOrder(order);
    });

    /* --- wiring --------------------------------------------------------- */

    coForm.addEventListener("change", function (event) {
      var name = event.target.name;
      if (name === "language") co.langTouched = true;
      if (name === "format" || name === "quantity" || name === "shipping" || name === "language") {
        render();
      }
    });

    document.addEventListener("sitelangchange", function () {
      if (!co.langTouched) selectBookLanguage(Lang.get());
      applyCopy();
    });

    function selectBookLanguage(code) {
      var radio = coForm.querySelector('input[name="language"][value="' + code + '"]');
      if (radio) radio.checked = true;
    }

    buildQuantity();
    selectBookLanguage(Lang.get());
    applyCopy();
  }

  /* --- CTAs that jump to the form --------------------------------------- */

  document.getElementById("nav-buy").addEventListener("click", function () {
    scrollToSection("buy");
  });
  document.querySelectorAll("[data-order-book]").forEach(function (button) {
    button.addEventListener("click", function () {
      scrollToSection("buy");
    });
  });
})();

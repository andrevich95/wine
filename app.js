/* ==========================================================================
   Подорож трансформацій — page behaviour
   Plain ES2020, no modules, no dependencies. Loaded with `defer`.
   ========================================================================== */

(function () {
  "use strict";

  /* Phase 1 checkout configuration. Prices are per book; null means unknown.
     Product language and delivery destination are deliberately independent. */
  var CHECKOUT = {
    variants: {
      "physical-UA": { id: "physical-ua", format: "physical", language: "UA", currency: "UAH", price: 1200 },
      "ebook-UA": { id: "ebook-ua", format: "ebook", language: "UA", currency: "UAH", price: 900 },
      "physical-EN": { id: "physical-en", format: "physical", language: "EN", currency: "EUR", price: 35 },
    },
    cover: "assets/cover.png",
    ebookOrderForm: {
      url: "https://docs.google.com/forms/d/e/1FAIpQLScMnV-1EPRyRzQu14mLskPbQNe2lI2omj1C5uZv6ZAOq1csFw/viewform",
      entries: { firstName: "307735541", email: "2044579426" },
    },
    ukraineOrderForm: {
      url: "https://docs.google.com/forms/d/e/1FAIpQLSci-pms-g-hM0PcxCcMgZqMaycDPAwF8oSzfDbIgjMlz-rXRA/viewform",
      entries: {
        country: "1010262154", firstName: "307735541", lastName: "1551863023",
        phone: "1061640817", email: "2044579426", city: "778705268",
        branch: "665549530", comment: "1168496972",
      },
    },
    internationalOrderForm: {
      url: "https://docs.google.com/forms/d/e/1FAIpQLSfA2TMQS8GFPAEKAcxgBxgPwTEfGP7XO8s8cHvOLc2pMqOl1w/viewform",
      entries: {
        country: "1010262154", firstName: "307735541", lastName: "1551863023",
        phone: "1061640817", email: "2044579426", city: "778705268",
        street: "665549530", building: "1168496972", address2: "720517786",
        postal: "1057800513", region: "252242427", comment: "1159017944",
      },
    },
    // Local country list only; shipping rates and country-specific rules are not configured.
    countries: [
      { code: "UA", label: { UA: "Україна", EN: "Ukraine" } },
      { code: "PL", label: { UA: "Польща", EN: "Poland" } },
      { code: "DE", label: { UA: "Німеччина", EN: "Germany" } },
      { code: "CZ", label: { UA: "Чехія", EN: "Czechia" } },
      { code: "FR", label: { UA: "Франція", EN: "France" } },
      { code: "IT", label: { UA: "Італія", EN: "Italy" } },
      { code: "ES", label: { UA: "Іспанія", EN: "Spain" } },
      { code: "GB", label: { UA: "Велика Британія", EN: "United Kingdom" } },
      { code: "US", label: { UA: "США", EN: "United States" } },
      { code: "CA", label: { UA: "Канада", EN: "Canada" } },
    ],
  };

  /* ------------------------------------------------------------------------
     Scrolling
     ------------------------------------------------------------------------ */

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function scrollToSection(id) {
    var target = document.getElementById(id === "reader" ? "book-preview" : id);
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
     aware component listens for "sitelangchange". First-time visitors choose
     a language before browsing; the header switcher stays available after.
     ------------------------------------------------------------------------ */

  var Lang = (function () {
    var current = "UA";
    var saved = null;
    try {
      saved = window.localStorage.getItem("site-lang");
      if (saved === "UA" || saved === "EN") current = saved;
    } catch (error) {
      /* storage blocked — fall back to UA for this visit */
    }

    var buttons = document.querySelectorAll("[data-lang]");
    var dialog = document.getElementById("language-dialog");

    function sync() {
      buttons.forEach(function (button) {
        button.setAttribute("aria-pressed", String(button.dataset.lang === current));
      });
    }

    function set(next) {
      if (next !== "UA" && next !== "EN") return;
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

    dialog.querySelectorAll("[data-choose-lang]").forEach(function (button) {
      button.addEventListener("click", function () {
        set(button.dataset.chooseLang);
        dialog.close();
        document.querySelector(".nav__brand").focus({ preventScroll: true });
      });
    });
    dialog.addEventListener("cancel", function (event) {
      event.preventDefault();
    });
    dialog.addEventListener("close", function () {
      document.documentElement.classList.remove("is-choosing-language");
    });
    if (saved !== "UA" && saved !== "EN") {
      document.documentElement.classList.add("is-choosing-language");
      dialog.showModal();
    }

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
    var rControls = document.getElementById("reader-controls");
    var rStage = document.getElementById("reader-stage");
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
      var host = rStage.clientWidth;
      var single = host < 800;
      var viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      var navHeight = document.querySelector(".nav__inner").getBoundingClientRect().height;
      reader.style.setProperty("--reader-nav-height", navHeight + "px");
      reader.parentElement.style.setProperty("--reader-nav-height", navHeight + "px");
      reader.parentElement.style.setProperty("--reader-viewport-height", viewportHeight + "px");
      var readerStyle = window.getComputedStyle(reader);
      var stageStyle = window.getComputedStyle(rStage);
      var controlsHeight = readerStyle.display === "grid" ? 0 : rControls.getBoundingClientRect().height;
      var spacing = parseFloat(readerStyle.paddingTop) + parseFloat(readerStyle.paddingBottom)
        + parseFloat(stageStyle.paddingTop) + parseFloat(stageStyle.paddingBottom);
      // Reserve room for the fixed header, both controls, and breathing space.
      var maxH = Math.max(64, Math.min(viewportHeight - navHeight
        - controlsHeight - spacing - 24, 780));
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
      document.getElementById("reader-hint-action").textContent = ui.coverAction;
      document.getElementById("reader-hint-description").textContent = ui.coverHint;
      rCover.setAttribute("aria-label", ui.coverLabel);
      rPrev.setAttribute("aria-label", ui.prev);
      rNext.setAttribute("aria-label", ui.next);
      rClose.textContent = ui.close;
      rBuy.textContent = ui.buy;
      document.getElementById("fq-lead").textContent = content().quote.lead;
      document.getElementById("fq-strong").textContent = content().quote.strong;
      document.getElementById("nav-buy").textContent = ui.buy;
      rs.dims = computeDims();
      applyDims();
      if (rs.open) repaginate();
    }

    function relayout() {
      if (rs.busy) {
        scheduleRelayout();
        return;
      }
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
        rHint.setAttribute("aria-expanded", "true");
        rBar.hidden = false;
        rClose.hidden = false;
        rBook.classList.remove("is-closed");
        scrollToSection("reader");
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
        rHint.setAttribute("aria-expanded", "false");
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
    rHint.addEventListener("click", openBook);

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
    function scheduleRelayout() {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(relayout, 150);
    }
    window.addEventListener("resize", scheduleRelayout);
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", scheduleRelayout);
    }
    if (window.ResizeObserver) {
      new ResizeObserver(scheduleRelayout).observe(rControls);
    }

    document.addEventListener("sitelangchange", applyLanguage);

    if (document.fonts && document.fonts.addEventListener) {
      document.fonts.addEventListener("loadingdone", function () {
        relayout();
        if (rs.open && !rs.busy) repaginate();
      });
    }

    rs.dims = computeDims();
    applyDims();
    applyLanguage();
  }

  /* ------------------------------------------------------------------------
     Checkout — validate and submit to the existing response tables. No payment integration.
     ------------------------------------------------------------------------ */

  var coForm = document.getElementById("co-form");

  if (coForm && window.CHECKOUT_COPY) {
    var co = {
      selectedVariant: "physical-UA",
      customer: { firstName: "", lastName: "", email: "", phone: "", comment: "" },
      deliveryCountry: "UA",
      ukrainianDelivery: { city: "", branch: "" },
      internationalDelivery: { city: "", street: "", building: "", apartment: "", address2: "", postal: "", region: "" },
    };
    var variantCards = {};
    var countryOptions = {};
    var coCountry = document.getElementById("co-country");
    var coPay = document.getElementById("co-pay");
    var orderState = "idle";
    var sentPayloads = new Set();
    var orderRevision = 0;

    function renderOrderStatus() {
      coPay.disabled = orderState === "sending" || orderState === "sent" || !hasPrice(currentVariant());
      coPay.textContent = t(orderState === "sending" ? "orderSending" : orderState === "sent" ? "orderSent" : "pay");
      coForm.setAttribute("aria-busy", String(orderState === "sending"));
      document.getElementById("co-payment-note").textContent = t(
        orderState === "sent" ? "orderSentNote" : orderState === "error" ? "orderError" : "paymentUnavailable"
      );
    }

    function resetOrderStatus() {
      orderRevision += 1;
      if (orderState !== "sending") orderState = "idle";
      renderOrderStatus();
    }

    function t(key) {
      return window.CHECKOUT_COPY[Lang.get()][key];
    }

    function currentVariant() {
      return CHECKOUT.variants[co.selectedVariant];
    }

    function hasPrice(variant) {
      return Number.isFinite(variant.price) && variant.price >= 0;
    }

    function priceLabel(variant) {
      if (!hasPrice(variant)) return t("priceTbd");
      return new Intl.NumberFormat(t("locale"), {
        style: "currency",
        currency: variant.currency,
        minimumFractionDigits: variant.price % 1 ? 2 : 0,
      }).format(variant.price);
    }

    function deliveryMode() {
      if (currentVariant().format === "ebook") return "ebook";
      return co.deliveryCountry === "UA" ? "ukraine" : "international";
    }

    /* BookVariantSelector: native radios provide keyboard selection. */
    function buildVariantSelector() {
      var host = document.getElementById("co-variants");
      Object.keys(CHECKOUT.variants).forEach(function (key) {
        var label = document.createElement("label");
        label.className = "card";
        var radio = document.createElement("input");
        radio.type = "radio";
        radio.name = "variant";
        radio.value = key;
        radio.checked = key === co.selectedVariant;
        var body = document.createElement("span");
        body.className = "card__body";
        var language = document.createElement("span");
        language.className = "card__language";
        var format = document.createElement("span");
        format.className = "card__title";
        var price = document.createElement("span");
        price.className = "card__price";
        body.append(language, format, price);
        label.append(radio, body);
        host.appendChild(label);
        variantCards[key] = { radio: radio, language: language, format: format, price: price };
      });
      CHECKOUT.countries.forEach(function (country) {
        var option = document.createElement("option");
        option.value = country.code;
        coCountry.appendChild(option);
        countryOptions[country.code] = option;
      });
    }

    /* CustomerInformationForm + delivery groups. Hidden controls are disabled
       and never required; their values remain only in this in-memory state. */
    function renderFields() {
      var mode = deliveryMode();
      var printed = mode !== "ebook";
      var visible = { printed: printed, ebook: !printed, ukraine: mode === "ukraine", international: mode === "international" };
      coForm.querySelectorAll("[data-co-visible]").forEach(function (group) {
        group.hidden = !visible[group.dataset.coVisible];
        if (group.tagName === "FIELDSET") group.disabled = group.hidden;
      });
      coForm.querySelectorAll("[data-co-field]").forEach(function (field) {
        var path = field.dataset.coField.split(".");
        field.value = path.length === 1 ? co[path[0]] : co[path[0]][path[1]];
        var hidden = Boolean(field.closest("[hidden]"));
        var rule = field.dataset.requiredWhen;
        var required = !hidden && (rule === "always" || Boolean(visible[rule]));
        field.disabled = hidden;
        field.required = required;
        var label = field.closest(".cf");
        label.querySelector("[data-required-mark]").hidden = !required;
        var labelText = label.querySelector("[data-i18n]");
        labelText.id = field.id + "-label";
        field.setAttribute("aria-labelledby", labelText.id);
      });
      coForm.querySelectorAll("[data-co-field]").forEach(function (field) {
        showError(field, field.disabled ? "" : (errors[field.id] ? validateField(field) : ""));
      });
    }

    var errors = {};
    function validateField(field) {
      if (field.disabled) return "";
      var value = field.value.trim();
      var ukraine = deliveryMode() === "ukraine";
      if (ukraine && (field.id === "co-first-name" || field.id === "co-last-name")) {
        if (!/^[А-ЩЬЮЯЄІЇҐа-щьюяєіїґ '’ʼ-]+$/.test(field.value) || !/[А-ЩЬЮЯЄІЇҐа-щьюяєіїґ]/.test(value))
          return field.id === "co-first-name" ? "firstNameError" : "lastNameError";
      }
      if (ukraine && field.id === "co-phone" && !/^\+380[0-9]{9}$/.test(value.replace(/[ ()-]/g, ""))) return "phoneError";
      if (field.id === "co-email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "emailError";
      if (ukraine && field.id === "co-ua-city" && !value) return "cityError";
      if (ukraine && field.id === "co-ua-branch" && !/^[0-9]*[1-9][0-9]*$/.test(value)) return "branchError";
      return field.required && !value ? "requiredError" : "";
    }

    function showError(field, key) {
      errors[field.id] = key;
      var errorId = field.id + "-error";
      var error = document.getElementById(errorId);
      if (!error) {
        error = document.createElement("span");
        error.id = errorId;
        error.className = "cf__error";
        error.setAttribute("aria-live", "polite");
        field.closest(".cf").appendChild(error);
      }
      error.textContent = key ? t(key) : "";
      error.hidden = !key;
      field.setAttribute("aria-invalid", String(Boolean(key)));
      var descriptions = [];
      if (!field.disabled && deliveryMode() === "ukraine") {
        if (field.id === "co-first-name" || field.id === "co-last-name") descriptions.push("co-name-hint");
        if (field.id === "co-phone") descriptions.push("co-phone-hint");
        if (field.id === "co-ua-branch") descriptions.push("co-branch-hint");
      }
      if (key) descriptions.push(errorId);
      if (descriptions.length) field.setAttribute("aria-describedby", descriptions.join(" "));
      else field.removeAttribute("aria-describedby");
    }

    /* OrderSummary: one book, with shipping explicitly separate from subtotal. */
    function renderSummary() {
      var variant = currentVariant();
      var mode = deliveryMode();
      document.getElementById("co-summary-cover").src = variant.cover || CHECKOUT.cover;
      document.getElementById("os-language").textContent = t(variant.language === "UA" ? "langUA" : "langEN");
      document.getElementById("os-format").textContent = t(variant.format === "physical" ? "physical" : "ebook");
      document.getElementById("os-unit").textContent = priceLabel(variant);
      document.getElementById("os-delivery-row").hidden = mode === "ebook";
      document.getElementById("os-delivery").textContent = mode === "ebook" ? "" : t(mode === "ukraine" ? "ukraineShipping" : "internationalShipping");
      if (mode === "ukraine") {
        var destination = [];
        if (co.ukrainianDelivery.city.trim()) destination.push(t("uaCity") + ": " + co.ukrainianDelivery.city.trim());
        if (co.ukrainianDelivery.branch.trim()) destination.push(t("branchLabel") + ": " + co.ukrainianDelivery.branch.trim());
        if (destination.length) document.getElementById("os-delivery").textContent += " " + destination.join(", ");
      }
      document.getElementById("os-subtotal-row").hidden = !hasPrice(variant);
      document.getElementById("os-subtotal").textContent = hasPrice(variant) ? priceLabel(variant) : "";
      document.getElementById("co-fulfillment-note").textContent = t(mode === "ebook" ? "ebookFulfillment" : "printedFulfillment");
      renderOrderStatus();
    }

    function renderCheckout() {
      Object.keys(variantCards).forEach(function (key) {
        var card = variantCards[key];
        var variant = CHECKOUT.variants[key];
        card.radio.checked = key === co.selectedVariant;
        card.language.textContent = t(variant.language === "UA" ? "langUA" : "langEN");
        card.format.textContent = t(variant.format === "physical" ? "physical" : "ebook");
        card.price.textContent = priceLabel(variant);
      });
      CHECKOUT.countries.forEach(function (country) {
        countryOptions[country.code].textContent = country.label[Lang.get()];
      });
      renderFields();
      renderSummary();
    }

    // Preserve the site's existing localization behavior, including all other sections.
    function applyCopy() {
      document.getElementById("buy").lang = Lang.get() === "EN" ? "en" : "uk";
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
      renderCheckout();
    }

    function updateField(event) {
      var field = event.target;
      var binding = field.dataset.coField;
      if (!binding || field.disabled) return;
      resetOrderStatus();
      var path = binding.split(".");
      if (path.length === 1) co[path[0]] = field.value;
      else co[path[0]][path[1]] = field.value;
      if (errors[field.id]) showError(field, validateField(field));
      if (binding === "deliveryCountry") renderCheckout();
      else if (binding.indexOf("ukrainianDelivery.") === 0) renderSummary();
    }

    coForm.addEventListener("focusout", function (event) {
      var field = event.target;
      if (!field.dataset.coField || field.disabled) return;
      if (field.id === "co-email") {
        field.value = field.value.trim();
        updateField(event);
      }
      showError(field, validateField(field));
    });
    coForm.addEventListener("input", updateField);
    coForm.addEventListener("change", function (event) {
      if (event.target.name === "variant") {
        if (!Object.prototype.hasOwnProperty.call(CHECKOUT.variants, event.target.value)) return;
        co.selectedVariant = event.target.value;
        resetOrderStatus();
        renderCheckout();
      } else updateField(event);
    });
    coForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      if (orderState === "sending" || orderState === "sent" || !hasPrice(currentVariant())) return;
      var mode = deliveryMode();
      var firstInvalid = null;
      coForm.querySelectorAll("[data-co-field]").forEach(function (field) {
        if (field.disabled) return;
        if (field.id === "co-email") field.value = field.value.trim();
        updateField({ target: field });
        var key = validateField(field);
        showError(field, key);
        if (key && !firstInvalid) firstInvalid = field;
      });
      if (firstInvalid) {
        firstInvalid.focus();
        return;
      }
      var variant = currentVariant();
      var edition = (variant.language === "UA" ? "Ukrainian" : "English") + (mode === "ebook" ? " — E-book" : " — Printed Book");
      var answers = {
        country: CHECKOUT.countries.find(function (country) { return country.code === co.deliveryCountry; }).label.EN,
        firstName: co.customer.firstName.trim(), lastName: co.customer.lastName.trim(),
        phone: mode === "ukraine" ? co.customer.phone.trim().replace(/[ ()-]/g, "") : co.customer.phone.trim(), email: co.customer.email.trim(),
        comment: "Book: " + edition + (co.customer.comment.trim() ? "\n\n" + co.customer.comment.trim() : ""),
      };
      var formConfig = mode === "international" ? CHECKOUT.internationalOrderForm : CHECKOUT.ukraineOrderForm;
      if (mode === "ebook") {
        formConfig = CHECKOUT.ebookOrderForm;
        answers = {
          firstName: co.customer.firstName.trim(),
          email: co.customer.email.trim(),
        };
      } else if (mode === "ukraine") {
        answers.city = co.ukrainianDelivery.city.trim();
        answers.branch = co.ukrainianDelivery.branch.trim();
      } else {
        var address = co.internationalDelivery;
        ["city", "street", "building", "postal", "region"].forEach(function (key) {
          answers[key] = address[key].trim();
        });
        // The Google Form has no apartment field; preserve it in address line 2.
        answers.address2 = [address.apartment.trim() ? "Apartment: " + address.apartment.trim() : "", address.address2.trim()].filter(Boolean).join("; ");
      }
      var endpoint = formConfig.url.replace(/\/viewform$/, "/formResponse");
      var body = new URLSearchParams();
      Object.keys(answers).forEach(function (key) {
        body.set("entry." + formConfig.entries[key], answers[key]);
      });
      var payloadKey = endpoint + "?" + body.toString();
      if (sentPayloads.has(payloadKey)) {
        orderState = "sent";
        renderOrderStatus();
        return;
      }
      var submittedRevision = orderRevision;
      orderState = "sending";
      renderOrderStatus();
      var controller = new AbortController();
      var timeout = setTimeout(function () { controller.abort(); }, 20000);
      try {
        // Google Forms accepts a simple POST but does not expose its response
        // cross-origin. An opaque response confirms dispatch, not a saved row.
        // Keep the UI at "confirmation pending"; never claim payment or saving.
        var response = await fetch(endpoint, {
          method: "POST", mode: "no-cors", credentials: "omit",
          body: body, signal: controller.signal,
        });
        if (response.type !== "opaque" && !response.ok) throw new Error("Order submission failed");
        sentPayloads.add(payloadKey);
        orderState = orderRevision === submittedRevision ? "sent" : "idle";
      } catch (error) {
        orderState = "error";
      } finally {
        clearTimeout(timeout);
        renderOrderStatus();
      }
    });
    document.addEventListener("sitelangchange", applyCopy);

    buildVariantSelector();
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

/* ==========================================================================
   Подорож трансформації — page behaviour
   Plain ES2020, no modules, no dependencies. Loaded with `defer`.
   ========================================================================== */

(function () {
  "use strict";

  /* ------------------------------------------------------------------------
     Google Form wiring — the only thing you should ever need to edit.

     Verified on 2026-09-02 against the live form "Презентація книги", whose
     six questions are labelled: registration, book, name, email, telegram,
     instagram. All six are optional form-side, so this page is the only
     thing validating a booking.

     To refresh these IDs: open the form → ⋮ → "Get pre-filled link" → fill
     dummy values → the generated URL contains each entry.XXXXXXX.
     ------------------------------------------------------------------------ */
  var FORM = {
    action:
      "https://docs.google.com/forms/d/e/1FAIpQLSfAyMAJCp4bkz_ZjITcqRBEXsDjxSI_025R0OBasQOtRYSolg/formResponse",
    entry: {
      seats: "entry.1049737412",
      books: "entry.178840253",
      name: "entry.648731893",
      email: "entry.777674831",
      telegram: "entry.1427964737",
      instagram: "entry.186597742",
    },
  };

  /* ------------------------------------------------------------------------
     The form this landing page used before the Google Sheets rewrite,
     recovered from the original repository (vino-culture-tour, commit
     1994a31 — the last one that still POSTed straight to Google Forms).

     Verified live on 2026-09-02: it still accepts responses, but it has only
     FOUR questions, so it is NOT a drop-in replacement for FORM above:

       - one radio instead of two checkboxes, and Google drops any value that
         is not one of `interestOptions` verbatim;
       - one free-text "КІЛЬКІСТЬ (МІСЦЬ / КНИГ)" instead of separate seat and
         book counts;
       - no Telegram and no Instagram question at all. The original repo bound
         those two inputs to entry.000000001 / entry.000000002, which are not
         real fields on this form — that data was silently discarded.

     Currently unused: kept as a documented fallback target. Anything sending
     here has to collapse the booking down to these four fields first.
     ------------------------------------------------------------------------ */
  var ALTERNATIVE_FORM = {
    action:
      "https://docs.ggit addoogle.com/forms/d/e/1FAIpQLScvvzGnfHK9DNyvJWsViUVPD8W7kiVZ8M8WJydreDYDrxkN6A/formResponse",
    entry: {
      interest: "entry.1809122846", // radio  — ЩО ВАС ЦІКАВИТЬ
      name: "entry.15527583", // text   — ІМʼЯ
      email: "entry.792148681", // para   — EMAIL АБО ТЕЛЕФОН
      quantity: "entry.2136755986", // text   — КІЛЬКІСТЬ (МІСЦЬ / КНИГ)
    },
    /* The radio accepts these two literals only. */
    interestOptions: {
      tourAndBook: "Тур + книга",
      bookOnly: "Тільки книга (передзамовлення)",
    },
    /* Fields FORM collects that this form cannot store. */
    unsupported: ["telegram", "instagram", "separate seat and book counts"],
  };

  /* ------------------------------------------------------------------------
     Booking constants — mirrored from the original page.
     ------------------------------------------------------------------------ */
  var SEATS_TOTAL = 25;
  var SEATS_TAKEN = 0;
  var SEATS_LEFT = SEATS_TOTAL - SEATS_TAKEN;
  var MAX_BOOKS = 10;
  var SEAT_PRICE = 250;
  /* TODO: set the book price once it is approved; until then the summary
     shows it as pending. */
  var BOOK_PRICE = null;
  var PRICE_PENDING = "вартість уточнюється";

  function formatPrice(amount) {
    return amount + " PLN";
  }

  function capitalise(text) {
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

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
    nav.classList.toggle("is-lifted", scrolled || menuOpen);
    nav.classList.toggle("is-open", menuOpen);
    mobileNav.hidden = !menuOpen;
    navToggle.setAttribute("aria-expanded", String(menuOpen));
    navToggleLabel.textContent = menuOpen ? "Закрити навігацію" : "Відкрити навігацію";
  }

  function onScroll() {
    var next = window.scrollY > 8;
    if (next === scrolled) return;
    scrolled = next;
    syncNav();
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

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
     Book excerpt — the quotes CTA swaps itself for the first pages, exactly
     as the React page did: open hides the button, close brings it back.
     ------------------------------------------------------------------------ */

  var excerptCta = document.getElementById("excerpt-cta");
  var excerptToggle = document.getElementById("excerpt-toggle");
  var excerptPanel = document.getElementById("excerpt-panel");
  var excerptClose = document.getElementById("excerpt-close");

  function setExcerptOpen(open) {
    excerptCta.hidden = open;
    excerptPanel.hidden = !open;
    excerptToggle.setAttribute("aria-expanded", String(open));
  }

  excerptToggle.addEventListener("click", function () {
    setExcerptOpen(true);
    excerptClose.focus();
  });

  excerptClose.addEventListener("click", function () {
    setExcerptOpen(false);
    excerptToggle.focus();
  });

  /* ------------------------------------------------------------------------
     Booking form
     ------------------------------------------------------------------------ */

  var form = document.getElementById("booking-form");
  var thanks = document.getElementById("register-thanks");
  var submitButton = document.getElementById("booking-submit");
  var errorBox = document.getElementById("booking-error");

  var wantsSeats = document.getElementById("wants-seats");
  var wantsBooks = document.getElementById("wants-books");
  var seatsSelect = document.getElementById("seats");
  var booksSelect = document.getElementById("books");
  var seatsWrap = document.getElementById("seats-wrap");
  var booksWrap = document.getElementById("books-wrap");

  var fieldName = document.getElementById("field-name");
  var fieldEmail = document.getElementById("field-email");
  var fieldTelegram = document.getElementById("field-telegram");
  var fieldInstagram = document.getElementById("field-instagram");

  var summaryList = document.getElementById("summary-list");
  var summaryEmpty = document.getElementById("summary-empty");
  var summaryFormat = document.getElementById("summary-format");
  var summarySeatsRow = document.getElementById("summary-seats-row");
  var summarySeats = document.getElementById("summary-seats");
  var summaryBooksRow = document.getElementById("summary-books-row");
  var summaryBooks = document.getElementById("summary-books");
  var summaryTotal = document.getElementById("summary-total");

  function fillSelect(select, max) {
    var fragment = document.createDocumentFragment();
    for (var count = 1; count <= Math.max(max, 1); count += 1) {
      var option = document.createElement("option");
      option.value = String(count);
      option.textContent = String(count);
      fragment.appendChild(option);
    }
    select.appendChild(fragment);
    select.value = "1";
  }

  fillSelect(seatsSelect, SEATS_LEFT);
  fillSelect(booksSelect, MAX_BOOKS);

  function readState() {
    var seatCount = wantsSeats.checked ? Number(seatsSelect.value) : 0;
    var bookCount = wantsBooks.checked ? Number(booksSelect.value) : 0;
    var parts = [];
    if (wantsSeats.checked) parts.push("Реєстрація на презентацію");
    if (wantsBooks.checked) parts.push("Купити книгу");
    return {
      seatCount: seatCount,
      bookCount: bookCount,
      format: parts.join(" + "),
    };
  }

  function render() {
    var state = readState();

    seatsWrap.hidden = !wantsSeats.checked;
    booksWrap.hidden = !wantsBooks.checked;

    var hasFormat = state.format !== "";
    summaryList.hidden = !hasFormat;
    summaryEmpty.hidden = hasFormat;
    if (!hasFormat) return;

    summaryFormat.textContent = state.format;

    summarySeatsRow.hidden = !wantsSeats.checked;
    if (wantsSeats.checked) {
      summarySeats.textContent =
        state.seatCount +
        " × " +
        formatPrice(SEAT_PRICE) +
        " = " +
        formatPrice(state.seatCount * SEAT_PRICE);
    }

    summaryBooksRow.hidden = !wantsBooks.checked;
    if (wantsBooks.checked) {
      summaryBooks.textContent =
        BOOK_PRICE === null
          ? state.bookCount + " × " + PRICE_PENDING
          : state.bookCount +
            " × " +
            formatPrice(BOOK_PRICE) +
            " = " +
            formatPrice(state.bookCount * BOOK_PRICE);
    }

    var knownTotal = state.seatCount * SEAT_PRICE + state.bookCount * (BOOK_PRICE || 0);
    var bookPricePending = wantsBooks.checked && BOOK_PRICE === null;

    if (!bookPricePending) {
      summaryTotal.textContent = formatPrice(knownTotal);
    } else if (knownTotal > 0) {
      summaryTotal.textContent = formatPrice(knownTotal) + " + " + PRICE_PENDING + " книги";
    } else {
      summaryTotal.textContent = capitalise(PRICE_PENDING);
    }
  }

  form.addEventListener("input", render);
  form.addEventListener("change", render);
  render();

  /* --- CTAs that pre-tick a format, then jump to the form ---------------- */

  function jumpToRegister() {
    window.requestAnimationFrame(function () {
      scrollToSection("register");
    });
  }

  function reserve() {
    wantsSeats.checked = true;
    render();
    jumpToRegister();
  }

  function orderBook() {
    wantsBooks.checked = true;
    render();
    jumpToRegister();
  }

  document.getElementById("nav-reserve").addEventListener("click", reserve);
  document.querySelectorAll("[data-reserve]").forEach(function (button) {
    button.addEventListener("click", reserve);
  });
  document.querySelectorAll("[data-order-book]").forEach(function (button) {
    button.addEventListener("click", orderBook);
  });

  /* --- Submit ------------------------------------------------------------ */

  function showError(message) {
    errorBox.textContent = message;
    errorBox.hidden = false;
  }

  function clearError() {
    errorBox.textContent = "";
    errorBox.hidden = true;
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    var state = readState();

    if (!wantsSeats.checked && !wantsBooks.checked) {
      showError("Оберіть хоча б один формат участі.");
      return;
    }

    if (!form.checkValidity()) {
      showError("Перевірте, будь ласка, позначені поля.");
      form.reportValidity();
      return;
    }

    clearError();
    submitButton.disabled = true;
    submitButton.textContent = "Надсилаємо…";

    var payload = new URLSearchParams();
    payload.set(FORM.entry.seats, String(state.seatCount));
    payload.set(FORM.entry.books, String(state.bookCount));
    payload.set(FORM.entry.name, fieldName.value.trim());
    payload.set(FORM.entry.email, fieldEmail.value.trim());
    payload.set(FORM.entry.telegram, fieldTelegram.value.trim());
    payload.set(FORM.entry.instagram, fieldInstagram.value.trim());

    /* Google Forms sends no CORS headers, so the response is opaque: a
       resolved promise means the request left the browser, not that Google
       accepted it. Only a genuine network failure surfaces as an error. */
    fetch(FORM.action, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: payload.toString(),
    })
      .then(function () {
        form.hidden = true;
        thanks.hidden = false;
      })
      .catch(function () {
        showError("Не вдалося надіслати заявку. Спробуйте ще раз або напишіть на email.");
        submitButton.disabled = false;
        submitButton.textContent = "Надіслати заявку";
      });
  });
})();

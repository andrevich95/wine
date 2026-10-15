/* ==========================================================================
   Book preview — approved copy and reader UI strings, one entry per language.

   Plain script (no modules): defines window.BOOK_PREVIEW, keyed by the site
   language code ("UA" / "EN"). Loaded before app.js.

   Block types
     title   opening line — set larger, kept with the paragraph that follows
     p       ordinary paragraph (may be split across pages)
     verse   group of italic lines (`lines`); only breaks between lines
     closing final statement — kept with the paragraph before it

   `keepNext: true` stops a block from being the last thing on a page.
   `html` may contain <em> around a single word only (the paginator splits
   paragraphs on spaces).

   The preview text is approved copy: do not edit, translate or "correct" it
   here — wording, punctuation and dashes are exactly as supplied.
   ========================================================================== */

window.BOOK_PREVIEW = {
  UA: {
    lang: "uk",
    quote: { lead: "Бо я не хочу прожити правильне життя.", strong: "Я хочу прожити СВОЄ." },
    ui: {
      coverLabel: "Відкрити книгу «Подорож трансформацій»",
      coverAction: "Відкрити книгу",
      coverHint: "Натисніть «Відкрити книгу» або на обкладинку, щоб читати уривок",
      prev: "Попередня сторінка",
      next: "Наступна сторінка",
      close: "Закрити книгу",
      buy: "Купити книгу",
      pages: "Сторінка",
      pagesPlural: "Сторінки",
      of: "з",
      region: "Уривок із книги",
      swipeHint: "Гортайте свайпом або стрілками",
    },
    blocks: [
      { type: "title", html: "Дитинство. Перший спогад", keepNext: true },
      {
        type: "p",
        html: "Постійно згадую яскравий епізод з дитинства – той, що, мабуть, і визначив моє майбутнє.",
      },
      {
        type: "p",
        html: "Мені тоді було роки три. У маминої подруги народилася донька. Ми прийшли в пологовий будинок, але нас, звісно, всередину не пустили. Подруга не могла вийти – немовля потребувало багато уваги.",
      },
      {
        type: "p",
        html: "Та мама працювала в тій самій будівлі лікарні, тому мала своєрідний карт-бланш. Вона покликала знайому лікарку-гінекологиню, щоб дізнатися, як пройшли пологи та чи все добре.",
      },
      {
        type: "p",
        html: "Це було ще до 2000-х, тоді ще ніхто не викладав сторіз із пологових, а телефони лише вчилися дзвонити без дротів. У нашому маленькому містечку навіть слово «айфон» звучало б як із майбутнього, а нокії з поліфонією стануть розкішшю ще років через десять.",
      },
      {
        type: "p",
        html: "Та я пам’ятаю зовсім не техніку.",
      },
      {
        type: "p",
        html: "Я пам’ятаю, як моє серце зненацька забилося вдесятеро швидше, коли в коридор вийшла вона – поважна жінка в білому халаті, спокійна, стримана, з тим поглядом, що не потребує слів.",
      },
      {
        type: "p",
        html: "Вона знала, що робить. Знала відповіді. І знала ціну своєму часу.",
      },
      {
        type: "p",
        html: "У той момент я відчула – ось вона, сила. Не та, що кричить чи переконує, а тиха, впевнена, професійна.",
      },
    ],
  },

  EN: {
    lang: "en",
    quote: { lead: "Because I don’t want to live the “right” life.", strong: "I want to live MY life." },
    ui: {
      coverLabel: "Open the book “Journey of Transformations”",
      coverAction: "Open the book",
      coverHint: "Tap “Open the book” or the cover to read a preview",
      prev: "Previous page",
      next: "Next page",
      close: "Close the book",
      buy: "Buy the Book",
      pages: "Page",
      pagesPlural: "Pages",
      of: "of",
      region: "Book excerpt",
      swipeHint: "Swipe or use the arrows to turn pages",
    },
    blocks: [
      { type: "title", html: "Childhood. My First Memory", keepNext: true },
      {
        type: "p",
        html: "There is one vivid episode from childhood that I return to again and again - one that may, in some way, have shaped my future.",
      },
      {
        type: "p",
        html: "I was about three years old. My mother’s friend had just had a baby girl. We came to the maternity hospital, but of course they would not let us inside. My mother’s friend could not come out either - the newborn needed a great deal of attention.",
      },
      {
        type: "p",
        html: "My mother, however, worked in the same hospital building, which gave her a certain kind of carte blanche. She called over a gynecologist she knew to ask how the birth had gone and whether everything was all right.",
      },
      {
        type: "p",
        html: "This was before the 2000s, when no one posted stories from maternity wards and phones were only just learning how to make calls without wires. In our small town, even the word “iPhone” would have sounded like something from the future, while Nokias with polyphonic ringtones would not become a luxury for another decade or so.",
      },
      {
        type: "p",
        html: "But technology is not what I remember.",
      },
      {
        type: "p",
        html: "I remember my heart suddenly starting to beat ten times faster when SHE stepped into the corridor - an imposing woman in a white coat, calm and composed, with the kind of gaze that needed no words.",
      },
      {
        type: "p",
        html: "She knew what she was doing. She knew the answers. And she knew the value of her time.",
      },
      {
        type: "p",
        html: "In that moment, I thought: this is what strength looks like. Not the kind that shouts or tries to persuade, but something quiet, confident, professional.",
      },
    ],
  },
};

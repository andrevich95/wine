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
      coverHint: "Натисніть на обкладинку, щоб відкрити книгу",
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
      { type: "title", html: "Я за свободу.", keepNext: true },
      {
        type: "p",
        html: "За свободу бути собою. Не тією версією себе, яку від тебе хочуть бачити. Не «правильною». Не зручною. А справжньою.",
      },
      {
        type: "p",
        html: "Для мене свобода- це коли я сама вирішую, як виглядати сьогодні, який парфум обрати, куди поїхати, з ким бути, чим займатися і що спробувати.",
      },
      {
        type: "p",
        html: "Я можу сама сісти за кермо й поїхати кудись без плану. Можу змінити маршрут. Можу сказати «а давайте?» і через день уже робити те, чого раніше ніколи не робила.",
      },
      { type: "p", html: "Я авантюристка. І ні, це не аферистка :)" },
      {
        type: "p",
        html: "Аферистка шукає, як отримати щось за рахунок інших. А мені цікаво зовсім інше- як створити собі й іншим більше життя. Більше досвіду. Більше історій. Більше моментів, які потім згадуєш і думаєш: «Оце ми тоді дали жару».",
      },
      { type: "p", html: "Мені цікаво пробувати. Досліджувати. Помилятися. Пробувати ще раз." },
      {
        type: "p",
        html: "Я багато чого тестую на собі- у роботі, психології, спорті, подорожах, спілкуванні, житті. Не тому, що знаю, як правильно. Навпаки. Мені цікаво перевіряти: а що буде, якщо?",
      },
      { type: "p", html: "Я не вірю в один правильний сценарій життя." },
      {
        type: "p",
        html: "Можна бути успішною в кар’єрі й одночасно шукати себе. Можна змінити професію. Можна мати десять захоплень. Можна сьогодні хотіти одного, а через рік- зовсім іншого.",
      },
      { type: "p", html: "І можна просто бути собою." },
      {
        type: "p",
        html: "Мені дуже цікаві люди. Я люблю спостерігати за ними, слухати їхні історії, бачити сильні сторони й те, що вони самі в собі ще не помічають.",
      },
      { type: "p", html: "Тому мені важливі люди поруч." },
      {
        type: "p",
        html: "Вільні. Цілеспрямовані. Допитливі. Ті, хто розвивається, але не змагається. Хто може підтримати, а не оцінити. Де можна бути різною і не боятися, що тебе за це засудять.",
      },
      { type: "p", html: "Я за чесні й щирі стосунки. За взаємоповагу. За «Я OK — Ти OK»." },
      {
        type: "p",
        html: "Я не хочу доводити, що знаю, як правильно жити. Я хочу показувати, що можна жити по-різному.",
      },
      {
        type: "p",
        html: "І якщо після розмови зі мною, моєї історії, виступу, книги, подорожі чи навіть якоїсь моєї чергової авантюри ти раптом подумав:",
        keepNext: true,
      },
      {
        type: "p",
        html: "«А чому б і мені не спробувати?» - значить, усе це було не дарма.",
      },
      { type: "p", html: "Бо я сама так живу." },
      {
        type: "p",
        html: "Коли в голові стає забагато хаосу, я сідаю за кермо й просто їду. А інколи беру квиток і вирушаю в подорож. Мені потрібен рух, нові місця й трохи нерутини, щоб видихнути, розкласти все по поличках і знову повернутися до себе.",
      },
      {
        type: "p",
        html: "Мабуть, саме тому мені так близькі слова із пісні ʼRide’ by Lana Del Rey.",
        keepNext: true,
      },
      {
        type: "verse",
        lines: [
          "Who are you? Are you in touch with all your darkest fantasies?",
          "Have you created a life for yourself where you can experience them?",
          "I have.",
          "I am fucking crazy.",
          "But I am free.",
        ],
      },
      { type: "p", html: "Оце про мене." },
      {
        type: "p",
        html: "Я хочу створити таке життя, в якому мені не доведеться себе зменшувати.",
      },
      {
        type: "p",
        html: "Де є місце для кар’єри, психології, спорту, подорожей, книг, людей, спонтанності, великих ідей і маленьких радощів.",
      },
      {
        type: "p",
        html: "Де можна бути сильною і вразливою. Серйозною і смішною. Амбітною і просто кайфувати від життя.",
      },
      { type: "p", html: "Де не треба обирати одну версію себе." },
      { type: "p", html: "Бо я не хочу прожити правильне життя.", keepNext: true },
      { type: "closing", html: "Я хочу прожити СВОЄ." },
    ],
  },

  EN: {
    lang: "en",
    quote: { lead: "Because I don’t want to live the “right” life.", strong: "I want to live MY life." },
    ui: {
      coverLabel: "Open the book “Journey of Transformations”",
      coverHint: "Click the cover to open the book",
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
      { type: "title", html: "I’m all for freedom.", keepNext: true },
      {
        type: "p",
        html: "The freedom to be yourself. Not the version of you people want to see. Not the “right” one. Not the convenient, socially acceptable one. But the real you.",
      },
      {
        type: "p",
        html: "For me, freedom means deciding for myself how I want to look today, which perfume to wear, where to go, who to be with, what to do and what to try.",
      },
      {
        type: "p",
        html: "I can jump in the car and drive somewhere with absolutely no plan. I can change my route halfway through. I can say, “Why don’t we...?” and a day later, find myself doing something I’ve never done before.",
      },
      {
        type: "p",
        html: "I’m an adventurer. And no, that’s not the same as being a con artist. :)",
      },
      {
        type: "p",
        html: "A con artist looks for ways to get something at someone else’s expense. I’m interested in something completely different: how to make life bigger, for myself and for others. More experiences. More stories. More moments you look back on and think, “Damn, that was wild. We really did that!”",
      },
      { type: "p", html: "I love trying things. Exploring. Making mistakes. Trying again." },
      {
        type: "p",
        html: "I experiment with all sorts of things in my own life — work, psychology, sports, travel, relationships, life in general. Not because I know the right way to do things. Quite the opposite. I’m curious to find out: what happens if I try this?",
      },
      { type: "p", html: "I don’t believe there’s only one right way to live." },
      {
        type: "p",
        html: "You can be successful in your career and still be figuring yourself out. You can change careers whenever you want. You can have ten different interests. You can want one thing today and something completely different a year from now.",
      },
      { type: "p", html: "And you can simply be yourself." },
      {
        type: "p",
        html: "I’m genuinely fascinated by people. I love observing them, listening to their stories, seeing their strengths and noticing the things in themselves they haven’t quite seen yet.",
      },
      { type: "p", html: "That’s why the people around me matter so much." },
      {
        type: "p",
        html: "Free-spirited. Driven. Curious. People who keep growing without turning everything into a competition. People who can support you instead of judge you. People you can be different versions of yourself around, without worrying about being judged for it.",
      },
      {
        type: "p",
        html: "I believe in honest, genuine relationships. Mutual respect. And the “I’m OK — You’re OK” approach to relationships.",
      },
      {
        type: "p",
        html: "I don’t want to prove that I know how to live life the right way. I want to show that there are different ways to live it.",
      },
      {
        type: "p",
        html: "And if, after a conversation with me, hearing my story, watching me give a talk, reading a book, going on a trip or hearing about one of my latest adventures, you suddenly find yourself thinking:",
        keepNext: true,
      },
      { type: "p", html: "“Why don’t I give it a try, too?”", keepNext: true },
      { type: "p", html: "Then it’s all been worth it." },
      { type: "p", html: "Because that’s how I live, too." },
      {
        type: "p",
        html: "When my head gets too full of chaos, I grab my keys, jump in the car and just drive. Sometimes, I book a ticket and take off somewhere. I need movement, new places and a little break from routine to breathe, sort things out in my head and find my way back to myself.",
      },
      {
        type: "p",
        html: "Maybe that’s exactly why the lyrics from Lana Del Rey’s <em>Ride</em> resonate with me so much.",
        keepNext: true,
      },
      {
        type: "verse",
        lines: [
          "Who are you? Are you in touch with all your darkest fantasies?",
          "Have you created a life for yourself where you can experience them?",
          "I have.",
          "I am fucking crazy.",
          "But I am free.",
        ],
      },
      { type: "p", html: "That’s me." },
      {
        type: "p",
        html: "I want to create a life where I never have to make myself smaller.",
      },
      {
        type: "p",
        html: "A life with room for a career, psychology, sports, travel, books, people, spontaneity, big ideas and little joys.",
      },
      {
        type: "p",
        html: "A life where I can be strong and vulnerable. Serious and funny. Ambitious and still know how to enjoy the hell out of life.",
      },
      { type: "p", html: "Where I don’t have to choose just one version of myself." },
      { type: "p", html: "Because I don’t want to live the “right” life.", keepNext: true },
      { type: "closing", html: "I want to live MY life." },
    ],
  },
};

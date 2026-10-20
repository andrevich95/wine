const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

// Minimal DOM for dependency-free interaction tests. This verifies the actual
// checkout controller against the page markup; it does not simulate CSS layout.
class Element {
  constructor(tag, attrs = {}, owner) {
    this.tagName = tag.toUpperCase();
    this.attrs = { ...attrs };
    this.children = [];
    this.owner = owner;
    this.listeners = {};
    this._value = attrs.value || '';
  }
  append(...nodes) { nodes.forEach(node => this.appendChild(node)); }
  appendChild(node) { node.parentElement = this; this.children.push(node); return node; }
  setAttribute(key, value) { this.attrs[key] = String(value); }
  getAttribute(key) { return this.attrs[key]; }
  removeAttribute(key) { delete this.attrs[key]; }
  hasAttribute(key) { return Object.hasOwn(this.attrs, key); }
  get dataset() {
    return Object.fromEntries(Object.entries(this.attrs).filter(([key]) => key.startsWith('data-'))
      .map(([key, value]) => [key.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase()), value]));
  }
  get options() { return this.children.filter(node => node.tagName === 'OPTION'); }
  get value() { return this._value; }
  set value(value) { this._value = String(value); }
  set textContent(text) { this._text = String(text); this.children = []; }
  get textContent() { return (this._text || '') + this.children.map(node => node.textContent).join(''); }
  matches(selector) {
    const match = selector.match(/^(\w+)?(?:\[([^=\]]+)(?:="([^"]*)")?\])?$/);
    if (selector.startsWith('.')) return (this.attrs.class || '').split(' ').includes(selector.slice(1));
    if (selector.startsWith('#')) return this.attrs.id === selector.slice(1);
    if (!match) throw new Error('Unsupported test selector: ' + selector);
    return (!match[1] || this.tagName === match[1].toUpperCase()) &&
      (!match[2] || (this.hasAttribute(match[2]) && (match[3] === undefined || this.attrs[match[2]] === match[3])));
  }
  querySelectorAll(selector) {
    return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector) || null; }
  addEventListener(name, callback) { (this.listeners[name] ||= []).push(callback); }
  dispatchEvent(event) { return Promise.all((this.listeners[event.type] || []).map(listener => listener(event))); }
  focus() { this.owner.activeElement = this; }
  showModal() { this.open = true; }
  close() { this.open = false; this.dispatchEvent({ type: 'close' }); }
}
for (const key of ['hidden', 'disabled', 'required', 'checked']) {
  Object.defineProperty(Element.prototype, key, {
    get() { return this.hasAttribute(key); },
    set(value) { if (value) this.setAttribute(key, ''); else this.removeAttribute(key); },
  });
}
for (const key of ['name', 'type', 'className', 'id']) {
  const attr = key === 'className' ? 'class' : key;
  Object.defineProperty(Element.prototype, key, {
    get() { return this.attrs[attr] || ''; }, set(value) { this.attrs[attr] = value; },
  });
}
function documentFromHTML(html) {
  const doc = new Element('document');
  const stack = [doc];
  const voidTags = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
  for (const token of html.match(/<!--[\s\S]*?-->|<![^>]*>|<[^>]+>|[^<]+/g)) {
    if (token.startsWith('<!')) continue;
    if (token.startsWith('</')) {
      const tag = token.slice(2, -1).trim().toUpperCase();
      assert.equal(stack.at(-1).tagName, tag, 'Balanced HTML');
      stack.pop();
    } else if (token.startsWith('<')) {
      const tag = token.match(/^<([^\s/>]+)/)[1];
      const attrs = {};
      for (const match of token.slice(tag.length + 1).matchAll(/([^\s=/>]+)(?:\s*=\s*"([^"]*)")?/g)) attrs[match[1]] = match[2] ?? '';
      const node = new Element(tag, attrs, doc);
      stack.at(-1).appendChild(node);
      if (!voidTags.has(tag) && !token.endsWith('/>')) stack.push(node);
    } else stack.at(-1)._text = (stack.at(-1)._text || '') + token;
  }
  assert.equal(stack.length, 1);
  doc.createElement = tag => new Element(tag, {}, doc);
  doc.getElementById = id => doc.querySelector('#' + id);
  doc.documentElement = doc.querySelector('html');
  return doc;
}
function setup(language = 'UA', configure = () => {}, submit = async () => ({ type: 'opaque', ok: false })) {
  const document = documentFromHTML(read('index.html'));
  const opened = [];
  const requests = [];
  const copied = [];
  const navigator = { clipboard: { async writeText(value) { copied.push(value); } } };
  const window = { crypto: require('node:crypto').webcrypto, open(...args) { opened.push(args); }, localStorage: { setItem() { throw Error('Personal data must not be persisted'); } }, location: { assign() { throw Error('Payment redirect'); } } };
  const context = vm.createContext({ document, window, navigator, Lang: { get: () => language }, Intl, URL, URLSearchParams, AbortController, setTimeout, clearTimeout,
    fetch(url, options) { requests.push({ url, options }); return submit(url, options); } });
  vm.runInContext(read('checkout-content.js'), context);
  const source = read('app.js');
  const configStart = source.indexOf('  var CHECKOUT =');
  const configEnd = source.indexOf('\n  };', configStart) + 5;
  vm.runInContext(source.slice(configStart, configEnd), context);
  configure(context.CHECKOUT);
  const start = source.indexOf('  var coForm =');
  const end = source.indexOf('  /* --- CTAs that jump to the form', start);
  vm.runInContext(source.slice(start, end), context);
  const get = id => document.getElementById(id);
  const form = get('co-form');
  const change = (id, value) => {
    const target = get(id); target.value = value;
    form.dispatchEvent({ type: target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' ? 'input' : 'change', target });
  };
  const select = value => form.dispatchEvent({ type: 'change', target: { name: 'variant', value, dataset: {} } });
  const translate = code => { language = code; document.dispatchEvent({ type: 'sitelangchange' }); };
  const active = () => form.querySelectorAll('[data-co-field]').filter(field => !field.disabled).map(field => field.id).sort();
  return { context, document, form, get, change, select, translate, active, opened, requests, copied, proceed: () => form.dispatchEvent({ type: 'submit', preventDefault() {} }) };
}

test('exactly three native-radio variants with existing prices and no English e-book', () => {
  const s = setup();
  const radios = s.form.querySelectorAll('[name="variant"]');
  assert.deepEqual(radios.map(r => r.value), ['physical-UA', 'ebook-UA', 'physical-EN']);
  assert.ok(radios.every(r => r.type === 'radio'));
  assert.equal(s.context.CHECKOUT.variants['physical-UA'].price, 1200);
  assert.equal(s.context.CHECKOUT.variants['ebook-UA'].price, 900);
  assert.equal(s.context.CHECKOUT.variants['physical-EN'].price, 35);
  s.select('ebook-EN');
  assert.equal(s.context.co.selectedVariant, 'physical-UA');
});

test('both printed books support Ukraine and international addresses independently', () => {
  const s = setup();
  assert.equal(s.get('co-country').value, 'UA');
  for (const variant of ['physical-UA', 'physical-EN']) {
    s.select(variant);
    s.change('co-country', 'UA');
    assert.ok(!s.get('co-ukrainian-delivery').hidden);
    assert.ok(s.get('co-international-delivery').hidden);
    assert.ok(!s.get('co-ua-city').disabled && !s.get('co-ua-branch').disabled);
    for (const id of ['co-country','co-first-name','co-last-name','co-email','co-phone','co-ua-city','co-ua-branch']) assert.ok(s.get(id).required);
    for (const id of ['co-street','co-building','co-postal']) assert.ok(s.get(id).disabled && !s.get(id).required);
    s.change('co-country', 'PL');
    assert.ok(s.get('co-ukrainian-delivery').hidden);
    assert.ok(!s.get('co-international-delivery').hidden);
    for (const id of ['co-city','co-street','co-building']) assert.ok(s.get(id).required && !s.get(id).disabled);
    for (const id of ['co-apartment','co-address2','co-postal','co-region','co-comment']) assert.ok(!s.get(id).required && !s.get(id).disabled);
    assert.equal(s.get('co-ua-branch').required, false);
    assert.equal(s.get('os-delivery').textContent, 'Вартість доставки буде розраховано.');
  }
});

test('e-book requires name, surname and email; no shipping summary', () => {
  const s = setup();
  s.select('ebook-UA');
  assert.deepEqual(s.active(), ['co-email','co-first-name','co-last-name']);
  assert.ok(s.get('co-email').required);
  assert.ok(s.get('co-last-name').required);
  assert.equal(s.get('co-first-name').required, true);
  assert.ok(s.get('os-delivery-row').hidden);
  assert.equal(s.get('os-delivery').textContent, '');
  for (const field of s.form.querySelectorAll('[data-co-field]')) {
    if (field.closest('[hidden]')) assert.ok(field.disabled && !field.required, field.id);
  }
});

test('variant, country, customer and address data survive option and interface-language changes', () => {
  const s = setup('EN');
  assert.equal(s.context.co.selectedVariant, 'physical-UA');
  s.change('co-first-name', 'Test');
  s.change('co-last-name', 'Reader');
  s.change('co-email', 'reader@example.com');
  s.change('co-phone', '+48123456789');
  s.change('co-country', 'PL');
  s.change('co-city', 'Test city');
  s.change('co-street', 'Test street');
  s.change('co-building', '10');
  s.change('co-comment', 'Test comment');
  s.select('physical-EN');
  assert.equal(s.get('co-country').value, 'PL');
  s.select('ebook-UA');
  s.translate('UA');
  assert.equal(s.context.co.selectedVariant, 'ebook-UA');
  s.select('physical-EN');
  assert.equal(s.document.documentElement.lang, 'uk');
  assert.equal(s.get('co-country').value, 'PL');
  for (const [id, value] of [['co-first-name','Test'],['co-last-name','Reader'],['co-email','reader@example.com'],['co-city','Test city'],['co-street','Test street'],['co-building','10'],['co-comment','Test comment']]) assert.equal(s.get(id).value, value);
  s.change('co-country', 'UA');
  s.change('co-ua-city', 'Київ');
  s.change('co-ua-branch', '25');
  s.translate('EN');
  assert.equal(s.get('co-ua-city').value, 'Київ');
  assert.equal(s.get('co-ua-branch').value, '25');
  s.change('co-country', 'PL');
  assert.equal(s.get('co-street').value, 'Test street');
});

test('missing prices have localized placeholders and no calculated subtotal', () => {
  for (const language of ['UA','EN']) {
    const s = setup(language, config => { config.variants['physical-UA'].price = null; });
    const expected = language === 'UA' ? 'Ціну буде додано' : 'Price coming soon';
    assert.equal(s.get('os-unit').textContent, expected);
    assert.equal(s.context.variantCards['physical-UA'].price.textContent, expected);
    assert.ok(s.get('os-subtotal-row').hidden);
    assert.equal(s.get('os-subtotal').textContent, '');
    assert.ok(s.get('co-pay').disabled);
  }
});

test('plain optional labels, required asterisks, and neutral phone placeholders stay consistent', () => {
  const s = setup();
  const enteredPhone = '+48123456789';
  s.change('co-phone', enteredPhone);
  for (const language of ['UA', 'EN']) {
    s.translate(language);
    const expected = language === 'UA' ? 'Введіть номер телефону' : 'Enter phone number';
    const apartmentLabel = language === 'UA' ? 'Квартира' : 'Apartment';
    for (const variant of ['physical-UA', 'physical-EN', 'ebook-UA']) {
      s.select(variant);
      for (const country of s.context.CHECKOUT.countries) {
        if (variant !== 'ebook-UA') s.change('co-country', country.code);
        assert.equal(s.get('co-phone').placeholder, expected);
        assert.equal(s.get('co-phone').value, enteredPhone);
        assert.equal(s.get('co-apartment').required, false);
        assert.equal(s.get('co-apartment').closest('.cf').querySelector('[data-i18n]').textContent, apartmentLabel);
        for (const field of s.form.querySelectorAll('[data-co-field]')) {
          const label = field.closest('.cf');
          const marker = label.querySelector('[data-required-mark]');
          assert.equal(!marker.hidden, field.required, field.id);
          assert.doesNotMatch(label.textContent, /\(optional\)|\(необов’язково\)/);
          if (field.closest('[hidden]')) assert.ok(!field.required && field.disabled, field.id);
          if (field.hasAttribute('data-development-placeholder')) {
            assert.ok(field.disabled);
            assert.equal(field.getAttribute('aria-required'), String(field.required));
          }
        }
      }
    }
  }
});

test('all checkout paths use one submit button, validate, and have complete translations', async () => {
  const s = setup();
  for (const language of ['UA','EN']) {
    s.translate(language);
    for (const variant of ['physical-UA','ebook-UA','physical-EN']) {
      s.select(variant);
      for (const country of ['UA','PL']) {
        if (variant !== 'ebook-UA') s.change('co-country', country);
        assert.equal(s.get('co-pay').disabled, false);
        assert.equal(s.get('co-pay').type, 'submit');
        let prevented = false;
        await s.form.dispatchEvent({ type: 'submit', preventDefault() { prevented = true; } });
        assert.ok(prevented);
      }
    }
    for (const attr of ['data-i18n','data-i18n-alt','data-i18n-aria','data-i18n-placeholder']) {
      for (const node of s.document.querySelectorAll('[' + attr + ']')) {
        assert.equal(typeof s.context.window.CHECKOUT_COPY[language][node.getAttribute(attr)], 'string', node.getAttribute(attr));
      }
    }
  }
  assert.equal(s.requests.length, 0);
  assert.equal(s.get('co-google-form'), null);
  assert.equal(s.opened.length, 0);
});

function blur(s, id, value) {
  if (value !== undefined) s.change(id, value);
  s.form.dispatchEvent({ type: 'focusout', target: s.get(id) });
}
function error(s, id) { return s.get(id + '-error').textContent; }

test('manual Ukraine fields validate on blur, correct live, and localize accessibly', () => {
  const s = setup();
  assert.ok(s.form.querySelectorAll('[data-co-field]').every(f => f.getAttribute('aria-invalid') === 'false'));
  for (const variant of ['physical-UA', 'physical-EN']) {
    s.select(variant);
    for (const id of ['co-first-name','co-last-name']) {
      for (const name of ['Ґанна', 'Єва', 'Ілля', 'Ївга', 'Анна-Марія', "Лук’ян", "Лукʼян", "Лук'ян", 'Олена Марія']) {
        blur(s, id, name); assert.equal(error(s, id), '', name);
      }
      for (const name of ['Anna', 'Олена1', 'Ыва', 'Эва', 'Ёва', 'Ъ', '---', ' ’ ', '   ', 'Олена!']) {
        blur(s, id, name); assert.ok(error(s, id), name);
        assert.equal(s.get(id).value, name);
      }
      s.translate('EN');
      assert.equal(error(s, id), id === 'co-first-name' ? 'Enter your first name in Ukrainian.' : 'Enter your last name in Ukrainian.');
      assert.ok(s.get(id).getAttribute('aria-describedby').includes(id + '-error'));
      s.change(id, 'Марія');
      assert.equal(error(s, id), '');
      assert.equal(s.get(id).getAttribute('aria-invalid'), 'false');
      s.translate('UA');
    }
    for (const phone of ['+380501234567', '+380 (50) 123-45-67']) {
      blur(s, 'co-phone', phone); assert.equal(error(s, 'co-phone'), '');
    }
    for (const phone of ['+48123456789', '+38050123456', '+3805012345678', '380501234567', '+38050abc4567', '']) {
      blur(s, 'co-phone', phone); assert.equal(error(s, 'co-phone'), 'Введіть номер у форматі +380XXXXXXXXX.');
    }
    s.change('co-phone', '+380 (50) 123-45-67'); assert.equal(error(s, 'co-phone'), '');
    for (const email of ['', '   ', 'invalid', 'a@b', 'a b@example.com']) {
      blur(s, 'co-email', email); assert.ok(error(s, 'co-email'));
    }
    blur(s, 'co-email', '  reader@example.com  ');
    assert.equal(s.get('co-email').value, 'reader@example.com');
    assert.equal(s.context.co.customer.email, 'reader@example.com');
    assert.equal(error(s, 'co-email'), '');
    blur(s, 'co-ua-city', '   '); assert.ok(error(s, 'co-ua-city'));
    s.change('co-ua-city', 'Київ'); assert.equal(error(s, 'co-ua-city'), '');
    for (const branch of ['', ' ', '0', '000', '-1', '1.5', 'abc', '1e2', '+25']) {
      blur(s, 'co-ua-branch', branch); assert.ok(error(s, 'co-ua-branch'), branch);
    }
    s.change('co-ua-branch', '25'); assert.equal(error(s, 'co-ua-branch'), '');
    blur(s, 'co-comment', ''); assert.equal(error(s, 'co-comment'), '');
  }
});

test('switches clear irrelevant errors and summaries while retaining manual values', () => {
  const s = setup();
  blur(s, 'co-first-name', 'Anna');
  blur(s, 'co-last-name', 'Smith');
  blur(s, 'co-phone', '+48123456789');
  blur(s, 'co-ua-city', '');
  blur(s, 'co-ua-branch', '0');
  s.change('co-country', 'PL');
  for (const id of ['co-first-name','co-last-name','co-phone','co-ua-city','co-ua-branch']) assert.equal(error(s, id), '');
  assert.ok(s.get('co-phone-hint').hidden);
  assert.equal(s.get('co-phone').value, '+48123456789');
  blur(s, 'co-street', ''); assert.ok(error(s, 'co-street'));
  s.change('co-country', 'UA'); assert.equal(error(s, 'co-street'), '');
  s.change('co-ua-city', '<img src=x onerror=alert(1)>');
  s.change('co-ua-branch', '25');
  assert.ok(s.get('os-delivery').textContent.includes('<img src=x onerror=alert(1)>'));
  assert.equal(s.get('os-delivery').children.length, 0);
  s.translate('EN'); assert.ok(s.get('os-delivery').textContent.includes('Nova Poshta branch number: 25'));
  blur(s, 'co-first-name'); assert.ok(error(s, 'co-first-name'));
  s.select('ebook-UA');
  assert.equal(error(s, 'co-first-name'), '');
  blur(s, 'co-first-name', 'Anna123'); assert.equal(error(s, 'co-first-name'), '');
  blur(s, 'co-email', ''); assert.ok(error(s, 'co-email'));
  assert.equal(s.get('os-delivery').textContent, '');
  s.select('physical-EN');
  assert.equal(s.get('co-ua-branch').value, '25');
  assert.ok(s.get('os-delivery').textContent.includes('25'));
});

function fillUkraine(s) {
  for (const [id, value] of Object.entries({
    'co-first-name': 'Анна-Марія', 'co-last-name': 'Лук’яненко',
    'co-phone': '+380 (50) 123-45-67', 'co-email': ' reader@example.com ',
    'co-ua-city': 'Київ', 'co-ua-branch': '25', 'co-comment': 'A & B + #?\nДякую',
  })) s.change(id, value);
}
function assertAnswers(request, expected) {
  assert.equal(request.options.method, 'POST');
  assert.equal(request.options.mode, 'no-cors');
  assert.equal(request.options.credentials, 'omit');
  assert.ok(request.url.endsWith('/formResponse'));
  for (const [id, value] of Object.entries(expected)) assert.equal(request.options.body.get('entry.' + id), value);
}

test('Proceed validates and posts Ukrainian orders for both printed editions without opening a tab', async () => {
  for (const language of ['UA', 'EN']) {
    for (const variant of ['physical-UA', 'physical-EN']) {
      const s = setup(language);
      await s.proceed();
      assert.equal(s.requests.length, 0);
      assert.equal(s.document.activeElement.id, 'co-first-name');
      fillUkraine(s);
      s.select(variant);
      await s.proceed();
      assert.equal(s.requests.length, 1);
      assert.ok(s.requests[0].url.includes('1FAIpQLSci-pms-g-hM0PcxCcMgZqMaycDPAwF8oSzfDbIgjMlz-rXRA'));
      assertAnswers(s.requests[0], {
        '1010262154': 'Ukraine', '307735541': 'Анна-Марія', '1551863023': 'Лук’яненко',
        '1061640817': '+380501234567', '2044579426': 'reader@example.com',
        '778705268': 'Київ', '665549530': '25',
        '1168496972': `Book: ${variant === 'physical-UA' ? 'Ukrainian' : 'English'} — Printed Book\n\nA & B + #?\nДякую`,
      });
      assert.equal(s.opened.length, 0);
      assert.equal(s.get('co-pay').disabled, false);
      assert.ok(s.get('payment-dialog').open);
      assert.equal(s.get('co-phone').value, '+380 (50) 123-45-67');
      await s.proceed();
      assert.equal(s.requests.length, 1);
      s.translate('EN');
      assert.match(s.get('co-payment-note').textContent, /confirmation is pending/);
      s.change('co-comment', 'new comment');
      s.change('co-comment', 'A & B + #?\nДякую');
      await s.proceed();
      assert.equal(s.requests.length, 1, 'unchanged request is not sent twice');
    }
  }
});

test('international printed orders map every country and address field to the international table', async () => {
  for (const variant of ['physical-UA', 'physical-EN']) {
    const s = setup('EN');
    s.select(variant);
    s.change('co-country', 'PL');
    for (const [id, value] of Object.entries({
      'co-first-name': 'Anna', 'co-last-name': 'Reader', 'co-phone': '+48 (000) 000-000',
      'co-email': ' reader@example.com ', 'co-city': 'Test city', 'co-street': 'A & B Street',
      'co-building': '12A', 'co-apartment': '7', 'co-address2': 'Care of Test',
      'co-postal': '00-001', 'co-region': 'Test region', 'co-comment': 'Test only',
    })) s.change(id, value);
    s.context.co.ukrainianDelivery.city = 'Stale Ukrainian city';
    for (const country of s.context.CHECKOUT.countries.filter(c => c.code !== 'UA')) {
      s.change('co-country', country.code);
      const count = s.requests.length;
      await s.proceed();
      assert.equal(s.requests.length, count + 1);
      const request = s.requests.at(-1);
      assert.ok(request.url.includes('1FAIpQLSfA2TMQS8GFPAEKAcxgBxgPwTEfGP7XO8s8cHvOLc2pMqOl1w'));
      assertAnswers(request, {
        '1010262154': country.label.EN, '307735541': 'Anna', '1551863023': 'Reader',
        '1061640817': '+48 (000) 000-000', '2044579426': 'reader@example.com',
        '778705268': 'Test city', '665549530': 'A & B Street', '1168496972': '12A',
        '720517786': 'Apartment: 7; Care of Test', '1057800513': '00-001', '252242427': 'Test region',
        '1159017944': `Book: ${variant === 'physical-UA' ? 'Ukrainian' : 'English'} — Printed Book\n\nTest only`,
      });
      assert.ok(!request.options.body.toString().includes('Stale'));
    }
    const count = s.requests.length;
    s.change('co-street', ' ');
    await s.proceed();
    assert.equal(s.requests.length, count);
    assert.equal(s.document.activeElement.id, 'co-street');
  }
});

test('e-books require surname for payment and send order ID, first name and email to their form', async () => {
  for (const language of ['UA', 'EN']) {
    const s = setup(language);
    fillUkraine(s);
    s.select('ebook-UA');
    s.change('co-first-name', ' ');
    await s.proceed();
    assert.equal(s.requests.length, 0);
    assert.equal(s.document.activeElement.id, 'co-first-name');
    s.change('co-first-name', ' Anna ');
    s.change('co-email', 'invalid');
    await s.proceed();
    assert.equal(s.requests.length, 0);
    assert.equal(s.document.activeElement.id, 'co-email');
    s.change('co-email', ' reader@example.com ');
    s.change('co-last-name', ' ');
    await s.proceed();
    assert.equal(s.requests.length, 0);
    assert.equal(s.document.activeElement.id, 'co-last-name');
    s.change('co-last-name', 'Reader');
    await s.proceed();
    assert.equal(s.requests.length, 1);
    const request = s.requests[0];
    assert.equal(request.url, 'https://docs.google.com/forms/d/e/1FAIpQLScMnV-1EPRyRzQu14mLskPbQNe2lI2omj1C5uZv6ZAOq1csFw/formResponse');
    assertAnswers(request, {
      '307735541': 'Anna', '2044579426': 'reader@example.com',
    });
    assert.deepEqual([...request.options.body.keys()].sort(), ['entry.2044579426', 'entry.307735541', 'entry.777020657']);
    assert.equal(request.options.body.get('entry.777020657'), s.get('payment-order-id').textContent);
    assert.equal(s.get('payment-surname').textContent, 'Reader');
    assert.equal(s.opened.length, 0);
  }
});

test('submission locks duplicate clicks; edits during sending remain ready for a new submission', async () => {
  let finish;
  const s = setup('EN', () => {}, () => new Promise(resolve => { finish = resolve; }));
  fillUkraine(s);
  const pending = s.proceed();
  assert.ok(s.get('co-pay').disabled);
  assert.equal(s.form.getAttribute('aria-busy'), 'true');
  assert.equal(s.get('co-pay').textContent, 'Sending…');
  assert.ok(!s.get('payment-dialog').open);
  await s.proceed();
  assert.equal(s.requests.length, 1);
  s.change('co-comment', 'Changed while sending');
  assert.ok(s.get('co-pay').disabled);
  finish({ type: 'opaque' });
  await pending;
  assert.equal(s.get('co-pay').disabled, false);
  assert.equal(s.form.getAttribute('aria-busy'), 'false');
});

test('network errors retain details and allow an explicit retry without claiming success', async () => {
  let fail = true;
  const s = setup('EN', () => {}, async () => {
    if (fail) throw new TypeError('Network unavailable');
    return { type: 'opaque' };
  });
  fillUkraine(s);
  await s.proceed();
  assert.match(s.get('co-payment-note').textContent, /couldn’t confirm/);
  assert.ok(!s.get('payment-dialog').open);
  assert.equal(s.get('co-pay').disabled, false);
  assert.equal(s.get('co-email').value, 'reader@example.com');
  fail = false;
  await s.proceed();
  assert.equal(s.requests.length, 2);
  assert.equal(s.get('co-pay').textContent, 'View payment details');
  assert.equal(s.requests[0].options.body.get('entry.1246459960'), s.requests[1].options.body.get('entry.1246459960'));
  assert.ok(s.get('payment-dialog').open);
});


test('every destination receives a unique ID matching the popup and exact transfer reference', async () => {
  const ids = new Set();
  for (const mode of ['ukraine', 'international', 'ebook']) {
    const s = setup('EN');
    fillUkraine(s);
    if (mode === 'ebook') s.select('ebook-UA');
    if (mode === 'international') {
      s.change('co-country', 'PL');
      for (const id of ['co-city', 'co-street', 'co-building']) s.change(id, 'Test');
    }
    await s.proceed();
    const entry = { ukraine: '1246459960', international: '581507591', ebook: '777020657' }[mode];
    const id = s.requests[0].options.body.get('entry.' + entry);
    assert.match(id, /^[A-Z]{2}[0-9]{4}-Лук’яненко$/);
    assert.ok(!ids.has(id)); ids.add(id);
    assert.equal(s.get('payment-order-id').textContent, id);
    assert.equal(s.get('payment-reference').textContent, id);
    assert.equal(s.get('payment-account').textContent, '27 1600 1462 1805 9774 5000 0001');
    assert.match(s.get('payment-dialog').textContent, /Alona Kovalenko/);
    assert.match(s.get('payment-dialog').textContent, /PPABPLPKXXX/);
    assert.match(s.get('payment-dialog').textContent, /BNP Paribas/);
    await s.get('payment-close').dispatchEvent({ type: 'click' });
    assert.equal(s.get('payment-dialog').open, false);
    assert.equal(s.document.activeElement.id, 'co-pay');
    await s.proceed();
    assert.equal(s.requests.length, 1);
    assert.ok(s.get('payment-dialog').open);
    assert.equal(s.get('payment-order-id').textContent, id);
    s.translate('UA');
    assert.equal(s.get('payment-title').textContent, 'Реквізити для оплати');
    assert.equal(s.get('payment-dialog').lang, 'uk');
    assert.equal(s.get('payment-reference').textContent, id);
    s.change('co-last-name', 'Коваленко');
    await s.proceed();
    assert.equal(s.requests.length, 2);
    assert.notEqual(s.get('payment-order-id').textContent, id);
    assert.equal(s.get('payment-surname').textContent, 'Коваленко');
  }
});

test('copy buttons use the displayed account and reference and handle clipboard failure', async () => {
  const s = setup('EN');
  fillUkraine(s);
  await s.proceed();
  const buttons = s.get('payment-dialog').querySelectorAll('[data-payment-copy]');
  for (const button of buttons) await button.dispatchEvent({ type: 'click' });
  assert.deepEqual(s.copied, [s.get('payment-account').textContent, s.get('payment-reference').textContent]);
  assert.equal(s.get('payment-copy-status').textContent, 'Copied');
  s.context.navigator.clipboard.writeText = async () => { throw new Error('Unavailable'); };
  await buttons[0].dispatchEvent({ type: 'click' });
  assert.match(s.get('payment-copy-status').textContent, /copy it manually/);
});

test('payment reference uses the submitted surname even if the form changes while sending', async () => {
  let finish;
  const s = setup('EN', () => {}, () => new Promise(resolve => { finish = resolve; }));
  fillUkraine(s);
  const pending = s.proceed();
  s.change('co-last-name', 'Коваленко');
  finish({ type: 'opaque' });
  await pending;
  assert.equal(s.get('payment-surname').textContent, 'Лук’яненко');
  assert.equal(s.get('payment-order-id').textContent, s.requests[0].options.body.get('entry.1246459960'));
  assert.equal(s.get('co-pay').textContent, 'Proceed to Payment');
});


test('short IDs preserve leading zeros and surname, avoid local collisions, and remain stable on retry', async () => {
  const s = setup('EN');
  const values = [0, 0, 12345];
  s.context.window.crypto = { getRandomValues(array) {
    assert.ok(values.length, 'unexpected ID regeneration');
    array[0] = values.shift();
    return array;
  } };
  fillUkraine(s);
  s.select('ebook-UA');
  s.change('co-last-name', ' Smith-Jones ');
  await s.proceed();
  assert.equal(s.get('payment-order-id').textContent, 'AA0000-Smith-Jones');
  assert.equal(s.get('payment-reference').textContent, 'AA0000-Smith-Jones');
  assert.equal(s.requests[0].options.body.get('entry.777020657'), 'AA0000-Smith-Jones');
  await s.proceed();
  assert.equal(s.requests.length, 1);
  s.change('co-email', 'another@example.com');
  await s.proceed();
  assert.equal(s.get('payment-order-id').textContent, 'AB2345-Smith-Jones');
  assert.equal(s.requests[1].options.body.get('entry.777020657'), 'AB2345-Smith-Jones');
  assert.equal(values.length, 0);
});

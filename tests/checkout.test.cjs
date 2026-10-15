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
  dispatchEvent(event) { for (const listener of this.listeners[event.type] || []) listener(event); }
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
function setup(language = 'UA', configure = () => {}) {
  const document = documentFromHTML(read('index.html'));
  const window = { localStorage: { setItem() { throw Error('Personal data must not be persisted'); } }, location: { assign() { throw Error('Payment redirect'); } } };
  const context = vm.createContext({ document, window, Lang: { get: () => language }, Intl,
    fetch() { throw Error('Checkout must not make network requests'); } });
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
  return { context, document, form, get, change, select, translate, active };
}

test('exactly three native-radio variants with existing prices and no English e-book', () => {
  const s = setup();
  const radios = s.form.querySelectorAll('[name="variant"]');
  assert.deepEqual(radios.map(r => r.value), ['physical-UA', 'ebook-UA', 'physical-EN']);
  assert.ok(radios.every(r => r.type === 'radio'));
  assert.equal(s.context.CHECKOUT.variants['physical-UA'].price, 1000);
  assert.equal(s.context.CHECKOUT.variants['ebook-UA'].price, 800);
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
    assert.ok(s.get('co-ua-city').disabled && s.get('co-ua-branch').disabled);
    assert.equal(s.get('co-ua-city').getAttribute('aria-required'), 'true');
    for (const id of ['co-country','co-first-name','co-last-name','co-email','co-phone','co-ua-type']) assert.ok(s.get(id).required);
    for (const id of ['co-street','co-building','co-postal']) assert.ok(s.get(id).disabled && !s.get(id).required);
    s.change('co-country', 'PL');
    assert.ok(s.get('co-ukrainian-delivery').hidden);
    assert.ok(!s.get('co-international-delivery').hidden);
    for (const id of ['co-city','co-street','co-building']) assert.ok(s.get(id).required && !s.get(id).disabled);
    for (const id of ['co-apartment','co-address2','co-postal','co-region','co-comment']) assert.ok(!s.get(id).required && !s.get(id).disabled);
    assert.equal(s.get('co-ua-type').required, false);
    assert.equal(s.get('os-delivery').textContent, 'Вартість доставки буде розраховано.');
  }
});

test('e-book has only optional first name and required email; no shipping summary', () => {
  const s = setup();
  s.select('ebook-UA');
  assert.deepEqual(s.active(), ['co-email','co-first-name']);
  assert.ok(s.get('co-email').required);
  assert.equal(s.get('co-first-name').required, false);
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
  s.change('co-ua-type', 'locker');
  s.translate('EN');
  assert.equal(s.get('co-ua-type').value, 'locker');
  assert.match(s.get('co-ua-branch').options[0].textContent, /locker.*development/);
  s.change('co-country', 'PL');
  assert.equal(s.get('co-street').value, 'Test street');
});

test('incompatible Nova Poshta branch state clears when city or delivery type changes', () => {
  const s = setup();
  s.context.co.ukrainianDelivery.branch = 'test-only-stale-value';
  s.change('co-ua-type', 'locker');
  assert.equal(s.context.co.ukrainianDelivery.branch, '');
  // Exercise the future city-control integration without presenting mock records in the UI.
  s.context.co.ukrainianDelivery.branch = 'test-only-stale-value';
  s.get('co-ua-city').disabled = false;
  s.change('co-ua-city', 'test-only-city');
  assert.equal(s.context.co.ukrainianDelivery.branch, '');
  assert.ok(s.get('co-ua-city').disabled);
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

test('all checkout paths keep payment disabled, suppress submission, and use complete translations', () => {
  const s = setup();
  for (const language of ['UA','EN']) {
    s.translate(language);
    for (const variant of ['physical-UA','ebook-UA','physical-EN']) {
      s.select(variant);
      for (const country of ['UA','PL']) {
        if (variant !== 'ebook-UA') s.change('co-country', country);
        assert.ok(s.get('co-pay').disabled);
        assert.equal(s.get('co-pay').type, 'button');
        let prevented = false;
        s.form.dispatchEvent({ type: 'submit', preventDefault() { prevented = true; } });
        assert.ok(prevented);
      }
    }
    for (const attr of ['data-i18n','data-i18n-alt','data-i18n-aria','data-i18n-placeholder']) {
      for (const node of s.document.querySelectorAll('[' + attr + ']')) {
        assert.equal(typeof s.context.window.CHECKOUT_COPY[language][node.getAttribute(attr)], 'string', node.getAttribute(attr));
      }
    }
  }
  const source = read('app.js');
  assert.doesNotMatch(source, /fetch\(|XMLHttpRequest|sendBeacon|formResponse|buy\.stripe|submitOrder|openPayment/);
});

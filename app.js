'use strict';
const API_ACTIONS = ['/feeds', '/feeds/readed'];
const BASE_URL = 'http://localhost:8080';
// const API_ACTIONS = ['/setFeedItemReaded', '/getfeeditems'];
// const BASE_URL = 'https://feedapi.yatchapp.dev/api';

// Entry point for the application
const init = () => {
  try {
    // App title
    document.title = getLabel('title');
    // Pollyfill for functions not supported on all browsers
    polyfill();
    // Define if we runnig on mobile or not
    if (isMobile()) document.body.classList.add('mobile');
    // If share is supported, show share button
    if (!navigator?.share) document.body.classList.add('no-share');
    // Get more items when click on button
    ['more', 'back', 'share', 'close', 'config'].forEach((action) =>
      document.querySelectorAll(`.button-${action}`).forEach((el) => el.addEventListener('click', () => menuButton(action)))
    );
    // Add placeholder to all items with data-placeholder attribute and label for all elements with data-label attribute
    document.body.querySelectorAll('[data-placeholder]').forEach((el) => el.setAttribute('placeholder', getLabel(el.getAttribute('data-placeholder'))));
    document.body.querySelectorAll('[data-label]').forEach((el) => (el.innerText = getLabel(el.getAttribute('data-label'))));
    // update text of time every second
    setInterval(() => document.querySelectorAll('[data-timestamp]').forEach((el) => (el.innerText = dateText(el.getAttribute('data-timestamp')))), 5000);
    // Create scrollables Items
    createScrollableItems();
    // Config Form: Add close config event and email change event
    document.getElementById('config-button-close').addEventListener('click', () => closeConfig());
    document.getElementById('config-email-input').addEventListener('change', (event) => localStorage.setItem('email', event.target.value));
    // Load items
    getData({ useCache: true });
  } catch (err) {
    errorLog('init', err);
  }
};

// Error log
const errorLog = (location, err, label) => {
  console.log(`${location} error:`, err);
  showToast(label ? getLabel(label) : `${getLabel('errorIn')} ${location}`);
};

// Close config window
const closeConfig = () => {
  try {
    const oldFilter = localStorage.getItem('old-filter') ?? '[]';
    const newFilter = localStorage.getItem('filter') ?? '[]';
    if (oldFilter !== newFilter) {
      let data = localStorage.getItem('last-data');
      if (data) {
        data = JSON.parse(data);
        data.feeds = data.feeds.filter((item) => {
          const { sourceId } = item;
          const source = data.sources.find((source) => source.id === sourceId);
          return !newFilter.includes(CATEGORIES.indexOf(source.type) + 1);
        });
        // Use data to update items
        processItems(data);
      }
    }
    // Save new filter as old filter and close config
    localStorage.setItem('old-filter', newFilter);
    document.body.classList.remove('show-config');
  } catch (err) {
    document.body.classList.remove('show-config');
    errorLog('closeConfig', err);
  }
};

// Open config window
const openConfig = () => {
  localStorage.setItem('old-filter', localStorage.getItem('filter') ?? '[]');
  const [mailInput, categories, categoryPill] = ['config-email-input', 'config-categories', 'category-pill-template'].map((id) => document.getElementById(id));
  if (!categories || !categoryPill || !mailInput) return errorLog('openConfig', { error: 'elements not found' });
  // Clean categories and set the email
  categories.innerHTML = '';
  mailInput.value = localStorage.getItem('email') ?? '';
  // Add or remove categories
  const inputChange = (el) => {
    try {
      const {
        checked,
        dataset: { id },
      } = el;
      // Read categories and remove or add category, then save in local storage
      let filter = JSON.parse(localStorage.getItem('filter') ?? '[]');
      if (checked) filter.splice(filter.indexOf(parseInt(id)), 1);
      else filter.push(parseInt(id));
      filter.sort((a, b) => a - b);
      localStorage.setItem('filter', JSON.stringify(filter));
    } catch (err) {
      errorLog('inputChange', err);
    }
  };
  // Add categories
  try {
    let filter = JSON.parse(localStorage.getItem('filter') ?? '[]');
    for (let i = 0; i < CATEGORIES.length; i++) {
      const newPill = document.createElement('div');
      newPill.innerHTML = categoryPill.innerHTML.replace('{{category}}', getLabel(CATEGORIES[i]));
      const pill = newPill.firstElementChild;
      pill.style.backgroundColor = `var(--color-${i + 1})`;
      pill.dataset.id = i + 1;
      const input = pill.querySelector('input');
      input.checked = !filter.includes(i + 1);
      input.dataset.id = i + 1;
      pill.addEventListener('click', () => ((input.checked = !pill.querySelector('input').checked), inputChange(input)));
      input.addEventListener('click', (event) => (event.stopPropagation(), inputChange(input)));
      categories.appendChild(pill);
    }
    document.body.classList.add('show-config');
  } catch (err) {
    categories.innerHTML = '';
    errorLog('openConfig', err);
  }
};

// Simple toast
const showToast = (message) => {
  try {
    document.body.querySelectorAll('.toast-close').forEach((el) => el.click());
    const toastContainer = document.createElement('div');
    toastContainer.innerHTML = document.getElementById('toast-template').innerHTML.replaceAll('{{message}}', message);
    const toast = toastContainer.firstElementChild;
    toast.querySelector('.toast-close').addEventListener('click', () => (toast.classList.remove('show'), setTimeout(() => toast.remove(), 750)));
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
  } catch (err) {
    errorLog('showToast', err);
  }
};

// Close iframe
const closeIframe = () => {
  document.body.classList.remove('iframe-loading', 'iframe-open', 'iframe-error', 'iframe-ready');
  setTimeout(() => document.getElementById('item-iframe')?.remove(), 500);
};

// Open url on iframe
const openOnIframe = (values) => {
  try {
    document.body.classList.add('iframe-open', 'iframe-loading');
    // Add item preventing iframe load error
    let iFrame = document.getElementById('iframe-item');
    values = { ...values, iFrame }; // Clean replace, used only on items list
    iFrame.innerHTML = '';
    addItem(values);
    // Create and set iframe
    iFrame = createIframe(values);
    if (!iFrame) return;
    // Wait for iframe load (Interval 250 to 750)
    const start = Date.now();
    const checkIfReady = () => {
      // Loading finished
      if ((iFrame.contentWindow?.length ?? 0) > 0) {
        document.body.classList.remove('iframe-loading');
        document.body.classList.add('iframe-ready');
        return;
      }
      //
      if (Date.now() - start < 1000) setTimeout(checkIfReady, 250);
      else {
        document.body.classList.remove('iframe-loading');
        document.body.classList.add('iframe-error');
      }
    };
    // Start Check
    setTimeout(checkIfReady, 250);
  } catch (err) {
    errorLog('openOnIframe', err);
  }
};

// Create iframe and open url
const createIframe = (values) => {
  try {
    const { url } = values;
    if (url == '') return;
    const iFrameItem = document.getElementById('item-iframe');
    iFrameItem && iFrameItem.remove();
    const iframe = document.createElement('iframe');
    Object.assign(iframe, { id: 'item-iframe', allowfullscreen: 'false', referrerpolicy: 'same-origin', sandbox: 'allow-same-origin allow-scripts', src: url });
    iframe.classList.add('w-100vw', 'full-height', 'border-none');
    document.getElementById('iframe-iframe').appendChild(iframe);
    return iframe;
  } catch (err) {
    errorLog('createIframe', err);
  }
};

// Create scrollable items
const createScrollableItems = () => {
  // Add goto top functionalities on scrollable items (Defined by class scrollable)
  // Inside scrollable items, must manually add scroll button with class goto-top (Used to scroll to top)
  const scrollableItems = document.querySelectorAll('.scrollable');
  scrollableItems &&
    scrollableItems.forEach((el) =>
      el.addEventListener('scroll', (e) => (e.target.scrollTop > 20 ? el.classList.add('on-scroll') : el.classList.remove('on-scroll')))
    );
  document
    .querySelectorAll('.goto-top')
    .forEach((el) => el.addEventListener('click', (evt) => (evt.stopPropagation(), evt.preventDefault(), gotoTop(el.parentElement))));
};

// Share from iframe
const shareIframe = () => {
  try {
    const iframeOpen = document.body.classList.contains('iframe-open');
    if (!iframeOpen) return;
    const item = document.getElementById('iframe-item').querySelector('.list-item .item');
    if (!item) return;
    const { id, url } = item?.dataset ?? {};
    const title = item.querySelector('.title')?.innerText;
    const summary = (item.querySelector('.summary')?.innerText?.substring(0, 255) ?? '') + '...';
    share({ id, type: 'all', url, title, summary });
  } catch (err) {
    errorLog('shareIframe', err);
  }
};

// Open new webbrowser window with url from iframe
const openWeb = (values) => {
  window.open(values?.url ?? values, '_blank');
  closeIframe();
};

// Actions on menu button click
const menuButton = (action) => {
  const iframeVisible = document.body.classList.contains('iframe-open');
  const configVisible = document.body.classList.contains('show-config');
  if (action === 'back' && !iframeVisible && !configVisible) getData({ backFrom: LAST_READED });
  else if (action === 'more' && !iframeVisible && !configVisible) getData({ sendCurrentsAsReaded: true });
  else if (action === 'config' && !iframeVisible && !configVisible) openConfig();
  else if (action === 'share') shareIframe();
  else if (action === 'close') closeIframe();
};

// Make element response when visible
const respondWhenVisible = (element, callback) => {
  const options = { root: document.body };
  // Create observer to check item visibility
  const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (entry.intersectionRatio > 0) {
        observer.disconnect();
        callback();
      }
    });
  }, options);
  // Start watching
  observer.observe(element);
};

// Set item as readed
const setReaded = (feedsId) => {
  const callFecth = async () => await fetch(API_READED_URL.replace('{{feedsId}}', feedsId), { method: 'POST', headers: { 'x-user': currentUser() } });
  callFecth();
};

// Get current user (Or set if not exists)
const currentUser = () => {
  let user = localStorage.getItem('user');
  if (!user) {
    user = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('user', user);
  }
  return user;
};

// Remove listaneer from element (Clonnig it)
const removeListener = (el) => el.parentNode.replaceChild(el.cloneNode(true), el);

// Get email to send with one click
const currentEmail = (callback) => {
  let email = localStorage.getItem('email');
  if (!email) {
    // Clean email input
    const inputEmail = document.getElementById('input-email').querySelector('input');
    inputEmail.value = email ?? '';
    // Show input email
    document.body.classList.add('show-input-email');
    // Remove listener and add new one (For cancel)
    removeListener(document.getElementById('input-email-btn-cancel'));
    document.getElementById('input-email-btn-cancel').addEventListener('click', () => document.body.classList.remove('show-input-email'));
    // Remove listener and add new one (For continue)
    removeListener(document.getElementById('input-email-btn-continue'));
    document.getElementById('input-email-btn-continue').addEventListener('click', () => {
      const email = inputEmail.value;
      email && localStorage.setItem('email', email);
      callback && callback(email);
      document.body.classList.remove('show-input-email');
    });
    return;
  }
  callback && callback(email);
};

// Create item from data and add to list
const getItemData = (item, sources) => {
  try {
    const { id, link: url, title, content, publish } = item;
    const { name: sourceName, icon: sourceIcon, type: category } = sources.find((source) => source.id === item.sourceId);
    const author = item?.authors?.[0] ?? item?.author ?? '';
    const timestamp = new Date(new Date(publish).getTime() + new Date().getTimezoneOffset() * -1 * 60000).getTime();
    const summary = (content ?? '').trim() != '' ? content : item.summary;
    const categoryId = CATEGORIES.indexOf(category ?? 0) + 1;
    const image = getFirstImage(item.images);
    const categoryName = getLabel(category) ?? category;
    const date = dateText(timestamp);
    return { id, url, author, title, summary, sourceName, sourceIcon, timestamp, date, categoryId, category: categoryName, image };
  } catch (err) {
    errorLog('getItemData', err);
    return null;
  }
};

// Get first valid image from array of images
const getFirstImage = (images) => {
  if (!images || images.length == 0) return null;
  for (let i = 0; i < images.length; i++) {
    if (images[i].url) return images[i].url;
  }
  return null;
};

// Get data from API
const getData = ({ backFrom = '', sendCurrentsAsReaded = false, useCache = false }) => {
  // start load items
  document.body.classList.add('items-loading');

  // Data received from API
  let data = null;

  // Filters
  let filter = JSON.parse(localStorage.getItem('filter') ?? '[]');

  // Call to API
  fetchWithTimeout(
    API_ITEMS_URL
      .replace('{{count}}', 20)
      .replace('{{backFrom}}', backFrom)
      .replace('{{filter}}', filter.join(',')),
    { method: 'GET', headers: { 'x-user': currentUser() } }
  )
    .then(async (response) => {
      // Get data from response
      response = await response.json();
      if (response.status !== 'success') throw Error('internal-error');
      // Received and ready to proced
      data = { ...response };
      localStorage.setItem('last-data', JSON.stringify(data));
    })
    .catch((err) => {
      errorLog('procesing', {err}, 'errorRefreshing' );
      if (useCache) data = JSON.parse(localStorage.getItem('last-data') ?? null);
    })
    .finally(() => {
      try {
        if (backFrom) data.feeds.reverse();
        processItems(data);
      } catch (err) {
        errorLog('procesing', err, 'errorProcessing' );
      }
      // Finish items loading
      document.body.classList.remove('items-loading');
      document.body.classList.remove('loading');
    });
};

// Call to API to get items with timeout
const fetchWithTimeout = async (resource, options = {}) => {
  try {
    const { timeout = 8000 } = options;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    const response = await fetch(resource, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (err) {
    errorLog('fetchWithTimeout', err);
  }
};

// Transform timestamp to text like (5 minutes ago)...
const dateText = (timestamp) => {
  try {
    let s = Math.floor((new Date() - timestamp) / 1e3);
    const [y, m, d, h, mm] = [Math.floor(s / 31536e3), Math.floor(s / 2592e3), Math.floor(s / 86400), Math.floor(s / 3600), Math.floor(s / 60)];
    const [pre, pos] = [getLabel('prefix'), getLabel('postfix')];
    if (mm < 5) return getLabel('now');
    let response = { t: y, label: getLabel('year') };
    if (h < 1) response = { t: mm, label: getLabel('minute') };
    else if (d < 1) response = { t: h, label: getLabel('hour') };
    else if (m < 1) response = { t: d, label: getLabel('day') };
    else if (y < 1) response = { t: m, label: getLabel('month') };
    return `${pre} ${response.t} ${response.label} ${pos}`.trim();
  } catch (err) {
    errorLog('dateText', err);
    return '';
  }
};

// Image loaded correctly - Then check if it's small
const imageCheck = (type, item, img) => {
  try {
    if (img.naturalWidth <= 1 || img.naturalHeight <= 1) imageError(type, item, img);
    else if (type == 'source-icon' && img.width <= 64) item.querySelectorAll('.list-item .source-name').forEach((el) => el.classList.remove('hide'));
    else if (type == 'image' && img.naturalWidth <= 400) item.classList.add('image-small');
    else if (type == 'image' && img.naturalHeight > img.naturalWidth) item.classList.add('image-small', 'image-vertical');
    else item.classList.remove('image-small');
    // Need to set max-height for small images to respect aspect ratio
    if (type == 'image' && item.classList.contains('image-small')) img.style.maxHeight = `${parseInt(35 / (img.naturalWidth / img.naturalHeight))}vw`;
  } catch (err) {
    errorLog('imageCheck', err);
  }
};

// Get label
const getLabel = (label) => LABELS[label] ?? `*${label}*`;

// Add item to list
const addItem = (values) => {
  if (values.id == null) return errorLog('addItem', { error: 'id is null' }, values);
  try {
    let { id, url, title, summary, image, sourceIcon, categoryId, iFrame, replace } = values;
    // Replace values in template
    let html = ITEM_TEMPLATE.innerHTML;
    for (let key in values) html = html.replaceAll(`{{${key}}}`, values[key]);
    html = html.replaceAll('{{clickToGo}}', getLabel('clickToGo'));
    // Create new list item
    const item = document.createElement('div');
    item.addEventListener('click', () => (iFrame ? openWeb(values) : openOnIframe({ ...values, replace: null, iFrame: null })));
    if (iFrame) item.classList.add('iframe-mode');
    item.classList.add('list-item');
    item.innerHTML = html;
    item.querySelectorAll('.item-footer .category').forEach((el) => (el.style.backgroundColor = `var(--color-${categoryId})`));
    // Add image events, and then, load image
    ['.item-image', '.source img'].forEach((selector, idx) => {
      item.querySelectorAll(selector).forEach((el) => {
        const type = ['image', 'source-icon'][idx];
        const img = [image, sourceIcon][idx];
        if (img) {
          el.addEventListener('error', (evt) => imageError(type, item, evt.target));
          el.addEventListener('load', (evt) => imageCheck(type, item, evt.target));
          el.setAttribute('src', img);
        } else if (idx == 0) {
          // No image
          item.classList.add('no-image');
          imageError(type, item, el);
        }
      });
    });
    // Share buttons events
    ['all', 'email'].forEach((type) => {
      item.querySelector(`.share-${type}`).addEventListener('click', (evt) => {
        evt.stopPropagation();
        share({ id, type, url, title, summary });
      });
    });
    // Add item to list
    if (replace) replace.replaceWith(item);
    else if (iFrame) iFrame.appendChild(item);
    else ITEMS_CONTAINER.insertBefore(item, ITEMS_CONTAINER.firstElementChild || ITEMS_CONTAINER.querySelector('.list-finish'));
    // TODO: Ver como ordenada la primera vez y la segunda... (Insert before, firstElemetChild haze que se ordene al reves)
    // Set read when item is visible
    respondWhenVisible(item, () => ((LAST_READED = id), setReaded(id)));
  } catch (err) {
    errorLog('addItem', err);
  }
};

// Hide image on error, and set error class to item
const imageError = (type, item, img) => {
  img.classList.add('hide');
  if (type === 'source-icon') item.querySelectorAll('.source-name').forEach((el) => el.classList.remove('hide'));
  else if (type === 'image') item.classList.add('image-error');
};

// Share content
const share = ({ type, url, title, summary }) => {
  if (type === 'all') navigator.share({ url, title: `nuus: ${title}`, text: `${summary.substring(0, 255)}...` });
  else currentEmail((email) => mailTo(email, `nuus: ${title}`, `\n${url}\n\n`));
};

// Send email
const mailTo = (to, subject, body) => {
  let obj = document.createElement('a');
  (obj.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body + '')}`), obj.click();
};

// Mobile detection
const isMobile = () => /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// Process items received from API
const processItems = (data) => {
  try {
    const { sources, feeds: items } = data ?? { sources: [], feeds: [] };
    // Start scroll to top animation
    gotoTop(ITEMS_CONTAINER);
    // Mark items to be remove
    [...document.querySelectorAll('.list-item')].forEach((item) => item.classList.add('to-remove'));
    const itemsToRemove = [...document.querySelectorAll('.list-item.to-remove')];
    // Add new items (Replacing old ones) and remove remaining
    items && items.forEach((item) => addItem({ ...getItemData(item, sources), replace: itemsToRemove.shift() ?? null }));
    itemsToRemove && itemsToRemove.forEach((item) => item.remove());
    // If no items, add class to body or remove, if exists
    if (!items || items.length === 0) document.body.classList.add('no-items');
    else document.body.classList.remove('no-items');
    // Set as readed the first 3 items
    const readedToSend = [];
    items?.slice(0, 3)?.forEach((item) => readedToSend.push(item.id));
    if (readedToSend.length > 0) {
      LAST_READED = readedToSend[readedToSend.length - 1];
      setReaded(readedToSend.join(','));
    }
  } catch (err) {
    errorLog('processItems', err);
  }
};

// Scroll to top (Smooth)
const gotoTop = (el) => {
  if (el.classList.contains('scrolling') || el.scrollTop == 0) return;
  // Mark as scrolling
  el.classList.add('scrolling');
  // Scroll to top (Variable speed - Desaccelerating)
  const speed = [1.25, 1.2, 1.19, 1.17, 1.16];
  // Detect scroll change to stop - Must be var to exist through closures
  var lastScroll = el.scrollTop;
  const scrollNow = () => {
    try {
      const scroll = el.scrollTop;
      // Stop if scroll end
      //if (Math.abs(lastScroll - scroll) > 10 || scroll <= 0) {
      if (scroll <= 0) {
        el.classList.remove('scrolling');
        return;
      }
      el.scrollTop /= scroll > 1000 ? speed[0] : scroll > 500 ? speed[1] : scroll > 200 ? speed[2] : scroll > 100 ? speed[3] : speed[4];
      lastScroll = el.scrollTop;
      requestAnimationFrame(scrollNow);
    } catch (err) {
      el.scrollTop = 0;
      errorLog('gotoTop', err);
    }
  };
  // Start process
  scrollNow();
};

// Polyfills
const polyfill = () => {
  if (!String.prototype.replaceAll) {
    String.prototype.replaceAll = function (str, newStr) {
      if (Object.prototype.toString.call(str).toLowerCase() === '[object regexp]') return this.replace(str, newStr);
      return this.replace(new RegExp(str, 'g'), newStr);
    };
  }
};

// Constants
let LAST_READED = null;
// const API_ITEMS_URL = `${BASE_URL}${API_ACTIONS[0]}?count={{count}}&user={{user}}&back={{backFrom}}&filter={{filter}}`;
// const API_READED_URL = `${BASE_URL}${API_ACTIONS[1]}?user={{user}}&feedsId={{feedsId}}`;
const API_ITEMS_URL = `${BASE_URL}${API_ACTIONS[0]}?count={{count}}&back={{backFrom}}&filter={{filter}}`;
const API_READED_URL = `${BASE_URL}${API_ACTIONS[1]}?feedsId={{feedsId}}`;
const [ITEM_TEMPLATE, ITEMS_CONTAINER] = ['item-template', 'list-items-container'].map((id) => document.getElementById(id));

// Labels
const LABELS = {
  title: 'Nuus - Más que noticias...',
  loadMore: 'más noticias',
  general: 'General',
  criminal: 'Criminal',
  international: 'Internacional',
  political: 'Pol&iacute;tica',
  technology: 'Tecnolog&iacute;a',
  television: 'Televisi&oacute;n',
  science: 'Ciencia',
  national: 'Nacional',
  economical: 'Econom&iacute;a',
  latest: '&Uacute;ltima hora',
  startups: 'Startups',
  watches: 'Relojes',
  develope: 'Desarrollo',
  sport: 'Deportes',
  prefix: 'hace',
  postfix: '',
  year: 'año(s)',
  month: 'mes(es)',
  day: 'día(s)',
  hour: 'hora(s)',
  minute: 'minuto(s)',
  second: 'segundo(s)',
  now: 'ahora mismo',
  errorRefreshing: 'Error recuperando noticias',
  errorProcessing: 'Error procesando noticias',
  refresh: 'Recargar',
  clickToGo: '>> Click para ir a la web del artículo <<',
  enterEmail: 'Introduce tu email...',
  continue: 'Continuar',
  cancel: 'Cancelar',
  enterYourEmail: 'Introduce tu email',
  close: 'Cerrar',
  email: 'Email',
  categories: 'Categorías',
  errorIn: 'Error en',
};

// Categories
const CATEGORIES = [
  'general',
  'criminal',
  'international',
  'political',
  'technology',
  'television',
  'science',
  'national',
  'economical',
  'latest',
  'startups',
  'watches',
  'develope',
  'sport',
];

export { init };

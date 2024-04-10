'use strict';
const BASE_URL = 'https://feedapi.yatchapp.dev';
const LAST_ERROR = { type: '', time: 0 };

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
    // update text of time every 5 second
    setInterval(() => document.querySelectorAll('[data-timestamp]').forEach((el) => (el.innerText = dateText(el.getAttribute('data-timestamp')))), 5000);
    // Create scrollables Items
    createScrollableItems();
    // Config Form: Add close config event and email change event
    document.getElementById('config-button-close').addEventListener('click', () => closeConfig());
    document.getElementById('config-email-input').addEventListener('change', (event) => localStorage.setItem('email', event.target.value));
    // Create Categories
    createCategories();
    // Set filter state
    if (JSON.parse(localStorage.getItem('filter') ?? '[]').length > 0) document.body.classList.add('filter-on');
    // Load items
    getData({ useCache: true });
  } catch (err) {
    errorLog('init', err);
  }
};

// Error log
const errorLog = (location, err, label) => {
  if (LAST_ERROR.type === `${location}-${label}` && Date.now() - LAST_ERROR.time < 2500) return;
  LAST_ERROR.type = `${location}-${label}`;
  LAST_ERROR.time = Date.now();
  console.log(`${location} error:`, err);
  showToast(label ? getLabel(label) : `${getLabel('errorIn')} ${location}`);
};

// Close config window
const closeConfig = () => {
  try {
    const oldFilter = localStorage.getItem('old-filter') ?? '[]';
    const newFilter = localStorage.getItem('filter') ?? '[]';
    const filter = JSON.parse(newFilter);
    // Set filter state
    if (filter.length > 0) document.body.classList.add('filter-on');
    else document.body.classList.remove('filter-on');
    // If filter changed, filter the current data
    if (oldFilter !== newFilter) {
      let data = localStorage.getItem('last-data');
      if (data) {
        data = JSON.parse(data);
        data.feeds = data.feeds.filter((item) => {
          const { sourceId } = item;
          const source = data.sources.find((source) => source.id === sourceId);
          return !filter.includes(source.type);
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

// Add or remove categories
const inputCategoryChange = (el) => {
  try {
    const { checked } = el;
    const id = parseInt(el.dataset.id);
    // Read categories and remove or add category, then save in local storage
    let filter = JSON.parse(localStorage.getItem('filter') ?? '[]');
    let position = filter.indexOf(id);
    if (checked && position >= 0) filter.splice(position, 1);
    else if (!checked && !filter.includes(id)) filter.push(id);
    // Order and save
    filter.sort((a, b) => a - b);
    localStorage.setItem('filter', JSON.stringify(filter));
  } catch (err) {
    errorLog('inputChange', err);
  }
};

/* Create categories in config form */
const createCategories = () => {
  const [categories, categoryPill] = ['config-categories', 'category-pill-template'].map((id) => document.getElementById(id));
  try {
    // Config - Select All - Deselect All
    const setChecked = (el, state) => ((el.checked = state), inputCategoryChange(el));
    document
      .getElementById('config-categories-button-select-all')
      .addEventListener('click', () => document.querySelectorAll('#config-categories input').forEach((el) => setChecked(el, true)));
    document
      .getElementById('config-categories-button-deselect-all')
      .addEventListener('click', () => document.querySelectorAll('#config-categories input').forEach((el, idx) => setChecked(el, idx == 0)));
    // Change evet
    const clickEvent = (event) => {
      event.stopPropagation();
      if (document.querySelectorAll('.category-pill input:checked').length === 0) event.preventDefault();
      else inputCategoryChange(event.target);
    };
    // List of categories
    let newPill;
    for (let i = 1; i < CATEGORIES.length; i++) {
      newPill = document.createElement('div');
      newPill.innerHTML = categoryPill.innerHTML.replace('{{category}}', getLabel(CATEGORIES[i]));
      const pill = newPill.firstElementChild;
      pill.style.backgroundColor = `var(--color-${i})`;
      pill.dataset.id = i;
      const input = pill.querySelector('input');
      input.dataset.id = i;
      pill.addEventListener('click', () => pill.querySelector('input').click());
      input.addEventListener('click', (event) => clickEvent(event));
      categories.appendChild(pill);
    }
  } catch (err) {
    categories.innerHTML = '';
    errorLog('createCategories', err);
  }
};

// Open config window
const openConfig = () => {
  try {
    localStorage.setItem('old-filter', localStorage.getItem('filter') ?? '[]');
    // Set email
    document.getElementById('config-email-input').value = localStorage.getItem('email') ?? '';
    // Set categories
    let filter = JSON.parse(localStorage.getItem('filter') ?? '[]');
    document.querySelectorAll('.category-pill input[data-id]').forEach((el) => {
      const { id } = el.dataset;
      el.checked = !filter.includes(parseInt(id));
    });
    // Show config
    document.body.classList.add('show-config');
  } catch (err) {
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
    toast.addEventListener('click', () => (toast.classList.remove('show'), setTimeout(() => toast.remove(), 750)));
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
  } catch (err) {
    errorLog('showToast', err);
  }
};

// Remove iframe
const removeIframe = () => {
  document.getElementById('item-iframe')?.remove();
};

// Close iframe
const closeIframe = () => {
  document.body.classList.remove('iframe-loading', 'iframe-open', 'iframe-error', 'iframe-ready', 'iframe-no-url');
  setTimeout(() => removeIframe(), 500);
};

// Open url on iframe
const openOnIframe = (values) => {
  try {
    document.body.classList.add('iframe-open', 'iframe-loading');
    // Check if url is present
    if (values.url == '') {
      document.body.classList.add('iframe-no-url');
    }
    // Add item preventing iframe load error
    let iFrame = document.getElementById('iframe-item');
    values = { ...values, iFrame }; // Clean replace, used only on items list
    iFrame.innerHTML = '';
    addItem(values);
    // Create and set iframe
    iFrame = createIframe(values);
    if (!iFrame) {
      document.body.classList.remove('iframe-loading');
      document.body.classList.add('iframe-error');
      return;
    }
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
        removeIframe();
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
  if ((values?.url ?? values) == '') return;
  window.open(values?.url ?? values, '_blank');
  closeIframe();
};

// Actions on menu button click
const menuButton = (action) => {
  const inactive =
    document.body.classList.contains('iframe-open') || document.body.classList.contains('show-config') || document.body.classList.contains('items-loading');
  if (action === 'back' && !inactive) getData({ itemsBack: LAST_READED ?? 999999999999 });
  else if (action === 'more' && !inactive) getData({});
  else if (action === 'config' && !inactive) openConfig();
  else if (action === 'share') shareIframe();
  else if (action === 'close') closeIframe();
};

// Make element response when visible
const respondWhenVisible = (element, ignoreIfClass, callback) => {
  const options = { root: document.body };
  // Create observer to check item visibility
  const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (entry.intersectionRatio > 0) {
        if (ignoreIfClass && document.body.classList.contains(ignoreIfClass)) return;
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
  if (!feedsId) return;
  // If is in Back mode, don't send
  if (document.body.classList.contains('items-back')) return;
  // Send readed items to API
  const body = JSON.stringify({ feedsId });
  fetchWithTimeout(API_READED_URL, { method: 'POST', headers: { 'x-user': currentUser(), 'Content-Type': 'application/json' }, body }).catch((err) =>
    errorLog('setReaded', err, 'errorMarkReaded')
  );
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
    const { name: sourceName, icon: sourceIcon, type: sourceType } = sources.find((source) => source.id === item.sourceId);
    const author = item?.authors?.[0] ?? item?.author ?? '';
    const timestamp = new Date(new Date(publish).getTime() + new Date().getTimezoneOffset() * -1 * 60000).getTime();
    const summary = (content ?? '').trim() != '' ? content : item.summary;
    const image = getFirstImage(item.images);
    const sourceTypeLabel = getLabel(CATEGORIES[sourceType] ?? `TYPE-${sourceType}`);
    const date = dateText(timestamp);
    return { id, url, author, title, summary, sourceName, sourceIcon, timestamp, date, sourceType, sourceTypeLabel, image }; //
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
const getData = ({ itemsBack = '', useCache = false }) => {
  // start load items
  document.body.classList.add('items-loading');

  // Data received from API
  let data = null;

  // Set if working with back data or not
  if (itemsBack) document.body.classList.add('items-back');
  else document.body.classList.remove('items-back');

  // Call to API
  fetchWithTimeout(
    API_ITEMS_URL.replace('{{count}}', 20)
      .replace('{{itemsBack}}', itemsBack)
      .replace('{{filter}}', JSON.parse(localStorage.getItem('filter') ?? '[]').join(',')),
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
      errorLog('procesing', { err }, 'errorRefreshing');
      if (useCache) data = JSON.parse(localStorage.getItem('last-data') ?? null);
    })
    .finally(() => {
      try {
        processItems(data);
      } catch (err) {
        errorLog('procesing', err, 'errorProcessing');
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
    throw err;
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
    else if (type == 'image') item.classList.remove('image-small');
    // Need to set max-height for small images to respect aspect ratio (Max 50% of width)
    if (type == 'image' && item.classList.contains('image-small')) {
      let maxHeight = parseInt(25 / (img.naturalWidth / img.naturalHeight));
      if (maxHeight > 50) maxHeight = 50;
      img.style.maxHeight = `${maxHeight}vw`;
      img.style.aspectRatio = `${img.naturalWidth}/${img.naturalHeight}`;
      // img.style.width = `100%`; (Not needed, solved with aspect ratio)
    }
  } catch (err) {
    errorLog('imageCheck', err);
  }
};

// Get label
const getLabel = (label) => LABELS[label] ?? `*${label}*`;

// Convert html to plain text
function convertToPlain(html) {
  var tempDivElement = document.createElement('div');
  tempDivElement.innerHTML = html;
  return (tempDivElement.textContent || tempDivElement.innerText || '').replace(/<[^>]*>/g, '').replaceAll("replace('$'", '');
}
// Add item to list
const cleanExhoticChars = (text) => {
  return text.replaceAll('${', '$').replaceAll("$'", '$').replaceAll('$"', '$');
};

// Add item to list
const addItem = (values) => {
  if (values.id == null) return errorLog('addItem', { error: 'id is null' }, values);
  try {
    // Convert summary to plain text (And remove replace('$')
    values.summary = convertToPlain(values.summary);
    values.summary = cleanExhoticChars(values.summary);
    // TEST: Debug TEST (DEBUG)
    values.title = convertToPlain(values.title);
    values.author = convertToPlain(values.author);
    // Get values
    let { idx, id, url, title, summary, image, sourceIcon, sourceType, iFrame, insertOn } = values;
    // TEST: Custom image (DEBUG)
    // image = "https://ichef.bbci.co.uk/news/240/cpsprodpb/398b/live/a9b1cb50-d7e8-11ee-908e-43ce8c45f0a5.jpg"; // Imagen pequeña maduro.
    // values.author = ' <div class="editorial-container__name">Salud y Familia</div> <p class="news-with-big-headline-container__author">Andrea Jumique Castillo</p> <div class="editorial-container__date"><span class="posted-on"><time class="sart-time entry-date published updated" datetime="2024-02-23T16:56:08-06:00">23 de febrero de 2024</time></span></div>'
    // values.author = convertToPlain(values.author);
    // Replace values in template
    let html = ITEM_TEMPLATE.innerHTML;
    ['author', 'date', 'id', 'idx', 'image', 'sourceIcon', 'sourceName', 'sourceType', 'sourceTypeLabel', 'summary', 'timestamp', 'title', 'url'].forEach(
      (key) => {
        html = html.replaceAll(`{{${key}}}`, values[key]);
      }
    );
    // Replace labels
    html = html.replaceAll('{{clickToGo}}', getLabel('clickToGo'));
    // Create new list item
    const item = document.createElement('div');
    item.addEventListener('click', () => {
      if (document.body.classList.contains('items-loading')) return;
      iFrame ? openWeb(values) : openOnIframe({ ...values, insertOn: null, iFrame: null });
    });
    if (url == '') item.classList.add('no-url');
    if (iFrame) item.classList.add('iframe-mode');
    item.classList.add('list-item');
    item.innerHTML = html;
    item.querySelectorAll('.item-footer .category').forEach((el) => (el.style.backgroundColor = `var(--color-${sourceType})`));
    // Add image events, and then, load image
    ['.item-image', '.source img'].forEach((selector, idx) => {
      item.querySelectorAll(selector).forEach((el) => {
        let type = ['image', 'source-icon'][idx];
        let img = [image, sourceIcon][idx];
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
        if (document.body.classList.contains('items-loading')) return;
        evt.stopPropagation();
        share({ id, type, url, title, summary });
      });
    });
    // Add item to list
    if (insertOn) insertOn.replaceWith(item);
    else if (iFrame) iFrame.appendChild(item);
    else ITEMS_CONTAINER.insertBefore(item, ITEMS_CONTAINER.querySelector('.list-finish'));
    // Set read when item is visible
    if (!iFrame && idx > 2) respondWhenVisible(item, 'processing-items', () => setReaded(id));
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
    gotoTop(ITEMS_CONTAINER, 'processing-items');
    // Mark items to be remove
    [...document.querySelectorAll('.list-item')].forEach((item) => item.classList.add('to-remove'));
    const itemsToRemove = [...document.querySelectorAll('.list-item.to-remove')];
    // Add new items (Replacing old ones) and remove remaining
    const procceedItems = [];
    if (items && items.length > 0) {
      items.forEach((item, idx) => {
        procceedItems.push({ id: item.id, published: item.publish });
        addItem({ idx, ...getItemData(item, sources), insertOn: itemsToRemove.shift() ?? null });
      });
      LAST_READED = items[0].id;
    }
    // DEBUG: Show items processed
    // console.log('Items processed:', procceedItems);
    // Remove remaining items
    itemsToRemove && itemsToRemove.forEach((item) => item.remove());
    // If no items, add class to body or remove, if exists
    if (!items || items.length === 0) document.body.classList.add('no-items');
    else document.body.classList.remove('no-items');
    // Set as readed the items in viewport
    const readedToSend = [];
    items?.slice(0, 3)?.forEach((item) => readedToSend.push(item.id));
    items.forEach((item) => {
      let itemEl = document.querySelector(`.list-item [data-id="${item.id}"]`);
      if (itemEl && isInViewport(itemEl) && !readedToSend.includes(item.id)) readedToSend.push(item.id);
    });
    if (readedToSend.length > 0) setReaded(readedToSend.join(','));
  } catch (err) {
    errorLog('processItems', err);
  }
};

// Scroll to top (Smooth)
const gotoTop = (el, addClass) => {
  if (el.classList.contains('scrolling') || el.scrollTop == 0) return;
  // Add class to Body
  if (addClass) document.body.classList.add(addClass);
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
      if (scroll <= 0) {
        if (addClass) document.body.classList.remove(addClass);
        el.classList.remove('scrolling');
        return;
      }
      el.scrollTop /= scroll > 1000 ? speed[0] : scroll > 500 ? speed[1] : scroll > 200 ? speed[2] : scroll > 100 ? speed[3] : speed[4];
      lastScroll = el.scrollTop;
      requestAnimationFrame(scrollNow);
    } catch (err) {
      if (addClass) document.body.classList.remove(addClass);
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

// Check if elements is in viewport
function isInViewport(element) {
  var rect = element.getBoundingClientRect();
  var html = document.documentElement;
  return rect.top >= 0 && rect.left >= 0 && rect.bottom <= (window.innerHeight || html.clientHeight) && rect.right <= (window.innerWidth || html.clientWidth);
}

// Constants
let LAST_READED = null;
const API_ITEMS_URL = `${BASE_URL}/feeds?count={{count}}&back={{itemsBack}}&filter={{filter}}`;
const API_READED_URL = `${BASE_URL}/feeds-readed`;
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
  errorRefreshing: 'No estoy pudiendo recuperar las nuevas noticias...',
  errorProcessing: 'No he podido procesar las noticias recibidas...',
  refresh: 'Recargar',
  clickToGo: '>> Click para ir a la web del artículo <<',
  enterEmail: 'Introduce tu email...',
  continue: 'Continuar',
  cancel: 'Cancelar',
  enterYourEmail: 'Introduce tu email',
  close: 'Cerrar',
  email: 'Email',
  categories: 'Categorías',
  errorIn: 'Tengo problemas en',
  selectAll: 'todas',
  deselectAll: 'ninguna',
  errorMarkReaded: 'Tengo problemas para marcar las noticas como leídas...',
};

// Categories
const CATEGORIES = [
  '',
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

'use strict';
const BASE_URL = 'https://feedapi.yatchapp.dev';
const LAST_ERROR = { type: '', time: 0 };

// Entry point for the application
const init = () => {
  try {
    // Set the document title using a function
    setDocumentTitle('title');

    // Apply polyfill for functions not supported on all browsers
    applyPolyfill();

    // Check if the application is running on a mobile device and add a corresponding class to the body
    addMobileClass();

    // Check if the share feature is supported and add a class to the body accordingly
    addShareClass();

    // Add event listeners to various buttons
    addEventListenersToButtons();

    // Set placeholders and labels for elements with data-placeholder and data-label attributes
    setPlaceholdersAndLabels();

    // Update the text of elements with data-timestamp attribute periodically
    updateTimestampText();

    // Create scrollable items
    createScrollableItems();

    // Add event listeners for configuration form
    addConfigFormEventListeners();

    // Create categories
    createCategories();

    // Set filter state based on local storage
    setFilterState();

    // Load items
    loadData({ useCache: true });
  } catch (err) {
    logError('init', err);
  }
};

// Function to set the document title
const setDocumentTitle = (label) => {
  document.title = getLabel(label);
};

// Function to apply polyfill for unsupported functions
const applyPolyfill = () => {
  polyfill();
};

// Function to add mobile class to body if running on mobile
const addMobileClass = () => {
  if (isMobile()) {
    document.body.classList.add('mobile');
  }
};

// Function to add no-share class to body if share feature is not supported
const addShareClass = () => {
  if (!navigator?.share) {
    document.body.classList.add('no-share');
  }
};

// Function to add event listeners to various buttons
const addEventListenersToButtons = () => {
  ['more', 'back', 'share', 'close', 'config'].forEach((action) =>
    document.querySelectorAll(`.button-${action}`).forEach((el) =>
      el.addEventListener('click', () => menuButton(action))
    )
  );
};

// Function to set placeholders and labels for elements
const setPlaceholdersAndLabels = () => {
  document.body.querySelectorAll('[data-placeholder]').forEach((el) =>
    el.setAttribute('placeholder', getLabel(el.getAttribute('data-placeholder')))
  );
  document.body.querySelectorAll('[data-label]').forEach((el) =>
    (el.innerText = getLabel(el.getAttribute('data-label')))
  );
};

// Function to update the text of elements with data-timestamp attribute periodically
const updateTimestampText = () => {
  setInterval(() => {
    document.querySelectorAll('[data-timestamp]').forEach((el) =>
      (el.innerText = dateText(el.getAttribute('data-timestamp')))
    );
  }, 5000);
};

// Function to add event listeners for configuration form
const addConfigFormEventListeners = () => {
  document.getElementById('config-button-close').addEventListener('click', () => closeConfig());
  document.getElementById('config-email-input').addEventListener('change', (event) =>
    localStorage.setItem('email', event.target.value)
  );
};

// Function to set filter state based on local storage
const setFilterState = () => {
  if (JSON.parse(localStorage.getItem('filter') ?? '[]').length > 0) {
    document.body.classList.add('filter-on');
  }
};

// Function to load data
const loadData = ({ useCache }) => {
  getData({ useCache });
};

// Function to log errors
const logError = (context, error) => {
  errorLog(context, error);
};

// Error log function
const errorLog = (location, err, label) => {
  try {
    // Check if the last error occurred in the same location and within 2.5 seconds
    if (LAST_ERROR.type === `${location}-${label}` && Date.now() - LAST_ERROR.time < 2500) return;
    
    // Update last error details
    LAST_ERROR.type = `${location}-${label}`;
    LAST_ERROR.time = Date.now();
    
    // Log the error
    console.log(`${location} error:`, err);
    
    // Show toast notification with error message
    showToast(label ? getLabel(label) : `${getLabel('errorIn')} ${location}`);
  } catch (error) {
    console.error('Error while logging error:', error);
  }
};

// Function to close configuration window
const closeConfig = () => {
  try {
    // Get old and new filter values from local storage
    const oldFilter = localStorage.getItem('old-filter') ?? '[]';
    const newFilter = localStorage.getItem('filter') ?? '[]';
    const filter = JSON.parse(newFilter);
    
    // Update filter state
    if (filter.length > 0) {
      document.body.classList.add('filter-on');
    } else {
      document.body.classList.remove('filter-on');
    }
    
    // If filter changed, filter the current data
    if (oldFilter !== newFilter) {
      let data = localStorage.getItem('last-data');
      
      // Process data if available
      if (data) {
        data = JSON.parse(data);
        // Filter items based on the updated filter
        data.feeds = data.feeds.filter((item) => {
          const { sourceId } = item;
          const source = data.sources.find((source) => source.id === sourceId);
          return !filter.includes(source.type);
        });
        // Use filtered data to update items
        processItems(data);
      }
    }
    
    // Save new filter as old filter and close config
    localStorage.setItem('old-filter', newFilter);
    document.body.classList.remove('show-config');
  } catch (err) {
    // If an error occurs, close config window and log the error
    document.body.classList.remove('show-config');
    errorLog('closeConfig', err);
  }
};

// Function to handle changes in category inputs
const inputCategoryChange = (el) => {
  try {
    const { checked } = el;
    const id = parseInt(el.dataset.id);
    
    // Read current filter from local storage
    let filter = JSON.parse(localStorage.getItem('filter') ?? '[]');
    
    // Add or remove category based on checked status
    if (checked) {
      const position = filter.indexOf(id);
      if (position >= 0) {
        filter.splice(position, 1);
      }
    } else {
      if (!filter.includes(id)) {
        filter.push(id);
      }
    }
    
    // Sort and save the updated filter
    filter.sort((a, b) => a - b);
    localStorage.setItem('filter', JSON.stringify(filter));
  } catch (err) {
    // If an error occurs, log it
    errorLog('inputChange', err);
  }
};

// Function to create categories in the config form
const createCategories = () => {
  const categoriesContainer = document.getElementById('config-categories');
  const categoryPillTemplate = document.getElementById('category-pill-template');
  
  try {
    // Helper function to set checkbox state and trigger change event
    const setChecked = (el, state) => {
      el.checked = state;
      inputCategoryChange(el);
    };
    
    // Event listener for "Select All" button
    document.getElementById('config-categories-button-select-all').addEventListener('click', () => {
      document.querySelectorAll('#config-categories input').forEach((el) => setChecked(el, true));
    });
    
    // Event listener for "Deselect All" button
    document.getElementById('config-categories-button-deselect-all').addEventListener('click', () => {
      document.querySelectorAll('#config-categories input').forEach((el, idx) => setChecked(el, idx == 0));
    });
    
    // Event listener for category click
    const clickEvent = (event) => {
      event.stopPropagation();
      if (document.querySelectorAll('.category-pill input:checked').length === 0) event.preventDefault();
      else inputCategoryChange(event.target);
    };
    
    // Create category pills
    for (let i = 1; i < CATEGORIES.length; i++) {
      const newPill = document.createElement('div');
      newPill.innerHTML = categoryPillTemplate.innerHTML.replace('{{category}}', getLabel(CATEGORIES[i]));
      const pill = newPill.firstElementChild;
      pill.style.backgroundColor = `var(--color-${i})`;
      pill.dataset.id = i;
      const input = pill.querySelector('input');
      input.dataset.id = i;
      pill.addEventListener('click', () => pill.querySelector('input').click());
      input.addEventListener('click', (event) => clickEvent(event));
      categoriesContainer.appendChild(pill);
    }
  } catch (err) {
    // Clear categories container and log error
    categoriesContainer.innerHTML = '';
    errorLog('createCategories', err);
  }
};

// Function to open config window
const openConfig = () => {
  try {
    // Save old filter state
    localStorage.setItem('old-filter', localStorage.getItem('filter') ?? '[]');
    
    // Set email input value
    document.getElementById('config-email-input').value = localStorage.getItem('email') ?? '';
    
    // Set category checkboxes
    let filter = JSON.parse(localStorage.getItem('filter') ?? '[]');
    document.querySelectorAll('.category-pill input[data-id]').forEach((el) => {
      const { id } = el.dataset;
      el.checked = !filter.includes(parseInt(id));
    });
    
    // Show config window
    document.body.classList.add('show-config');
  } catch (err) {
    // Log error
    errorLog('openConfig', err);
  }
};

// Function to show toast notification
const showToast = (message) => {
  try {
    // Close existing toasts
    document.body.querySelectorAll('.toast-close').forEach((el) => el.click());
    
    // Create new toast element
    const toastContainer = document.createElement('div');
    toastContainer.innerHTML = document.getElementById('toast-template').innerHTML.replaceAll('{{message}}', message);
    const toast = toastContainer.firstElementChild;
    
    // Event listener to close toast on click
    toast.addEventListener('click', () => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 750);
    });
    
    // Append toast to body and show it
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
  } catch (err) {
    // Log error
    errorLog('showToast', err);
  }
};

// Function to close the iframe
const closeIframe = () => {
  try {
    const classesToRemove = ['iframe-loading', 'iframe-open', 'iframe-error', 'iframe-ready', 'iframe-no-url'];
    document.body.classList.remove(...classesToRemove);
    setTimeout(() => {
      const iframe = document.getElementById('item-iframe');
      if (iframe) iframe.remove();
    }, 500);
  } catch (err) {
    errorLog('closeIframe', err);
  }
};

// Function to open URL on iframe
const openOnIframe = (values) => {
  try {
    const { url } = values;
    document.body.classList.add('iframe-open', 'iframe-loading');
    if (!url) {
      document.body.classList.add('iframe-no-url');
      return;
    }
    const iFrame = createIframe(values);
    if (!iFrame) {
      document.body.classList.remove('iframe-loading');
      document.body.classList.add('iframe-error');
      return;
    }
    const start = Date.now();
    const checkIfReady = () => {
      if (iFrame.contentWindow?.length) {
        document.body.classList.remove('iframe-loading');
        document.body.classList.add('iframe-ready');
      } else if (Date.now() - start < 1000) {
        setTimeout(checkIfReady, 250);
      } else {
        document.body.classList.remove('iframe-loading');
        document.body.classList.add('iframe-error');
      }
    };
    setTimeout(checkIfReady, 250);
  } catch (err) {
    errorLog('openOnIframe', err);
  }
};

// Function to create iframe and open URL
const createIframe = (values) => {
  try {
    const { url } = values;
    if (!url) return null;
    const iFrameItem = document.getElementById('item-iframe');
    if (iFrameItem) iFrameItem.remove();
    const iframe = document.createElement('iframe');
    Object.assign(iframe, {
      id: 'item-iframe',
      allowfullscreen: 'false',
      referrerpolicy: 'same-origin',
      sandbox: 'allow-same-origin allow-scripts',
      src: url
    });
    iframe.classList.add('w-100vw', 'full-height', 'border-none');
    document.getElementById('iframe-iframe').appendChild(iframe);
    return iframe;
  } catch (err) {
    errorLog('createIframe', err);
    return null;
  }
};

// Function to create scrollable items
const createScrollableItems = () => {
  try {
    const scrollableItems = document.querySelectorAll('.scrollable');
    scrollableItems.forEach((el) => {
      el.addEventListener('scroll', () => {
        if (el.scrollTop > 20) {
          el.classList.add('on-scroll');
        } else {
          el.classList.remove('on-scroll');
        }
      });
    });
    const gotoTopButtons = document.querySelectorAll('.goto-top');
    gotoTopButtons.forEach((el) => {
      el.addEventListener('click', (evt) => {
        evt.stopPropagation();
        evt.preventDefault();
        gotoTop(el.parentElement);
      });
    });
  } catch (err) {
    errorLog('createScrollableItems', err);
  }
};

// Function to share from iframe
const shareIframe = () => {
  try {
    const iframeOpen = document.body.classList.contains('iframe-open');
    if (!iframeOpen) return;
    const item = document.getElementById('iframe-item').querySelector('.list-item .item');
    if (!item) return;
    const { id, url } = item.dataset || {};
    const title = item.querySelector('.title')?.innerText;
    const summary = (item.querySelector('.summary')?.innerText?.substring(0, 255) ?? '') + '...';
    share({ id, type: 'all', url, title, summary });
  } catch (err) {
    errorLog('shareIframe', err);
  }
};

// Function to open a new web browser window with URL from iframe
const openWeb = (values) => {
  try {
    const url = values?.url ?? values;
    if (!url) return;
    window.open(url, '_blank');
    closeIframe();
  } catch (err) {
    errorLog('openWeb', err);
  }
};

// Function to handle menu button actions
const menuButton = (action) => {
  try {
    const inactive =
      document.body.classList.contains('iframe-open') ||
      document.body.classList.contains('show-config') ||
      document.body.classList.contains('items-loading');
    if (!inactive) {
      switch (action) {
        case 'back':
          getData({ itemsBack: LAST_READED ?? 999999999999 });
          break;
        case 'more':
          getData({});
          break;
        case 'config':
          openConfig();
          break;
        case 'share':
          shareIframe();
          break;
        case 'close':
          closeIframe();
          break;
        default:
          break;
      }
    }
  } catch (err) {
    errorLog('menuButton', err);
  }
};

// Function to make an element respond when visible
const respondWhenVisible = (element, ignoreIfClass, callback) => {
  try {
    const options = { root: document.body };
    const observer = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (entry.intersectionRatio > 0) {
          if (ignoreIfClass && document.body.classList.contains(ignoreIfClass)) return;
          observer.disconnect();
          callback();
        }
      });
    }, options);
    observer.observe(element);
  } catch (err) {
    errorLog('respondWhenVisible', err);
  }
};

// Function to mark an item as read
const setReaded = (feedsId) => {
  try {
    if (!feedsId || document.body.classList.contains('items-back')) return;
    const body = JSON.stringify({ feedsId });
    fetchWithTimeout(API_READED_URL, {
      method: 'POST',
      headers: { 'x-user': currentUser(), 'Content-Type': 'application/json' },
      body
    }).catch((err) => errorLog('setReaded', err, 'errorMarkReaded'));
  } catch (err) {
    errorLog('setReaded', err);
  }
};

// Function to get the current user (or set if not exists)
const currentUser = () => {
  try {
    let user = localStorage.getItem('user');
    if (!user) {
      user = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('user', user);
    }
    return user;
  } catch (err) {
    errorLog('currentUser', err);
    return null;
  }
};

// Function to remove listener from element (cloning it)
const removeListener = (el) => {
  try {
    const clonedEl = el.cloneNode(true);
    el.parentNode.replaceChild(clonedEl, el);
  } catch (err) {
    errorLog('removeListener', err);
  }
};

// Function to get email to send with one click
const currentEmail = (callback) => {
  try {
    let email = localStorage.getItem('email');
    if (!email) {
      const inputEmail = document.getElementById('input-email').querySelector('input');
      inputEmail.value = email ?? '';
      document.body.classList.add('show-input-email');
      removeListener(document.getElementById('input-email-btn-cancel'));
      document.getElementById('input-email-btn-cancel').addEventListener('click', () => document.body.classList.remove('show-input-email'));
      removeListener(document.getElementById('input-email-btn-continue'));
      document.getElementById('input-email-btn-continue').addEventListener('click', () => {
        const email = inputEmail.value;
        if (email) localStorage.setItem('email', email);
        callback && callback(email);
        document.body.classList.remove('show-input-email');
      });
      return;
    }
    callback && callback(email);
  } catch (err) {
    errorLog('currentEmail', err);
  }
};

// Function to get item data
const getItemData = (item, sources) => {
  try {
    const { id, link: url, title, content, publish } = item;
    const { name: sourceName, icon: sourceIcon, type: sourceType } = sources.find((source) => source.id === item.sourceId);
    const author = item?.authors?.[0] ?? item?.author ?? '';
    const timestamp = new Date(new Date(publish).getTime() + new Date().getTimezoneOffset() * -1 * 60000).getTime();
    const summary = (content ?? '').trim() !== '' ? content : item.summary;
    const image = getFirstImage(item.images);
    const sourceTypeLabel = getLabel(CATEGORIES[sourceType] ?? `TYPE-${sourceType}`);
    const date = dateText(timestamp);
    return { id, url, author, title, summary, sourceName, sourceIcon, timestamp, date, sourceType, sourceTypeLabel, image };
  } catch (err) {
    errorLog('getItemData', err);
    return null;
  }
};

// Function to get the first valid image from an array of images
const getFirstImage = (images) => {
  if (!images || images.length === 0) return null;
  for (let i = 0; i < images.length; i++) {
    if (images[i].url) return images[i].url;
  }
  return null;
};

// Function to get data from the API
const getData = async ({ itemsBack = '', useCache = false }) => {
  try {
    // Start loading
    document.body.classList.add('items-loading');
    let data = null;
    
    // We are working with old data
    if (itemsBack) document.body.classList.add('items-back');
    else document.body.classList.remove('items-back');
    
    // Call to the API
    const response = await fetchWithTimeout(
      API_ITEMS_URL.replace('{{count}}', 20)
        .replace('{{itemsBack}}', itemsBack)
        .replace('{{filter}}', JSON.parse(localStorage.getItem('filter') ?? '[]').join(',')),
      { method: 'GET', headers: { 'x-user': currentUser() } }
    );
    const responseData = await response.json();
    if (responseData.status !== 'success') throw Error('internal-error');
    // Received data and ready to proceed
    data = { ...responseData };
    localStorage.setItem('last-data', JSON.stringify(data));
    processItems(data);
  } catch (err) {
    errorLog('getData', err);
    if (useCache) {
      data = JSON.parse(localStorage.getItem('last-data') ?? null);
      if (data) processItems(data);
    }
  } finally {
    // Finishing loading
    document.body.classList.remove('items-loading');
    document.body.classList.remove('loading');
  }
};

// Function to make a call to the API with a timeout
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

// Check if the image loaded correctly and then check if it's small
const imageCheck = (type, item, img) => {
  try {
    if (img.naturalWidth <= 1 || img.naturalHeight <= 1) imageError(type, item, img);
    else if (type === 'source-icon' && img.width <= 64) item.querySelectorAll('.list-item .source-name').forEach((el) => el.classList.remove('hide'));
    else if (type === 'image' && img.naturalWidth <= 400) item.classList.add('image-small');
    else if (type === 'image' && img.naturalHeight > img.naturalWidth) item.classList.add('image-small', 'image-vertical');
    else if (type === 'image') item.classList.remove('image-small');
    // Need to set max-height for small images to respect aspect ratio (Max 50% of width)
    if (type === 'image' && item.classList.contains('image-small')) {
      let maxHeight = parseInt(25 / (img.naturalWidth / img.naturalHeight));
      if (maxHeight > 50) maxHeight = 50;
      img.style.maxHeight = `${maxHeight}vw`;
      img.style.width = `100%`;
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
  return (tempDivElement.textContent || tempDivElement.innerText || '').replace(/<[^>]*>/g, '');
}

// Add item to list
const addItem = (values) => {
  if (values.id == null) return errorLog('addItem', { error: 'id is null' }, values);
  try {
    // Convert summary to plain text
    values.summary = convertToPlain(values.summary);
    values.title = convertToPlain(values.title);
    // Get values
    let { idx, id, url, title, summary, image, sourceIcon, sourceType, iFrame, insertOn } = values;
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
    if (url === '') item.classList.add('no-url');
    if (iFrame) item.classList.add('iframe-mode');
    item.classList.add('list-item');
    item.innerHTML = html;
    item.querySelectorAll('.item-footer .category').forEach((el) => (el.style.backgroundColor = `var(--color-${sourceType})`));
    // Add image events, and then, load image
    ['.item-image', '.source img'].forEach((selector, idx) => {
      item.querySelectorAll(selector).forEach((el) => {
        const type = ['image', 'source-icon'][idx];
        const img = [image, sourceIcon][idx];
        if (img) {
          el.addEventListener('error', (evt) => imageError(type, item, evt.target));
          el.addEventListener('load', (evt) => imageCheck(type, item, evt.target));
          el.setAttribute('src', img);
        } else if (idx === 0) {
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
    // Mark items to be removed
    [...document.querySelectorAll('.list-item')].forEach((item) => item.classList.add('to-remove'));
    const itemsToRemove = [...document.querySelectorAll('.list-item.to-remove')];
    // Add new items (Replacing old ones) and remove remaining
    const processedItems = [];
    if (items && items.length > 0) {
      items.forEach((item, idx) => {
        processedItems.push({ id: item.id, published: item.publish });
        addItem({ idx, ...getItemData(item, sources), insertOn: itemsToRemove.shift() ?? null });
      });
      LAST_READED = items[0].id;
    }
    // DEBUG: Show items processed
    // console.log('Items processed:', processedItems);
    // Remove remaining items
    itemsToRemove && itemsToRemove.forEach((item) => item.remove());
    // If no items, add class to body or remove if exists
    if (!items || items.length === 0) document.body.classList.add('no-items');
    else document.body.classList.remove('no-items');
    // Set as read the first 3 items
    const readToSend = [];
    items?.slice(0, 3)?.forEach((item) => readToSend.push(item.id));
    if (readToSend.length > 0) setReaded(readToSend.join(','));
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
      // Stop if scroll ends
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
  // Check if the replaceAll method is available, if not, polyfill it
  if (!String.prototype.replaceAll) {
    String.prototype.replaceAll = function (str, newStr) {
      // If str is a regular expression, use the native replace method
      if (Object.prototype.toString.call(str).toLowerCase() === '[object regexp]') return this.replace(str, newStr);
      // Otherwise, use a regular expression with global flag to replace all occurrences
      return this.replace(new RegExp(str, 'g'), newStr);
    };
  }
};

// Constants
// Initialize LAST_READED to null
let LAST_READED = null;
// Define API URLs using template literals
const API_ITEMS_URL = `${BASE_URL}/feeds?count={{count}}&back={{itemsBack}}&filter={{filter}}`;
const API_READED_URL = `${BASE_URL}/feeds-readed`;
// Get references to HTML elements by their IDs and assign them to variables
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

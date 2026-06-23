const euro = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });
const dateFormat = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
let activeMenuData = null;
let selectedCategory = '';
let menuSearch = '';
let revealObserver = null;

const openingHours = [
  { day: 'Zondag', open: '16:00', close: '20:00' },
  { day: 'Maandag', open: '10:00', close: '20:00' },
  { day: 'Dinsdag', open: '10:00', close: '20:00' },
  { day: 'Woensdag', open: '10:00', close: '20:00' },
  { day: 'Donderdag', open: '10:00', close: '20:00' },
  { day: 'Vrijdag', open: '10:00', close: '20:00' },
  { day: 'Zaterdag', open: '11:30', close: '20:00' }
];

function minutesSinceMidnight(value) {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function nextOpenSlot(now) {
  const today = now.getDay();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  for (let offset = 0; offset < 8; offset += 1) {
    const dayIndex = (today + offset) % 7;
    const hours = openingHours[dayIndex];
    if (offset === 0 && minutesSinceMidnight(hours.open) <= currentMinutes) continue;
    return { ...hours, offset };
  }
  return null;
}

function updateHours() {
  const now = new Date();
  const today = openingHours[now.getDay()];
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const openMinutes = minutesSinceMidnight(today.open);
  const closeMinutes = minutesSinceMidnight(today.close);
  const target = document.querySelector('#today-hours');
  const open = currentMinutes >= openMinutes && currentMinutes < closeMinutes;
  let statusText = '';

  if (open) {
    statusText = `Nu open · tot ${today.close}`;
    target.textContent = statusText;
    target.classList.add('is-open');
  } else {
    const next = nextOpenSlot(now);
    const label = next?.offset === 0 ? 'vandaag' : next?.offset === 1 ? 'morgen' : next?.day.toLowerCase();
    statusText = next ? `Nu gesloten · open ${label} om ${next.open}` : 'Bekijk openingstijden';
    target.textContent = statusText;
    target.classList.remove('is-open');
  }

  document.querySelectorAll('[data-hours-status]').forEach(element => {
    element.textContent = statusText;
    element.classList.toggle('is-open', open);
  });
}

function renderSpecial(special) {
  const section = document.querySelector('#special-section');
  const teaser = document.querySelector('#monthly-teaser');
  section.hidden = !special?.active;
  teaser.hidden = !special?.active;
  if (!special?.active) return;
  const image = document.querySelector('#special-image');
  const number = document.querySelector('.special-number');
  document.querySelector('#special-month').textContent = special.month;
  document.querySelector('#special-name').textContent = special.name;
  document.querySelector('#special-description').textContent = special.description;
  document.querySelector('#special-price').textContent = euro.format(special.price);
  document.querySelector('#monthly-teaser-name').textContent = special.name || 'Bekijk de special';
  if (special.imageUrl) {
    image.src = special.imageUrl;
    image.alt = special.name ? `Snack van de maand: ${special.name}` : 'Snack van de maand';
    image.hidden = false;
    number.hidden = true;
  } else {
    image.hidden = true;
    number.hidden = false;
  }
}

function productMarkup(product) {
  if (Array.isArray(product.variants) && product.variants.length) {
    return `<article class="menu-product menu-product-sized">
      <div class="menu-product-title">${escapeHtml(product.name)}</div>
      <div class="size-options">
        ${product.variants.map(variant => `<div class="size-option"><span>${escapeHtml(variant.label)}</span><strong>${euro.format(variant.price)}</strong></div>`).join('')}
      </div>
    </article>`;
  }
  return `<article class="menu-item">
    <span class="menu-item-name">${escapeHtml(product.name)}</span><span class="menu-dots"></span><span class="menu-price">${euro.format(product.price)}</span>
  </article>`;
}

function productMatchesSearch(product, category, query) {
  if (!query) return true;
  const haystack = [
    product.name,
    category?.name,
    ...(Array.isArray(product.variants) ? product.variants.map(variant => variant.label) : [])
  ].join(' ').toLowerCase();
  return haystack.includes(query);
}

function renderMenu(data, selected = selectedCategory) {
  activeMenuData = data;
  selectedCategory = selected;
  const categories = [...data.categories].sort((a, b) => a.position - b.position);
  const visibleProducts = data.products.filter(product => product.visible && !product.archived);
  const query = menuSearch.trim().toLowerCase();
  const tabs = document.querySelector('#category-tabs');
  tabs.innerHTML = `<button class="category-tab ${selected === '' ? 'active' : ''}" data-category="" aria-pressed="${selected === ''}">Alles</button>` + categories.map(category =>
    `<button class="category-tab ${selected === category.id ? 'active' : ''}" data-category="${category.id}" aria-pressed="${selected === category.id}">${escapeHtml(category.name)}</button>`
  ).join('');

  const shownCategories = selected ? categories.filter(category => category.id === selected) : categories;
  const sections = shownCategories.map(category => {
    const products = visibleProducts
      .filter(product => product.categoryId === category.id)
      .filter(product => productMatchesSearch(product, category, query))
      .sort((a, b) => a.position - b.position);
    if (!products.length) return '';
    return `<section class="menu-category ${selected ? 'full' : ''}">
      <h3>${escapeHtml(category.name)} <span>${String(products.length).padStart(2, '0')}</span></h3>
      ${products.map(productMarkup).join('')}
    </section>`;
  }).join('');
  document.querySelector('#menu-grid').innerHTML = sections || `<p class="menu-empty">${query ? `Geen producten gevonden voor “${escapeHtml(menuSearch.trim())}”.` : 'Binnenkort vind je hier onze producten.'}</p>`;

  tabs.querySelectorAll('button').forEach(button => button.addEventListener('click', () => {
    renderMenu(data, button.dataset.category);
    document.querySelector('#menu').scrollIntoView({ block: 'start' });
  }));
  observeRevealElements(document.querySelectorAll('.menu-category'));
}

function renderPopular(data) {
  const section = document.querySelector('#popular-section');
  const grid = document.querySelector('#popular-grid');
  const ids = Array.isArray(data.popularProductIds) ? data.popularProductIds : [];
  const visibleProducts = data.products.filter(product => product.visible && !product.archived);
  const products = ids
    .map(id => visibleProducts.find(product => product.id === id))
    .filter(Boolean)
    .slice(0, 6);

  section.hidden = !products.length;
  if (!products.length) return;

  grid.innerHTML = products.map((product, index) => {
    const category = data.categories.find(item => item.id === product.categoryId);
    return `<article class="popular-card">
      <span class="popular-index">${String(index + 1).padStart(2, '0')}</span>
      <div>
        <h3>${escapeHtml(product.name)}</h3>
        <p>${escapeHtml(category?.name || 'Menukaart')}</p>
      </div>
      <strong>${Array.isArray(product.variants) && product.variants.length ? `vanaf ${euro.format(product.price)}` : euro.format(product.price)}</strong>
    </article>`;
  }).join('');
  observeRevealElements(grid.querySelectorAll('.popular-card'));
}

function observeRevealElements(elements) {
  elements.forEach((element, index) => {
    if (
      !element.classList.contains('reveal-on-scroll')
      && !element.classList.contains('reveal-child')
      && !element.classList.contains('reveal-fly-in')
    ) {
      element.classList.add('reveal-on-scroll');
    }
    element.style.setProperty('--reveal-delay', `${Math.min(index * 55, 220)}ms`);
    if (revealObserver) {
      element.classList.remove('is-visible');
      revealObserver.observe(element);
    } else {
      element.classList.add('is-visible');
    }
  });
}

function initScrollReveals() {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const elements = document.querySelectorAll('.reveal-on-scroll, .reveal-child, .reveal-fly-in');

  if (prefersReducedMotion || !('IntersectionObserver' in window)) {
    elements.forEach(element => element.classList.add('is-visible'));
    return;
  }

  revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });

  elements.forEach((element, index) => {
    if (element.classList.contains('reveal-child')) {
      element.style.setProperty('--reveal-delay', `${Math.min(index * 70, 220)}ms`);
    }
    revealObserver.observe(element);
  });
}

function renderLastUpdated(value) {
  const target = document.querySelector('#menu-updated');
  if (!target) return;
  const date = value ? new Date(value) : null;
  target.textContent = date && !Number.isNaN(date.getTime())
    ? `Menukaart laatst bijgewerkt: ${dateFormat.format(date)}.`
    : 'Vraag ons gerust naar allergenen.';
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

async function loadMenu() {
  try {
    const response = await fetch('/api/menu');
    if (!response.ok) throw new Error();
    const data = await response.json();
    renderSpecial(data.monthlySpecial);
    renderPopular(data);
    renderLastUpdated(data.lastUpdated);
    renderMenu(data);
  } catch {
    document.querySelector('#menu-grid').innerHTML = '<p class="menu-empty">De menukaart kan nu niet worden geladen. Bel ons gerust voor het actuele aanbod.</p>';
    renderLastUpdated();
  }
}

document.querySelector('.nav-toggle').addEventListener('click', event => {
  const nav = document.querySelector('.main-nav');
  const open = nav.classList.toggle('open');
  event.currentTarget.setAttribute('aria-expanded', String(open));
});
document.querySelectorAll('.main-nav a').forEach(link => link.addEventListener('click', () => {
  document.querySelector('.main-nav').classList.remove('open');
  document.querySelector('.nav-toggle').setAttribute('aria-expanded', 'false');
}));
document.querySelector('#year').textContent = new Date().getFullYear();
document.querySelector('#menu-search').addEventListener('input', event => {
  menuSearch = event.currentTarget.value;
  if (activeMenuData) renderMenu(activeMenuData);
});
updateHours();
initScrollReveals();
loadMenu();

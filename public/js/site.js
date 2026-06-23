const euro = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });

function updateHours() {
  const hours = [
    '16:00 — 20:00',
    '10:00 — 20:00',
    '10:00 — 20:00',
    '10:00 — 20:00',
    '10:00 — 20:00',
    '10:00 — 20:00',
    '11:30 — 20:00'
  ];
  document.querySelector('#today-hours').textContent = hours[new Date().getDay()];
}

function renderSpecial(special) {
  const section = document.querySelector('#special-section');
  section.hidden = !special?.active;
  if (!special?.active) return;
  document.querySelector('#special-month').textContent = special.month;
  document.querySelector('#special-name').textContent = special.name;
  document.querySelector('#special-description').textContent = special.description;
  document.querySelector('#special-price').textContent = euro.format(special.price);
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

function renderMenu(data, selected = '') {
  const categories = [...data.categories].sort((a, b) => a.position - b.position);
  const visibleProducts = data.products.filter(product => product.visible);
  const tabs = document.querySelector('#category-tabs');
  tabs.innerHTML = `<button class="category-tab ${selected === '' ? 'active' : ''}" data-category="" aria-pressed="${selected === ''}">Alles</button>` + categories.map(category =>
    `<button class="category-tab ${selected === category.id ? 'active' : ''}" data-category="${category.id}" aria-pressed="${selected === category.id}">${escapeHtml(category.name)}</button>`
  ).join('');

  const shownCategories = selected ? categories.filter(category => category.id === selected) : categories;
  const sections = shownCategories.map(category => {
    const products = visibleProducts
      .filter(product => product.categoryId === category.id)
      .sort((a, b) => a.position - b.position);
    if (!products.length) return '';
    return `<section class="menu-category ${selected ? 'full' : ''}">
      <h3>${escapeHtml(category.name)} <span>${String(products.length).padStart(2, '0')}</span></h3>
      ${products.map(productMarkup).join('')}
    </section>`;
  }).join('');
  document.querySelector('#menu-grid').innerHTML = sections || '<p class="menu-empty">Binnenkort vind je hier onze producten.</p>';

  tabs.querySelectorAll('button').forEach(button => button.addEventListener('click', () => {
    renderMenu(data, button.dataset.category);
    document.querySelector('#menu').scrollIntoView({ block: 'start' });
  }));
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
    renderMenu(data);
  } catch {
    document.querySelector('#menu-grid').innerHTML = '<p class="menu-empty">De menukaart kan nu niet worden geladen. Bel ons gerust voor het actuele aanbod.</p>';
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
updateHours();
loadMenu();

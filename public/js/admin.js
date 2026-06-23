let menuData = { categories: [], products: [], monthlySpecial: {} };
const euro = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });
const loginView = document.querySelector('#login-view');
const adminApp = document.querySelector('#admin-app');
const productDialog = document.querySelector('#product-dialog');
const categoryDialog = document.querySelector('#category-dialog');

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && url !== '/api/login') showLogin();
    throw new Error(data.error || 'Er ging iets mis');
  }
  return data;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

function showLogin() {
  loginView.hidden = false;
  adminApp.hidden = true;
}

async function showAdmin() {
  loginView.hidden = true;
  adminApp.hidden = false;
  await refreshData();
}

async function refreshData() {
  menuData = await api('/api/menu');
  renderProducts();
  renderCategories();
  populateSpecial();
}

function categoryName(id) {
  return menuData.categories.find(category => category.id === id)?.name || 'Onbekend';
}

function categoryPosition(id) {
  return menuData.categories.find(category => category.id === id)?.position || 9999;
}

function orderedCategories() {
  return [...menuData.categories].sort((a, b) => a.position - b.position);
}

function filteredProducts() {
  const search = document.querySelector('#product-search').value.trim().toLowerCase();
  const category = document.querySelector('#category-filter').value;
  return [...menuData.products]
    .filter(product => (!search || product.name.toLowerCase().includes(search)) && (!category || product.categoryId === category))
    .sort((a, b) => categoryPosition(a.categoryId) - categoryPosition(b.categoryId) || a.position - b.position || a.name.localeCompare(b.name, 'nl'));
}

function isPopular(id) {
  return Array.isArray(menuData.popularProductIds) && menuData.popularProductIds.includes(id);
}

function productPriceSummary(product) {
  if (Array.isArray(product.variants) && product.variants.length) {
    const lowest = Math.min(...product.variants.map(variant => Number(variant.price)));
    return `vanaf ${euro.format(lowest)}`;
  }
  return euro.format(product.price);
}

function renderProducts() {
  const categoryFilter = document.querySelector('#category-filter');
  const currentFilter = categoryFilter.value;
  categoryFilter.innerHTML = '<option value="">Alle categorieën</option>' + orderedCategories().map(category => `<option value="${category.id}">${escapeHtml(category.name)}</option>`).join('');
  categoryFilter.value = currentFilter;
  const products = filteredProducts();
  document.querySelector('#product-table').innerHTML = products.map(product => `<tr>
    <td class="product-name">${escapeHtml(product.name)}</td>
    <td>${escapeHtml(categoryName(product.categoryId))}</td>
    <td class="price-cell">${productPriceSummary(product)}</td>
    <td><span class="badge ${product.visible ? 'visible' : 'hidden'}">${product.visible ? 'Zichtbaar' : 'Verborgen'}</span>${isPopular(product.id) ? '<span class="badge popular">Populair</span>' : ''}</td>
    <td><div class="row-actions"><button class="icon-button edit-product" data-id="${product.id}" title="Bewerken">✎</button><button class="icon-button delete-product" data-id="${product.id}" title="Verwijderen">×</button></div></td>
  </tr>`).join('') || '<tr><td colspan="5">Geen producten gevonden.</td></tr>';
  document.querySelector('#mobile-product-list').innerHTML = products.map(product => `<article class="mobile-product">
    <p><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(categoryName(product.categoryId))} · ${product.visible ? 'Zichtbaar' : 'Verborgen'}${isPopular(product.id) ? ' · Populair' : ''}</small></p>
    <span class="price-cell">${productPriceSummary(product)}</span>
    <div class="row-actions"><button class="icon-button edit-product" data-id="${product.id}">✎</button><button class="icon-button delete-product" data-id="${product.id}">×</button></div>
  </article>`).join('');
  attachProductActions();
}

function addVariantRow(label = '', price = '') {
  const row = document.createElement('div');
  row.className = 'variant-row';
  row.innerHTML = `<label>Maat<input class="variant-label" value="${escapeHtml(label)}" placeholder="Bijv. Groot" required></label>
    <label>Prijs (€)<input class="variant-price" type="number" min="0" step="0.05" value="${price}" required></label>
    <button class="icon-button remove-variant" type="button" aria-label="Maat verwijderen">×</button>`;
  row.querySelector('.remove-variant').addEventListener('click', () => row.remove());
  document.querySelector('#variant-rows').append(row);
}

function setVariantMode(active) {
  const form = document.querySelector('#product-form');
  const editor = document.querySelector('#variant-editor');
  const standardPrice = document.querySelector('#standard-price-field');
  form.elements.hasVariants.checked = active;
  editor.hidden = !active;
  standardPrice.hidden = active;
  form.elements.price.required = !active;
  if (active && !document.querySelector('#variant-rows').children.length) addVariantRow();
}

function attachProductActions() {
  document.querySelectorAll('.edit-product').forEach(button => button.addEventListener('click', () => openProductDialog(button.dataset.id)));
  document.querySelectorAll('.delete-product').forEach(button => button.addEventListener('click', () => deleteProduct(button.dataset.id)));
}

function openProductDialog(id = '') {
  const form = document.querySelector('#product-form');
  form.reset();
  form.dataset.mode = 'create';
  form.elements.id.value = '';
  form.elements.id.defaultValue = '';
  form.elements.categoryId.innerHTML = orderedCategories().map(category => `<option value="${category.id}">${escapeHtml(category.name)}</option>`).join('');
  form.elements.visible.checked = true;
  form.elements.popular.checked = false;
  document.querySelector('#variant-rows').innerHTML = '';
  setVariantMode(false);
  document.querySelector('#product-message').textContent = '';
  const product = menuData.products.find(item => item.id === id);
  document.querySelector('#product-dialog-title').textContent = product ? 'Product bewerken' : 'Product toevoegen';
  if (product) {
    form.dataset.mode = 'edit';
    form.elements.id.value = product.id;
    form.elements.name.value = product.name;
    form.elements.price.value = product.price.toFixed(2);
    form.elements.categoryId.value = product.categoryId;
    form.elements.visible.checked = product.visible;
    form.elements.popular.checked = isPopular(product.id);
    if (Array.isArray(product.variants) && product.variants.length) {
      document.querySelector('#variant-rows').innerHTML = '';
      product.variants.forEach(variant => addVariantRow(variant.label, Number(variant.price).toFixed(2)));
      setVariantMode(true);
    }
  }
  productDialog.showModal();
}

async function deleteProduct(id) {
  const product = menuData.products.find(item => item.id === id);
  if (!product || !window.confirm(`‘${product.name}’ permanent verwijderen?`)) return;
  await api(`/api/admin/products/${encodeURIComponent(id)}`, { method: 'DELETE' });
  await refreshData();
}

function renderCategories() {
  const grid = document.querySelector('#category-admin-grid');
  grid.innerHTML = orderedCategories().map(category => {
    const count = menuData.products.filter(product => product.categoryId === category.id).length;
    return `<article class="category-admin-card">
      <div><strong>${escapeHtml(category.name)}</strong><span>${count} ${count === 1 ? 'product' : 'producten'}</span></div>
      <div class="row-actions"><button class="icon-button edit-category" data-id="${category.id}" title="Bewerken">✎</button><button class="icon-button delete-category" data-id="${category.id}" title="Verwijderen">×</button></div>
    </article>`;
  }).join('');
  document.querySelectorAll('.edit-category').forEach(button => button.addEventListener('click', () => openCategoryDialog(button.dataset.id)));
  document.querySelectorAll('.delete-category').forEach(button => button.addEventListener('click', () => deleteCategory(button.dataset.id)));
}

function openCategoryDialog(id = '') {
  const form = document.querySelector('#category-form');
  form.reset();
  document.querySelector('#category-message').textContent = '';
  const category = menuData.categories.find(item => item.id === id);
  document.querySelector('#category-dialog-title').textContent = category ? 'Categorie bewerken' : 'Categorie toevoegen';
  if (category) {
    form.elements.id.value = category.id;
    form.elements.name.value = category.name;
  }
  categoryDialog.showModal();
}

async function deleteCategory(id) {
  const category = menuData.categories.find(item => item.id === id);
  if (!category || !window.confirm(`Categorie ‘${category.name}’ verwijderen?`)) return;
  try {
    await api(`/api/admin/categories/${encodeURIComponent(id)}`, { method: 'DELETE' });
    await refreshData();
  } catch (error) {
    window.alert(error.message);
  }
}

function populateSpecial() {
  const form = document.querySelector('#special-form');
  const special = menuData.monthlySpecial;
  form.elements.name.value = special.name || '';
  form.elements.month.value = special.month || '';
  form.elements.description.value = special.description || '';
  form.elements.imageUrl.value = special.imageUrl || '';
  form.elements.price.value = Number(special.price || 0).toFixed(2);
  form.elements.active.checked = special.active !== false;
}

function showView(name) {
  document.querySelectorAll('.admin-view').forEach(view => { view.hidden = view.id !== `${name}-view`; });
  document.querySelectorAll('.admin-nav').forEach(button => button.classList.toggle('active', button.dataset.view === name));
  document.querySelector('#view-title').textContent = ({ products: 'Menukaart', special: 'Snack van de maand', categories: 'Categorieën' })[name];
  document.querySelector('.admin-sidebar').classList.remove('open');
}

document.querySelector('#login-form').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const message = document.querySelector('#login-message');
  message.textContent = '';
  try {
    await api('/api/login', { method: 'POST', body: JSON.stringify({ password: form.elements.password.value }) });
    form.reset();
    await showAdmin();
  } catch (error) {
    message.textContent = error.message;
  }
});

document.querySelector('#logout-button').addEventListener('click', async () => {
  await api('/api/logout', { method: 'POST' });
  showLogin();
});
document.querySelectorAll('.admin-nav').forEach(button => button.addEventListener('click', () => showView(button.dataset.view)));
document.querySelector('.admin-menu-toggle').addEventListener('click', () => document.querySelector('.admin-sidebar').classList.toggle('open'));
document.querySelector('#product-search').addEventListener('input', renderProducts);
document.querySelector('#category-filter').addEventListener('change', renderProducts);
document.querySelector('#add-product-button').addEventListener('click', () => openProductDialog());
document.querySelector('#add-variant-button').addEventListener('click', () => addVariantRow());
document.querySelector('#product-form').elements.hasVariants.addEventListener('change', event => setVariantMode(event.currentTarget.checked));
document.querySelectorAll('.close-dialog').forEach(button => button.addEventListener('click', () => productDialog.close()));
document.querySelector('#add-category-button').addEventListener('click', () => openCategoryDialog());
document.querySelectorAll('.close-category-dialog').forEach(button => button.addEventListener('click', () => categoryDialog.close()));

document.querySelector('#product-form').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const id = form.dataset.mode === 'edit' ? form.elements.id.value : '';
  const message = document.querySelector('#product-message');
  try {
    const variants = form.elements.hasVariants.checked
      ? [...document.querySelectorAll('#variant-rows .variant-row')].map(row => ({
          label: row.querySelector('.variant-label').value,
          price: row.querySelector('.variant-price').value
        }))
      : [];
    if (form.elements.hasVariants.checked && !variants.length) throw new Error('Voeg minimaal één maat toe');
    await api(id ? `/api/admin/products/${encodeURIComponent(id)}` : '/api/admin/products', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify({
        name: form.elements.name.value,
        price: form.elements.price.value,
        variants,
        categoryId: form.elements.categoryId.value,
        popular: form.elements.popular.checked,
        visible: form.elements.visible.checked
      })
    });
    productDialog.close();
    await refreshData();
  } catch (error) {
    message.textContent = error.message;
  }
});

document.querySelector('#category-form').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const id = form.elements.id.value;
  const message = document.querySelector('#category-message');
  try {
    await api(id ? `/api/admin/categories/${encodeURIComponent(id)}` : '/api/admin/categories', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify({ name: form.elements.name.value })
    });
    categoryDialog.close();
    await refreshData();
  } catch (error) {
    message.textContent = error.message;
  }
});

document.querySelector('#special-form').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const message = document.querySelector('#special-message');
  message.className = 'form-message';
  try {
    await api('/api/admin/monthly-special', {
      method: 'PUT',
      body: JSON.stringify({
        name: form.elements.name.value,
        month: form.elements.month.value,
        imageUrl: form.elements.imageUrl.value,
        description: form.elements.description.value,
        price: form.elements.price.value,
        active: form.elements.active.checked
      })
    });
    message.textContent = 'Wijzigingen zijn opgeslagen.';
    message.classList.add('success');
    await refreshData();
  } catch (error) {
    message.textContent = error.message;
  }
});

(async () => {
  try {
    const session = await api('/api/session');
    session.authenticated ? await showAdmin() : showLogin();
  } catch {
    showLogin();
  }
})();

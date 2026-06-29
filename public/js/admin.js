let menuData = { categories: [], products: [], monthlySpecial: {} };
const euro = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });
const loginView = document.querySelector('#login-view');
const adminApp = document.querySelector('#admin-app');
const productDialog = document.querySelector('#product-dialog');
const categoryDialog = document.querySelector('#category-dialog');
const imageCropDialog = document.querySelector('#image-crop-dialog');
const specialImageMaxSize = 2 * 1024 * 1024;
const allowedSpecialImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
let cropImage = null;

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
  const showArchived = document.querySelector('#show-archived-products')?.checked;
  return [...menuData.products]
    .filter(product =>
      (showArchived || !product.archived)
      && (!search || [product.name, product.description].join(' ').toLowerCase().includes(search))
      && (!category || product.categoryId === category)
    )
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
  document.querySelector('#product-table').innerHTML = products.map(product => `<tr class="${product.archived ? 'archived-row' : ''}" data-product-id="${product.id}">
    <td class="product-name">${escapeHtml(product.name)}${product.description ? '<small>Details</small>' : ''}</td>
    <td>${escapeHtml(categoryName(product.categoryId))}</td>
    <td class="price-cell">${productPriceSummary(product)}</td>
    <td><span class="badge ${product.visible ? 'visible' : 'hidden'}">${product.visible ? 'Zichtbaar' : 'Verborgen'}</span>${product.archived ? '<span class="badge archived">Archief</span>' : ''}${isPopular(product.id) ? '<span class="badge popular">Populair</span>' : ''}</td>
    <td><div class="row-actions"><button class="icon-button edit-product" data-id="${product.id}" title="Bewerken">✎</button><button class="icon-button duplicate-product" data-id="${product.id}" title="Dupliceren">⧉</button>${product.archived ? `<button class="icon-button restore-product" data-id="${product.id}" title="Terugzetten">↺</button>` : `<button class="icon-button delete-product" data-id="${product.id}" title="Archiveren">×</button>`}</div></td>
  </tr>`).join('') || '<tr><td colspan="5">Geen producten gevonden.</td></tr>';
  document.querySelector('#mobile-product-list').innerHTML = products.map(product => `<article class="mobile-product ${product.archived ? 'archived-row' : ''}" data-product-id="${product.id}">
    <p><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(categoryName(product.categoryId))} · ${product.archived ? 'Archief' : product.visible ? 'Zichtbaar' : 'Verborgen'}${product.description ? ' · Details' : ''}${isPopular(product.id) ? ' · Populair' : ''}</small></p>
    <span class="price-cell">${productPriceSummary(product)}</span>
    <div class="row-actions"><button class="icon-button edit-product" data-id="${product.id}">✎</button><button class="icon-button duplicate-product" data-id="${product.id}">⧉</button>${product.archived ? `<button class="icon-button restore-product" data-id="${product.id}">↺</button>` : `<button class="icon-button delete-product" data-id="${product.id}">×</button>`}</div>
  </article>`).join('');
  attachProductActions();
  renderBulkPrices();
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
  document.querySelectorAll('.duplicate-product').forEach(button => button.addEventListener('click', () => duplicateProduct(button.dataset.id)));
  document.querySelectorAll('.delete-product').forEach(button => button.addEventListener('click', () => archiveProduct(button.dataset.id)));
  document.querySelectorAll('.restore-product').forEach(button => button.addEventListener('click', () => restoreProduct(button.dataset.id)));
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
  form.elements.archived.checked = false;
  document.querySelector('#variant-rows').innerHTML = '';
  setVariantMode(false);
  document.querySelector('#product-message').textContent = '';
  const product = menuData.products.find(item => item.id === id);
  document.querySelector('#product-dialog-title').textContent = product ? 'Product bewerken' : 'Product toevoegen';
  if (product) {
    form.dataset.mode = 'edit';
    form.elements.id.value = product.id;
    form.elements.name.value = product.name;
    form.elements.description.value = product.description || '';
    form.elements.price.value = product.price.toFixed(2);
    form.elements.categoryId.value = product.categoryId;
    form.elements.visible.checked = product.visible;
    form.elements.popular.checked = isPopular(product.id);
    form.elements.archived.checked = product.archived === true;
    if (Array.isArray(product.variants) && product.variants.length) {
      document.querySelector('#variant-rows').innerHTML = '';
      product.variants.forEach(variant => addVariantRow(variant.label, Number(variant.price).toFixed(2)));
      setVariantMode(true);
    }
  }
  productDialog.showModal();
}

function productPayload(product, overrides = {}) {
  return {
    name: product.name,
    description: product.description || '',
    price: product.price,
    variants: Array.isArray(product.variants) ? product.variants : [],
    categoryId: product.categoryId,
    popular: isPopular(product.id),
    visible: product.visible,
    archived: product.archived === true,
    ...overrides
  };
}

async function saveExistingProduct(product, overrides = {}) {
  return api(`/api/admin/products/${encodeURIComponent(product.id)}`, {
    method: 'PUT',
    body: JSON.stringify(productPayload(product, overrides))
  });
}

async function archiveProduct(id) {
  const product = menuData.products.find(item => item.id === id);
  if (!product || !window.confirm(`‘${product.name}’ archiveren? Je kunt het later terugzetten.`)) return;
  await api(`/api/admin/products/${encodeURIComponent(id)}`, { method: 'DELETE' });
  await refreshData();
}

async function restoreProduct(id) {
  const product = menuData.products.find(item => item.id === id);
  if (!product) return;
  await saveExistingProduct(product, { archived: false, visible: true });
  await refreshData();
}

async function duplicateProduct(id) {
  const product = menuData.products.find(item => item.id === id);
  if (!product) return;
  const copyName = `${product.name} kopie`;
  await api('/api/admin/products', {
    method: 'POST',
    body: JSON.stringify({
      name: copyName,
      description: product.description || '',
      price: product.price,
      variants: Array.isArray(product.variants) ? product.variants : [],
      categoryId: product.categoryId,
      popular: false,
      visible: product.visible && !product.archived
    })
  });
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
  updateSpecialPreview();
}

function updateSpecialPreview() {
  const value = document.querySelector('#special-form').elements.imageUrl.value.trim();
  const preview = document.querySelector('#special-image-preview');
  preview.innerHTML = value
    ? `<img src="${escapeHtml(value)}" alt=""><span>Afbeelding preview</span>`
    : '<span>Afbeelding preview</span>';
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(reader.result));
    reader.addEventListener('error', () => reject(new Error('Afbeelding kon niet gelezen worden')));
    reader.readAsDataURL(file);
  });
}

async function useSpecialImageFile(file) {
  const message = document.querySelector('#special-message');
  message.className = 'form-message';
  message.textContent = '';
  if (!file) return;
  if (!allowedSpecialImageTypes.includes(file.type)) {
    message.textContent = 'Gebruik een JPG, PNG, WebP of GIF afbeelding.';
    return;
  }
  if (file.size > specialImageMaxSize) {
    message.textContent = 'De afbeelding mag maximaal 2 MB zijn.';
    return;
  }
  try {
    const dataUrl = await fileToDataUrl(file);
    openImageCropper(dataUrl);
  } catch (error) {
    message.textContent = error.message;
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', () => reject(new Error('Afbeelding kon niet geopend worden')));
    image.src = src;
  });
}

async function openImageCropper(src) {
  const message = document.querySelector('#special-message');
  message.className = 'form-message';
  message.textContent = '';
  try {
    cropImage = await loadImage(src);
    document.querySelector('#crop-zoom').value = '1';
    document.querySelector('#crop-x').value = '0';
    document.querySelector('#crop-y').value = '0';
    renderCropPreview();
    imageCropDialog.showModal();
  } catch (error) {
    message.textContent = error.message;
  }
}

function drawCroppedImage(canvas) {
  if (!cropImage) return;
  const context = canvas.getContext('2d');
  const zoom = Number(document.querySelector('#crop-zoom').value);
  const xControl = Number(document.querySelector('#crop-x').value) / 100;
  const yControl = Number(document.querySelector('#crop-y').value) / 100;
  const containScale = Math.min(canvas.width / cropImage.naturalWidth, canvas.height / cropImage.naturalHeight);
  const scale = containScale * zoom;
  const drawWidth = cropImage.naturalWidth * scale;
  const drawHeight = cropImage.naturalHeight * scale;
  const overflowX = Math.max(0, (drawWidth - canvas.width) / 2);
  const overflowY = Math.max(0, (drawHeight - canvas.height) / 2);
  const x = (canvas.width - drawWidth) / 2 - (xControl * overflowX);
  const y = (canvas.height - drawHeight) / 2 - (yControl * overflowY);

  context.fillStyle = '#111111';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(cropImage, x, y, drawWidth, drawHeight);
}

function renderCropPreview() {
  drawCroppedImage(document.querySelector('#crop-canvas'));
}

function useCroppedSpecialImage() {
  const output = document.createElement('canvas');
  output.width = 1200;
  output.height = 900;
  drawCroppedImage(output);
  document.querySelector('#special-form').elements.imageUrl.value = output.toDataURL('image/jpeg', 0.86);
  updateSpecialPreview();
  imageCropDialog.close();
  const message = document.querySelector('#special-message');
  message.className = 'form-message success';
  message.textContent = 'Afbeelding is gecropt. Klik nog op opslaan om hem te bewaren.';
}

function renderBulkPrices() {
  const panel = document.querySelector('#bulk-price-panel');
  if (panel.hidden) return;
  const products = filteredProducts().filter(product => !product.archived);
  const list = document.querySelector('#bulk-price-list');
  list.innerHTML = products.map(product => {
    if (Array.isArray(product.variants) && product.variants.length) {
      return `<section class="bulk-price-row" data-product-id="${product.id}">
        <strong>${escapeHtml(product.name)}</strong>
        <div class="bulk-variant-grid">
          ${product.variants.map((variant, index) => `<label>${escapeHtml(variant.label)}<input type="number" min="0" step="0.05" value="${Number(variant.price).toFixed(2)}" data-variant-index="${index}"></label>`).join('')}
        </div>
      </section>`;
    }
    return `<section class="bulk-price-row" data-product-id="${product.id}">
      <strong>${escapeHtml(product.name)}</strong>
      <label>Prijs<input type="number" min="0" step="0.05" value="${Number(product.price).toFixed(2)}"></label>
    </section>`;
  }).join('') || '<p class="menu-empty">Geen producten om prijzen voor te wijzigen.</p>';
}

async function saveBulkPrices() {
  const message = document.querySelector('#bulk-price-message');
  message.textContent = '';
  const rows = [...document.querySelectorAll('.bulk-price-row')];
  try {
    await Promise.all(rows.map(row => {
      const product = menuData.products.find(item => item.id === row.dataset.productId);
      if (!product) return Promise.resolve();
      if (Array.isArray(product.variants) && product.variants.length) {
        const variants = product.variants.map((variant, index) => ({
          label: variant.label,
          price: row.querySelector(`[data-variant-index="${index}"]`).value
        }));
        return saveExistingProduct(product, { variants, price: variants[0]?.price || product.price });
      }
      return saveExistingProduct(product, { price: row.querySelector('input').value });
    }));
    message.textContent = 'Prijzen zijn opgeslagen.';
    message.classList.add('success');
    await refreshData();
  } catch (error) {
    message.classList.remove('success');
    message.textContent = error.message;
  }
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
document.querySelector('#show-archived-products').addEventListener('change', renderProducts);
document.querySelector('#bulk-prices-button').addEventListener('click', () => {
  document.querySelector('#bulk-price-panel').hidden = false;
  renderBulkPrices();
});
document.querySelector('#close-bulk-prices').addEventListener('click', () => {
  document.querySelector('#bulk-price-panel').hidden = true;
  document.querySelector('#bulk-price-message').textContent = '';
});
document.querySelector('#add-product-button').addEventListener('click', () => openProductDialog());
document.querySelector('#add-variant-button').addEventListener('click', () => addVariantRow());
document.querySelector('#product-form').elements.hasVariants.addEventListener('change', event => setVariantMode(event.currentTarget.checked));
document.querySelectorAll('.close-dialog').forEach(button => button.addEventListener('click', () => productDialog.close()));
document.querySelector('#add-category-button').addEventListener('click', () => openCategoryDialog());
document.querySelectorAll('.close-category-dialog').forEach(button => button.addEventListener('click', () => categoryDialog.close()));
document.querySelectorAll('.close-crop-dialog').forEach(button => button.addEventListener('click', () => imageCropDialog.close()));
['#crop-zoom', '#crop-x', '#crop-y'].forEach(selector => {
  document.querySelector(selector).addEventListener('input', renderCropPreview);
});
document.querySelector('#image-crop-form').addEventListener('submit', event => {
  event.preventDefault();
  useCroppedSpecialImage();
});
document.querySelector('#special-form').elements.imageUrl.addEventListener('input', updateSpecialPreview);
document.querySelector('#special-form').elements.imageFile.addEventListener('change', event => {
  useSpecialImageFile(event.currentTarget.files?.[0]);
  event.currentTarget.value = '';
});
document.querySelector('#special-image-dropzone').addEventListener('dragover', event => {
  event.preventDefault();
  event.currentTarget.classList.add('drag-over');
});
document.querySelector('#special-image-dropzone').addEventListener('dragleave', event => {
  event.currentTarget.classList.remove('drag-over');
});
document.querySelector('#special-image-dropzone').addEventListener('drop', event => {
  event.preventDefault();
  event.currentTarget.classList.remove('drag-over');
  useSpecialImageFile(event.dataTransfer.files?.[0]);
});
document.querySelector('#bulk-price-panel').addEventListener('submit', async event => {
  event.preventDefault();
  await saveBulkPrices();
});

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
        description: form.elements.description.value,
        price: form.elements.price.value,
        variants,
        categoryId: form.elements.categoryId.value,
        popular: form.elements.popular.checked,
        visible: form.elements.visible.checked,
        archived: form.elements.archived.checked
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

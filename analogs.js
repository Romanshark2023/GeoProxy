const photoDialog = document.querySelector('#photo-viewer');

function inspectPhoto(item) {
  document.querySelector('#photo-title').textContent = item.name;
  const image = document.querySelector('#photo-large');
  const state = document.querySelector('#photo-state');
  state.textContent = 'Loading image…';
  image.hidden = false;
  image.alt = item.name;
  image.onload = () => { state.textContent = ''; };
  image.onerror = () => {
    image.hidden = true;
    state.textContent = 'The image host is unavailable. Open the image source below.';
  };
  image.src = item.fullImage || item.image;
  document.querySelector('#photo-credit').href = item.credit || item.source;
  const credit = document.querySelector('#photo-attribution');
  credit.replaceChildren();
  credit.append(item.creator || 'See original file for creator', ' · ');
  const license = document.createElement('a');
  license.textContent = item.license || 'License details on original file';
  license.href = /^https?:/.test(item.licenseUrl || '') ? item.licenseUrl : item.credit;
  license.target = '_blank';
  license.rel = 'noopener';
  credit.append(license);
  photoDialog.showModal();
}
document.querySelector('#close-photo').onclick = () => photoDialog.close();
photoDialog.addEventListener('click', event => {
  if (event.target === photoDialog) {
    const box = photoDialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) photoDialog.close();
  }
});

function analogCard(site) {
  const card = document.createElement('article');
  card.className = 'analog-card';
  if (site.image) {
    const button = document.createElement('button');
    button.className = 'analog-photo';
    button.setAttribute('aria-label', 'Enlarge image of ' + site.name);
    const image = document.createElement('img');
    image.src = site.image;
    image.alt = site.name;
    image.loading = 'lazy';
    image.onerror = () => {
      image.hidden = true;
      button.textContent = 'View image at source ↗';
      button.onclick = () => window.open(site.credit || site.source, '_blank', 'noopener');
    };
    button.append(image);
    button.onclick = () => inspectPhoto(site);
    card.append(button);
  }
  const info = document.createElement('div');
  info.className = 'analog-info';
  const heading = document.createElement('h2');
  heading.textContent = site.name;
  info.append(heading);
  if (site.bodies) {
    const body = document.createElement('p');
    body.className = 'micro';
    body.textContent = site.bodies + ' · Reference environment';
    info.append(body);
  }
  const links = document.createElement('div');
  links.className = 'source-links';
  if (Number.isFinite(site.lat) && Number.isFinite(site.lon)) {
    const location = document.createElement('p');
    location.className = 'legend';
    location.textContent = coordinates(site) + ' · Published representative location';
    info.append(location);
    const map = document.createElement('a');
    map.textContent = 'Open map ↗';
    map.href = 'https://www.openstreetmap.org/?mlat=' + site.lat + '&mlon=' + site.lon + '#map=10/' + site.lat + '/' + site.lon;
    map.target = '_blank';
    map.rel = 'noopener';
    links.append(map);
  } else if (site.bodies) {
    const note = document.createElement('p');
    note.className = 'legend';
    note.textContent = 'Environment group or site without a verified coordinate in this catalog.';
    info.append(note);
  }
  const source = document.createElement('a');
  source.textContent = site.bodies ? 'Read source ↗' : 'Image credits ↗';
  source.href = site.bodies ? site.source : site.credit;
  source.target = '_blank';
  source.rel = 'noopener';
  links.append(source);
  info.append(links);
  card.append(info);
  return card;
}

fetch('data/analogs.json').then(response => {
  if (!response.ok) throw Error('Atlas unavailable');
  return response.json();
}).then(catalog => {
  const render = () => {
    const search = document.querySelector('#analog-search').value.trim().toLocaleLowerCase();
    const body = document.querySelector('#analog-body').value;
    const sites = catalog.sites.filter(site => site.name.toLocaleLowerCase().includes(search) && site.bodies.includes(body));
    document.querySelector('#analog-sites').replaceChildren(...sites.map(analogCard));
    document.querySelector('#analog-status').textContent = sites.length + ' reference entries';
  };
  document.querySelector('#analog-search').addEventListener('input', render);
  document.querySelector('#analog-body').addEventListener('change', render);
  render();
  document.querySelector('#reference-images').replaceChildren(...catalog.images.map(analogCard));
}).catch(() => {
  document.querySelector('#analog-status').textContent = 'The atlas could not load. Reload to try again.';
});

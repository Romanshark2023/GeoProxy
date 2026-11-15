const views = Array.from(document.querySelectorAll('[data-view]'));
const navigationLinks = document.querySelectorAll('nav a, .header-launch');

function showView(moveFocus) {
  if (location.hash === '#main') return;
  const route = ['#moon','#weights','#comparison','#saved'].includes(location.hash) ? '#explorer' : location.hash;
  const active = views.find(view => '#' + view.id === route) || views[0];
  views.forEach(view => { view.hidden = view !== active; });
  navigationLinks.forEach(link => {
    if (link.hash === '#' + active.id) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  document.title = 'GeoProxy · ' + (active.querySelector('.kicker')?.textContent.trim() || 'Planetary analog atlas');
  if (moveFocus) {
    const heading = active.querySelector('h1');
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', () => showView(true));
showView(false);

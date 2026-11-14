// The native disclosure works without JavaScript; these are desktop conveniences.
const startLauncher = document.querySelector('.start-launcher');
if (startLauncher) {
  const startButton = startLauncher.querySelector('summary');
  document.addEventListener('click', event => {
    if (!startLauncher.contains(event.target) || event.target.closest('a')) {
      startLauncher.open = false;
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && startLauncher.open) {
      startLauncher.open = false;
      startButton.focus();
    }
  });
  document.addEventListener('focusin', event => {
    if (!startLauncher.contains(event.target)) startLauncher.open = false;
  });
}

document.querySelectorAll('.site-nav, .preset-tabs > .tab-labels, .card-subtab-labels').forEach(row => {
  const update = () => {
    row.classList.toggle('more-left', row.scrollLeft > 2);
    row.classList.toggle('more-right', row.scrollLeft + row.clientWidth < row.scrollWidth - 2);
  };
  row.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();
});

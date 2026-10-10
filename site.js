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

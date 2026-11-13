const document = globalThis.document;
const form = document.querySelector('[data-upload]');
const input = document.querySelector('#package');
const drop = document.querySelector('[data-drop]');
if (form && input && drop) {
  for (const type of ['dragenter', 'dragover']) {
    drop.addEventListener(type, (event) => {
      event.preventDefault();
      drop.classList.add('dragging');
    });
  }
  for (const type of ['dragleave', 'drop']) {
    drop.addEventListener(type, (event) => {
      event.preventDefault();
      drop.classList.remove('dragging');
    });
  }
  drop.addEventListener('drop', (event) => {
    if (event.dataTransfer?.files.length === 1) {
      input.files = event.dataTransfer.files;
    }
  });
  form.addEventListener('submit', () => {
    form.querySelector('[data-progress]').textContent =
      'Przesyłanie i sprawdzanie paczki…';
    form.setAttribute('aria-busy', 'true');
  });
}

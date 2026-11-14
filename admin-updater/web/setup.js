const button = globalThis.document.querySelector('#download-settings');
button?.addEventListener('click', () => {
  const key = Array.from(
    globalThis.crypto.getRandomValues(new Uint8Array(32)),
    (value) => value.toString(16).padStart(2, '0'),
  ).join('');
  const origin = globalThis.location.origin;
  if (!/^https:\/\/[a-z0-9.-]+(?::[0-9]+)?$/.test(origin)) return;
  const contents = `<?php\ndeclare(strict_types=1);\nreturn [\n    'origin' => '${origin}',\n    'setupKey' => '${key}',\n];\n`;
  const url = globalThis.URL.createObjectURL(
    new globalThis.Blob([contents], { type: 'text/plain' }),
  );
  const link = globalThis.document.createElement('a');
  link.href = url;
  link.download = 'install-settings.php';
  link.click();
  globalThis.setTimeout(() => globalThis.URL.revokeObjectURL(url), 1000);
  globalThis.document.querySelector('#download-status').textContent =
    'Wgraj pobrany plik do public_html/_pixelforge/. Klucz do następnego kroku znajdziesz w polu setupKey tego pliku.';
});

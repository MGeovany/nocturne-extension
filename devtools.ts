// Registers a new tab in Chrome DevTools called "Nocturne".
// The third argument is the page rendered inside that tab.
chrome.devtools.panels.create(
  'Nocturne',
  'icons/icon32.png', // icon shown on the panel tab
  'panel.html',
)

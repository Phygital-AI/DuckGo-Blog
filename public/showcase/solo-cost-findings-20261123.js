const template = document.querySelector('#solo-cost-findings-template');

function mount() {
  const findings = document.querySelector('#conclusions');
  if (!findings || !template) return false;
  if (!findings.querySelector('#solo-cost-finding')) {
    findings.append(template.content.cloneNode(true));
  }
  return true;
}

if (!mount()) {
  const observer = new MutationObserver(() => {
    if (mount()) observer.disconnect();
  });
  observer.observe(document.querySelector('#main') ?? document.body, { childList: true, subtree: true });
}

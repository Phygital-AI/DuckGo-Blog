export function mountArticleNavigation() {
  const progress = document.querySelector('#reading-progress');
  const links = [...document.querySelectorAll('.contents-nav a')];
  const sections = links.map((link) => document.querySelector(link.getAttribute('href'))).filter(Boolean);
  let scheduled = false;
  const update = () => {
    scheduled = false;
    const scrollable = document.documentElement.scrollHeight - innerHeight;
    progress.style.width = `${scrollable > 0 ? Math.min(100, scrollY / scrollable * 100) : 0}%`;
    let active = null;
    for (const section of sections) if (section.getBoundingClientRect().top <= 160) active = section;
    for (const link of links) {
      if (link.getAttribute('href') === `#${active?.id}`) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    }
  };
  const schedule = () => {
    if (!scheduled) {
      scheduled = true;
      requestAnimationFrame(update);
    }
  };
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule);
  new ResizeObserver(schedule).observe(document.querySelector('#main'));
  update();
  if (location.hash) requestAnimationFrame(() => document.getElementById(location.hash.slice(1))?.scrollIntoView());
}

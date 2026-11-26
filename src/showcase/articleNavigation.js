export function mountArticleNavigation() {
  const progress = document.querySelector('#reading-progress');
  const contents = document.querySelector('.article-contents');
  const standings = document.querySelector('.leaderboard-groups');
  const desktop = matchMedia('(min-width: 1280px)');
  const links = [...document.querySelectorAll('.contents-nav a')];
  const sections = links.map((link) => document.querySelector(link.getAttribute('href'))).filter(Boolean);
  let scheduled = false;
  const update = () => {
    scheduled = false;
    if (desktop.matches) {
      const board = standings.getBoundingClientRect();
      const menu = contents.getBoundingClientRect();
      contents.classList.toggle('yield-to-standings', board.top < menu.bottom + 40 && board.bottom > menu.top);
    } else {
      contents.classList.remove('yield-to-standings');
    }
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

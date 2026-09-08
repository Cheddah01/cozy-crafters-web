(() => {
  'use strict';

  const sky = document.querySelector('.sky');
  if (!sky) return;
  const riderSky = document.createElement('div');
  riderSky.className = 'sky balloon-sky';
  document.body.append(riderSky);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const riders = [
    'Alyis202-drops-256.png', 'Cheddah01-drops-512.png',
    'ItsCook21-drops-256.png', 'Krill73-drops-256.png',
    'ZeroVR0-drops-256.png', 'Puzzle4770-drops-512.png',
    'SirSquared-drops-512.png', 'TheRealAwire96-drops-512.png',
    'JxstMxrcel-drops-512.png',
    'ttyl3802-drops-512.png',
    'DiddeFjidde-drops-512.png',
    'P31242-drops-512.png',
    'A_sterrr-drops-512.png',
    'Behrd-drops-512.png',
    'Cheddah02-drops-512.png',
    'Ethanlion5555-drops-512.png',
    'MISTERTACO8770-drops-512.png'
  ];
  const colors = ['#ff91aa', '#ffd56b', '#aa9cff', '#83dca6', '#79d8f0'];
  let remaining = [];
  let timer;
  const activeRiders = new Map();
  const pendingRiders = new Set();
  let rightSide = Math.random() > 0.5;

  const stop = () => {
    window.clearTimeout(timer);
    pendingRiders.forEach((pending) => window.clearTimeout(pending));
    pendingRiders.clear();
    activeRiders.forEach((cleanup, rider) => {
      window.clearTimeout(cleanup);
      rider.remove();
    });
    activeRiders.clear();
  };

  const schedule = (delay) => {
    window.clearTimeout(timer);
    if (!document.hidden && !reducedMotion.matches) {
      timer = window.setTimeout(launchGroup, delay);
    }
  };

  const launch = () => {
    if (document.hidden || reducedMotion.matches || activeRiders.size >= 3) return;
    if (!remaining.length) remaining = [...riders];
    const filename = remaining.splice(Math.floor(Math.random() * remaining.length), 1)[0];
    const duration = 28000 + Math.random() * 6000;
    const rider = document.createElement('div');
    rider.className = 'balloon-rider';
    rider.style.setProperty('--ride-duration', `${duration}ms`);
    rider.style.setProperty('--balloon-color', colors[Math.floor(Math.random() * colors.length)]);
    rightSide = !rightSide;
    rider.classList.toggle('balloon-rider-right', rightSide);

    const rig = document.createElement('div');
    rig.className = 'balloon-rider-rig';
    const balloon = document.createElement('button');
    balloon.className = 'rider-balloon';
    balloon.type = 'button';
    balloon.setAttribute('aria-label', `Pop ${filename.split('-drops-')[0]}'s balloon`);
    const string = document.createElement('span');
    string.className = 'rider-string';
    const character = document.createElement('img');
    character.src = `./images/balloon-riders/${filename}`;
    character.alt = '';
    character.width = 96;
    character.height = 96;
    character.draggable = false;
    rig.append(balloon, string, character);
    rider.append(rig);
    riderSky.append(rider);
    const cleanup = window.setTimeout(() => {
      rider.remove();
      activeRiders.delete(rider);
    }, duration + 100);
    activeRiders.set(rider, cleanup);
    balloon.addEventListener('click', () => {
      if (balloon.disabled) return;
      balloon.disabled = true;
      window.clearTimeout(activeRiders.get(rider));
      rider.style.animationPlayState = 'paused';
      rig.style.animationPlayState = 'paused';
      rider.classList.add('is-popped');

      const pop = document.createElement('span');
      pop.className = 'rider-pop';
      pop.setAttribute('aria-hidden', 'true');
      rig.append(pop);
      const fallDistance = window.innerHeight - character.getBoundingClientRect().top + 160;
      character.animate([
        { transform: 'translateY(0) rotate(0deg)' },
        { transform: `translateY(${fallDistance}px) rotate(${rider.classList.contains('balloon-rider-right') ? 100 : -100}deg)` }
      ], { duration: 1200, easing: 'cubic-bezier(0.55, 0, 1, 0.45)', fill: 'forwards' });
      activeRiders.set(rider, window.setTimeout(() => {
        rider.remove();
        activeRiders.delete(rider);
      }, 1300));
    });
  };

  const launchGroup = () => {
    if (document.hidden || reducedMotion.matches) return;
    const roll = Math.random();
    const count = roll < 0.5 ? 1 : roll < 0.85 ? 2 : 3;
    launch();
    // Stagger friends so they share the sky without sitting on top of each other.
    for (let i = 1; i < count; i += 1) {
      const pending = window.setTimeout(() => {
        pendingRiders.delete(pending);
        launch();
      }, i * 6000);
      pendingRiders.add(pending);
    }
    // Wait for the last rider to finish, then leave a shorter quiet gap.
    schedule(34000 + (count - 1) * 6000 + 8000 + Math.random() * 8000);
  };

  const restart = () => {
    stop();
    schedule(5000 + Math.random() * 4000);
  };
  document.addEventListener('visibilitychange', restart);
  reducedMotion.addEventListener('change', restart);
  window.addEventListener('pagehide', stop);
  window.addEventListener('pageshow', restart);
  restart();
})();

(() => {
  'use strict';

  const sky = document.querySelector('.sky');
  if (!sky) return;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const riders = [
    'Alyis202-drops-256.png', 'Cheddah01-drops-512.png',
    'ItsCook21-drops-256.png', 'Krill73-drops-256.png',
    'ZeroVR0-drops-256.png', 'Puzzle4770-drops-512.png',
    'SirSquared-drops-512.png', 'TheRealAwire96-drops-512.png',
    'JxstMxrcel-drops-512.png'
  ];
  const colors = ['#ff91aa', '#ffd56b', '#aa9cff', '#83dca6', '#79d8f0'];
  let remaining = [];
  let timer;
  let cleanup;
  let activeRider;
  let rightSide = Math.random() > 0.5;

  const stop = () => {
    window.clearTimeout(timer);
    window.clearTimeout(cleanup);
    if (activeRider) activeRider.remove();
    activeRider = null;
  };

  const schedule = (delay) => {
    window.clearTimeout(timer);
    if (!document.hidden && !reducedMotion.matches) {
      timer = window.setTimeout(launch, delay);
    }
  };

  const launch = () => {
    if (document.hidden || reducedMotion.matches) return;
    if (!remaining.length) remaining = [...riders];
    const filename = remaining.splice(Math.floor(Math.random() * remaining.length), 1)[0];
    const duration = 28000 + Math.random() * 6000;
    const rider = document.createElement('div');
    rider.className = 'balloon-rider';
    rider.setAttribute('aria-hidden', 'true');
    rider.style.setProperty('--ride-duration', `${duration}ms`);
    rider.style.setProperty('--balloon-color', colors[Math.floor(Math.random() * colors.length)]);
    rightSide = !rightSide;
    rider.classList.toggle('balloon-rider-right', rightSide);

    const rig = document.createElement('div');
    rig.className = 'balloon-rider-rig';
    const balloon = document.createElement('span');
    balloon.className = 'rider-balloon';
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
    sky.append(rider);
    activeRider = rider;
    cleanup = window.setTimeout(() => {
      rider.remove();
      if (activeRider === rider) activeRider = null;
    }, duration + 100);
    // One passenger at a time, with a quiet gap between visits.
    schedule(duration + 18000 + Math.random() * 22000);
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

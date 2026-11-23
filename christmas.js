// Christmas theme: always on for the season. To turn it off, remove the
// christmas.css / christmas.js tags from the pages (or delete this line below).
(function () {
  document.documentElement.classList.add('xmas');

  document.addEventListener('DOMContentLoaded', function () {
    if (!document.querySelector('.xmas-snow')) {
      var snow = document.createElement('div');
      snow.className = 'xmas-snow';
      snow.setAttribute('aria-hidden', 'true');
      snow.innerHTML = '<i></i><i></i><i></i>';
      document.body.appendChild(snow);
    }
    var mark = document.querySelector('.brand-mark');
    if (mark) mark.textContent = '🎄';
  });
})();

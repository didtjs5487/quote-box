// 계절 입자 효과: 봄 벚꽃잎 / 여름 장맛비 / 가을 단풍잎 / 겨울 눈
(function () {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var host = document.createElement('div');
  host.id = 'season-fx';
  host.setAttribute('aria-hidden', 'true');
  var count = window.innerWidth < 600 ? 12 : 22;
  var season = document.documentElement.getAttribute('data-season');
  if (season === 'summer') count = Math.round(count * 1.6);
  var r = function (a, b) { return a + Math.random() * (b - a); };
  for (var i = 0; i < count; i++) {
    var p = document.createElement('i');
    var size = season === 'winter' ? r(4, 9) : season === 'summer' ? r(8, 16) : r(10, 18);
    p.style.setProperty('--x', r(0, 100).toFixed(1) + 'vw');
    p.style.setProperty('--s', size.toFixed(1) + 'px');
    p.style.setProperty('--d', r(9, 17).toFixed(1) + 's');
    p.style.setProperty('--delay', (-r(0, 17)).toFixed(1) + 's');
    p.style.setProperty('--sway', r(-90, 90).toFixed(0) + 'px');
    p.style.setProperty('--rot', r(120, 420).toFixed(0) + 'deg');
    host.appendChild(p);
  }
  document.body.appendChild(host);
})();

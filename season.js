// 계절 입자 효과: 봄 벚꽃잎 / 여름 장맛비 / 가을 단풍잎 / 겨울 눈
(function () {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var host = document.createElement('div');
  host.id = 'season-fx';
  host.setAttribute('aria-hidden', 'true');
  var count = window.innerWidth < 600 ? 3 : 5; // 어쩌다 하나씩 떨어지는 느낌
  var season = document.documentElement.getAttribute('data-season');
  if (season === 'summer') count = count * 2; // 장맛비는 조금 더 촘촘하게(그래도 드문드문)
  var r = function (a, b) { return a + Math.random() * (b - a); };
  for (var i = 0; i < count; i++) {
    var p = document.createElement('i');
    var size = season === 'winter' ? r(4, 9) : season === 'summer' ? r(8, 16) : r(10, 18);
    p.style.setProperty('--x', r(0, 100).toFixed(1) + 'vw');
    p.style.setProperty('--s', size.toFixed(1) + 'px');
    p.style.setProperty('--d', r(26, 40).toFixed(1) + 's');
    p.style.setProperty('--delay', (-r(0, 40)).toFixed(1) + 's');
    p.style.setProperty('--sway', r(-90, 90).toFixed(0) + 'px');
    p.style.setProperty('--rot', r(120, 420).toFixed(0) + 'deg');
    host.appendChild(p);
  }
  document.body.appendChild(host);
})();

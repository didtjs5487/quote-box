// 계절 입자 효과: 봄 벚꽃잎 / 여름 장맛비 / 가을 단풍잎 / 겨울 눈
// 모든 계절이 같은 밀도: 화면에 동시에 보이는 입자가 모바일 1~2개, PC 2~3개 정도
(function () {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var host = document.createElement('div');
  host.id = 'season-fx';
  host.setAttribute('aria-hidden', 'true');
  var season = document.documentElement.getAttribute('data-season');
  var small = window.innerWidth < 600;
  // 한 주기 중 실제로 떨어지는 비율(brush.css의 keyframes와 같은 값). 빗방울은 빨리 떨어지므로 짧다.
  var fallShare = season === 'summer' ? 0.08 : 0.45;
  var visible = small ? 1.4 : 2.3;               // 동시에 보일 평균 개수
  var count = Math.round(visible / fallShare);   // 잎·눈 3~5개, 빗방울 17~29개
  var r = function (a, b) { return a + Math.random() * (b - a); };
  for (var i = 0; i < count; i++) {
    var p = document.createElement('i');
    var size = season === 'winter' ? r(5, 10) : season === 'summer' ? r(8, 16) : r(14, 24);
    var d = r(40, 60);
    // 첫 입자는 이미 떨어지는 중으로 시작해, 열자마자 하나는 보이게 한다
    var delay = i === 0 ? -d * fallShare * r(0.1, 0.7) : -r(0, d);
    p.style.setProperty('--x', r(0, 100).toFixed(1) + 'vw');
    p.style.setProperty('--s', size.toFixed(1) + 'px');
    p.style.setProperty('--d', d.toFixed(1) + 's');
    p.style.setProperty('--delay', delay.toFixed(1) + 's');
    p.style.setProperty('--sway', r(-90, 90).toFixed(0) + 'px');
    p.style.setProperty('--rot', r(120, 420).toFixed(0) + 'deg');
    host.appendChild(p);
  }
  document.body.appendChild(host);
})();

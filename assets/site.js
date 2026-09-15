/* HUG 교육플랫폼 공통 동작
   - 학습 체크: 이 브라우저에만 저장(localStorage). 계정·기기 동기화 아님.
   - 프롬프트 복사 + 실패 시 안내, 퀴즈 해설, 본문 검색, 인쇄(해설 포함 선택), 단계 내비게이션.
   외부로 어떤 데이터도 보내지 않는다. */
(function () {
  'use strict';

  var KEY = 'hug-edu-progress-v1';
  var pageId = document.body.getAttribute('data-page') || 'page';
  var storageOK = true;

  function readAll() {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}'); }
    catch (e) { storageOK = false; return {}; }
  }
  function writeAll(obj) {
    try { localStorage.setItem(KEY, JSON.stringify(obj)); }
    catch (e) { storageOK = false; noteStorage(); }
  }
  function noteStorage() {
    var el = document.getElementById('storage-note');
    if (el) el.textContent = '이 브라우저에서는 체크 자동 저장을 쓸 수 없습니다. 체크는 화면에만 남습니다.';
  }

  /* ---------- 학습 체크 ---------- */
  var boxes = Array.prototype.slice.call(document.querySelectorAll('input[data-check]'));
  var all = readAll();
  if (!storageOK) noteStorage();
  var mine = all[pageId] || {};
  boxes.forEach(function (b) { b.checked = mine[b.getAttribute('data-check')] === true; });

  function updateCount() {
    var done = boxes.filter(function (b) { return b.checked; }).length;
    var el = document.getElementById('progress');
    if (el) el.textContent = done + ' / ' + boxes.length + ' 확인';
  }
  function saveChecks() {
    var obj = readAll();
    var m = {};
    boxes.forEach(function (b) { m[b.getAttribute('data-check')] = b.checked; });
    obj[pageId] = m;
    writeAll(obj);
    updateCount();
  }
  boxes.forEach(function (b) { b.addEventListener('change', saveChecks); });
  updateCount();

  var reset = document.getElementById('reset-checks');
  if (reset) {
    reset.addEventListener('click', function () {
      if (!window.confirm('이 단원의 학습 체크를 지울까요? 다른 단원은 그대로 남습니다.')) return;
      boxes.forEach(function (b) { b.checked = false; });
      saveChecks();
      toast('이 단원의 체크를 지웠습니다.');
    });
  }

  /* 전체 진도(홈에서만) */
  var railTotal = document.getElementById('all-progress');
  if (railTotal) {
    var store = readAll(), done = 0, total = 0;
    Object.keys(store).forEach(function (k) {
      Object.keys(store[k]).forEach(function (c) { total++; if (store[k][c]) done++; });
    });
    railTotal.textContent = total ? ('지금까지 ' + done + ' / ' + total + '개 확인함') :
      '아직 체크한 항목이 없습니다.';
  }

  /* ---------- 토스트 ---------- */
  var toastTimer;
  function toast(msg) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 2600);
  }

  /* ---------- 프롬프트 복사 ---------- */
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () { return true; },
        function () { return legacyCopy(text); });
    }
    return Promise.resolve(legacyCopy(text));
  }
  function legacyCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }
  Array.prototype.forEach.call(document.querySelectorAll('button[data-copy]'), function (btn) {
    btn.addEventListener('click', function () {
      var src = document.getElementById(btn.getAttribute('data-copy'));
      if (!src) { toast('복사할 문장을 찾지 못했습니다. 아래 글을 직접 선택해 복사해 주세요.'); return; }
      copyText(src.textContent).then(function (ok) {
        toast(ok ? '프롬프트를 복사했습니다. 붙여넣기(Ctrl+V) 하세요.'
                 : '자동 복사가 막혔습니다. 회색 상자의 글을 직접 선택해 복사해 주세요.');
      });
    });
  });

  /* ---------- 퀴즈 ---------- */
  Array.prototype.forEach.call(document.querySelectorAll('.quiz'), function (q) {
    q.addEventListener('change', function (e) {
      var input = e.target;
      if (!input || input.tagName !== 'INPUT') return;
      var fb = q.querySelector('.fb');
      if (!fb) return;
      var right = input.getAttribute('data-ok') === '1';
      var why = input.getAttribute('data-why') || '';
      fb.className = 'fb on ' + (right ? 'right' : 'wrong');
      fb.textContent = (right ? '맞습니다. ' : '다시 보세요. ') + why;
    });
  });

  /* ---------- 본문 검색 ---------- */
  var search = document.getElementById('search');
  if (search) {
    var blocks = null;
    search.addEventListener('input', function () {
      var term = search.value.trim();
      if (blocks === null) blocks = Array.prototype.slice.call(document.querySelectorAll('main section.chapter'));
      Array.prototype.forEach.call(document.querySelectorAll('mark.hit'), function (m) {
        var p = m.parentNode; p.replaceChild(document.createTextNode(m.textContent), m); p.normalize();
      });
      if (term.length < 2) {
        blocks.forEach(function (b) { b.hidden = false; });
        var c0 = document.getElementById('search-count'); if (c0) c0.textContent = '';
        return;
      }
      var lower = term.toLowerCase(), found = 0;
      blocks.forEach(function (b) {
        var hit = b.textContent.toLowerCase().indexOf(lower) !== -1;
        b.hidden = !hit;
        if (hit) { found++; highlight(b, lower); }
      });
      var c = document.getElementById('search-count');
      if (c) c.textContent = found ? (found + '개 항목에서 찾음') : '찾지 못했습니다';
    });
  }
  function highlight(root, lower) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var nodes = [], n;
    while ((n = walker.nextNode())) {
      if (n.nodeValue.toLowerCase().indexOf(lower) !== -1 &&
          n.parentNode.nodeName !== 'SCRIPT' && n.parentNode.nodeName !== 'STYLE') nodes.push(n);
    }
    nodes.slice(0, 60).forEach(function (node) {
      var idx = node.nodeValue.toLowerCase().indexOf(lower);
      if (idx < 0) return;
      var after = node.splitText(idx);
      var hit = after.splitText(lower.length);
      var mk = document.createElement('mark');
      mk.className = 'hit';
      mk.textContent = after.nodeValue;
      after.parentNode.replaceChild(mk, after);
      if (hit) { /* keep */ }
    });
  }

  /* ---------- 인쇄 ---------- */
  var printBtn = document.getElementById('print');
  if (printBtn) printBtn.addEventListener('click', function () {
    document.body.classList.remove('print-answers');
    window.print();
  });
  var printAns = document.getElementById('print-answers');
  if (printAns) printAns.addEventListener('click', function () {
    document.body.classList.add('print-answers');
    window.print();
    setTimeout(function () { document.body.classList.remove('print-answers'); }, 1200);
  });

  /* ---------- 현재 단계 표시 ---------- */
  var stepLinks = Array.prototype.slice.call(document.querySelectorAll('.side-group.steps a'));
  if (stepLinks.length && 'IntersectionObserver' in window) {
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        stepLinks.forEach(function (a) {
          a.classList.toggle('active', a.getAttribute('href') === '#' + en.target.id);
        });
      });
    }, { rootMargin: '-90px 0px -62% 0px', threshold: 0 });
    Array.prototype.forEach.call(document.querySelectorAll('main section[id]'), function (s) { obs.observe(s); });
  }
})();

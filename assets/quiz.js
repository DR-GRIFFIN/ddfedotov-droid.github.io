// Многоразовый квиз. Разметка:
// <div class="quiz"><div class="q" data-answer="1"><p>Вопрос</p>
//   <button class="opt">A</button><button class="opt">B</button>
//   <div class="why" hidden>Объяснение</div></div></div>
// data-answer — индекс правильного варианта (с 0).
document.querySelectorAll('.quiz .q').forEach(function (q) {
  var answer = Number(q.dataset.answer);
  var opts = q.querySelectorAll('button.opt');
  var why = q.querySelector('.why');
  opts.forEach(function (btn, i) {
    btn.addEventListener('click', function () {
      opts.forEach(function (b) { b.classList.remove('right', 'wrong'); });
      btn.classList.add(i === answer ? 'right' : 'wrong');
      if (i === answer && why) why.hidden = false;
    });
  });
});

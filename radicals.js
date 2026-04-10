// =====================================================================
// SRS for radicals (separate from HSK2)
// =====================================================================
const SRS_KEY = 'radicals_srs';
const LEARN_THRESHOLD = 3;
const INTERVALS = [10*60*1000, 60*60*1000, 24*60*60*1000, 3*24*60*60*1000, 7*24*60*60*1000];
const WRONG_INTERVAL = 2 * 60 * 1000;

function loadSRS() {
    try { return JSON.parse(localStorage.getItem(SRS_KEY)) || {}; } catch { return {}; }
}
function saveSRS(s) {
    localStorage.setItem(SRS_KEY, JSON.stringify(s));
    if (window.HSKAuth) window.HSKAuth.save(SRS_KEY, s);
}
function getState(srs, i) { return srs[i] || { score: 0, nextReview: 0 }; }

function markKnown(i) {
    const srs = loadSRS();
    const newScore = Math.min(5, getState(srs, i).score + 1);
    srs[i] = { score: newScore, nextReview: Date.now() + INTERVALS[Math.min(newScore-1, INTERVALS.length-1)] };
    saveSRS(srs); updateProgress();
}
function markUnknown(i) {
    const srs = loadSRS();
    srs[i] = { score: Math.max(0, getState(srs, i).score - 1), nextReview: Date.now() + WRONG_INTERVAL };
    saveSRS(srs); updateProgress();
}
function getNextIndex(learnedOnly) {
    const srs = loadSRS(), now = Date.now();
    const pool = radicals.map((_,i) => i).filter(i =>
        learnedOnly ? getState(srs,i).score >= LEARN_THRESHOLD : getState(srs,i).score < LEARN_THRESHOLD
    );
    if (!pool.length) return null;
    const due = pool.filter(i => getState(srs,i).nextReview <= now);
    if (due.length) return due[Math.floor(Math.random() * due.length)];
    const unseen = pool.filter(i => !srs[i]);
    if (unseen.length) return unseen[Math.floor(Math.random() * unseen.length)];
    return pool.reduce((a,b) => getState(srs,a).nextReview < getState(srs,b).nextReview ? a : b);
}

function updateProgress() {
    const srs = loadSRS(), total = radicals.length;
    const learned = radicals.filter((_,i) => getState(srs,i).score >= LEARN_THRESHOLD).length;
    const pct = Math.round(learned/total*100);
    document.getElementById('progress-text').textContent = `Выучено: ${learned} / ${total} (${pct}%)`;
    document.getElementById('progress-bar-fill').style.width = pct + '%';
}

function speak(text) {
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-CN'; u.rate = 0.85;
    speechSynthesis.speak(u);
}

function shuffleArray(arr) {
    for (let i = arr.length-1; i > 0; i--) {
        const j = Math.floor(Math.random()*(i+1));
        [arr[i],arr[j]] = [arr[j],arr[i]];
    }
}

function makeOptions(correctIdx, count = 4) {
    const opts = [correctIdx];
    const pool = radicals.map((_,i)=>i).filter(i=>i!==correctIdx);
    shuffleArray(pool);
    while (opts.length < count && pool.length) opts.push(pool.shift());
    shuffleArray(opts);
    return opts;
}

// =====================================================================
// Tabs
// =====================================================================
function showTab(name) {
    ['flashcards','quiz','review'].forEach(t =>
        document.getElementById(t).style.display = t===name ? 'block' : 'none'
    );
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-' + name).classList.add('active');
}
document.getElementById('tab-flashcards').addEventListener('click', () => showTab('flashcards'));
document.getElementById('tab-quiz')      .addEventListener('click', () => { showTab('quiz');   genQuiz(); });
document.getElementById('tab-review')    .addEventListener('click', () => { showTab('review'); loadReview(); });

// =====================================================================
// Flashcards
// =====================================================================
let fcIndex = null;

function loadCard() {
    fcIndex = getNextIndex(false);
    const front = document.getElementById('card-front'), back = document.getElementById('card-back');
    const flipBtn = document.getElementById('flip-card'), srsBtns = document.getElementById('srs-buttons');
    if (fcIndex === null) {
        front.innerHTML = '<p class="empty-msg">Все радикалы изучены!<br>Перейдите в «Повторение».</p>';
        back.style.display = flipBtn.style.display = srsBtns.style.display = 'none'; return;
    }
    const r = radicals[fcIndex];
    document.getElementById('rad-char').textContent    = r.char;
    document.getElementById('rad-strokes').textContent = `${r.strokes} черт`;
    document.getElementById('rad-pinyin').textContent  = r.pinyin;
    document.getElementById('rad-russian').textContent = r.russian;
    front.style.display = 'flex'; back.style.display = 'none';
    flipBtn.style.display = 'inline-block'; flipBtn.textContent = 'Показать значение';
    srsBtns.style.display = 'none';
}

document.getElementById('flip-card').addEventListener('click', () => {
    const front = document.getElementById('card-front'), back = document.getElementById('card-back');
    const flipped = back.style.display !== 'none';
    front.style.display = flipped ? 'flex' : 'none';
    back.style.display  = flipped ? 'none' : 'flex';
    document.getElementById('flip-card').textContent = flipped ? 'Показать значение' : 'Показать радикал';
    document.getElementById('srs-buttons').style.display = flipped ? 'none' : 'flex';
});
document.getElementById('tts-btn')    .addEventListener('click', () => { if (fcIndex!==null) speak(radicals[fcIndex].char); });
document.getElementById('btn-known')  .addEventListener('click', () => { if (fcIndex!==null) markKnown(fcIndex);   loadCard(); });
document.getElementById('btn-unknown').addEventListener('click', () => { if (fcIndex!==null) markUnknown(fcIndex); loadCard(); });

// =====================================================================
// Quiz: Russian meaning → pick radical character
// =====================================================================
let qIndex = null;

function genQuiz() {
    qIndex = getNextIndex(false);
    const qEl = document.getElementById('q-question'), oEl = document.getElementById('q-options');
    document.getElementById('q-feedback').innerHTML = '';
    if (qIndex === null) { qEl.textContent = 'Все радикалы пройдены!'; oEl.innerHTML = ''; return; }
    const r = radicals[qIndex];
    qEl.innerHTML = `${r.russian}<span style="font-size:13px;color:#888;margin-left:8px">(${r.strokes} черт)</span>`;
    oEl.innerHTML = '';
    makeOptions(qIndex).forEach(idx => {
        const btn = document.createElement('button');
        btn.className = 'option-button rad-option'; btn.dataset.idx = idx;
        btn.textContent = radicals[idx].char;
        btn.addEventListener('click', () => checkRadQuiz(idx, oEl));
        oEl.appendChild(btn);
    });
}

function checkRadQuiz(selectedIdx, oEl) {
    oEl.querySelectorAll('.option-button').forEach(btn => {
        btn.disabled = true;
        const bi = parseInt(btn.dataset.idx);
        if (bi === qIndex)   btn.classList.add('correct');
        if (bi === selectedIdx && bi !== qIndex) btn.classList.add('incorrect');
    });
    const fb = document.getElementById('q-feedback');
    if (selectedIdx === qIndex) {
        fb.innerHTML = `<span class="fb-ok">✓ Правильно! ${radicals[qIndex].char} — ${radicals[qIndex].pinyin}</span>`;
        markKnown(qIndex);
    } else {
        fb.innerHTML = `<span class="fb-err">✗ Неправильно.</span> Ответ: ${radicals[qIndex].char} — ${radicals[qIndex].pinyin} — ${radicals[qIndex].russian}`;
        markUnknown(qIndex);
    }
    const ttsB = document.createElement('button');
    ttsB.className = 'tts-button'; ttsB.textContent = '🔊'; ttsB.style.marginLeft = '8px';
    ttsB.addEventListener('click', () => speak(radicals[qIndex].char));
    fb.appendChild(ttsB);
}

document.getElementById('q-next').addEventListener('click', genQuiz);

// =====================================================================
// Review (mixed: flashcard | quiz)
// =====================================================================
function loadReview() {
    const idx = getNextIndex(true);
    const container = document.getElementById('review-container');
    const feedback  = document.getElementById('review-feedback');
    const nextBtn   = document.getElementById('review-next');
    const emptyEl   = document.getElementById('review-empty');
    feedback.innerHTML = ''; container.innerHTML = '';

    if (idx === null) {
        nextBtn.style.display = 'none'; emptyEl.style.display = 'block'; return;
    }
    nextBtn.style.display = 'inline-block'; emptyEl.style.display = 'none';

    const mode = Math.random() < 0.5 ? 'flash' : 'quiz';
    const r = radicals[idx];

    if (mode === 'flash') {
        container.innerHTML = `
            <div id="rv-card">
                <div id="rv-front" style="display:flex;flex-direction:column;align-items:center;gap:8px">
                    <div style="font-size:72px">${r.char}</div>
                    <div class="strokes-badge">${r.strokes} черт</div>
                    <button class="tts-button rv-tts">🔊</button>
                </div>
                <div id="rv-back" style="display:none;font-size:22px;text-align:center;padding:10px">
                    <div style="color:#666;margin-bottom:4px">${r.pinyin}</div>
                    <div>${r.russian}</div>
                </div>
            </div>
            <button id="rv-flip" style="margin-top:12px">Показать значение</button>
            <div id="rv-srs" style="display:none;margin-top:10px">
                <button class="btn-unknown" id="rv-no">✗ Не знаю</button>
                <button class="btn-known"   id="rv-yes">✓ Знаю</button>
            </div>`;
        container.querySelector('.rv-tts').addEventListener('click', () => speak(r.char));
        container.querySelector('#rv-flip').addEventListener('click', () => {
            const f = container.querySelector('#rv-front'), b = container.querySelector('#rv-back');
            const flipped = b.style.display !== 'none';
            f.style.display = flipped ? 'flex' : 'none'; b.style.display = flipped ? 'none' : 'block';
            container.querySelector('#rv-flip').textContent = flipped ? 'Показать значение' : 'Показать радикал';
            container.querySelector('#rv-srs').style.display = flipped ? 'none' : 'flex';
        });
        container.querySelector('#rv-yes').addEventListener('click', () => { markKnown(idx); loadReview(); });
        container.querySelector('#rv-no') .addEventListener('click', () => { markUnknown(idx); loadReview(); });
    } else {
        container.innerHTML = `
            <div class="quiz-prompt">Выберите радикал для значения:</div>
            <div class="quiz-question">${r.russian}</div>
            <div id="rv-options" class="quiz-options rad-grid"></div>`;
        const oEl = container.querySelector('#rv-options');
        makeOptions(idx).forEach(oi => {
            const btn = document.createElement('button');
            btn.className = 'option-button rad-option'; btn.dataset.idx = oi;
            btn.textContent = radicals[oi].char;
            btn.addEventListener('click', () => {
                oEl.querySelectorAll('.option-button').forEach(b => {
                    b.disabled = true;
                    const bi = parseInt(b.dataset.idx);
                    if (bi === idx) b.classList.add('correct');
                    if (bi === oi && bi !== idx) b.classList.add('incorrect');
                });
                if (oi === idx) {
                    feedback.innerHTML = `<span class="fb-ok">✓ Правильно! ${r.char} — ${r.pinyin}</span>`;
                    markKnown(idx);
                } else {
                    feedback.innerHTML = `<span class="fb-err">✗ Неправильно.</span> ${r.char} — ${r.pinyin} — ${r.russian}`;
                    markUnknown(idx);
                }
            });
            oEl.appendChild(btn);
        });
    }
}

document.getElementById('review-next').addEventListener('click', loadReview);

// =====================================================================
// Init
// =====================================================================
updateProgress();
loadCard();

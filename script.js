// =====================================================================
// SRS (Spaced Repetition System)
// =====================================================================
const SRS_KEY = 'hsk_srs';
const LEARN_THRESHOLD = 3;
const INTERVALS = [
    10 * 60 * 1000,
    60 * 60 * 1000,
    24 * 60 * 60 * 1000,
    3  * 24 * 60 * 60 * 1000,
    7  * 24 * 60 * 60 * 1000,
];
const WRONG_INTERVAL = 2 * 60 * 1000;

function loadSRS() {
    try { return JSON.parse(localStorage.getItem(SRS_KEY)) || {}; } catch { return {}; }
}
function saveSRS(s) { localStorage.setItem(SRS_KEY, JSON.stringify(s)); }
function getState(srs, i) { return srs[i] || { score: 0, nextReview: 0 }; }

function markKnown(i) {
    const srs = loadSRS();
    const newScore = Math.min(5, getState(srs, i).score + 1);
    srs[i] = { score: newScore, nextReview: Date.now() + INTERVALS[Math.min(newScore - 1, INTERVALS.length - 1)] };
    saveSRS(srs); updateProgress();
}
function markUnknown(i) {
    const srs = loadSRS();
    srs[i] = { score: Math.max(0, getState(srs, i).score - 1), nextReview: Date.now() + WRONG_INTERVAL };
    saveSRS(srs); updateProgress();
}

function getNextIndex(learnedOnly) {
    const srs = loadSRS(), now = Date.now();
    const pool = vocabulary.map((_, i) => i).filter(i =>
        learnedOnly ? getState(srs, i).score >= LEARN_THRESHOLD : getState(srs, i).score < LEARN_THRESHOLD
    );
    if (!pool.length) return null;
    const due = pool.filter(i => getState(srs, i).nextReview <= now);
    if (due.length) return due[Math.floor(Math.random() * due.length)];
    const unseen = pool.filter(i => !srs[i]);
    if (unseen.length) return unseen[Math.floor(Math.random() * unseen.length)];
    return pool.reduce((a, b) => getState(srs, a).nextReview < getState(srs, b).nextReview ? a : b);
}

// =====================================================================
// Progress
// =====================================================================
function updateProgress() {
    const srs = loadSRS(), total = vocabulary.length;
    const learned = vocabulary.filter((_, i) => getState(srs, i).score >= LEARN_THRESHOLD).length;
    const pct = Math.round(learned / total * 100);
    document.getElementById('progress-text').textContent = `Выучено: ${learned} / ${total} (${pct}%)`;
    document.getElementById('progress-bar-fill').style.width = pct + '%';
}

// =====================================================================
// TTS & similarity
// =====================================================================
function speak(text) {
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-CN'; u.rate = 0.85;
    speechSynthesis.speak(u);
}

function stripTones(s) {
    return s.replace(/[āáǎà]/g,'a').replace(/[ēéěè]/g,'e')
            .replace(/[īíǐì]/g,'i').replace(/[ōóǒò]/g,'o')
            .replace(/[ūúǔù]/g,'u').replace(/[ǖǘǚǜ]/g,'ü').trim();
}

function getInitial(stripped) {
    for (const ini of ['zh','ch','sh','b','p','m','f','d','t','n','l','g','k','h','j','q','x','z','c','s','r','y','w'])
        if (stripped.startsWith(ini)) return ini;
    return '';
}

function similarityScore(pinA, pinB) {
    const a = stripTones(pinA.toLowerCase()).split(' ')[0];
    const b = stripTones(pinB.toLowerCase()).split(' ')[0];
    let s = 0;
    if (getInitial(a) === getInitial(b)) s += 3;
    if (a === b) s += 10;
    else if (a.slice(getInitial(a).length) === b.slice(getInitial(b).length)) s += 5;
    return s;
}

// Returns `count` distractor indices (similar-sounding preferred)
function getDistractors(correctIdx, count) {
    const target = vocabulary[correctIdx];
    const scored = vocabulary
        .map((w, i) => ({ i, s: i !== correctIdx ? similarityScore(target.pinyin, w.pinyin) : -1 }))
        .filter(x => x.s >= 0)
        .sort((a, b) => b.s - a.s);

    const similar = scored.filter(x => x.s > 0);
    const rest    = scored.filter(x => x.s === 0);
    shuffleArray(rest);

    const result = [];
    while (result.length < count) {
        if (similar.length && result.length < Math.ceil(count / 2))
            result.push(similar.shift().i);
        else if (rest.length)
            result.push(rest.shift().i);
        else if (similar.length)
            result.push(similar.shift().i);
        else break;
    }
    return result;
}

function makeOptions(correctIdx, count = 4) {
    const opts = [correctIdx, ...getDistractors(correctIdx, count - 1)];
    shuffleArray(opts);
    return opts;
}

// =====================================================================
// Tabs
// =====================================================================
const TABS = ['flashcards','quiz-trans','quiz-char','quiz-audio','review'];
function showTab(name) {
    TABS.forEach(t => document.getElementById(t).style.display = t === name ? 'block' : 'none');
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-' + name).classList.add('active');
}
document.getElementById('tab-flashcards').addEventListener('click', () => showTab('flashcards'));
document.getElementById('tab-quiz-trans').addEventListener('click', () => { showTab('quiz-trans');  genQuizTrans(); });
document.getElementById('tab-quiz-char') .addEventListener('click', () => { showTab('quiz-char');   genQuizChar(); });
document.getElementById('tab-quiz-audio').addEventListener('click', () => { showTab('quiz-audio');  genQuizAudio(); });
document.getElementById('tab-review')    .addEventListener('click', () => { showTab('review');      loadReview(); });

// =====================================================================
// Flashcards
// =====================================================================
let fcIndex = null;

function loadCard() {
    fcIndex = getNextIndex(false);
    const front = document.getElementById('card-front'), back = document.getElementById('card-back');
    const flipBtn = document.getElementById('flip-card'), srsBtns = document.getElementById('srs-buttons');

    if (fcIndex === null) {
        front.innerHTML = '<p class="empty-msg">Новых слов нет!<br>Перейдите в «Повторение» для закрепления.</p>';
        back.style.display = flipBtn.style.display = srsBtns.style.display = 'none';
        return;
    }
    const w = vocabulary[fcIndex];
    document.getElementById('chinese').textContent = w.chinese;
    document.getElementById('pinyin').textContent  = w.pinyin;
    document.getElementById('russian').textContent = w.russian;
    front.style.display = 'flex'; back.style.display = 'none';
    flipBtn.style.display = 'inline-block'; flipBtn.textContent = 'Показать перевод';
    srsBtns.style.display = 'none';
}

document.getElementById('flip-card').addEventListener('click', () => {
    const front = document.getElementById('card-front'), back = document.getElementById('card-back');
    const flipped = back.style.display !== 'none';
    front.style.display = flipped ? 'flex' : 'none';
    back.style.display  = flipped ? 'none' : 'flex';
    document.getElementById('flip-card').textContent = flipped ? 'Показать перевод' : 'Показать иероглиф';
    document.getElementById('srs-buttons').style.display = flipped ? 'none' : 'flex';
});
document.getElementById('tts-btn').addEventListener('click', () => {
    if (fcIndex !== null) speak(vocabulary[fcIndex].chinese);
});
document.getElementById('btn-known').addEventListener('click',   () => { if (fcIndex !== null) markKnown(fcIndex);   loadCard(); });
document.getElementById('btn-unknown').addEventListener('click', () => { if (fcIndex !== null) markUnknown(fcIndex); loadCard(); });

// =====================================================================
// Quiz: Translation (Russian → Chinese+Pinyin)
// =====================================================================
let qtIndex = null, qtDone = false;

function genQuizTrans() {
    qtDone = false; qtIndex = getNextIndex(false);
    const qEl = document.getElementById('qt-question'), oEl = document.getElementById('qt-options');
    document.getElementById('qt-feedback').innerHTML = '';
    if (qtIndex === null) { qEl.textContent = 'Все слова пройдены!'; oEl.innerHTML = ''; return; }
    qEl.textContent = vocabulary[qtIndex].russian;
    renderOptions(oEl, makeOptions(qtIndex), (idx) => checkQuiz(idx, qtIndex, 'qt', 'trans'));
}

document.getElementById('qt-next').addEventListener('click', genQuizTrans);

// =====================================================================
// Quiz: Character (Chinese → Pinyin+Russian)
// =====================================================================
let qcIndex = null, qcDone = false;

function genQuizChar() {
    qcDone = false; qcIndex = getNextIndex(false);
    const qEl = document.getElementById('qc-question'), oEl = document.getElementById('qc-options');
    document.getElementById('qc-feedback').innerHTML = '';
    if (qcIndex === null) { qEl.textContent = 'Все слова пройдены!'; oEl.innerHTML = ''; return; }
    qEl.textContent = vocabulary[qcIndex].chinese;
    renderOptions(oEl, makeOptions(qcIndex), (idx) => checkQuiz(idx, qcIndex, 'qc', 'char'));
}

document.getElementById('qc-next').addEventListener('click', genQuizChar);

// =====================================================================
// Quiz: Audio (Listen → Chinese+Pinyin+Russian)
// =====================================================================
let qaIndex = null, qaDone = false;

function genQuizAudio() {
    qaDone = false; qaIndex = getNextIndex(false);
    const oEl = document.getElementById('qa-options');
    document.getElementById('qa-feedback').innerHTML = '';
    if (qaIndex === null) { oEl.innerHTML = '<p class="empty-msg">Все слова пройдены!</p>'; return; }
    // auto-play after tiny delay
    setTimeout(() => speak(vocabulary[qaIndex].chinese), 300);
    renderOptions(oEl, makeOptions(qaIndex), (idx) => checkQuiz(idx, qaIndex, 'qa', 'audio'), true);
}

document.getElementById('qa-play').addEventListener('click', () => {
    if (qaIndex !== null) speak(vocabulary[qaIndex].chinese);
});
document.getElementById('qa-next').addEventListener('click', genQuizAudio);

// =====================================================================
// Generic option renderer & checker
// =====================================================================
// mode: 'trans' → show Chinese+Pinyin | 'char' → show Pinyin+Russian | 'audio' → show all three
function renderOptions(container, opts, onAnswer, fullCard = false) {
    container.innerHTML = '';
    opts.forEach(idx => {
        const w = vocabulary[idx], btn = document.createElement('button');
        btn.className = 'option-button'; btn.dataset.idx = idx;
        if (fullCard) {
            btn.innerHTML = `<span class="opt-chinese">${w.chinese}</span><span class="opt-pinyin">${w.pinyin}</span><span class="opt-russian">${w.russian}</span>`;
        } else if (container.id === 'qc-options') {
            btn.innerHTML = `<span class="opt-pinyin">${w.pinyin}</span><span class="opt-russian">${w.russian}</span>`;
        } else {
            btn.innerHTML = `<span class="opt-chinese">${w.chinese}</span><span class="opt-pinyin">${w.pinyin}</span>`;
        }
        btn.addEventListener('click', () => onAnswer(idx));
        container.appendChild(btn);
    });
}

function checkQuiz(selectedIdx, correctIdx, prefix, mode) {
    const feedbackEl = document.getElementById(prefix + '-feedback');
    document.querySelectorAll(`#${prefix}-options .option-button`).forEach(btn => {
        btn.disabled = true;
        const bi = parseInt(btn.dataset.idx);
        if (bi === correctIdx)   btn.classList.add('correct');
        if (bi === selectedIdx && bi !== correctIdx) btn.classList.add('incorrect');
    });

    if (selectedIdx === correctIdx) {
        feedbackEl.innerHTML = '<span class="fb-ok">✓ Правильно!</span>';
        markKnown(correctIdx);
    } else {
        const w = vocabulary[correctIdx];
        feedbackEl.innerHTML = `<span class="fb-err">✗ Неправильно.</span> ${w.chinese} — ${w.pinyin} — ${w.russian}`;
        markUnknown(correctIdx);
    }
    const ttsBtn = document.createElement('button');
    ttsBtn.className = 'tts-button'; ttsBtn.textContent = '🔊'; ttsBtn.style.marginLeft = '8px';
    ttsBtn.addEventListener('click', () => speak(vocabulary[correctIdx].chinese));
    feedbackEl.appendChild(ttsBtn);
}

// =====================================================================
// Review (mixed: flashcard | trans | char | audio)
// =====================================================================
let reviewIdx = null, reviewMode = null, reviewFlipped = false;
const REVIEW_MODES = ['flash', 'trans', 'char', 'audio'];

function loadReview() {
    reviewIdx = getNextIndex(true);
    const container = document.getElementById('review-container');
    const feedback  = document.getElementById('review-feedback');
    const nextBtn   = document.getElementById('review-next');
    const emptyEl   = document.getElementById('review-empty');
    feedback.innerHTML = '';
    container.innerHTML = '';

    if (reviewIdx === null) {
        nextBtn.style.display = 'none'; emptyEl.style.display = 'block'; return;
    }
    nextBtn.style.display = 'inline-block'; emptyEl.style.display = 'none';
    reviewMode = REVIEW_MODES[Math.floor(Math.random() * REVIEW_MODES.length)];
    renderReview(reviewIdx, reviewMode, container, feedback);
}

function renderReview(idx, mode, container, feedback) {
    const w = vocabulary[idx];
    if (mode === 'flash') {
        reviewFlipped = false;
        container.innerHTML = `
            <div id="rv-card">
                <div id="rv-front" style="display:flex;flex-direction:column;align-items:center;gap:6px;">
                    <div style="font-size:52px">${w.chinese}</div>
                    <div style="font-size:20px;color:#666">${w.pinyin}</div>
                    <button class="tts-button rv-tts">🔊</button>
                </div>
                <div id="rv-back" style="display:none;font-size:22px;padding:10px">${w.russian}</div>
            </div>
            <button id="rv-flip" style="margin-top:12px">Показать перевод</button>
            <div id="rv-srs" style="display:none;margin-top:10px">
                <button class="btn-unknown" id="rv-no">✗ Не знаю</button>
                <button class="btn-known"   id="rv-yes">✓ Знаю</button>
            </div>`;
        container.querySelector('.rv-tts').addEventListener('click', () => speak(w.chinese));
        container.querySelector('#rv-flip').addEventListener('click', () => {
            const front = container.querySelector('#rv-front');
            const back  = container.querySelector('#rv-back');
            const f2 = back.style.display !== 'none';
            front.style.display = f2 ? 'flex' : 'none';
            back.style.display  = f2 ? 'none' : 'block';
            container.querySelector('#rv-flip').textContent = f2 ? 'Показать перевод' : 'Показать иероглиф';
            container.querySelector('#rv-srs').style.display = f2 ? 'none' : 'flex';
        });
        container.querySelector('#rv-yes').addEventListener('click', () => { markKnown(idx); loadReview(); });
        container.querySelector('#rv-no') .addEventListener('click', () => { markUnknown(idx); loadReview(); });
    } else {
        // quiz-style
        let prompt = '', question = '', fullCard = false;
        if (mode === 'trans') {
            prompt   = 'Выберите иероглиф для слова:';
            question = `<div class="quiz-question">${w.russian}</div>`;
        } else if (mode === 'char') {
            prompt   = 'Выберите значение и пиньинь для иероглифа:';
            question = `<div class="quiz-question" style="font-size:56px">${w.chinese}</div>`;
        } else if (mode === 'audio') {
            prompt   = 'Прослушайте и выберите:';
            question = `<button class="play-button" id="rv-play">🔊 Воспроизвести</button>`;
            fullCard = true;
            setTimeout(() => speak(w.chinese), 300);
        }
        container.innerHTML = `
            <div class="quiz-prompt">${prompt}</div>
            ${question}
            <div id="rv-options" class="quiz-options"></div>`;
        if (mode === 'audio') {
            container.querySelector('#rv-play')?.addEventListener('click', () => speak(w.chinese));
        }
        const optsEl = container.querySelector('#rv-options');
        const opts   = makeOptions(idx);
        opts.forEach(oi => {
            const ww = vocabulary[oi], btn = document.createElement('button');
            btn.className = 'option-button'; btn.dataset.idx = oi;
            if (fullCard || mode === 'audio') {
                btn.innerHTML = `<span class="opt-chinese">${ww.chinese}</span><span class="opt-pinyin">${ww.pinyin}</span><span class="opt-russian">${ww.russian}</span>`;
            } else if (mode === 'char') {
                btn.innerHTML = `<span class="opt-pinyin">${ww.pinyin}</span><span class="opt-russian">${ww.russian}</span>`;
            } else {
                btn.innerHTML = `<span class="opt-chinese">${ww.chinese}</span><span class="opt-pinyin">${ww.pinyin}</span>`;
            }
            btn.addEventListener('click', () => {
                optsEl.querySelectorAll('.option-button').forEach(b => {
                    b.disabled = true;
                    const bi = parseInt(b.dataset.idx);
                    if (bi === idx) b.classList.add('correct');
                    if (bi === parseInt(btn.dataset.idx) && bi !== idx) b.classList.add('incorrect');
                });
                if (oi === idx) {
                    feedback.innerHTML = '<span class="fb-ok">✓ Правильно!</span>';
                    markKnown(idx);
                } else {
                    feedback.innerHTML = `<span class="fb-err">✗ Неправильно.</span> ${w.chinese} — ${w.pinyin} — ${w.russian}`;
                    markUnknown(idx);
                }
                const ttsB = document.createElement('button');
                ttsB.className = 'tts-button'; ttsB.textContent = '🔊'; ttsB.style.marginLeft = '8px';
                ttsB.addEventListener('click', () => speak(w.chinese));
                feedback.appendChild(ttsB);
            });
            optsEl.appendChild(btn);
        });
    }
}

document.getElementById('review-next').addEventListener('click', loadReview);

// =====================================================================
// Utils
// =====================================================================
function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}

// =====================================================================
// Init
// =====================================================================
updateProgress();
loadCard();

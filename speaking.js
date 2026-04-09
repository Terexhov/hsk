// =====================================================================
// Tone helpers
// =====================================================================
const TONE_TABLE = {
    a: ['ā','á','ǎ','à','a'], e: ['ē','é','ě','è','e'],
    i: ['ī','í','ǐ','ì','i'], o: ['ō','ó','ǒ','ò','o'],
    u: ['ū','ú','ǔ','ù','u'], v: ['ǖ','ǘ','ǚ','ǜ','ü'],
};

function charTone(ch) {
    if ('āēīōūǖ'.includes(ch)) return 1;
    if ('áéíóúǘ'.includes(ch)) return 2;
    if ('ǎěǐǒǔǚ'.includes(ch)) return 3;
    if ('àèìòùǜ'.includes(ch)) return 4;
    return 0;
}

function analyzeSyllable(syl) {
    let tone = 5;
    for (const ch of syl) { const t = charTone(ch); if (t) { tone = t; break; } }
    const stripped = syl
        .replace(/[āáǎà]/g,'a').replace(/[ēéěè]/g,'e').replace(/[īíǐì]/g,'i')
        .replace(/[ōóǒò]/g,'o').replace(/[ūúǔù]/g,'u').replace(/[ǖǘǚǜ]/g,'v');
    return { stripped, tone };
}

function analyzePinyin(pinyin) {
    return pinyin.trim().split(/\s+/).map(analyzeSyllable);
}

function applyTone(stripped, toneNum) {
    if (toneNum === 5) return stripped.replace('v','ü');
    const t = toneNum - 1;
    if (stripped.includes('a')) return stripped.replace('a', TONE_TABLE.a[t]);
    if (stripped.includes('e')) return stripped.replace('e', TONE_TABLE.e[t]);
    if (stripped.includes('ou')) return stripped.replace('o', TONE_TABLE.o[t]);
    for (const v of ['v','u','i','o']) {
        const idx = stripped.lastIndexOf(v);
        if (idx >= 0) return stripped.slice(0,idx) + TONE_TABLE[v][t] + stripped.slice(idx+1);
    }
    return stripped;
}

// =====================================================================
// TTS
// =====================================================================
function speak(text) {
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-CN'; u.rate = 0.8;
    speechSynthesis.speak(u);
}

// =====================================================================
// Tabs
// =====================================================================
function showTab(name) {
    ['tones','speaking'].forEach(t => document.getElementById(t).style.display = t===name ? 'block' : 'none');
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-' + name).classList.add('active');
}
document.getElementById('tab-tones')   .addEventListener('click', () => { showTab('tones');    loadToneWord(); });
document.getElementById('tab-speaking').addEventListener('click', () => { showTab('speaking'); loadSpeakWord(); });

// =====================================================================
// Pick a random HSK2 word (multi-syllable preferred for tones)
// =====================================================================
function pickWord() {
    return vocabulary[Math.floor(Math.random() * vocabulary.length)];
}
function pickToneWord() {
    // prefer words with 2+ syllables for more interesting tone exercises
    const multi = vocabulary.filter(w => w.pinyin.trim().includes(' '));
    const pool  = multi.length >= 5 ? multi : vocabulary;
    return pool[Math.floor(Math.random() * pool.length)];
}

// =====================================================================
// TONE EXERCISE
// =====================================================================
let toneWord = null, toneData = null, selectedTones = [], toneChecked = false;

function loadToneWord() {
    toneChecked = false;
    toneWord = pickToneWord();
    toneData = analyzePinyin(toneWord.pinyin);
    selectedTones = new Array(toneData.length).fill(0);

    document.getElementById('tone-chinese').textContent = toneWord.chinese;
    document.getElementById('tone-pinyin-stripped').textContent =
        toneData.map(s => s.stripped.replace('v','ü')).join(' ');
    document.getElementById('tone-feedback').innerHTML = '';
    document.getElementById('tone-buttons').style.display = 'none';

    // Build syllable tone-pickers
    const container = document.getElementById('tone-syllables');
    container.innerHTML = '';
    toneData.forEach((syl, si) => {
        const block = document.createElement('div');
        block.className = 'tone-block';
        const label = document.createElement('div');
        label.className = 'tone-label';
        label.textContent = syl.stripped.replace('v','ü');
        block.appendChild(label);

        const btnRow = document.createElement('div');
        btnRow.className = 'tone-btns';
        [1,2,3,4,5].forEach(t => {
            const btn = document.createElement('button');
            btn.className = 'tone-btn';
            btn.textContent = t === 5 ? '·' : t;
            btn.title = ['1-й тон','2-й тон','3-й тон','4-й тон','нейтральный'][t-1];
            btn.addEventListener('click', () => {
                if (toneChecked) return;
                selectedTones[si] = t;
                btnRow.querySelectorAll('.tone-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                // show check button when all syllables have a tone
                if (selectedTones.every(x => x > 0))
                    document.getElementById('tone-buttons').style.display = 'block';
            });
            btnRow.appendChild(btn);
        });
        block.appendChild(btnRow);
        container.appendChild(block);
    });
}

document.getElementById('tone-play').addEventListener('click', () => {
    if (toneWord) speak(toneWord.chinese);
});

document.getElementById('tone-check').addEventListener('click', () => {
    if (toneChecked) return;
    toneChecked = true;

    let allCorrect = true;
    toneData.forEach((syl, si) => {
        const blocks = document.querySelectorAll('.tone-block');
        const btns   = blocks[si].querySelectorAll('.tone-btn');
        btns.forEach(b => b.disabled = true);

        // Mark correct tone button
        btns[syl.tone - 1]?.classList.add('tone-correct');
        if (selectedTones[si] !== syl.tone) {
            allCorrect = false;
            if (selectedTones[si] > 0) btns[selectedTones[si]-1]?.classList.add('tone-wrong');
        }
    });

    const fb = document.getElementById('tone-feedback');
    const correct = toneData.map(s => applyTone(s.stripped, s.tone)).join(' ');
    if (allCorrect) {
        fb.innerHTML = `<span class="fb-ok">✓ Все тоны правильные!</span> <em>${correct}</em>`;
    } else {
        fb.innerHTML = `<span class="fb-err">✗ Не совсем.</span> Правильно: <b>${correct}</b>`;
    }
    document.getElementById('tone-buttons').innerHTML = '';
    const nextBtn = document.createElement('button');
    nextBtn.textContent = 'Следующее слово';
    nextBtn.addEventListener('click', loadToneWord);
    document.getElementById('tone-buttons').appendChild(nextBtn);
    document.getElementById('tone-buttons').style.display = 'block';
});

// =====================================================================
// SPEAKING PRACTICE
// =====================================================================
let speakWord = null;
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

function loadSpeakWord() {
    speakWord = pickWord();
    document.getElementById('speak-chinese').textContent = speakWord.chinese;
    document.getElementById('speak-pinyin').textContent  = speakWord.pinyin;
    document.getElementById('speak-russian').textContent = speakWord.russian;
    document.getElementById('speak-result').textContent  = '';
    document.getElementById('speak-feedback').innerHTML  = '';
    document.getElementById('speak-status').textContent  = '';

    if (!SR) {
        document.getElementById('speak-no-support').style.display = 'block';
        document.getElementById('speak-mic').style.display = 'none';
    }
}

document.getElementById('speak-tts').addEventListener('click', () => {
    if (speakWord) speak(speakWord.chinese);
});

document.getElementById('speak-next').addEventListener('click', loadSpeakWord);

document.getElementById('speak-mic').addEventListener('click', () => {
    if (!SR) return;
    const recognition = new SR();
    recognition.lang = 'zh-CN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 3;

    const micBtn   = document.getElementById('speak-mic');
    const statusEl = document.getElementById('speak-status');
    const resultEl = document.getElementById('speak-result');
    const feedEl   = document.getElementById('speak-feedback');

    micBtn.classList.add('recording');
    micBtn.textContent = '⏺';
    statusEl.textContent = 'Слушаю…';
    feedEl.innerHTML = '';
    resultEl.textContent = '';

    recognition.start();

    recognition.onresult = (e) => {
        const results = Array.from(e.results[0]).map(r => r.transcript.trim());
        const best = results[0];
        resultEl.innerHTML = `Распознано: <b>${best}</b>`;

        // Compare: check if recognized text matches target character(s)
        const target = speakWord.chinese;
        if (best === target || best.includes(target) || target.includes(best)) {
            feedEl.innerHTML = '<span class="fb-ok">✓ Отлично! Совпадает с правильным ответом.</span>';
        } else {
            // Partial char match (for multi-char words)
            const matchCount = [...target].filter(ch => best.includes(ch)).length;
            const ratio = matchCount / target.length;
            if (ratio >= 0.5) {
                feedEl.innerHTML = `<span style="color:#f57c00;font-weight:bold">～ Близко!</span> Ожидалось: <b>${target}</b>`;
            } else {
                feedEl.innerHTML = `<span class="fb-err">✗ Не совпало.</span> Ожидалось: <b>${target}</b> (${speakWord.pinyin})`;
            }
        }
    };

    recognition.onerror = (e) => {
        statusEl.textContent = '';
        if (e.error === 'no-speech') {
            feedEl.innerHTML = '<span style="color:#888">Речь не обнаружена. Говорите громче и нажмите снова.</span>';
        } else if (e.error === 'not-allowed') {
            feedEl.innerHTML = '<span class="fb-err">Нет доступа к микрофону. Разрешите доступ в браузере.</span>';
        } else if (e.error === 'aborted' || e.error === 'network') {
            feedEl.innerHTML = '<span style="color:#888">Не удалось подключиться к серверу распознавания. Нажмите ещё раз.</span>';
        } else {
            feedEl.innerHTML = `<span style="color:#888">Попробуйте ещё раз (${e.error}).</span>`;
        }
        micBtn.classList.remove('recording'); micBtn.textContent = '🎤';
    };

    recognition.onend = () => {
        statusEl.textContent = '';
        micBtn.classList.remove('recording'); micBtn.textContent = '🎤';
    };
});

// =====================================================================
// Init
// =====================================================================
loadToneWord();
loadSpeakWord();

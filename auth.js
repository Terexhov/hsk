// =====================================================================
// HSK Auth — Google Sign-In + Firestore sync
// Работает поверх localStorage: если пользователь не вошёл,
// всё хранится локально. После входа данные синхронизируются.
// =====================================================================
(function () {
    'use strict';

    let db = null, auth = null, currentUser = null;

    // ------------------------------------------------------------------
    // Init (вызывается автоматически при загрузке страницы)
    // ------------------------------------------------------------------
    function init() {
        if (typeof firebase === 'undefined') return;
        if (!window.FIREBASE_CONFIG || window.FIREBASE_CONFIG.apiKey === 'YOUR_API_KEY') return;

        try {
            if (!firebase.apps.length) firebase.initializeApp(window.FIREBASE_CONFIG);
            auth = firebase.auth();
            db   = firebase.firestore();

            auth.onAuthStateChanged(async (user) => {
                currentUser = user;
                renderBar();
                if (user) {
                    await syncDown();
                    window.dispatchEvent(new Event('hsk-synced'));
                }
            });
        } catch (e) {
            console.warn('[HSKAuth] init:', e);
        }
    }

    // ------------------------------------------------------------------
    // Sign in / out
    // ------------------------------------------------------------------
    function signIn() {
        if (!auth) return;
        auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()).catch(e => {
            console.warn('[HSKAuth] signIn:', e);
        });
    }
    function signOut() {
        if (!auth) return;
        auth.signOut();
    }

    // ------------------------------------------------------------------
    // Панель авторизации (div#auth-bar на каждой странице)
    // ------------------------------------------------------------------
    function renderBar() {
        const bar = document.getElementById('auth-bar');
        if (!bar) return;
        if (currentUser) {
            bar.innerHTML = `
                <img src="${currentUser.photoURL || ''}" class="auth-avatar"
                     onerror="this.style.display='none'" alt="">
                <span class="auth-name">${currentUser.displayName || currentUser.email}</span>
                <button class="auth-btn auth-btn-out" id="hsk-signout">Выйти</button>`;
            document.getElementById('hsk-signout').addEventListener('click', signOut);
        } else {
            bar.innerHTML = `<button class="auth-btn auth-btn-in" id="hsk-signin">🔑 Войти через Google</button>`;
            document.getElementById('hsk-signin').addEventListener('click', signIn);
        }
    }

    // ------------------------------------------------------------------
    // Firestore: сохранить один SRS-ключ
    // ------------------------------------------------------------------
    async function save(srsKey, data) {
        if (!db || !currentUser) return;
        try {
            await db.collection('users').doc(currentUser.uid)
                    .collection('progress').doc(srsKey)
                    .set({ data: JSON.stringify(data), ts: Date.now() });
        } catch (e) {
            console.warn('[HSKAuth] save:', e);
        }
    }

    // ------------------------------------------------------------------
    // Firestore: скачать все ключи и смержить с localStorage
    // Принцип: берём запись с бо́льшим счётом (score)
    // ------------------------------------------------------------------
    async function syncDown() {
        if (!db || !currentUser) return;
        for (const key of ['hsk_srs', 'radicals_srs']) {
            try {
                const snap = await db.collection('users').doc(currentUser.uid)
                                     .collection('progress').doc(key).get();
                if (!snap.exists) continue;
                const cloud = JSON.parse(snap.data().data || '{}');
                const local = JSON.parse(localStorage.getItem(key) || '{}');
                const merged = { ...local };
                for (const [k, v] of Object.entries(cloud)) {
                    if (k === '__batch') {
                        merged.__batch = Math.max(merged.__batch || 0, v);
                    } else if (!merged[k] || (v.score || 0) > (merged[k].score || 0)) {
                        merged[k] = v;
                    }
                }
                localStorage.setItem(key, JSON.stringify(merged));
            } catch (e) {
                console.warn('[HSKAuth] syncDown:', e);
            }
        }
    }

    // ------------------------------------------------------------------
    // Публичный API
    // ------------------------------------------------------------------
    window.HSKAuth = { init, save, getUser: () => currentUser };

    // Запустить после загрузки DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

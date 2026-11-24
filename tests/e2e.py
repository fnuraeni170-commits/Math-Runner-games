"""Uji end-to-end di Chrome headless: python3 tests/e2e.py
Memainkan seluruh 4 level (dipercepat), menguji dashboard, ekspor, impor, dan penyimpanan."""
import http.server, threading, functools, os, sys, json, time
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, '..', 'shots'); os.makedirs(OUT, exist_ok=True)
H = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 8765), functools.partial(Q, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = 'http://127.0.0.1:8765/index.html'

results = []
def check(name, cond, info=''):
    results.append((name, bool(cond), info)); print(('PASS ' if cond else 'FAIL ') + name + (' — ' + str(info) if info else ''))

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'])
    ctx = b.new_context(viewport={'width': 1280, 'height': 760}, accept_downloads=True)
    page = ctx.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' and 'favicon' not in m.text and 'fonts.g' not in m.text else None)
    page.goto(URL); page.wait_for_selector('#scr-menu:not(.hidden)', timeout=30000); time.sleep(2.5)
    page.screenshot(path=OUT + '/01-menu.png')
    check('Menu tampil', page.is_visible('#btn-play'))

    # validasi form
    page.click('#btn-play'); check('Validasi nama kosong', 'nama' in page.inner_text('#form-error').lower())
    page.fill('#in-name', 'Raka'); page.select_option('#in-class', 'IV A')
    page.click('#btn-play'); time.sleep(3)
    page.screenshot(path=OUT + '/02-run-l1.png')
    st = page.evaluate('({mode: MR.Game.state.mode, level: MR.Game.state.level})')
    check('Game mulai di level 1', st['mode'] == 'run' and st['level'] == 1, st)

    # kontrol
    page.keyboard.press('ArrowLeft'); time.sleep(0.6); lane = page.evaluate('MR.Game.state.lane'); check('Pindah kiri', lane == 0, lane)
    page.keyboard.press('ArrowRight'); page.keyboard.press('ArrowRight'); time.sleep(0.6); lane = page.evaluate('MR.Game.state.lane'); check('Pindah kanan', lane == 2, lane)
    page.keyboard.press('ArrowUp'); time.sleep(0.15); y = page.evaluate('MR.Game.state.y'); check('Melompat', y > 0.2, round(y, 2))
    time.sleep(1.2); page.keyboard.press('ArrowDown'); time.sleep(0.1); sl = page.evaluate('MR.Game.state.slideT'); check('Sliding', sl > 0, round(sl, 2))
    page.screenshot(path=OUT + '/03-slide.png')

    # tabrakan: tunggu sampai nyawa berkurang (tanpa menghindar), dipercepat
    page.evaluate('MR.Game._simSteps = 6')
    t0 = time.time(); hearts = 3
    while time.time() - t0 < 40:
        hearts = page.evaluate('MR.Game.state.hearts')
        if hearts < 3: break
        time.sleep(0.3)
    check('Collision detection mengurangi nyawa', hearts < 3, hearts)
    coins = page.evaluate('MR.App.session.totalCoins')

    def play_level(level, wrong_on=()):
        for gi in range(5):
            # paksa gerbang muncul lebih cepat
            page.evaluate('(() => { const S = MR.Game.state; S.invuln = 999; if (S.dist < S.nextGateDist - 5) S.dist = S.nextGateDist - 5; })()')
            page.wait_for_selector('#qpanel:not(.hidden)', timeout=60000)
            if level == 1 and gi == 0: page.screenshot(path=OUT + '/04-question.png')
            if level == 4 and gi == 0: page.screenshot(path=OUT + '/09-story-question.png')
            ans = page.evaluate('(() => { const i = MR.Game.state.gateIndex; const q = MR.App.levelQs[i]; const o = MR.App.presented[i]; return {c: o.findIndex(x => String(x.value) === String(q.answer)), n: o.length}; })()')
            pick = ans['c'] if gi not in wrong_on else (ans['c'] + 1) % 3
            page.click('#q-options .q-opt[data-k="%d"]' % pick)
            # tunggu melewati gerbang
            t0 = time.time()
            while time.time() - t0 < 90:
                done = page.evaluate('MR.Game.state.gateIndex') > gi
                if done: break
                page.evaluate('MR.Game.state.invuln = 999'); time.sleep(0.25)
            if gi in wrong_on:
                page.wait_for_selector('#ov-feedback:not(.hidden)', timeout=10000)
                if level == 1: page.screenshot(path=OUT + '/05-feedback.png')
                page.click('#btn-fb-continue')
            elif level == 1 and gi == 1:
                time.sleep(0.4); page.screenshot(path=OUT + '/05b-correct.png')
        page.evaluate('MR.Game.state.invuln = 999')
        page.wait_for_selector('#ov-level:not(.hidden)', timeout=120000)
        page.screenshot(path=OUT + '/06-level%d-done.png' % level)

    play_level(1, wrong_on=(2,))
    s = page.evaluate('MR.App.session')
    check('Level 1 selesai', 1 in s['completedLevels'], s['completedLevels'])
    check('Skor: 4 benar ×100 + koin×5 + 250', s['totalScore'] == 4 * 100 + s['totalCoins'] * 5 + 250, (s['totalScore'], s['totalCoins']))
    check('Jawaban salah tercatat', s['incorrectAnswers'] == 1 and s['questionHistory'][2]['isCorrect'] is False, s['incorrectAnswers'])
    check('Koin terkumpul', s['totalCoins'] > 0, s['totalCoins'])
    for L in (2, 3, 4):
        page.click('#btn-next-level'); time.sleep(1.5)
        page.screenshot(path=OUT + '/07-run-l%d.png' % L)
        play_level(L, wrong_on=(0,) if L == 3 else ())
    s = page.evaluate('MR.App.session')
    check('Seluruh level dapat diselesaikan', s['completedLevels'] == [1, 2, 3, 4], s['completedLevels'])
    check('Lencana champion', 'champion' in s['achievements'], s['achievements'])
    page.click('#btn-level-finish'); time.sleep(1)
    page.screenshot(path=OUT + '/10-results.png', full_page=True)
    check('Halaman hasil', page.is_visible('#scr-results'))
    acc = page.inner_text('#res-grid')
    check('Akurasi 18/20 = 90%', '90%' in acc, acc.replace('\n', ' '))
    page.click('#btn-save'); check('Tombol simpan', 'Tersimpan' in page.inner_text('#btn-save'))

    # sesi kedua (siswa lain, berhenti di tengah) untuk data dashboard
    page.click('[data-go=menu] >> nth=-1'); time.sleep(1)
    page.fill('#in-name', 'Sinta'); page.select_option('#in-class', 'IV B'); page.click('.lvl-btn[data-l="2"]'); page.click('#btn-play'); time.sleep(1)
    page.evaluate('MR.Game._simSteps = 6')
    def gate(correct):
        gi = page.evaluate('MR.Game.state.gateIndex')
        page.evaluate('(() => { const S = MR.Game.state; S.invuln = 999; S.dist = Math.max(S.dist, S.nextGateDist - 5); })()')
        page.wait_for_selector('#qpanel:not(.hidden)', timeout=60000)
        c = page.evaluate('(() => { const i = MR.Game.state.gateIndex; const q = MR.App.levelQs[i]; return MR.App.presented[i].findIndex(x => String(x.value) === String(q.answer)); })()')
        # tes "wajib memilih": jangan memilih dulu, tunggu berhenti
        if gi == 0:
            t0 = time.time()
            while time.time() - t0 < 60 and not page.evaluate('MR.Game.state.wait'): time.sleep(0.25)
            check('Berhenti menunggu pilihan di depan gerbang', page.evaluate('MR.Game.state.wait'))
            page.screenshot(path=OUT + '/08-need-choice.png')
        page.keyboard.press(str((c if correct else (c + 1) % 3) + 1))
        t0 = time.time()
        while time.time() - t0 < 90 and page.evaluate('MR.Game.state.gateIndex') == gi: time.sleep(0.25)
        if not correct:
            page.wait_for_selector('#ov-feedback:not(.hidden)'); page.keyboard.press('Enter')
    gate(False); gate(False); gate(True)
    # nyawa habis → checkpoint
    page.evaluate('(() => { const S = MR.Game.state; S.invuln = 0; S.hearts = 1; })()')
    page.wait_for_selector('#ov-down:not(.hidden)', timeout=60000)
    page.screenshot(path=OUT + '/11-out-of-hearts.png')
    page.click('#btn-checkpoint'); time.sleep(0.5)
    check('Lanjut dari checkpoint', page.evaluate('MR.Game.state.hearts') == 3 and page.evaluate('MR.Game.state.gateIndex') == 3)
    page.keyboard.press('p'); time.sleep(0.3); check('Pause dengan P', page.evaluate('MR.Game.state.paused') and page.is_visible('#ov-pause'))
    page.click('#btn-quit'); time.sleep(0.8)

    # data bertahan setelah reload
    page.reload(); page.wait_for_selector('#scr-menu:not(.hidden)', timeout=30000)
    n = page.evaluate('MR.Storage.getSessions().length'); check('Data tetap ada setelah reload', n == 2, n)

    # Dashboard
    page.click('[data-go=teacher]'); page.fill('#t-pin', '0000'); page.click('#t-pin-form button[type=submit]')
    check('PIN salah ditolak', 'salah' in page.inner_text('#t-pin-err').lower())
    page.fill('#t-pin', '1234'); page.click('#t-pin-form button[type=submit]'); time.sleep(0.6)
    page.screenshot(path=OUT + '/12-dash-overview.png', full_page=True)
    cards = page.inner_text('.t-cards'); check('Kartu: 2 siswa, 2 sesi', cards.split('\n')[1] == '2' and cards.split('\n')[4] == '2', cards.replace('\n', '|'))
    page.click('[data-nav=table]'); time.sleep(0.4)
    rows = page.locator('.t-table tbody tr').count(); check('Tabel 2 baris', rows == 2, rows)
    page.fill('[data-f=q]', 'sin'); time.sleep(0.4); rows = page.locator('.t-table tbody tr').count(); check('Search nama', rows == 1, rows)
    page.fill('[data-f=q]', ''); time.sleep(0.3)
    page.select_option('[data-f=cls]', 'IV A'); time.sleep(0.3); rows = page.locator('.t-table tbody tr').count(); check('Filter kelas', rows == 1, rows)
    page.select_option('[data-f=cls]', ''); time.sleep(0.3)
    page.select_option('[data-f=level]', 'tamat'); time.sleep(0.3); rows = page.locator('.t-table tbody tr').count(); check('Filter level (tamat)', rows == 1, rows)
    page.select_option('[data-f=level]', ''); time.sleep(0.3)
    import datetime; tomorrow = (datetime.date.today() + datetime.timedelta(days=2)).isoformat()
    page.fill('[data-f=from]', tomorrow); page.dispatch_event('[data-f=from]', 'change'); time.sleep(0.3)
    check('Filter tanggal', page.locator('.t-table tbody tr').count() == 0)
    page.click('[data-act=clear-filters]'); time.sleep(0.3)
    page.click('[data-sort=score]'); time.sleep(0.3)
    first = page.locator('.t-table tbody tr').first.inner_text(); check('Sort skor (tertinggi dulu)', 'Raka' in first, first[:40])
    page.click('[data-sort=acc]'); time.sleep(0.3); page.click('[data-sort=acc]'); time.sleep(0.3)
    first = page.locator('.t-table tbody tr').first.inner_text(); check('Sort akurasi (terendah dulu)', 'Sinta' in first, first[:40])
    page.screenshot(path=OUT + '/13-dash-table.png', full_page=True)
    with page.expect_download() as d: page.click('[data-act=csv-sessions]')
    csvp = d.value.path(); csvt = open(csvp, encoding='utf-8-sig').read()
    check('Export CSV', csvt.startswith('No,Nama/Kode Siswa') and csvt.count('\n') >= 2, csvt[:60])
    page.click('[data-nav=analytics]'); time.sleep(1.2)
    page.screenshot(path=OUT + '/14-dash-analytics.png', full_page=True)
    ch = page.evaluate('MR.Dashboard._state.charts.map(c => c.data.datasets[0].data)')
    s_all = page.evaluate('MR.Storage.getSessions()')
    fa = sum(x['fpbAttempted'] for x in s_all); fc = sum(x['fpbCorrect'] for x in s_all)
    check('Grafik FPB sesuai data', abs(ch[0][0] - round(fc / fa * 1000) / 10) < 0.01, (ch[0], fc, fa))
    page.click('[data-nav=table]'); time.sleep(0.3)
    page.locator('.t-table tbody tr', has_text='Sinta').click(); time.sleep(0.5)
    page.screenshot(path=OUT + '/15-dash-report.png', full_page=True)
    rep = page.inner_text('#t-view')
    check('Laporan individu memuat rekomendasi & soal salah', 'Rekomendasi' in rep and 'Soal yang salah dijawab (2)' in rep, '')
    with page.expect_download() as d: page.click('[data-act=dl-report]')
    check('Download laporan', open(d.value.path(), encoding='utf-8').read().startswith('<!DOCTYPE html>'))
    # Backup JSON & impor (tidak menggandakan)
    page.click('[data-nav=data]'); time.sleep(0.3)
    with page.expect_download() as d: page.click('[data-act=backup]')
    jp = d.value.path(); j = json.load(open(jp)); check('Backup JSON', len(j['sessions']) == 2 and j['schemaVersion'] == 1)
    page.set_input_files('#t-import', jp); page.click('[data-act=import]'); time.sleep(0.4)
    msg = page.inner_text('.t-alert'); check('Import tidak menggandakan sesi', '0 sesi baru' in msg and '2 sesi dilewati' in msg, msg)
    # impor CSV ke penyimpanan kosong
    page.evaluate("localStorage.removeItem('mathRunner.data'); MR.Storage.reload()")
    open(OUT + '/import.csv', 'w', encoding='utf-8-sig').write(csvt)
    page.click('[data-nav=data]'); time.sleep(0.2)
    page.set_input_files('#t-import', OUT + '/import.csv'); page.click('[data-act=import]'); time.sleep(0.4)
    msg = page.inner_text('.t-alert'); n2 = page.evaluate('MR.Storage.getSessions()')
    check('Import CSV memulihkan sesi + riwayat', '2 sesi baru' in msg and sum(len(x['questionHistory']) for x in n2) == sum(len(x['questionHistory']) for x in s_all), msg)
    # data rusak
    page.evaluate("localStorage.setItem('mathRunner.data','{rusak'); MR.Storage.reload()")
    page.click('[data-nav=overview]'); time.sleep(0.3)
    check('Data rusak ditangani', 'rusak' in page.inner_text('#t-view').lower() or 'rusak' in page.inner_text('.t-main').lower())
    page.screenshot(path=OUT + '/16-dash-corrupt.png')

    # Learning zone
    page.click('[data-act=exit]'); time.sleep(0.6)
    page.click('[data-go=learn]'); time.sleep(0.5); page.screenshot(path=OUT + '/17-learn-fpb.png', full_page=True)
    page.click('.learn-tab[data-t=kpk]'); time.sleep(0.3); page.click('#k-play'); time.sleep(9.5)
    page.screenshot(path=OUT + '/18-learn-kpk.png', full_page=True)
    check('Learning Zone: lampu menemukan KPK 12', 'detik ke-12' in page.inner_text('#k-lamp-res'), page.inner_text('#k-lamp-res'))

    # Mobile
    m = b.new_context(viewport={'width': 390, 'height': 800}, is_mobile=True, has_touch=True, device_scale_factor=2)
    mp = m.new_page(); mp.on('pageerror', lambda e: errors.append('mobile: ' + str(e)))
    mp.goto(URL); mp.wait_for_selector('#scr-menu:not(.hidden)', timeout=30000); time.sleep(2)
    mp.screenshot(path=OUT + '/19-mobile-menu.png')
    mp.fill('#in-name', 'Dewi'); mp.select_option('#in-class', 'IV C'); mp.click('#btn-play'); time.sleep(2)
    check('Tombol virtual tampil di HP', mp.is_visible('#vcontrols'))
    mp.tap('#vcontrols [data-act=left]'); time.sleep(0.4); check('Tombol virtual kiri', mp.evaluate('MR.Game.state.lane') == 0)
    mp.evaluate('MR.Game._simSteps = 6; MR.Game.state.dist = MR.Game.state.nextGateDist - 5; MR.Game.state.invuln = 999')
    mp.wait_for_selector('#qpanel:not(.hidden)', timeout=60000); time.sleep(1.5)
    mp.screenshot(path=OUT + '/20-mobile-question.png')
    check('Tidak ada horizontal overflow (HP)', mp.evaluate('document.documentElement.scrollWidth <= innerWidth'))
    errs = [e for e in errors if 'AudioContext' not in e]
    check('Tidak ada error JavaScript', not errs, errs[:5])
    b.close()
srv.shutdown()
fails = [r for r in results if not r[1]]
print('\n%d/%d lulus' % (len(results) - len(fails), len(results)))
sys.exit(1 if fails else 0)

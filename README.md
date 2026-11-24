# MATH RUNNER: THE LOST TEMPLE
Game petualangan *endless runner* 3D untuk belajar **FPB dan KPK** (kelas IV SD), lengkap dengan **Teacher Dashboard**.
Berjalan langsung di browser (Chrome, Edge, Firefox, Safari, dan browser HP modern), tanpa instalasi dan tanpa server/backend.

---

## 1. Struktur file

```
math-runner/
├── index.html        Halaman utama (semua layar game + wadah dashboard)
├── style.css         Tampilan game & dashboard
├── config.js         PENGATURAN: PIN guru, daftar kelas, poin, batas data
├── questions.js      Bank 53 soal FPB/KPK (kunci dihitung otomatis)
├── storage.js        Penyimpanan LocalStorage berversi, ekspor/impor CSV & JSON
├── audio.js          Musik & efek suara (disintesis, tanpa file audio)
├── game.js           Mesin game 3D (Three.js): dunia, karakter, rintangan, gerbang
├── learning.js       Learning Zone interaktif
├── dashboard.js      Teacher Dashboard
├── app.js            Alur siswa: sesi, skor, lencana, hasil
├── lib/              three.min.js (r158) & chart.umd.min.js (4.4.1) – disertakan lokal
├── assets/           (kosong) lihat assets/README.md
└── tests/            verify-questions.js (cek kunci jawaban) & e2e.py (uji otomatis)
```

Semua karakter, lingkungan, tekstur, dan suara dibuat **secara prosedural** di dalam kode, jadi tidak ada file gambar/suara yang perlu diunggah dan tidak ada masalah lisensi aset. Pustaka Three.js dan Chart.js sudah disertakan di folder `lib/`, sehingga game tetap jalan walau internet sekolah lambat. Hanya huruf (Google Fonts) yang dimuat dari internet; jika gagal, browser memakai huruf cadangan.

## 2. Mengubah pengaturan (`config.js`)

| Pengaturan | Bawaan | Keterangan |
|---|---|---|
| `TEACHER_PIN_DEFAULT` | `1234` | PIN untuk membuka Teacher Dashboard. **Ganti sebelum dipakai di kelas.** PIN juga bisa diganti dari dashboard (menu *Data & Pengaturan*). |
| `CLASSES` | IV A – IV E | Pilihan kelas pada layar awal. Siswa juga bisa memilih "Lainnya…". |
| `MIN_QUESTIONS_OVERALL` | 5 | Minimal soal sebelum dashboard memberi kategori performa. |
| `MIN_QUESTIONS_TOPIC` | 3 | Minimal soal FPB/KPK sebelum ada kesimpulan per materi. |
| `POINTS_*` | 100 / 5 / 250 | Poin per jawaban benar / per koin / per level selesai. |

> **Penting:** PIN hanya penghalang sederhana agar siswa tidak membuka dashboard tanpa sengaja. PIN tersimpan di kode dan browser, jadi **bukan** sistem keamanan. Jangan simpan data pribadi sensitif. Aplikasi ini sengaja hanya meminta nama panggilan/kode dan kelas.

## 3. Mencoba di komputer sendiri

Cara paling mudah: unggah ke GitHub Pages (bagian 4).
Untuk mencoba lokal, buka terminal di folder `math-runner` lalu jalankan `python -m http.server 8000`, kemudian buka `http://localhost:8000`.
Membuka `index.html` dengan klik dua kali juga biasanya berjalan (semua skrip memakai `<script>` biasa), tetapi beberapa browser membatasi LocalStorage untuk file lokal. Karena itu server lokal atau GitHub Pages lebih disarankan.

## 4. Deployment ke GitHub Pages

1. Buat akun di github.com (gratis) jika belum punya.
2. Klik **New repository**. Beri nama, misalnya `math-runner`. Pilih **Public**, lalu **Create repository**.
3. Pada halaman repositori, klik **Add file › Upload files**. Seret **isi** folder `math-runner` (bukan foldernya): `index.html`, `style.css`, semua file `.js`, serta folder `lib/` dan `assets/`. Klik **Commit changes**.
   *Pastikan `index.html` berada di tingkat paling atas repositori.*
4. Buka **Settings › Pages**. Pada *Build and deployment › Source* pilih **Deploy from a branch**, lalu pilih branch **main** dan folder **/ (root)**. Klik **Save**.
5. Tunggu 1–3 menit, lalu muat ulang halaman Settings › Pages. Alamat game akan muncul, biasanya:
   `https://NAMA-AKUN.github.io/math-runner/`
6. Buka alamat itu dan uji: mainkan satu level, lalu buka Teacher Dashboard.

Untuk memperbarui game, unggah ulang file yang berubah (Add file › Upload files). GitHub Pages akan memperbarui situs dalam beberapa menit.
*Catatan: nama menu GitHub bisa sedikit berubah dari waktu ke waktu. Jika berbeda, cari bagian "Pages" di Settings repositori.*

## 5. Embed ke Google Sites

1. Buka situs Anda di Google Sites (mode edit).
2. Di panel kanan, pilih **Sisipkan (Insert) › Sematkan (Embed)**.
3. Pilih tab **Dengan URL (By URL)**, tempel alamat GitHub Pages dari langkah 4, lalu pilih **Seluruh halaman (Whole page)** dan **Sisipkan**.
4. Tarik sudut kotak embed agar besar (disarankan selebar halaman dan tinggi minimal ±700 px), lalu **Publikasikan**.

Hal yang perlu diketahui saat game di-embed:
- Di dalam Google Sites, game menampilkan tombol **"Buka di tab baru"** di menu utama. Gunakan tombol ini jika layar terasa sempit atau untuk layar penuh di HP.
- **Ekspor/unduh dan cetak** dapat diblokir oleh bingkai (iframe) Google Sites. Untuk Teacher Dashboard, sebaiknya buka game di tab baru. Dashboard juga menyediakan tombol **Salin backup JSON** sebagai cadangan.
- **Penyimpanan data saat di-embed:** saya tidak dapat memastikan perilakunya di setiap browser. Browser modern (misalnya Chrome) memisahkan penyimpanan iframe berdasarkan situs induknya. Artinya, hasil yang dimainkan *di dalam* Google Sites kemungkinan **tidak terlihat** saat Anda membuka alamat GitHub Pages secara langsung, dan sebaliknya. Safari bisa lebih ketat lagi. **Saran:** pilih satu cara akses dan gunakan secara konsisten (siswa bermain dan guru membuka dashboard dari halaman yang sama), lalu **uji dulu** di perangkat sekolah sebelum dipakai di kelas.

## 6. Cara pakai di kelas

- **Satu perangkat untuk banyak siswa:** setiap siswa mengisi nama/kode dan kelas sebelum bermain. Hasil tiap sesi tersimpan di perangkat itu.
- **Banyak perangkat:** di setiap perangkat buka *Teacher Dashboard › Data & Pengaturan › Backup data (JSON)*. Kumpulkan file-file itu ke satu perangkat guru, lalu klik **Import** untuk setiap file. Sesi yang sama tidak akan tergandakan (dicek berdasarkan ID sesi).
- **Ekspor ke Excel/Google Sheets:** gunakan *Export CSV*. Jika Excel menampilkan semua data dalam satu kolom, ubah pemisah CSV menjadi **titik koma (;)** di *Data & Pengaturan* (umum pada Excel berbahasa/berpengaturan Indonesia), lalu ekspor ulang.
- **Backup rutin:** LocalStorage bisa terhapus jika riwayat/cache browser dibersihkan.

## 7. Cara bermain (ringkas)

- Laptop: ← → pindah jalur, ↑/Spasi lompat, ↓ meluncur, P jeda, 1/2/3 pilih jawaban.
- HP: geser kiri/kanan/atas/bawah, atau gunakan tombol panah di layar dan ketuk tombol jawaban.
- Setiap level berisi 5 gerbang soal. Lari melambat saat soal muncul. Jika siswa belum memilih, karakter berhenti di depan gerbang sampai siswa memilih.
- Jawaban salah **tidak** mengakhiri permainan. Siswa melihat jawaban benar beserta penjelasannya.
- 3 nyawa untuk rintangan. Jika habis, siswa melanjutkan dari checkpoint (gerbang terakhir).

## 8. Data yang disimpan per sesi

```json
{
  "studentName": "", "studentClass": "", "sessionId": "", "date": "",
  "totalScore": 0, "totalCoins": 0, "totalQuestions": 0, "correctAnswers": 0, "incorrectAnswers": 0,
  "overallAccuracy": 0, "fpbAttempted": 0, "fpbCorrect": 0, "kpkAttempted": 0, "kpkCorrect": 0,
  "completedLevels": [], "highestLevel": "", "questionHistory": [],
  "startLevel": 1, "status": "tamat|berhenti|terputus", "achievements": [], "durationSec": 0
}
```
Setiap item `questionHistory` berisi: `questionId`, `topic` (FPB/KPK), `subIndicator`, `difficulty`, `level`, `question`, `studentAnswer`, `correctAnswer`, `isCorrect`, `timeSec`, `misconception` (jenis kesalahan), dan `answeredAt`.
Angka ringkasan (akurasi dan lainnya) **selalu dihitung ulang dari `questionHistory`**, sehingga akurasi selalu sesuai jawaban aktual.
Seluruh data disimpan di kunci LocalStorage `mathRunner.data` dengan `schemaVersion` untuk migrasi di masa depan. Jika data rusak, salinan mentahnya disimpan dengan kunci `mathRunner.data.corrupt-…` dan dashboard memberi peringatan.

## 9. Pengembangan berikutnya (Firebase / Supabase)

`storage.js` memakai lapisan adapter. Untuk sinkronisasi antarperangkat, daftarkan adapter jarak jauh:
```js
MR.Storage.registerRemote({
  onChange(data) { /* kirim data.sessions baru ke Firestore/Supabase */ },
});
```
Lalu tambahkan fungsi tarik data yang memanggil `MR.Storage.importSessions(...)`. Game dan dashboard tidak perlu diubah. Jika nanti memakai server, PIN lokal perlu diganti dengan login guru yang sebenarnya.

## 10. Menambah atau mengubah soal

Edit array `RAW` di `questions.js`. Cukup tulis jenis soal (`gcd`, `lcm`, `factorList`, `multipleList`, `commonFactor`, `commonMultiple`), bilangannya, dan 3 pilihan jawaban. Kunci jawaban, penjelasan, dan jenis kesalahan dihitung otomatis. Setelah mengubah soal, jalankan:
```
node tests/verify-questions.js
```
untuk memastikan setiap soal memiliki tepat satu jawaban benar.

# assets/

Folder ini sengaja kosong. Versi 1 membuat semua aset secara prosedural di dalam kode:

- **characters/**: karakter penjelajah dibuat dari bentuk 3D di `game.js` › `makeExplorer()`.
- **environments/**: hutan, jembatan, kuil, dan gua dibuat di `game.js` › `buildSegment()` dan `buildFar()`.
- **textures/**: tekstur batu, kayu, ubin kuil, lantai gua, dan rumput digambar di kanvas (`game.js` › `TEX`).
- **sounds/**: musik dan efek suara disintesis dengan Web Audio API (`audio.js`).

Jika ingin memakai aset buatan sendiri (misalnya model .glb atau suara .mp3), simpan di subfolder yang sesuai, lalu muat dari `game.js`/`audio.js`. Pastikan Anda memiliki hak untuk memakai aset tersebut.

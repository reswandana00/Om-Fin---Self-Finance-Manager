# Product Requirements Document (PRD)

## 1. Nama Produk

**AI Financial Assistant**

Aplikasi mobile untuk mencatat, mengelola, dan menganalisis keuangan pribadi secara otomatis menggunakan input teks, foto, dan audio.

---

## 2. Ringkasan Produk

Banyak orang malas mencatat keuangan karena proses input manual terlalu repot. Produk ini menyederhanakan pencatatan dengan AI yang dapat membaca struk, memahami input suara, dan mengubahnya menjadi transaksi yang langsung masuk ke dashboard.

Target awal produk adalah penggunaan pribadi, lalu berkembang menjadi aplikasi yang dapat dipakai oleh mahasiswa, pekerja, dan pengguna umum yang ingin mengelola uang tanpa ribet administrasi.

---

## 3. Masalah yang Ingin Diselesaikan

Pengguna sering mengalami masalah berikut:

- Sulit disiplin mencatat pengeluaran dan pemasukan.
- Input manual transaksi terasa membosankan.
- Struk belanja sering hilang atau tidak pernah dicatat.
- Pengguna ingin tahu ke mana uang habis, tetapi tidak ingin input data secara detail.
- Aplikasi keuangan yang ada terlalu kaku dan terasa seperti pekerjaan akuntansi.

---

## 4. Tujuan Produk

### Tujuan utama

Membuat pencatatan keuangan menjadi semudah mengirim pesan atau memfoto struk.

### Tujuan bisnis/produk

- Meningkatkan frekuensi pencatatan transaksi.
- Memberikan insight keuangan yang relevan dan mudah dipahami.
- Membantu pengguna mengontrol pengeluaran tanpa beban administrasi.

---

## 5. Sasaran Pengguna

### Target utama

- Mahasiswa
- Pekerja muda
- Pengguna pribadi yang ingin mengatur keuangan sederhana
- Orang yang tidak suka administrasi, akuntansi, dan pencatatan manual

### Karakteristik pengguna

- Ingin cepat
- Tidak suka form panjang
- Sering belanja kecil-kecilan dan lupa mencatat
- Lebih nyaman dengan input natural seperti chat, foto, atau voice note

---

## 6. Value Proposition

> “Catat pengeluaran cukup dengan foto struk, teks, atau suara. AI akan memahami, mengelompokkan, dan memperbarui dashboard keuangan secara otomatis.”

Keunggulan utama:

- Input minim friksi
- AI-assisted categorization
- Dashboard yang langsung berguna
- Cocok untuk pengguna yang tidak suka administrasi

---

## 7. Ruang Lingkup Produk

### In-scope

- Pemasukan
- Pengeluaran
- Dashboard ringkasan
- Input transaksi dari teks
- Input transaksi dari foto struk
- Input transaksi dari audio
- Kategori transaksi otomatis oleh AI
- Edit / koreksi hasil AI
- Riwayat transaksi
- Insight sederhana

### Out-of-scope untuk versi awal

- Integrasi bank langsung
- Sinkronisasi kartu kredit otomatis
- Pajak
- Akuntansi lengkap
- Investasi / portofolio saham
- Multi-user family account
- Fitur pinjaman / kredit

---

## 8. Persona Pengguna

### Persona 1: Mahasiswa Sibuk

Ingin tahu uang habis ke mana, tetapi tidak rajin mencatat.

### Persona 2: Pekerja Muda

Sering transaksi kecil, ingin dashboard sederhana dan insight bulanan.

### Persona 3: Power User

Suka aplikasi yang bisa menerima input cepat dari foto, teks, dan suara.

---

## 9. User Story

- Sebagai pengguna, saya ingin memfoto struk agar transaksi masuk otomatis.
- Sebagai pengguna, saya ingin mengirim teks atau suara agar tidak perlu mengisi form manual.
- Sebagai pengguna, saya ingin melihat pengeluaran per kategori.
- Sebagai pengguna, saya ingin mengoreksi hasil AI jika salah.
- Sebagai pengguna, saya ingin mengetahui total pemasukan, pengeluaran, dan saldo bersih dalam satu layar.
- Sebagai pengguna, saya ingin mendapatkan insight tentang kebiasaan belanja saya.

---

## 10. Use Cases Utama

### Use Case 1: Input dari Teks

Pengguna menulis:

> beli kopi 25 ribu

Sistem mengekstrak:

- tipe: expense
- nominal: 25000
- kategori: Food & Beverage

### Use Case 2: Input dari Foto Struk

Pengguna memfoto struk.
Sistem melakukan OCR lalu mengekstrak item transaksi dan total nominal.

### Use Case 3: Input dari Audio

Pengguna merekam:

> tadi beli makan 30 ribu dan parkir 5 ribu

Sistem mengubah audio menjadi teks, lalu mengekstrak transaksi.

### Use Case 4: Dashboard

Pengguna membuka aplikasi dan langsung melihat:

- total pemasukan bulan ini
- total pengeluaran bulan ini
- saldo bersih
- kategori pengeluaran terbesar

### Use Case 5: Koreksi Data

Jika AI salah membaca nominal atau kategori, pengguna bisa mengedit sebelum data disimpan permanen.

---

## 11. Fitur Produk

### 11.1 Input Transaksi Multi-Modal

#### a. Teks

- Input bebas
- AI mengekstrak nominal, kategori, tanggal, dan deskripsi

#### b. Foto

- Upload atau kamera langsung
- OCR untuk membaca struk
- Ekstraksi data transaksi dari hasil OCR

#### c. Audio

- Rekam suara
- Speech-to-text
- Parsing transaksi dari hasil transkrip

### 11.2 Dashboard Keuangan

- Total pemasukan
- Total pengeluaran
- Saldo bersih
- Grafik pengeluaran per kategori
- Tren mingguan / bulanan
- Transaksi terbaru

### 11.3 Kategori Otomatis

- Makanan
- Transportasi
- Hiburan
- Belanja
- Kesehatan
- Pendidikan
- Tagihan
- Lain-lain

Kategori dapat dikoreksi pengguna.

### 11.4 Riwayat Transaksi

- Daftar transaksi
- Filter berdasarkan tanggal, kategori, jenis transaksi
- Search transaksi

### 11.5 Insight Otomatis

- Kategori pengeluaran terbesar
- Perbandingan bulan ini vs bulan lalu
- Pengeluaran yang meningkat
- Rekomendasi sederhana untuk kontrol keuangan

### 11.6 Koreksi dan Validasi

- Pengguna dapat mengedit hasil AI
- Sistem menyimpan koreksi untuk perbaikan ke depan

---

## 12. Kebutuhan Fungsional

1. Pengguna dapat membuat akun dan login.
2. Pengguna dapat menambahkan transaksi manual.
3. Pengguna dapat menambahkan transaksi melalui teks.
4. Pengguna dapat menambahkan transaksi melalui foto struk.
5. Pengguna dapat menambahkan transaksi melalui audio.
6. Sistem dapat mengekstrak nominal, kategori, dan deskripsi secara otomatis.
7. Pengguna dapat mengedit hasil ekstraksi sebelum disimpan.
8. Pengguna dapat melihat dashboard ringkasan keuangan.
9. Pengguna dapat melihat riwayat transaksi.
10. Pengguna dapat memfilter transaksi.
11. Sistem dapat menampilkan insight otomatis.
12. Sistem menyimpan data transaksi secara aman.

---

## 13. Kebutuhan Non-Fungsional

- Aplikasi harus responsif di mobile.
- Waktu respons AI harus tetap masuk akal untuk pengalaman pengguna.
- Data harus tersimpan dengan aman.
- Aplikasi harus mudah digunakan tanpa pembelajaran panjang.
- UI harus sederhana, modern, dan minim beban visual.
- Sistem harus dapat menangani input yang tidak sempurna atau ambigu.

---

## 14. Prinsip UX

- Minim langkah input
- Progressively disclose detail, jangan langsung penuh form
- Feedback cepat setelah input
- User selalu bisa koreksi hasil AI
- Dashboard harus langsung menunjukkan manfaat
- Hindari tampilan seperti aplikasi akuntansi

---

## 15. Alur Pengguna

### Alur A: Foto Struk

1. Pengguna buka aplikasi.
2. Tekan tombol foto.
3. Ambil gambar struk.
4. AI membaca data.
5. User meninjau hasil.
6. User menyimpan transaksi.
7. Dashboard otomatis ter-update.

### Alur B: Input Suara

1. Pengguna tekan tombol mic.
2. Ucapkan transaksi.
3. Sistem transkrip audio.
4. AI mengekstrak informasi transaksi.
5. User konfirmasi.
6. Data masuk ke dashboard.

### Alur C: Input Teks

1. Pengguna ketik transaksi.
2. AI memahami isi pesan.
3. User cek hasil.
4. Transaksi tersimpan.

---

## 16. MVP (Minimum Viable Product)

Versi awal fokus pada 4 hal:

1. Input teks
2. Input foto struk
3. Dashboard dasar
4. AI kategorisasi transaksi

### MVP tidak termasuk

- Integrasi bank
- Goal planning lanjutan
- Rekomendasi investasi
- Multi-wallet kompleks
- Family account

---

## 17. Versi Pengembangan Berikutnya

### V1.0

- Teks
- Foto struk
- Dashboard
- Histori transaksi
- Koreksi hasil AI

### V2.0

- Audio input
- Insight otomatis
- Kategori custom
- Recurring transaction

### V3.0

- Goal planning
- Prediksi pengeluaran
- Rekomendasi tabungan
- Agent keuangan personal

---

## 18. Data Model Tingkat Tinggi

### Entitas utama

- User
- Transaction
- TransactionItem
- Category
- Receipt
- Budget
- AIProcessingLog
- FinancialGoal

### Contoh field Transaction

- id
- user_id
- type (income / expense)
- amount
- category
- description
- source (manual / text / photo / audio)
- date
- created_at
- updated_at

---

## 19. Rekomendasi Tech Stack

### Frontend mobile

- Next.js
- React
- Tailwind
- Shadcn UI
- Capacitor

### Backend

- FastAPI
- PostgreSQL
- Redis
- Object storage untuk file gambar/audio

### AI / Processing

- OCR engine
- Speech-to-text engine
- LLM untuk parsing transaksi dan insight

---

## 20. Risiko Produk

### Risiko 1: AI salah membaca data

Mitigasi:

- tampilkan hasil untuk konfirmasi pengguna
- sediakan edit manual

### Risiko 2: User malas pakai lagi

Mitigasi:

- input harus cepat
- dashboard harus memberi manfaat langsung
- kurangi langkah yang tidak perlu

### Risiko 3: Struk tidak terbaca

Mitigasi:

- fallback ke input manual
- indikator kualitas foto

### Risiko 4: Terlalu kompleks di awal

Mitigasi:

- fokus MVP pada satu alur utama
- jangan tambahkan fitur akuntansi lengkap

---

## 21. Definisi Sukses

Produk dianggap berhasil bila:

- pengguna rutin mencatat transaksi
- pengguna merasa lebih paham pengeluaran mereka
- input via foto / teks / audio terasa lebih cepat daripada input manual
- pengguna mau terus memakai aplikasi setelah beberapa minggu

---

## 22. Catatan Strategis

Produk ini paling kuat jika diposisikan sebagai:
**“AI personal finance assistant untuk pengguna yang tidak suka administrasi.”**

Bukan sebagai:

- aplikasi akuntansi
- aplikasi pembukuan formal
- aplikasi bank replacement

---

## 23. Pertanyaan Terbuka untuk Tahap Berikutnya

- Apakah kategori transaksi harus fixed atau bisa custom?
- Apakah dashboard dibuat harian, mingguan, atau bulanan sebagai default?
- Apakah transaksi bisa diinput tanpa login pada versi awal?
- Apakah ingin fokus Android dulu atau langsung cross-platform?
- Apakah AI parsing dilakukan lokal, server-side, atau hybrid?

---

## 24. Kesimpulan

Produk ini punya potensi kuat karena menyelesaikan masalah yang nyata: pencatatan keuangan yang merepotkan. Keunggulan utamanya ada pada input natural (teks, foto, audio) dan insight otomatis. Jika dibangun dengan MVP yang kecil tetapi solid, produk ini bisa berkembang menjadi aplikasi personal finance yang benar-benar dipakai harian.

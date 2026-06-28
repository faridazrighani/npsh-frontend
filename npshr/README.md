# NPSHr Module Boundary

Folder ini disediakan khusus untuk rancangan UI/UX dan aturan perhitungan NPSHr / NPSH3.

Prinsip utama:

```text
NPSHa = hasil perhitungan sistem.
NPSHr / NPSH3 = karakteristik pompa dari vendor/test/jurnal/manual input.
```

Karena itu NPSHr tidak boleh dihitung dari Fluid Basis, PFV, pipe loss, source, sink, suction pressure, vapor pressure, density, viscosity, elevation, atau hasil NPSHa.

## Ruang Lingkup Yang Diizinkan

- Membaca nilai NPSHr manual yang dimasukkan user.
- Membaca data NPSHr/NPSH3 dari datasheet vendor, kurva pompa, hasil test, atau jurnal.
- Melakukan lookup/interpolasi pada kurva NPSHr yang sudah tersedia.
- Menampilkan status kelengkapan data sumber NPSHr.
- Menyimpan audit trail sumber data: vendor, test standard, halaman dokumen, flow, speed, unit, dan catatan validasi.

## Ruang Lingkup Yang Dilarang

- Menghitung NPSHr dari Fluid Basis.
- Menghitung NPSHr dari PFV, pipe segment, fitting, valve, suction loss, atau route trace.
- Menghitung NPSHr dari pressure, vapor pressure, density, viscosity, temperature, atau static head.
- Menurunkan NPSHr dari NPSHa atau margin NPSH.
- Menulis ulang hasil NPSHa, suction loss, system head, atau hasil protected backend.
- Membuat pump curve sintetis untuk mengganti data vendor/test.

## Aturan Jika Data Sistem Dibutuhkan

Jika suatu tampilan NPSHr perlu mengetahui konteks sistem seperti flow operasi, Fluid Basis, PFV, atau NPSHa, maka modul NPSHr hanya boleh:

```text
READ ONLY untuk konteks tampilan atau pembanding.
```

Contoh yang boleh:

```text
Flow operasi dibaca hanya sebagai koordinat lookup kurva NPSHr vendor.
NPSHa dibaca hanya untuk comparison NPSHa vs NPSHr di modul evaluasi terpisah.
```

Contoh yang tidak boleh:

```text
Density + vapor pressure + suction loss dipakai untuk menghitung NPSHr.
PFV loss dipakai untuk mengubah nilai NPSHr.
NPSHa dikurangi margin lalu dianggap sebagai NPSHr.
```

## Kontrak Data Minimal

```text
pumpId
npshrBasis          NPSHr | NPSH3
npshrSourceType     manual | vendor_curve | vendor_table | test_report | journal
npshrValueM         number | null
flowM3H             number | null
speedRpm            number | null
curvePoints         [{ flowM3H, npshrM }]
sourceReference     text
confidence          verified | declared | digitized | journal | manual | unknown
notes               text
```

Folder ini sengaja belum dihubungkan ke runtime aplikasi. Integrasi UI/UX NPSHr harus dibahas dan disetujui dulu sebelum menyentuh Pump Object, Pump Curve, atau backend.


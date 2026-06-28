# NPSHr Guardrails

Dokumen ini adalah pagar implementasi supaya NPSHr tidak tercampur dengan NPSHa.

## Dependency Rule

Modul NPSHr tidak boleh import, call, atau membaca langsung dari domain berikut:

```text
Fluid Basis
PFV
Pipe / fitting / valve loss
SRC / source boundary
SNK / sink boundary
Route trace
NPSHa calculation
Vapor pressure calculation
Density / viscosity calculation
Protected backend hydraulic solve
```

Jika data tersebut dibutuhkan untuk layar pembanding, data harus datang dari modul evaluasi luar sebagai read-only display context, bukan sebagai input perhitungan NPSHr.

## Allowed NPSHr Operations

```text
manual value read
vendor/test/journal value read
provided curve point read
provided curve interpolation
source completeness validation
unit display and conversion for already-provided NPSHr value
```

## Forbidden NPSHr Operations

```text
derive from NPSHa
derive from suction pressure
derive from vapor pressure
derive from density or viscosity
derive from PFV loss
derive from pipe friction
derive from static head
derive from system margin
generate synthetic vendor curve
overwrite backend hydraulic results
```

## Review Checklist Before Implementation

- Apakah nilai NPSHr berasal dari manual/vendor/test/jurnal?
- Apakah flow hanya dipakai sebagai koordinat lookup kurva yang sudah ada?
- Apakah tidak ada Fluid Basis/PFV/pipe/source/sink import di folder ini?
- Apakah output NPSHr tidak menulis hasil NPSHa?
- Apakah comparison NPSHa vs NPSHr diletakkan di modul evaluasi terpisah?
- Apakah UI memberi label sumber data dan confidence?


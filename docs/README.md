# Indeks dokumentasi

Baseline: [RUPA-HANDOFF.md](../RUPA-HANDOFF.md). Paket dokumentasi ini mengubah handoff menjadi requirement, kontrak implementasi, dan langkah kerja yang dapat diperiksa. **Lima kontrak sudah live menurut konfirmasi pengguna; SDK, DSL, agent dan UI demo sudah diimplementasikan. App/agent registration dan E2E produk baru belum selesai.** Status aktual ada di [verification notes](verification-notes.md).

## Jalur baca

| Kebutuhan | Dokumen |
| --- | --- |
| Memahami temuan dan konflik handoff | [Telaah handoff](handoff-review.md) |
| Scope, pengguna, metrik, acceptance | [PRD](prd.md) |
| Istilah inti | [Concepts](concepts.md) |
| Komponen, data, trust boundary | [Arsitektur](architecture.md) |
| Route, alur pengguna, loading/error state | [Spesifikasi UX](ux-spec.md) |
| Kontrak, hak akses, encoding, alamat | [Kontrak](contracts.md) |
| Format aturan dan determinisme | [Mapping DSL](mapping-dsl.md) |
| API SDK, endpoint agent, error | [SDK dan API](sdk-and-api.md) |
| Threat model dan kontrol | [Security](security.md) |
| Test matrix dan release gate | [Test plan](test-plan.md) |
| Urutan milestone dan estimasi | [Implementation plan](implementation-plan.md) |
| Task yang dapat langsung dikerjakan | [Backlog](backlog.md) |
| Setup lokal dan CI | [Development](development.md) |
| Environment, deployment, recovery | [Deployment](deployment.md) |
| Keputusan tetap, usulan, pertanyaan | [Decision log](decisions.md) |
| Evidence teknis | [Verification notes](verification-notes.md) |
| Integrasi aplikasi | [Quickstart](quickstart.md) |
| Akses dan troubleshooting juri | [Judge guide](judge-guide.md) |
| Rekaman demo, pitch, submission | [Demo script](demo-script.md) |
| Pedoman kontribusi | [CONTRIBUTING](../CONTRIBUTING.md) |
| Pedoman repository | [AGENTS](../AGENTS.md) |

## Pemeliharaan

`prd.md` menentukan perilaku yang dibutuhkan; spesifikasi teknis memperinci implementasi. `decisions.md` menjelaskan penambahan atau perubahan terhadap baseline. `verification-notes.md` menyimpan evidence, bukan janji. `backlog.md` melacak progres dan tidak menggantikan requirement.

Requirement memakai ID `FR-*`/`NFR-*`; test memakai `T-*`; task memakai `M*-*`; gap handoff memakai `G-*`. Jika sebuah keputusan mengubah requirement, perbarui seluruh tautan terkait dalam perubahan yang sama.

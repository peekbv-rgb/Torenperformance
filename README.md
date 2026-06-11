# Catava Air — Dynamisch Torensimulator v3

Interactief fysisch rekenmodel voor de **Catava Air airsok** — een katabatische adiabatische koeltoren voor glastuinbouw.

🔗 **Live demo:** [GitHub Pages](https://jouwaccount.github.io/catava-simulator)

---

## Snel starten

```bash
git clone https://github.com/jouwaccount/catava-simulator.git
cd catava-simulator
# Open index.html in je browser — geen installatie nodig
```

Of direct online via GitHub Pages:
1. Ga naar **Settings → Pages**
2. Branch: `main`, folder: `/ (root)`
3. Save → de simulator is live op `https://jouwaccount.github.io/catava-simulator`

---

## Inhoud

```
catava-simulator/
├── index.html     # Volledige simulator (self-contained, geen dependencies)
└── README.md
```

Alles zit in één HTML-bestand. Geen npm, geen build-stap, geen externe bibliotheken.

---

## Tabbladen

| Tab | Wat je kunt instellen | Wat je ziet |
|-----|-----------------------|-------------|
| **Geometrie** | Ø boven, Ø keel, Ø tussenstuk, Ø onder, hoogte per zone | Doorsnede-tekening op schaal met maatpijlen, oppervlakken |
| **Performance** | Temperatuur, RV, ΔT, rendement, water | Koelvermogen, luchtdebiet, VD, Venturi-snelheden per zone |
| **2 Torens** | Hart-op-hart afstand (2–25 m) | Bovenaanzicht met invloedszones + overlap, zijaanzicht op schaal |
| **Per hectare** | Aantal torens/ha (15–55) | Rastervisualisatie 100×100 m, waterverbruiksgrafiek |
| **Nozzles** | Type (KBN 80125 / 80063), ringen, druk | Capaciteitstabel, ringdebiet, waterbalans |
| **VD-matrix** | VD-doelbereik min/max | Kleurmatrix 18–38°C × 40–95% RV |

---

## Fysisch model

### Koelvermogen
```
Q_max   = (water [l/h] / 3600) × 2450 kJ/kg
Q_netto = Q_max × verdampingsrendement
```

### Luchtdebiet
```
ṁ_lucht = Q_netto / (Cp × ΔT)     [kg/s],  Cp = 1,006 kJ/kg·K
V̇       = ṁ_lucht / ρ              [m³/s],  ρ  = 1,15 kg/m³
```

### Venturi (4 zones)
```
Continuïteit:  A₁·v₁ = A₂·v₂ = A₃·v₃ = A₄·v₄
Bernoulli:     ΔP = ½·ρ·(v_keel² − v_boven²)
```

### Vochtdeficit
```
VD = ρ_sat(T) × (1 − RV/100)   [g/m³]
ρ_sat(T) ≈ 4,849 × e^(0,0653 × T)
```

### Nozzle debiet (√P-schaling)
```
q(P) = q_ref × √(P / 10)
KBN 80125: q_ref = 7,50 l/h  @ 10 bar
KBN 80063: q_ref = 3,78 l/h  @ 10 bar
```

---

## Torengeometrie (standaardwaarden uit ontwerp dec. 2025)

| Zone | Diameter | Hoogte |
|------|----------|--------|
| Boven-conus (binnenmaat kunststof) | Ø 1067 mm | 1950 mm |
| Venturi-keel | Ø 800 mm | — |
| Tussenstuk | Ø 800 mm | 1500 mm |
| Onder-uitloop | Ø 1000 mm | 400 mm |
| **Totaal** | | **4200 mm** |

Alle maten zijn volledig aanpasbaar in de simulator.

---

## Ontwerpuitgangspunten (aanpasbaar via sliders)

| Parameter | Standaard |
|-----------|-----------|
| Torens per hectare | 32 |
| Water per toren | 48 l/h |
| Verdampingsrendement | 85 % |
| Nozzle type | KBN 80125 |
| VD-doelbereik | 2–8 g/m³ |

---

## Bronnen

- Ontwerptekening airsok Catava/Catyra BV (december 2025)
- Kickoff-presentatie 'Maak-BV' (18 december 2025)
- CoolFlow validatierapport (december 2025)
- Nozzle specs: KBN-serie (Ten Cate KA-10/KA-46, fabricage Japan)

---

## Licentie

Intern gebruik Catava Air BV. Niet voor externe distributie zonder toestemming.

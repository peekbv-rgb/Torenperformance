[README.md](https://github.com/user-attachments/files/28842928/README.md)
# Catava Air — Dynamisch Torensimulator v3

> Interactief fysisch rekenmodel voor de **Catava Air airsok** —  
> een katabatische adiabatische koeltoren voor glastuinbouw.

[![Deploy to GitHub Pages](https://github.com/catava-air/torensimulator/actions/workflows/deploy.yml/badge.svg)](https://github.com/catava-air/torensimulator/actions/workflows/deploy.yml)

---

## Live demo

```
https://<jouw-account>.github.io/catava-simulator/
```

---

## Snel starten

```bash
# 1. Clone
git clone https://github.com/<jouw-account>/catava-simulator.git
cd catava-simulator

# 2. Open direct in browser — geen installatie nodig
open index.html
```

Of via een lokale server (optioneel):

```bash
python3 -m http.server 8080
# open: http://localhost:8080
```

---

## Projectstructuur

```
catava-simulator/
│
├── index.html                  # HTML-structuur en tabbladen
├── style.css                   # Volledige opmaak
├── model.js                    # Fysisch model, berekeningen, Canvas
│
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Actions → automatisch deployen
│
├── .gitignore
└── README.md
```

---

## Tabbladen

| Tab | Instelbaar | Output |
|-----|-----------|--------|
| **Geometrie** | Ø boven, Ø keel, Ø tussenstuk, Ø onder + hoogte per zone | Doorsnede op schaal, oppervlakken, formules |
| **Performance** | Temp, RV, ΔT, rendement, water | Koelvermogen, luchtdebiet, VD, Venturi 4 zones |
| **2 Torens** | Hart-op-hart afstand 2–25 m | Boven- en zijaanzicht met invloedszones + overlap |
| **Per hectare** | Aantal torens/ha | Rastervisualisatie 100×100 m, waterverbruiksgrafiek |
| **Nozzles** | Type KBN 80125 / 80063, ringen, druk | Capaciteitstabel, ringdebiet, waterbalans |
| **VD-matrix** | VD-doelbereik min/max | Kleurmatrix 18–38°C × 40–95% RV |

---

## Fysisch model

### Koelvermogen

```
Q_max   = (water [l/h] / 3600) × 2450   [kW]
Q_netto = Q_max × verdampingsrendement
```

### Luchtdebiet

```
ṁ_lucht = Q_netto / (Cp × ΔT)    [kg/s]    Cp = 1,006 kJ/kg·K
V̇       = ṁ_lucht / ρ             [m³/s]    ρ  = 1,15 kg/m³
```

### Venturi — 4 zones

```
Continuïteit:  A₁·v₁ = A₂·v₂ = A₃·v₃ = A₄·v₄
Bernoulli:     ΔP = ½·ρ·(v_keel² − v_boven²)   [Pa]
```

### Vochtdeficit

```
VD(T, RV) = ρ_sat(T) × (1 − RV/100)   [g/m³]
ρ_sat(T)  ≈ 4,849 × e^(0,0653 × T)
```

### Nozzle debiet (√P-schaling)

```
q(P) = q_ref × √(P / 10)          [l/h]
KBN 80125:  q_ref = 7,50 l/h  @ 10 bar
KBN 80063:  q_ref = 3,78 l/h  @ 10 bar
```

---

## Torengeometrie — standaardwaarden (ontwerp dec. 2025)

| Zone | Diameter | Hoogte |
|------|----------|--------|
| Boven-conus (binnenmaat kunststof) | Ø 1067 mm | 1950 mm |
| Venturi-keel | Ø 800 mm | — |
| Tussenstuk | Ø 800 mm | 1500 mm |
| Onder-uitloop | Ø 1000 mm | 400 mm |
| **Totaal** | | **4200 mm** |

Alle maten zijn volledig aanpasbaar in de simulator.

---

## Standaardwaarden sliders

| Parameter | Waarde |
|-----------|--------|
| Buitentemperatuur | 35 °C |
| Relatieve vochtigheid | 30 % |
| Doelkoeling ΔT | 10 K |
| Verdampingsrendement | 85 % |
| Water per toren | 48 l/h |
| Torens per hectare | 32 |
| Nozzle type | KBN 80125 |
| VD-doelbereik | 2–8 g/m³ |

---

## GitHub Pages activeren

1. Ga naar **Settings → Pages**
2. Source: **GitHub Actions**
3. Bij elke push naar `main` deployt de simulator automatisch

---

## Lokale ontwikkeling

Geen build-stap nodig. Bewerk `model.js` of `style.css` en herlaad de browser.

```bash
# Optioneel: live-reload met browser-sync
npx browser-sync start --server --files "*.html, *.css, *.js"
```

---

## Bronnen

- Ontwerptekening airsok Catava/Catyra BV (december 2025)
- Kickoff-presentatie 'Maak-BV' (18 december 2025)
- CoolFlow validatierapport (december 2025)
- Nozzle specs: KBN-serie, fabricage Japan (Ten Cate KA-10/KA-46)

---

## Licentie

Intern gebruik Catava Air BV.  
Niet voor externe distributie zonder toestemming.

# Admin Unified F0 — dabartinio UI vaizdinė bazė

**Fiksavimo data:** 2026-09-04
**Bazinis commit:** `4d03b94`
**Duomenys:** tik sintetiniai fixture duomenys
**Production:** nenaudota ir nekeista

Šios PNG nuotraukos sugeneruotos Chromium tiesiai iš šiame repository esančių
Next.js komponentų. Tai nėra ranka nupieštas maketas. Fixture maršrutai buvo
paleisti lokaliai su `ADMIN_NEXT_VISUAL_FIXTURE=true`; be šio aiškaus vartų
įjungimo jie grąžina `404`, o `NODE_ENV=production` atveju yra fail-closed.

Nuotraukos rodo **dabartinę kodo būseną**, ne F1–F7 įgyvendinimo rezultatą.
Sutartas būsimos vientisos sistemos tikslas pateiktas atskiroje interaktyvioje
vizualinėje specifikacijoje.

## Failai ir kontrolinės sumos

| Paviršius | Viewport | Failas | SHA-256 |
|---|---:|---|---|
| Today | 1440 × 900 | `admin-next-today-1440.png` | `48bf911998fee39072d05f730c35d086d45c69b06c09950b94a38884e99878de` |
| Today | 1024 × 900 | `admin-next-today-1024.png` | `549c6153809f453d74c7dd10f3d6b676a4a633a51afd7197f1f4e6782155a483` |
| Today | 768 × 1024 | `admin-next-today-768.png` | `d5e2e2b7167ed51312dfe39b7f6743c27c9cdf0a67631025d921a37dd3101a89` |
| Today | 375 × 812 | `admin-next-today-375.png` | `63a6ef03a58c0d1a76c5b6ae74889844747d4afd71e822b374189762550663d6` |
| Case | 1440 × 900 | `admin-next-case-1440.png` | `472a2c7f1ecb73e2354553b49b6001cf07755c326f6c5a42c9dfc8ff137cdfea` |
| Case | 375 × 812 | `admin-next-case-375.png` | `a5aad7e78b4b7844a128a8f71e15833f030c0e6c570ca20926992af2c4e14e63` |
| R4 review | 1440 × 900 | `admin-next-r4-1440.png` | `10fa8e1ec54c7083fc1d47e83a97d81bfc73da0cb4cfc07536336ffc80accf66` |
| R4 review | 375 × 812 | `admin-next-r4-375.png` | `2c4f08a7850f693c78bb1aaa012a3efb639be5753f862fc71f4d8867a7c2d842` |
| Document preflight | 1440 × 900 | `admin-next-document-preflight-1440.png` | `d2b53e3a7c810c3d7270002a4496065da105c5f0cca2e7fc6478ef1a760500e4` |
| Document preflight | 375 × 812 | `admin-next-document-preflight-375.png` | `7cb8321f194f07a79e5adcce6bc1c2d5b4d248b1e66ecaca3e357130e9a5f47b` |
| Field visit | 1440 × 900 | `admin-next-field-visit-1440.png` | `3be18b3254a8ff06bd28242aa4dc26cab8e09e3b85316957543f06b2478466f5` |
| Field visit | 375 × 812 | `admin-next-field-visit-375.png` | `d30fc1882fb801781119844f6bdb73f0c0229587f032d5a81c434f4f78dc1770` |

## Vizualinės patikros išvada

- Today persirikiuoja 1440, 1024, 768 ir 375 px pločiuose be horizontalaus
  dokumento overflow.
- Case, R4, document preflight ir field visit turi source-built desktop bei
  mobile bazę tolesnei regresinei patikrai.
- Case etapo indikatorius ties 375 px per daug susispaudžia ir pablogina
  pavadinimų įskaitomumą; tai registruota kaip `UA-FND-014`.
- R4 ir document preflight mobile režimu naudoja fiksuotą veiksmo juostą ir
  vidinį turinio slinkimą; tai turi būti tikrinama interakciniu testu, ne vien
  full-page nuotrauka.

Pakartotiniam fiksavimui skirtas `scripts/f0-capture-screenshots.mjs`. Jis
patikrina HTTP atsakymą, laukia hidratacijos, pašalina tik Next.js lokalaus dev
įrankio portalą ir nekeičia vaizduojamo produkto DOM.

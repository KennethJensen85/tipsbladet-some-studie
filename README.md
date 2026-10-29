# Tipsbladets SoMe-studie

Lav slides til Instagram og story i Tipsbladets stil. Otte formater, tre størrelser (4:5, 1:1, 9:16), download som png eller som én zip-fil.

Det er en ren statisk side uden afhængigheder. Alt ligger i `public/`.

## Kør lokalt

    npm run dev

Åbn http://localhost:3000 (kræver Node og Python 3). Alternativt: `npx serve public`.

## Læg på Vercel

1. Læg mappen i et repo på GitHub.
2. Vercel: **Add New → Project**, vælg repoet. Framework preset: **Other**. Resten læses fra `vercel.json`.
3. Deploy. Hver gang du pusher, bliver siden opdateret.

Eller fra kommandolinjen i denne mappe: `npx vercel --prod`.

Siden er offentlig for alle med linket.

## Husets logoer

- **Klublogoer:** læg png/svg/webp/jpg i `public/logos/`. Filnavnet bliver logoets navn (`fc-koebenhavn.png` giver "fc koebenhavn"). Listen over logoer bygges automatisk ved hver udrulning (`npm run build`), eller lokalt med `npm run logos`.
- **Hvidt Tipsbladet-logo med tekst** (bruges på CTA-sliden): læg det som `public/assets/tipsbladet-logo-hvid.png`, PNG med gennemsigtig baggrund. Indtil da tegnes teksten som en tilnærmelse.
- **Ikonet** ligger i `public/assets/ikon-groen.png` (til hjørnet) og `ikon-hvid.png` (til CTA-sliden).

Logoer, man selv trækker ind i siden, gemmes kun i den enkelte browser.

## Filer

- `public/index.html`, `styles.css`, `app.js`: selve studiet. Skabelonerne ligger i `app.js` under `R.headline`, `R.article`, `R.cta` osv.
- `scripts/make-manifest.mjs`: laver `public/logos/logos.json`.
- `vercel.json`: bygge-kommando og output-mappe.

Skrifttyperne (Barlow Condensed og Montserrat) hentes fra Google Fonts, og JSZip til zip-filen hentes fra cdnjs.

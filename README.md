# VBSK Amsterdam - Urenregistratie

Urenregistratieportaal voor boksvereniging VBSK Amsterdam.

## Installatie

```bash
cd vbsk-uren
npm install
npm run seed   # Maakt database aan met voorbeelddata
npm run dev    # Start op http://localhost:3000
```

## Inloggen

### Admin
- **Naam:** Admin
- **Pin:** 0000

### Trainers (voorbeelddata)
| Naam | Pin |
|------|-----|
| Mohamed El Amrani | 1234 |
| Youssef Bakali | 5678 |
| Rachid Ouazzani | 9012 |

## Functionaliteit

### Admin
- **Dashboard:** Maandoverzicht van alle ingediende uren per trainer
- **Rooster:** Weekrooster beheren (slots toevoegen/verwijderen)
- **Trainers:** Trainers toevoegen, activeren of deactiveren
- **Goedkeuren/Afwijzen:** Uren beoordelen met optionele reden bij afwijzing
- **CSV Export:** Per trainer per maand downloaden

### Trainer
- Weekrooster bekijken en slot selecteren om uren in te voeren
- Handmatig tijdslot toevoegen
- Aangeven of het regulier of inval is (met naam oorspronkelijke trainer)
- Status van ingediende uren bekijken

## Trainers toevoegen

1. Log in als Admin
2. Ga naar het tabblad "Trainers"
3. Vul naam en 4-cijferige pincode in
4. Klik "Toevoegen"

## Rooster aanpassen

1. Log in als Admin
2. Ga naar het tabblad "Rooster"
3. Voeg slots toe met dag, tijden, locatie en vaste trainer
4. Verwijder bestaande slots indien nodig

## Technische details

- **Frontend:** Next.js 15 + React 19 + TailwindCSS
- **Database:** SQLite via better-sqlite3
- **Auth:** Simpele naam + pincode (sessionStorage)
- **Database locatie:** `data/vbsk.db`

## Herseeden

```bash
npm run seed  # Wist bestaande database en maakt nieuwe aan
```

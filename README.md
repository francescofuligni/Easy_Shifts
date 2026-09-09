# Turni → Calendario

**Turni → Calendario** è una web app statica che converte un file Excel contenente i turni di lavoro in un calendario `.ics`, pronto da importare in Apple Calendar o Google Calendar.

L'app è progettata per funzionare interamente nel browser: i file Excel e i dati delle persone non vengono caricati, inviati o salvati su alcun server.

> Profilo attualmente supportato: **GH Bologna CKIN + LOST**

## Funzionalità

- Caricamento locale di file `.xlsx` e `.xls`
- Supporto per workbook con uno o più fogli
- Rilevamento automatico della riga delle date e delle colonne del mese
- Selezione e ricerca della persona interessata
- Gestione di cognomi duplicati tramite il numero di riga
- Anteprima cronologica dei turni, inclusi i codici non riconosciuti
- Esportazione di un file `.ics` compatibile con Apple Calendar e Google Calendar
- Interfaccia accessibile, responsive e interamente in italiano

## Privacy

Il file caricato viene elaborato solo localmente nel browser.

- Nessun backend, database, account o autenticazione
- Nessun upload o conservazione di file Excel e dati personali
- Nessuna integrazione con Google Calendar, Google OAuth o API esterne
- Nessun cookie di tracciamento o analytics

Ricaricando la pagina, tutti i dati elaborati vengono rimossi.

## Formato Excel supportato

Per il profilo **GH Bologna CKIN + LOST**:

- I cognomi sono nella prima colonna (A).
- La riga contenente più celle di tipo data viene rilevata automaticamente.
- Le colonne contenenti date valide vengono individuate dinamicamente: sono supportati mesi da 28 a 31 giorni e qualsiasi anno.
- Le persone sono le righe successive alla riga delle date con un valore in colonna A.
- I cognomi vengono mantenuti esattamente come presenti nel file, inclusi spazi, asterischi e simboli.

## Codici turno

| Codice | Evento generato |
| --- | --- |
| Cella vuota | Nessun evento |
| `R`, `R1`, `R2`, `RC` | Evento per l'intera giornata |
| `C` | Dalle 08:00 alle 22:00 |
| Singola lettera, ad es. `F` o `X` | Evento per l'intera giornata |
| `L0706` | Evento `L070`, dalle 07:00 alle 13:00 |
| `B1445` | Evento `B144`, dalle 14:40 alle 19:40 |
| Codice non riconosciuto | Nessun evento; indicato chiaramente nell'anteprima |

Un codice turno completo segue il formato:

```
lettera + 3 cifre dell'orario + 1 cifra della durata
```

La terza cifra dell'orario rappresenta le decine dei minuti:

- `0` → `:00`
- `3` → `:30`
- `4` → `:40`

Se la fine del turno supera la mezzanotte, l'evento termina correttamente il giorno successivo.

## Esportazione calendario

L'app crea file conformi a [RFC 5545](https://www.rfc-editor.org/rfc/rfc5545), con fuso orario `Europe/Rome`.

- Gli eventi giornalieri usano una data di fine corrispondente al giorno successivo.
- I turni con orario riportano inizio e fine corretti.
- I titoli vengono sottoposti a escape per il formato ICS.
- Non vengono aggiunti colori, descrizioni, invitati, promemoria o metadati proprietari.
- Il file esportato ha un nome simile a `turni-rossi-settembre-2026.ics`.

I pulsanti “Scarica per Apple Calendar” e “Scarica per Google Calendar” generano lo stesso file `.ics`.

## Tecnologie

- React
- TypeScript
- [SheetJS / xlsx](https://sheetjs.com/) per la lettura locale dei file Excel
- Generazione ICS nel browser

L'architettura è predisposta per aggiungere nuovi formati aziendali senza riscrivere l'app:

```
src/
├── companyProfiles/  # configurazioni per azienda/formato
├── excelParser/      # lettura e individuazione dei dati Excel
├── shiftParser/      # interpretazione dei codici turno
├── icsGenerator/     # generazione dei file .ics
└── components/       # componenti dell'interfaccia
```

## Avvio in locale

Sono necessari Node.js e npm.

```sh
git clone https://github.com/francescofuligni/Easy_Shifts.git
cd Easy_Shifts
npm install
npm run dev
```

## Demo

L'app è disponibile su [turni-facili.lovable.app](https://turni-facili.lovable.app).

## Contributi

Per proporre miglioramenti o supportare un nuovo formato Excel:

1. crea un branch dedicato;
2. mantieni l'elaborazione dei dati esclusivamente lato client;
3. aggiungi la configurazione in `companyProfiles`;
4. verifica i casi limite: mesi di diversa durata, fogli multipli, cognomi duplicati, turni notturni e codici non riconosciuti.

---

Realizzato con [Lovable](https://lovable.dev).

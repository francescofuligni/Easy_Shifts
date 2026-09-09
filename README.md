# Turni Facili

Certo — il nome dell’azienda/formato sarà esattamente “GH Bologna CKIN + LOST”.

Crea un sito web statico, responsive e interamente in italiano chiamato “Turni → Calendario”.

OBIETTIVO
L’utente carica un file Excel di turni, seleziona l’azienda/formato, il foglio e la riga della persona interessata. Il sito genera un file .ics da importare in Apple Calendar o Google Calendar.

Il sito deve essere una prima versione statica, ma con un’architettura pronta a diventare in futuro una web app multi-azienda con ulteriori formati Excel.

VINCOLI NON NEGOZIABILI
- Tutto deve funzionare localmente nel browser dell’utente.
- Non creare backend, database, autenticazione, Supabase, API server, Google OAuth o Google Calendar API.
- Non caricare, inviare, salvare o conservare file Excel o dati personali su server.
- Nessun account utente, analytics, cookie di tracciamento o quota API.
- Il sito deve poter essere pubblicato come frontend statico.
- Tutti i testi dell’interfaccia devono essere in italiano.
- Non assegnare colori agli eventi.
- Non aggiungere descrizioni, invitati, promemoria o metadata proprietari Apple/Google.
- L’interfaccia deve essere mobile-first, accessibile e responsive su smartphone, tablet e desktop.

TECNOLOGIE E ARCHITETTURA
- React + TypeScript.
- Usa una libreria client-side affidabile per leggere file .xlsx e .xls, ad esempio SheetJS/xlsx.
- Genera file ICS localmente nel browser.
- Organizza il codice separando:
  - `companyProfiles`: configurazioni aziendali;
  - `excelParser`: lettura e rilevamento dati Excel;
  - `shiftParser`: interpretazione codici turno;
  - `icsGenerator`: creazione file .ics;
  - componenti UI.
- Non hardcodare nomi di dipendenti o dati del file Excel.
- Il profilo aziendale deve essere configurabile tramite un oggetto separato, in modo che in futuro possano essere aggiunti altri formati senza riscrivere l’app.

PROFILO AZIENDALE INIZIALE
Nome visualizzato nel selettore:
“GH Bologna CKIN + LOST”

Il selettore “Azienda / formato” deve esistere già nella prima versione, anche se inizialmente contiene soltanto “GH Bologna CKIN + LOST”.

Il file Excel di riferimento può essere usato per testare il parser durante lo sviluppo, ma non deve essere incluso nell’app pubblicata.

REGOLE DI LETTURA DEL FILE EXCEL
1. L’utente seleziona “GH Bologna CKIN + LOST”.
2. Carica un file .xlsx o .xls.
3. Leggi tutti i fogli del workbook.
4. Se il file contiene un solo foglio, selezionalo automaticamente.
5. Se contiene più fogli, mostra un menu a tendina con tutti i fogli e seleziona il primo come default.
6. Nel formato GH Bologna CKIN + LOST:
   - i cognomi sono nella prima colonna, colonna A;
   - le date sono nella riga che contiene più celle di tipo data, normalmente la seconda riga;
   - non assumere mai un numero fisso di giorni o colonne;
   - rileva dinamicamente tutte le colonne che contengono date valide;
   - deve funzionare con mesi di 28, 29, 30 o 31 giorni e con qualunque anno;
   - ignora eventuali righe contenenti solo il giorno della settimana;
   - considera come persone le righe successive alla riga delle date con un valore nella colonna A.
7. Mantieni il cognome esattamente come compare nel file, inclusi asterischi, spazi e simboli.
8. Se due persone hanno lo stesso cognome, devono restare selezionabili separatamente. Mostra, ad esempio:
   “ROSSI* — riga 23”.
9. Aggiungi ricerca testuale nella lista delle persone.
10. Se il foglio selezionato non contiene date o persone valide, mostra un errore chiaro e non creare eventi.

REGOLE DI CONVERSIONE DEI CODICI TURNO
Per ogni cella della riga della persona selezionata, crea al massimo un evento seguendo queste regole.

- Cella vuota:
  - non creare evento.

- Codici `R`, `R1`, `R2`, `RC`:
  - crea un evento per l’intera giornata;
  - usa il codice esatto come titolo.

- Codice `C`:
  - crea un evento con titolo `C`;
  - inizio alle 08:00;
  - fine alle 22:00.

- Qualunque altro codice composto da una sola lettera, per esempio `F` o `X`:
  - crea un evento per l’intera giornata;
  - usa il codice esatto come titolo.

- Codice turno completo:
  - formato: `lettera + 3 cifre orario + 1 cifra durata`;
  - esempio: `B1445`;
  - prima lettera: mansione;
  - tre cifre successive: orario;
  - ultima cifra: durata in ore;
  - `144` significa 14:40;
  - la terza cifra dell’orario equivale alle decine dei minuti:
    - `0` = :00
    - `3` = :30
    - `4` = :40
  - `B1445` genera:
    - titolo: `B144`
    - inizio: 14:40
    - fine: 19:40.
  - `L0706` genera:
    - titolo: `L070`
    - inizio: 07:00
    - fine: 13:00.
  - conserva maiuscole o minuscole presenti nel codice.
  - se la fine supera la mezzanotte, deve terminare correttamente nel giorno successivo.

- Codice non riconosciuto:
  - non creare l’evento;
  - mostralo nell’anteprima con stato `Codice non riconosciuto`;
  - mostra data e valore originale della cella;
  - non ignorarlo silenziosamente.

CALENDARIO ED ESPORTAZIONE
- Genera un file `.ics` conforme allo standard RFC 5545.
- Inserisci correttamente:
  - `BEGIN:VCALENDAR`
  - `VERSION:2.0`
  - `PRODID`
  - `CALSCALE:GREGORIAN`
  - un `VEVENT` per ogni evento.
- Per gli eventi di intera giornata usa date ICS corrette e `DTEND` al giorno successivo.
- Per i turni con orario usa data, ora di inizio e ora di fine.
- Usa `Europe/Rome` come fuso orario del profilo GH Bologna CKIN + LOST.
- Escapa correttamente caratteri speciali nei titoli ICS.
- Non assegnare colori agli eventi.
- Non implementare protezione dai duplicati: se l’utente esporta o importa due volte, è un comportamento accettato.
- Il nome file deve essere simile a:
  `turni-{cognome}-{mese}-{anno}.ics`
  usando una versione sicura del cognome nel nome del file.

ESPERIENZA UTENTE
Realizza una procedura visuale chiara a passaggi.

1. “Scegli azienda e formato”
   - select con valore iniziale: `GH Bologna CKIN + LOST`.

2. “Carica il file Excel”
   - area drag and drop;
   - bottone “Scegli file”;
   - accetta `.xlsx` e `.xls`;
   - testo visibile: “Il file viene elaborato solo nel tuo browser e non viene salvato.”

3. “Scegli il foglio”
   - visibile dopo il caricamento;
   - menu a tendina se il file contiene più fogli.

4. “Scegli la persona”
   - campo di ricerca;
   - lista filtrabile;
   - mostra cognome e numero riga per distinguere duplicati.

5. “Controlla i turni”
   - anteprima in ordine cronologico;
   - colonne: Data, Codice, Titolo, Inizio, Fine, Stato;
   - su smartphone usa card leggibili anziché una tabella troppo larga;
   - separa chiaramente eventi validi e codici non riconosciuti;
   - mostra il totale degli eventi che saranno esportati.

6. “Esporta calendario”
   - due grandi pulsanti:
     - `Scarica per Apple Calendar`
     - `Scarica per Google Calendar`
   - entrambi generano lo stesso file `.ics`.
   - dopo il click su Apple mostra:
     “Apri il file scaricato con Calendar e scegli il calendario di destinazione.”
   - dopo il click su Google mostra:
     “Importa il file scaricato in Google Calendar da computer, scegliendo il calendario di destinazione.”
   - non promettere inserimento automatico nel calendario e non tentare login Google.

DESIGN
- Design pulito, rassicurante e semplice.
- Sfondo chiaro, tipografia leggibile, contrasto elevato.
- Barra dei passaggi chiara.
- Nessuna grafica corporate pesante.
- Nessun colore applicato agli eventi.
- Componenti accessibili via tastiera, con label corrette e messaggi di errore comprensibili.
- Layout perfetto da 320 px fino a desktop.

CRITERI DI ACCETTAZIONE
- Il file Excel viene elaborato solo localmente.
- Nessun dato viene conservato dopo il refresh della pagina.
- Il sito gestisce correttamente mesi da 28, 29, 30 e 31 giorni.
- I fogli multipli sono selezionabili.
- I cognomi duplicati restano distinguibili tramite numero riga.
- `B1445` genera `B144`, dalle 14:40 alle 19:40.
- `L0706` genera `L070`, dalle 07:00 alle 13:00.
- Un turno alle 20:00 di durata 8 ore termina alle 04:00 del giorno successivo.
- `R`, `R1`, `R2`, `RC`, `F` e `X` generano eventi per tutta la giornata.
- `C` genera un evento dalle 08:00 alle 22:00.
- I codici non riconosciuti sono visibili nell’anteprima.
- Il file ICS è importabile sia in Apple Calendar sia in Google Calendar.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://turni-facili.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/f8d7039a-18fa-4b2c-84d2-e402fc873828).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

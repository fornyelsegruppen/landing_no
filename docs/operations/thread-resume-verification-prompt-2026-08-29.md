# Naujos Codex užduoties privalomas pasitikrinimo promptas

Nauja užduotis prieš bet kokį kodo, Git, Preview ar Production veiksmą turi
įvykdyti šį protokolą ir pateikti vartotojui trumpą atsakymą lietuviškai.

## Promptas

```text
Perskaityk visą failą
docs/operations/thread-handoff-checkpoint-2026-08-29.md ir jame nurodytus
keturis pagrindinius dokumentus. Tada read-only būdu patikrink:

1. dabartinį cwd ir ar egzistuoja C:\Dev\takfornyelse-master-implementation;
2. Git šaką, HEAD, origin SHA ir git status;
3. ar yra commit f75db31 ir kokius tiksliai du failus jis keičia;
4. ar untracked failai sutampa su checkpointo preserve sąrašu;
5. PR #52 būseną ir ar Preview deployment SHA sutampa su darbo šaka;
6. ar Production tikrai nėra autorizuotas šio tęsinio taikinys;
7. kuris vienas veiksmas pagal H-1–H-5 yra kitas.

Nedaryk jokių mutacijų, kol nepateiksi tokios savikontrolės:

- PROJECT: tikslus kelias;
- BRANCH/HEAD: tikslūs duomenys;
- CURRENT PHASE: H-x;
- COMPLETED: kas įrodyta PASS;
- PENDING: kas dar nebaigta;
- AUTHORIZATION: kas leidžiama ir draudžiama;
- NEXT ACTION: vienas konkretus veiksmas;
- STOP CONDITION: kas sustabdytų tą veiksmą.

Jeigu bent vienas faktas nesutampa su checkpointu, nespėliok ir nepradėk
darbo. Pateik neatitikimą vartotojui. Jeigu viskas sutampa, aiškiai parašyk:
„Checkpoint suprastas ir patikrintas. Galiu kompetentingai tęsti nuo H-x.“
```

## Priėmimo kriterijus

Nauja užduotis laikoma pasirengusia tik kai:

- nepainioja `takfornyelse-businesspress` su
  `takfornyelse-master-implementation`;
- nepainioja Preview su Production;
- žino, kad `Case Workspace V3` dar tik specifikacija;
- žino, kad paskutinis DI juodraštis negali būti laikomas išsiųstu;
- žino, kad pirmiausia reikia užbaigti H-1 ir tik tada prašyti savininko UAT;
- nesiūlo merge ar Production be atskiro GO;
- išsaugo visus checkpointo untracked failus.

# temoin-poc-ball-tracking

POC d'exploration pour la détection et le suivi de la balle de tennis, dans le cadre du
projet **Témoin**. Voir `CLAUDE.md` pour le contexte complet du projet.

## Où on en est

**Jalon 1 — la plomberie, avec une fausse détection.**

L'application tourne de bout en bout : la caméra s'ouvre, les images partent au serveur,
les détections reviennent et sont dessinées en direct. Mais **la détection est inventée** :
le serveur ne charge aucun modèle et ne regarde même pas l'image. Le but de ce jalon est
de mesurer ce que coûte l'aller-retour, avant d'avoir un modèle.

| Onglet | État |
|---|---|
| **Camera** | vivant — webcam, trajectoire dessinée, métriques de performance |
| **Replay** | coquille — structure posée, rien de branché (jalon 3) |
| **Training** | coquille — réglages affichés mais désactivés (jalon 4) |

Jalon 2 : remplacer `backend/detection/fake.py` par un vrai YOLO pré-entraîné, et voir ce
que le décodage de l'image et l'inférence ajoutent à la latence mesurée ici.

## Lancer le projet

Deux terminaux.

```bash
# terminal 1 — le serveur
cd backend
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

> **Python 3.12**, pas plus récent : `pydantic-core` n'a pas encore de wheel pour 3.14
> (il tente de compiler du Rust), et au jalon 2 Ultralytics/PyTorch seront aussi plus
> sûrs en 3.12.

```bash
# terminal 2 — le front
cd frontend
npm install
npm run dev
```

Puis `http://localhost:5173`, onglet **Camera**, bouton « Démarrer la caméra ».

## Comment c'est branché

```
caméra → <video> → canvas caché (réduit à 640px) → JPEG base64
      → WebSocket ws://localhost:8000/ws/detect
      → fake.detect()  ← le seul endroit à remplacer au jalon 2
      → DetectResponse → canvas superposé (balle + trajectoire)
```

Le format des données est défini **deux fois, en miroir** :
`backend/schemas.py` et `frontend/src/lib/types.ts`. Si tu changes l'un, change l'autre.

Quelques réglages, dans `frontend/src/lib/useBallTracking.ts` :

- `CAPTURE_WIDTH` (640) — largeur d'envoi
- `TARGET_FPS` (15) — cadence visée ; le budget par image est de 1000/TARGET_FPS ms
- une image n'est envoyée que si la réponse de la précédente est revenue, pour ne pas
  accumuler de retard et fausser la latence mesurée

Et dans `backend/detection/fake.py` :

- `MISS_RATE` (0.1) — une image sur dix sans balle, exprès, pour que le front gère les
  trous dès maintenant (ce sera le vrai problème du suivi : interpolation, Kalman)

## Données

Rien de versionné : `data/`, `models/` et `outputs/` sont dans le `.gitignore`
(droit à l'image, poids des fichiers). Il n'y a pas encore de vidéo de test.

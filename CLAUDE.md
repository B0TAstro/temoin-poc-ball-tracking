temoin-poc-ball-tracking

POC d'exploration pour la détection et le suivi de la balle de tennis. Il fait partie du projet Témoin, une application qui aide les joueurs de tennis amateurs à régler eux-mêmes un point litigieux grâce à un replay partagé, sans arbitre.

Ce repo sert à tester des choses : des modèles, des réglages, des façons de repérer la balle et les lignes. Il n'y a pas de livrable figé, on essaie, on regarde, on garde ce qui marche.

Contexte du projet
Projet individuel de Master 1 Informatique (Gobelins Annecy, ECNI 2026-2027), développé seul.
Problématique : permettre à des compétiteurs amateurs de tennis, sans arbitre, de régler eux-mêmes un point litigieux, sans le rejouer ni céder au plus insistant, à partir des seuls téléphones présents sur le court, grâce à une preuve rapide et visible des deux camps.
La piste retenue est le point témoin : le téléphone filme le point en cours et garde le point précédent. Sur appui du bouton « VAR », le point entier est rejoué au ralenti, visible des deux joueurs, qui décident ensemble. L'application ne tranche jamais à leur place.
Repos liés :
temoin-poc-replay : enregistrement point par point, replay et score co-validé
temoin-poc-voice-score : mise à jour du score par reconnaissance vocale (modèle local)
temoin-poc-ball-tracking : ce repo
Vision à terme (dans l'application)

Quand le joueur appuie sur VAR sur le point en cours :

la timeline du replay est pré-surlignée là où se trouve la faute ou la fin du point,
la balle est suivie et la ligne du court surlignée sur le replay, qui peut être recadré sur le moment de la faute,
une indication de confiance est affichée, par exemple « 50 % sûr que le point est pour Mathéo ». C'est une aide à la lecture, jamais un verdict imposé.

Ce POC explore les briques qui rendront ça possible.

Les trois onglets

L'outil est une application web avec trois onglets.

1. App : le suivi en direct
Ouvre la caméra (webcam ou téléphone connecté au navigateur).
Repère et suit la balle en direct, avec sa trajectoire dessinée sur l'image.
Affiche les performances : images par seconde traitées, temps d'inférence, confiance des détections.
Sert à voir ce qu'on peut espérer en temps réel, et à quel coût.
2. Replay : l'analyse d'une vidéo
Charge une vidéo d'un point de tennis.
Affiche une timeline avec les moments repérés : frappes, rebonds, fin du point, faute probable.
Rejoue la vidéo au ralenti, image par image, avec la balle suivie et sa trajectoire.
Surligne les lignes du court détectées, comme les boîtes et masques de YOLO.
Plus tard : dedans ou dehors au rebond, indice de confiance, recadrage automatique sur le moment de la faute.
3. Training : l'entraînement des modèles
Charge un jeu de données (export Roboflow au format YOLO, ou annotations maison).
Lance un fine-tuning avec les réglages principaux : modèle de départ, nombre d'époques, taille d'image.
Affiche les courbes et métriques d'entraînement (pertes, précision, rappel, mAP).
Compare plusieurs modèles entraînés sur les mêmes vidéos de test.
Exporte un modèle vers les formats mobiles (ONNX, Core ML, TensorFlow Lite).
Architecture envisagée
Front : une application Vite + Tailwind (React ou TypeScript simple, à choisir ensemble) avec les trois onglets. Elle gère la caméra, la lecture vidéo, la timeline et les surlignages dessinés dans un canvas.
Back : un serveur Python (FastAPI) qui fait tourner les modèles et l'entraînement, parce que les outils de vision et d'entraînement (Ultralytics, TrackNet, OpenCV) sont en Python.
Onglet App : les images de la caméra sont envoyées au serveur par WebSocket, en résolution réduite, et les détections reviennent en direct.
Onglet Replay : la vidéo est envoyée au serveur, qui renvoie la timeline et le suivi de la balle en JSON.
Onglet Training : le serveur lance l'entraînement en tâche de fond et renvoie l'avancement.
À tester aussi : exporter le modèle en ONNX et le faire tourner directement dans le navigateur avec ONNX Runtime Web, sans passer par le serveur. C'est la piste la plus proche de ce qui tournera en local sur le téléphone, surtout pour l'onglet App.

Ces choix sont un point de départ, pas une règle : si une autre organisation est plus simple, on en discute.

Pistes techniques à explorer
Piste	Ce qu'on veut savoir
YOLO (Ultralytics) pré-entraîné	Ce qu'il voit d'une balle de tennis sans rien faire (la classe « sports ball »)
YOLO ré-entraîné sur des balles de tennis (Roboflow)	Combien ça améliore la détection, avec combien d'images
TrackNet	S'il suit mieux une balle petite et floue, en s'appuyant sur plusieurs images à la fois
Suivi et lissage (interpolation, filtre de Kalman)	Comment combler les images où la balle n'est pas vue
Repérage des rebonds à partir de la trajectoire	Si un changement de direction verticale suffit à trouver le rebond
Lignes du court (OpenCV classique ou modèle de points clés)	Quelle méthode repère les lignes de façon fiable selon l'angle et la lumière
Homographie	Projeter le rebond sur le plan du court pour savoir s'il est dedans ou dehors
Résolution et images par seconde	Le minimum pour voir le rebond, et le coût en performance
Export mobile	Ce que donne le modèle une fois exporté en Core ML ou TensorFlow Lite
Format de la timeline
json
{
  "video": "data/videos/point_01.mp4",
  "fps": 60,
  "duration_s": 18.4,
  "ball_track": [
    { "frame": 0, "t": 0.0, "x": 812, "y": 403, "conf": 0.71, "interpolated": false }
  ],
  "court_lines": [
    { "name": "baseline_far", "points": [[210, 180], [1070, 182]] }
  ],
  "events": [
    { "type": "hit", "frame": 120, "t": 2.0, "conf": 0.58 },
    { "type": "bounce", "frame": 512, "t": 8.53, "x": 640, "y": 690, "conf": 0.64 },
    { "type": "point_end", "frame": 1011, "t": 16.85, "conf": 0.80 }
  ]
}

Les coordonnées sont en pixels de l'image d'origine. conf est entre 0 et 1. Le format peut évoluer au fil des tests.

pur crer l'app fait pas tout les fichiers à la mano, tu peux utiliser le script `create_app.py` pour générer la structure de base de l'application front-end et back-end et `npm create vite@latest`. Il crée les dossiers et fichiers nécessaires pour démarrer rapidement le développement.

Structure du repo
temoin-poc-ball-tracking/
├── CLAUDE.md
├── README.md
├── backend/
│   ├── requirements.txt
│   ├── main.py            # serveur FastAPI
│   ├── detection/         # détection et suivi de la balle
│   ├── court/             # repérage des lignes du court
│   ├── events/            # frappes, rebonds, fin du point
│   └── training/          # fine-tuning et export des modèles
├── frontend/              # Vite + Tailwind
│   ├── index.html
│   ├── package.json
│   └── src/
│       ├── tabs/          # App, Replay, Training
│       ├── components/    # lecteur vidéo, timeline, canvas de surlignage
│       └── lib/           # appels au back, ONNX Runtime Web
├── data/
│   ├── videos/            # vidéos de test (non versionnées)
│   └── datasets/          # jeux de données (non versionnés)
├── models/                # poids entraînés (non versionnés)
└── outputs/               # résultats générés (non versionnés)
Lancer le projet
bash
# back
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload

# front, dans un autre terminal
cd frontend
npm install
npm run dev
Données
Vidéos de test : filmées au téléphone au bord d'un court, de préférence à 60 images par seconde et avec le téléphone fixe.
Jeux de données : jeux publics de balles de tennis et de courts sur Roboflow Universe, complétés par des images annotées depuis mes propres vidéos.
Ne jamais versionner les vidéos, les jeux de données ni les poids (droit à l'image, poids des fichiers) : data/, models/ et outputs/ sont dans le .gitignore.
Comment travailler avec moi
Je connais la théorie des réseaux de neurones dans les grandes lignes, mais je débute en pratique : explique ce qu'on fait et pourquoi, avant d'écrire le code.
Réponds en français.
Avance par petites étapes, avec du code que je peux lancer et vérifier à chaque fois.
Commente le code en français, simplement.
Propose plusieurs approches quand il y en a, avec leurs avantages et leurs limites, puis on choisit ensemble.
Demande avant d'ajouter une dépendance lourde ou de changer de modèle.
Quand un résultat est mauvais, aide-moi à comprendre pourquoi (données, résolution, réglages) avant de changer de méthode.
Garde en tête la cible finale : un modèle qui tourne en local sur un téléphone, sur le clip d'un point de 15 à 25 secondes.
Questions ouvertes
YOLO suffit-il pour une balle de tennis filmée au téléphone, ou faut-il passer à TrackNet ?
Le suivi en direct est-il réaliste sur un téléphone, ou faut-il s'en tenir à l'analyse du replay ?
Quelle résolution et combien d'images par seconde faut-il pour repérer un rebond ?
Où placer le téléphone pour bien voir les lignes et la balle : derrière la ligne de fond, ou sur le côté ?
Comment repérer la fin du point de façon fiable, et comment la relier à l'annonce du score du POC vocal ?
Glossaire
Image (frame) : une photo de la vidéo ; une vidéo à 60 images par seconde en contient 60 par seconde.
Boîte (bounding box) : le rectangle que le modèle dessine autour d'un objet détecté.
Confiance : le score entre 0 et 1 que le modèle donne à sa détection.
Fine-tuning : ré-entraîner un modèle existant sur ses propres données pour qu'il reconnaisse mieux un objet précis.
Époque : un passage complet sur toutes les images du jeu de données pendant l'entraînement.
mAP : la mesure principale de qualité d'un détecteur, entre 0 et 1, plus elle est haute mieux c'est.
Inférence : faire tourner un modèle entraîné sur de nouvelles images.
Interpolation : estimer la position de la balle sur les images où elle n'a pas été vue, à partir des images voisines.
Homographie : la transformation qui fait passer un point de l'image au plan réel du court, pour savoir où la balle a touché le sol.
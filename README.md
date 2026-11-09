# Log Pose

## Démarrage (front + serveur relais)

Le projet a deux parties : le front Vite et un petit serveur relais (`server/`) qui cache la clé API Anthropic.

1. **Clé API** : copie `.env.example` en `.env` et colle ta clé après `ANTHROPIC_API_KEY=` (le `.env` n'est pas commité).
2. **Serveur relais** : `npm run server` (démarre sur http://localhost:3001 ; tourne même sans clé, mais renvoie une erreur claire tant qu'elle manque).
3. **Front** : `npm run dev` dans un autre terminal (http://localhost:5173). Il tape sur le serveur via `VITE_API_URL` (défaut `http://localhost:3001`).
4. **Courrier** (optionnel) : l'onglet « Courrier » affiche les mails importants de tes boîtes Gmail, triés en local par Ollama (qui doit être lancé). Renseigne `GMAIL_COMPTES` dans `.env` (voir `.env.example`). L'onglet « Récap » prépare un récap chaque matin et chaque soir (heures réglables en haut de `server/recaps.js`) : le serveur relais doit tourner.
5. **Second cerveau** (page « Going Merry ») : dépose n'importe quel fichier (bouton, glisser-déposer ou Ctrl+V), remplis la petite fiche, puis retrouve-le en le demandant. Les fichiers restent sur ta machine dans `server/cerveau/` (non commité). Ollama lit chaque fichier en arrière-plan (texte des PDF, description des images) pour qu'on le retrouve aussi par son contenu ; sans carte graphique, compte quelques minutes par image.
6. **Réseaux** (optionnel) : l'onglet « Réseaux » envoie une vidéo déposée sur les comptes reliés, et rassemble les stats du compte et de chaque vidéo. Pour l'instant : TikTok (en brouillon : une notification dans l'appli permet de publier) et Instagram (Reel publié tout de suite : il faut un compte professionnel, et Tailscale Funnel pour qu'Instagram vienne chercher la vidéo). Les étapes s'affichent dans l'onglet, et les variables sont décrites dans `.env.example`. Pour ajouter une plateforme (Instagram, YouTube…), voir `server/reseaux/index.js`.

**Appli de bureau (usage au quotidien)** : `npm run appli:installeur` fabrique `release/Log Pose Setup 0.0.0.exe` ; une fois installée, l'appli (icônes bureau + menu Démarrer) lance elle-même le serveur sur le port 3001 depuis ce dossier (avec son `.env` et ses données) et l'arrête quand on fait « Quitter » (clic droit sur la boussole près de l'horloge ; la croix ne fait que réduire). Après une modification du site : `npm run appli`, puis rouvre l'appli (Quitter → relancer). L'installeur n'est à refaire que si `electron/` change ou si le dossier du projet est déplacé. Le code est dans `electron/main.cjs`, le journal du serveur dans `%APPDATA%\log-pose\serveur.log`.

**Version rapide dans le navigateur** : `npm start` compile le site puis lance le serveur relais, qui sert aussi le site sur http://localhost:3001 (ou l'adresse Tailscale du PC, port 3001, depuis le téléphone). Bien plus rapide à ouvrir que `npm run dev`, qui reste pour développer. Après une modification du code, relance `npm start`.

---

## React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

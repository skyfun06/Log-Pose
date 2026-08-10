# Log Pose

## Démarrage (front + serveur relais)

Le projet a deux parties : le front Vite et un petit serveur relais (`server/`) qui cache la clé API Anthropic.

1. **Clé API** : copie `.env.example` en `.env` et colle ta clé après `ANTHROPIC_API_KEY=` (le `.env` n'est pas commité).
2. **Serveur relais** : `npm run server` (démarre sur http://localhost:3001 ; tourne même sans clé, mais renvoie une erreur claire tant qu'elle manque).
3. **Front** : `npm run dev` dans un autre terminal (http://localhost:5173). Il tape sur le serveur via `VITE_API_URL` (défaut `http://localhost:3001`).

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

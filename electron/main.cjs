// Appli de bureau Log Pose (Electron).
// Elle démarre le serveur relais (server/index.js) depuis le dossier du projet,
// avec le .env de ce dossier, puis l'affiche dans sa propre fenêtre. Le site
// et les données restent donc exactement où ils sont : rien n'est copié.
//
// - Une seule fenêtre : relancer l'appli remet au premier plan celle ouverte.
// - La croix réduit l'appli près de l'horloge ; « Quitter » arrête tout.
// - Les liens externes s'ouvrent dans le navigateur habituel.

const { app, BrowserWindow, Menu, Tray, dialog, nativeImage, screen, shell } = require('electron');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');

// --- Dossier du projet ------------------------------------------------------
// Lancée avec « electron . », l'appli est dans le projet. Installée, elle lit
// le chemin noté par electron/preparer.cjs au moment de fabriquer l'installeur.
function dossierProjet() {
  if (!app.isPackaged) return path.join(__dirname, '..');
  return JSON.parse(fs.readFileSync(path.join(__dirname, 'projet.json'), 'utf8')).dossier;
}
const PROJET = dossierProjet();

// Même port que « npm run server » : PORT du .env s'il y est, sinon 3001.
// Tailscale (et donc TikTok, le téléphone) pointe sur ce port.
function lirePort() {
  try {
    const ligne = fs
      .readFileSync(path.join(PROJET, '.env'), 'utf8')
      .split(/\r?\n/)
      .find((l) => /^\s*PORT\s*=/.test(l));
    const port = Number(ligne?.split('=')[1].trim().replace(/^["']|["']$/g, ''));
    if (Number.isInteger(port) && port > 0) return port;
  } catch {
    /* pas de .env : port par défaut */
  }
  return 3001;
}
const PORT = lirePort();
const ADRESSE = `http://localhost:${PORT}`;

const ICONE = path.join(__dirname, 'icones', 'logpose.ico');
const REGLAGES = path.join(app.getPath('userData'), 'reglages.json');
const JOURNAL = path.join(app.getPath('userData'), 'serveur.log');

let fenetre = null;
let tray = null;
let serveur = null;
let enTrainDeQuitter = false;
let serveurPret = false; // avant ça, les erreurs passent par attendreServeur()

// --- Réglages (taille et position de la fenêtre…) ---------------------------
function lireReglages() {
  try {
    return JSON.parse(fs.readFileSync(REGLAGES, 'utf8'));
  } catch {
    return {};
  }
}
function ecrireReglages(modifs) {
  try {
    fs.writeFileSync(REGLAGES, JSON.stringify({ ...lireReglages(), ...modifs }, null, 2));
  } catch {
    /* tant pis : la fenêtre reprendra sa taille par défaut */
  }
}

// --- Une seule instance -----------------------------------------------------
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', montrerFenetre);
  app.whenReady().then(demarrer);
}

// Les erreurs survenues avant la fenêtre s'affichent dans une boîte, puis on quitte.
function erreurFatale(titre, texte) {
  dialog.showMessageBoxSync({ type: 'error', title: 'Log Pose', message: titre, detail: texte });
  quitter();
}

async function demarrer() {
  Menu.setApplicationMenu(null);
  creerTray();

  if (!fs.existsSync(path.join(PROJET, 'server', 'index.js'))) {
    return erreurFatale(
      'Dossier Log Pose introuvable',
      `L'appli cherche le projet dans :\n${PROJET}\n\nS'il a été déplacé, refais l'installeur depuis le nouveau dossier (npm run appli:installeur).`,
    );
  }

  if (!(await portLibre(PORT))) {
    const dejaLogPose = await repondComme(PORT);
    return erreurFatale(
      `Le port ${PORT} est déjà utilisé`,
      dejaLogPose
        ? `Log Pose tourne déjà ailleurs (sans doute « npm run server » ou « npm start » dans un terminal).\n\nFerme ce terminal (ou fais Ctrl+C dedans), puis relance l'appli.`
        : `Un autre programme utilise le port ${PORT}, dont Log Pose a besoin (Tailscale et TikTok pointent dessus).\n\nFerme ce programme, puis relance l'appli.`,
    );
  }

  creerFenetre();
  lancerServeur();
  try {
    await attendreServeur();
  } catch (err) {
    return erreurFatale("Log Pose n'a pas pu démarrer", err.message);
  }
  serveurPret = true;
  if (fenetre) fenetre.loadURL(ADRESSE);
}

// --- Serveur relais ---------------------------------------------------------
function portLibre(port) {
  return new Promise((resolve) => {
    const essai = net.createServer();
    essai.once('error', () => resolve(false));
    essai.once('listening', () => essai.close(() => resolve(true)));
    essai.listen(port); // comme le serveur : toutes les adresses
  });
}

// Le port est pris : est-ce un Log Pose déjà lancé ?
function repondComme(port) {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/api/health', timeout: 1500 }, (res) => {
      let corps = '';
      res.on('data', (d) => (corps += d));
      res.on('end', () => {
        try {
          const sante = JSON.parse(corps);
          resolve(sante.ok === true && 'hasKey' in sante);
        } catch {
          resolve(false);
        }
      });
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => req.destroy());
  });
}

let dernieresLignes = '';
function lancerServeur() {
  const journal = fs.createWriteStream(JOURNAL, { flags: 'w' });
  // Même commande que « npm run server », avec le Node installé sur le PC.
  serveur = spawn('node', ['--env-file-if-exists=.env', 'server/index.js'], {
    cwd: PROJET,
    env: { ...process.env, PORT: String(PORT) },
    windowsHide: true,
  });
  const noter = (morceau) => {
    journal.write(morceau);
    dernieresLignes = (dernieresLignes + morceau).slice(-1500);
  };
  serveur.stdout.on('data', noter);
  serveur.stderr.on('data', noter);
  serveur.on('error', (err) => {
    serveur = null;
    const texte =
      err.code === 'ENOENT'
        ? "Node.js est introuvable sur ce PC. Installe-le depuis https://nodejs.org puis relance l'appli."
        : err.message;
    if (!enTrainDeQuitter) erreurFatale("Log Pose n'a pas pu démarrer", texte);
  });
  serveur.on('exit', (code) => {
    serveur = null;
    journal.end();
    if (enTrainDeQuitter || !serveurPret) return;
    const choix = dialog.showMessageBoxSync({
      type: 'error',
      title: 'Log Pose',
      message: "Le serveur Log Pose s'est arrêté",
      detail: `Code ${code}. Dernières lignes :\n\n${dernieresLignes.trim().slice(-800)}`,
      buttons: ['Relancer', 'Quitter'],
      defaultId: 0,
    });
    if (choix === 0) {
      app.relaunch();
    }
    quitter();
  });
}

// Attend que le serveur réponde (le cerveau, les relevés… se chargent vite).
async function attendreServeur() {
  const limite = Date.now() + 45_000;
  while (Date.now() < limite) {
    if (!serveur) throw new Error(dernieresLignes.trim() || 'Le serveur a quitté sans message.');
    if (await repondComme(PORT)) return;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Le serveur ne répond pas après 45 secondes.\nJournal : ${JOURNAL}`);
}

// Sous Windows, on arrête aussi ce que le serveur a lancé (missions du QG :
// Claude Code et ses scripts), sinon ils continueraient en arrière-plan.
function arreterServeur() {
  if (!serveur || serveur.exitCode !== null) return;
  if (process.platform === 'win32') {
    try {
      require('node:child_process').execFileSync('taskkill', ['/pid', String(serveur.pid), '/T', '/F'], {
        windowsHide: true,
        stdio: 'ignore',
      });
      return;
    } catch {
      /* déjà arrêté, ou taskkill indisponible : arrêt simple ci-dessous */
    }
  }
  serveur.kill();
}

function quitter() {
  enTrainDeQuitter = true;
  arreterServeur();
  app.quit();
}

app.on('before-quit', () => {
  enTrainDeQuitter = true;
  arreterServeur();
});
// Extinction ou déconnexion de Windows : ne pas la bloquer avec la croix.
app.on('session-end', () => {
  enTrainDeQuitter = true;
  arreterServeur();
});
// Fenêtre cachée près de l'horloge : l'appli continue de tourner.
app.on('window-all-closed', () => {});

// --- Fenêtre ----------------------------------------------------------------
const PAGE_ATTENTE =
  'data:text/html;charset=utf-8,' +
  encodeURIComponent(
    `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#1c130b;color:#f3e6c8;font-family:system-ui;display:grid;place-items:center;height:100vh">` +
      `<div style="text-align:center"><div style="font-size:48px">🧭</div><p>Le Log Pose s'oriente…</p></div>`,
  );

// Position gardée seulement si elle tombe encore sur un écran branché.
function positionValide(b) {
  if (!b || typeof b.x !== 'number') return false;
  const ecran = screen.getDisplayMatching(b).workArea;
  return b.x < ecran.x + ecran.width - 50 && b.x + b.width > ecran.x + 50 && b.y >= ecran.y - 10 && b.y < ecran.y + ecran.height - 50;
}

function creerFenetre() {
  const { fenetre: memo } = lireReglages();
  const bords = positionValide(memo?.bords) ? memo.bords : { width: 1280, height: 860 };
  fenetre = new BrowserWindow({
    ...bords,
    minWidth: 380,
    minHeight: 500,
    title: 'Log Pose',
    icon: ICONE,
    backgroundColor: '#1c130b',
    show: false,
    autoHideMenuBar: true,
    webPreferences: { spellcheck: false },
  });
  if (memo?.agrandie) fenetre.maximize();
  fenetre.once('ready-to-show', () => fenetre.show());
  fenetre.loadURL(PAGE_ATTENTE);

  // Garde la taille et la position (hors plein écran), avec un petit délai.
  let minuteur;
  const memoriser = () => {
    clearTimeout(minuteur);
    minuteur = setTimeout(() => {
      if (!fenetre || fenetre.isMinimized()) return;
      ecrireReglages({ fenetre: { bords: fenetre.getNormalBounds(), agrandie: fenetre.isMaximized() } });
    }, 400);
  };
  fenetre.on('resize', memoriser);
  fenetre.on('move', memoriser);
  fenetre.on('maximize', memoriser);
  fenetre.on('unmaximize', memoriser);

  // La croix réduit près de l'horloge au lieu de quitter.
  fenetre.on('close', (e) => {
    if (enTrainDeQuitter) return;
    e.preventDefault();
    fenetre.hide();
    if (!lireReglages().bulleVue) {
      tray?.displayBalloon({
        iconType: 'info',
        title: 'Log Pose continue en arrière-plan',
        content: "Retrouve-le près de l'horloge. Clic droit sur la boussole → Quitter pour tout arrêter.",
      });
      ecrireReglages({ bulleVue: true });
    }
  });
  fenetre.on('closed', () => (fenetre = null));

  // F5 / Ctrl+R : recharger (pas de barre d'adresse pour le faire).
  fenetre.webContents.on('before-input-event', (e, touche) => {
    if (touche.type !== 'keyDown') return;
    if (touche.key === 'F5' || (touche.control && touche.key.toLowerCase() === 'r')) {
      e.preventDefault();
      fenetre.webContents.reload();
    }
  });

  gererLiens(fenetre.webContents);
}

function montrerFenetre() {
  if (!fenetre) return;
  if (fenetre.isMinimized()) fenetre.restore();
  fenetre.show();
  fenetre.focus();
}

// --- Liens externes → navigateur habituel ----------------------------------
const estInterne = (url) => url.startsWith(ADRESSE + '/') || url === ADRESSE || url.startsWith('data:');

function ouvrirDehors(url) {
  if (/^(https?|mailto):/i.test(url)) shell.openExternal(url);
}

function gererLiens(contenu) {
  contenu.setWindowOpenHandler(({ url }) => {
    // L'onglet Réseaux ouvre d'abord une page vide, puis l'envoie vers TikTok
    // une fois le lien prêt : on la laisse naître (cachée) et on récupère
    // l'adresse au moment où elle part.
    if (!url || url === 'about:blank') {
      return { action: 'allow', overrideBrowserWindowOptions: { show: false } };
    }
    ouvrirDehors(url); // y compris les fichiers du cerveau : le navigateur sait les afficher
    return { action: 'deny' };
  });
  contenu.on('did-create-window', (enfant) => {
    const partir = (e, url) => {
      if (url === 'about:blank') return;
      e.preventDefault();
      ouvrirDehors(url);
      enfant.destroy();
    };
    enfant.webContents.on('will-navigate', partir);
    enfant.webContents.on('will-redirect', partir);
    // Page vide jamais utilisée (erreur côté Log Pose) : on la ferme.
    setTimeout(() => !enfant.isDestroyed() && enfant.destroy(), 30_000);
  });
  contenu.on('will-navigate', (e, url) => {
    if (estInterne(url)) return;
    e.preventDefault();
    ouvrirDehors(url);
  });
}

// --- Icône près de l'horloge ------------------------------------------------
function lancementAuDemarrage() {
  return app.getLoginItemSettings(argsDemarrage()).openAtLogin;
}
function argsDemarrage() {
  // Sans installeur (« electron . »), il faut redonner le dossier de l'appli.
  return app.isPackaged ? {} : { path: process.execPath, args: [path.join(__dirname, '..')] };
}

function menuTray() {
  return Menu.buildFromTemplate([
    { label: 'Ouvrir Log Pose', click: montrerFenetre },
    { type: 'separator' },
    {
      label: 'Lancer au démarrage du PC',
      type: 'checkbox',
      checked: lancementAuDemarrage(),
      click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked, ...argsDemarrage() }),
    },
    { type: 'separator' },
    { label: 'Quitter', click: quitter },
  ]);
}

function creerTray() {
  tray = new Tray(nativeImage.createFromPath(ICONE));
  tray.setToolTip('Log Pose');
  tray.on('click', montrerFenetre);
  // Menu refait à chaque ouverture : la case reflète le vrai réglage Windows.
  tray.on('right-click', () => tray.popUpContextMenu(menuTray()));
}

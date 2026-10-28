// Composants chargés à la demande : leur code ne pèse pas sur l'ouverture du
// site. precharger() le récupère à l'avance (au repos, ou juste avant
// d'afficher la page) ; une fois chargé, le composant s'affiche directement,
// sans passer par Suspense, ce qui garde les transitions de page fluides.

import { lazy, Suspense, type ComponentType } from 'react';

export function paresseux<P extends object>(charger: () => Promise<ComponentType<P>>) {
  let Charge: ComponentType<P> | null = null;
  let promesse: Promise<void> | null = null;
  const precharger = () =>
    (promesse ??= charger().then(
      (c) => {
        Charge = c;
      },
      (err: unknown) => {
        // Échec (réseau coupé…) : on retentera à la prochaine demande.
        promesse = null;
        throw err;
      },
    ));
  const Attente = lazy(async () => {
    await precharger();
    return { default: Charge! };
  });

  function Paresseux(props: P) {
    const C = Charge;
    if (C) return <C {...props} />;
    return (
      <Suspense fallback={null}>
        <Attente {...props} />
      </Suspense>
    );
  }
  return Object.assign(Paresseux, { precharger });
}

// Précharge les composants quand le navigateur n'a rien d'autre à faire.
export function prechargerAuRepos(composants: { precharger: () => Promise<void> }[]) {
  const auRepos =
    window.requestIdleCallback ?? ((f: () => void) => window.setTimeout(f, 1500));
  auRepos(() => {
    for (const c of composants) void c.precharger().catch(() => {});
  });
}

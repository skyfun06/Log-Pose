import type { ReactNode } from 'react';

// Affiche du Markdown simple (réponses de l'équipage) : titres, listes,
// citations, tableaux, code, gras, italique, liens. Tout est construit en
// éléments React, jamais en HTML brut : un texte ne peut rien injecter.

function enLigne(texte: string, cle = 'l'): ReactNode[] {
  const morceaux: ReactNode[] = [];
  // `code` · **gras** · *italique* / _italique_ · [texte](lien) · lien nu
  const motif = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\s][^*]*\*|_[^_\s][^_]*_)|(\[[^\]]+\]\([^)\s]+\))|(https?:\/\/[^\s)]+)/g;
  let dernier = 0;
  let n = 0;
  for (const m of texte.matchAll(motif)) {
    if (m.index > dernier) morceaux.push(texte.slice(dernier, m.index));
    const k = `${cle}-${n++}`;
    const brut = m[0];
    if (m[1]) morceaux.push(<code key={k}>{brut.slice(1, -1)}</code>);
    else if (m[2]) morceaux.push(<strong key={k}>{enLigne(brut.slice(2, -2), k)}</strong>);
    else if (m[3]) morceaux.push(<em key={k}>{enLigne(brut.slice(1, -1), k)}</em>);
    else {
      const [, libelle, url] = m[4] ? (brut.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/) ?? []) : [null, brut, brut];
      const sur = /^https?:\/\//.test(url ?? '');
      morceaux.push(
        sur ? (
          <a key={k} href={url} target="_blank" rel="noreferrer noopener">
            {libelle}
          </a>
        ) : (
          libelle
        ),
      );
    }
    dernier = m.index + brut.length;
  }
  if (dernier < texte.length) morceaux.push(texte.slice(dernier));
  return morceaux;
}

const cellules = (ligne: string) =>
  ligne
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((c) => c.trim());

export function Markdown({ texte, className }: { texte: string; className?: string }) {
  const lignes = texte.replace(/\r\n/g, '\n').split('\n');
  const blocs: ReactNode[] = [];
  let i = 0;
  while (i < lignes.length) {
    const ligne = lignes[i];
    const k = `b${i}`;
    if (!ligne.trim()) {
      i++;
    } else if (ligne.startsWith('```')) {
      const code: string[] = [];
      for (i++; i < lignes.length && !lignes[i].startsWith('```'); i++) code.push(lignes[i]);
      i++;
      blocs.push(
        <pre key={k}>
          <code>{code.join('\n')}</code>
        </pre>,
      );
    } else if (/^#{1,6}\s/.test(ligne)) {
      const niveau = Math.min(ligne.match(/^#+/)![0].length + 2, 6);
      const Titre = `h${niveau}` as 'h3';
      blocs.push(<Titre key={k}>{enLigne(ligne.replace(/^#+\s*/, ''), k)}</Titre>);
      i++;
    } else if (/^(-{3,}|\*{3,})\s*$/.test(ligne)) {
      blocs.push(<hr key={k} />);
      i++;
    } else if (ligne.startsWith('>')) {
      const cite: string[] = [];
      for (; i < lignes.length && lignes[i].startsWith('>'); i++) cite.push(lignes[i].replace(/^>\s?/, ''));
      blocs.push(
        <blockquote key={k}>
          <Markdown texte={cite.join('\n')} />
        </blockquote>,
      );
    } else if (ligne.trim().startsWith('|') && /^\s*\|?\s*:?-{2,}/.test(lignes[i + 1] ?? '')) {
      const entete = cellules(ligne);
      const rangs: string[][] = [];
      for (i += 2; i < lignes.length && lignes[i].trim().startsWith('|'); i++) rangs.push(cellules(lignes[i]));
      blocs.push(
        <div key={k} className="md-tableau">
          <table>
            <thead>
              <tr>
                {entete.map((c, j) => (
                  <th key={j}>{enLigne(c, `${k}h${j}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rangs.map((r, x) => (
                <tr key={x}>
                  {r.map((c, j) => (
                    <td key={j}>{enLigne(c, `${k}${x}-${j}`)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
    } else if (/^\s*([-*+]|\d+[.)])\s/.test(ligne)) {
      const ordonnee = /^\s*\d/.test(ligne);
      const items: string[] = [];
      for (; i < lignes.length && /^\s*([-*+]|\d+[.)])\s/.test(lignes[i]); i++) {
        items.push(lignes[i].replace(/^\s*([-*+]|\d+[.)])\s+/, ''));
        // Lignes de suite indentées : rattachées à l'élément.
        while (i + 1 < lignes.length && /^\s{2,}\S/.test(lignes[i + 1]) && !/^\s*([-*+]|\d+[.)])\s/.test(lignes[i + 1])) {
          items[items.length - 1] += ` ${lignes[++i].trim()}`;
        }
      }
      const Liste = ordonnee ? 'ol' : 'ul';
      blocs.push(
        <Liste key={k}>
          {items.map((it, j) => (
            <li key={j}>{enLigne(it, `${k}-${j}`)}</li>
          ))}
        </Liste>,
      );
    } else {
      const para: string[] = [];
      for (
        ;
        i < lignes.length &&
        lignes[i].trim() &&
        !/^(#{1,6}\s|```|>|\s*([-*+]|\d+[.)])\s|\s*\|)/.test(lignes[i]);
        i++
      ) {
        para.push(lignes[i]);
      }
      if (para.length === 0) {
        para.push(lignes[i]);
        i++;
      }
      blocs.push(
        <p key={k}>
          {para.flatMap((l, j) => (j ? [<br key={`br${j}`} />, ...enLigne(l, `${k}-${j}`)] : enLigne(l, `${k}-${j}`)))}
        </p>,
      );
    }
  }
  return <div className={className}>{blocs}</div>;
}

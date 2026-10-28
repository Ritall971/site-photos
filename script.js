const $ = (id) => document.getElementById(id);

// --- Animations : apparition des blocs au défilement ---
const mouvementReduit = matchMedia("(prefers-reduced-motion: reduce)").matches;
const racine = document.documentElement;
const observateur = "IntersectionObserver" in window && !mouvementReduit
  ? new IntersectionObserver((entrees) => entrees.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add("visible");
      observateur.unobserve(e.target);
    }), { rootMargin: "0px 0px -8% 0px", threshold: 0.08 })
  : null;
if (observateur) racine.classList.add("anim");

function reveler(el, delai = 0) {
  el.setAttribute("data-reveal", "");
  el.style.setProperty("--delai", `${+delai.toFixed(2)}s`);
  if (observateur) observateur.observe(el);
  else el.classList.add("visible");
}

// Relance l'animation CSS d'un élément (texte qui change, image suivante...)
function rejouer(el, classe = "rejoue") {
  el.classList.remove(classe);
  void el.offsetWidth;
  el.classList.add(classe);
}

// --- Textes ---
document.title = `${CONFIG.nom} — ${CONFIG.metier}`;
$("logo").textContent = CONFIG.nom;
$("nom").textContent = CONFIG.nom;
$("metier").textContent = CONFIG.metier;
$("accroche").textContent = CONFIG.accroche;
$("apropos").textContent = CONFIG.apropos;
$("note-dispo").textContent = CONFIG.noteDispo;
$("footer").textContent = `© ${new Date().getFullYear()} ${CONFIG.nom} — Tous droits réservés`;
if (CONFIG.photos.length) $("hero-bg").style.backgroundImage = `url("${CONFIG.photos[0].src}")`;

// --- Galerie ---
let visibles = CONFIG.photos;
const categories = ["Tout", ...new Set(CONFIG.photos.map((p) => p.categorie))];

function afficherGalerie(cat) {
  visibles = cat === "Tout" ? CONFIG.photos : CONFIG.photos.filter((p) => p.categorie === cat);
  $("grille").innerHTML = "";
  visibles.forEach((p, i) => {
    const fig = document.createElement("figure");
    fig.innerHTML = `<img loading="lazy" alt=""><figcaption></figcaption>`;
    fig.querySelector("img").src = p.src;
    fig.querySelector("img").alt = p.titre;
    fig.querySelector("figcaption").textContent = p.titre;
    fig.onclick = () => ouvrir(i);
    $("grille").appendChild(fig);
    reveler(fig, Math.min(i * 0.07, 0.42));
  });
  document.querySelectorAll(".filtres button").forEach((b) => b.classList.toggle("actif", b.textContent === cat));
}

categories.forEach((c) => {
  const b = document.createElement("button");
  b.textContent = c;
  b.onclick = () => afficherGalerie(c);
  $("filtres").appendChild(b);
});
afficherGalerie("Tout");

// --- Lightbox ---
let courant = 0;
let minuterieFermeture;
function ouvrir(i) {
  courant = (i + visibles.length) % visibles.length;
  clearTimeout(minuterieFermeture);
  $("lightbox").classList.remove("fermeture");
  $("lb-img").src = visibles[courant].src;
  $("lb-cap").textContent = visibles[courant].titre;
  rejouer($("lb-img"), "suivante");
  $("lightbox").hidden = false;
  document.body.classList.add("lb-ouverte");
}
const fermer = () => {
  if ($("lightbox").classList.contains("fermeture")) return;
  $("lightbox").classList.add("fermeture");
  document.body.classList.remove("lb-ouverte");
  minuterieFermeture = setTimeout(() => {
    $("lightbox").hidden = true;
    $("lightbox").classList.remove("fermeture");
  }, mouvementReduit ? 0 : 250);
};
document.querySelector(".lb-close").onclick = fermer;
document.querySelector(".lb-prev").onclick = (e) => { e.stopPropagation(); ouvrir(courant - 1); };
document.querySelector(".lb-next").onclick = (e) => { e.stopPropagation(); ouvrir(courant + 1); };
$("lightbox").onclick = (e) => { if (e.target.id === "lightbox") fermer(); };
document.addEventListener("keydown", (e) => {
  if ($("lightbox").hidden || $("lightbox").classList.contains("fermeture")) return;
  if (e.key === "Escape") fermer();
  if (e.key === "ArrowLeft") ouvrir(courant - 1);
  if (e.key === "ArrowRight") ouvrir(courant + 1);
});

// --- Calendrier des disponibilités ---
const auj = new Date();
auj.setHours(0, 0, 0, 0);
let vue = new Date(auj.getFullYear(), auj.getMonth(), 1);
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// --- Horaires des séances ---
const NOMS_JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const enMinutes = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
const enHeure = (min) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

// Plages d'ouverture d'un jour, en minutes depuis minuit : [[540, 720], [840, 1140]]
function plagesDuJour(d) {
  const plages = CONFIG.exceptionsHoraires?.[iso(d)] ?? CONFIG.horaires?.[NOMS_JOURS[d.getDay()]] ?? [];
  return plages.map((p) => p.split("-").map(enMinutes));
}
const estFerme = (d) => plagesDuJour(d).length === 0;

// Occupation lue dans Google Agenda : { "AAAA-MM-JJ": nombre d'heures, ou Infinity pour une journée entière }
const occupation = {};
// Rendez-vous de chaque jour, en minutes depuis minuit : { "AAAA-MM-JJ": [[840, 960], ...] }
const plagesOccupees = {};
const chargements = new Map(); // mois -> promesse de chargement, pour ne pas interroger Google deux fois
const evenementsVus = new Set(); // un événement à cheval sur deux mois revient dans les deux requêtes

function ajouterOccupation(debut, fin, journeeEntiere) {
  for (let d = new Date(debut.getFullYear(), debut.getMonth(), debut.getDate()); d < fin; d.setDate(d.getDate() + 1)) {
    const cle = iso(d);
    if (journeeEntiere) { occupation[cle] = Infinity; continue; }
    const finJour = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    const debutJ = new Date(Math.max(debut, d)), finJ = new Date(Math.min(fin, finJour));
    occupation[cle] = (occupation[cle] || 0) + (finJ - debutJ) / 3600000;
    (plagesOccupees[cle] ||= []).push([
      debutJ.getHours() * 60 + debutJ.getMinutes(),
      finJ >= finJour ? 24 * 60 : finJ.getHours() * 60 + finJ.getMinutes(),
    ]);
  }
}

function chargerGoogleAgenda(annee, mois) {
  const { idAgenda, cleApi } = CONFIG.googleAgenda || {};
  if (!idAgenda || !cleApi) return Promise.resolve();
  const cleMois = `${annee}-${mois}`;
  if (!chargements.has(cleMois)) chargements.set(cleMois, lireMoisGoogle(annee, mois, idAgenda, cleApi, cleMois));
  return chargements.get(cleMois);
}

async function lireMoisGoogle(annee, mois, idAgenda, cleApi, cleMois) {
  const params = new URLSearchParams({
    key: cleApi,
    timeMin: new Date(annee, mois, 1).toISOString(),
    timeMax: new Date(annee, mois + 1, 1).toISOString(),
    singleEvents: "true",
    maxResults: "250",
  });
  try {
    const rep = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(idAgenda)}/events?${params}`);
    if (!rep.ok) throw new Error(`HTTP ${rep.status}`);
    const data = await rep.json();
    for (const ev of data.items || []) {
      if (ev.status === "cancelled" || ev.transparency === "transparent") continue;
      const idEv = ev.id || JSON.stringify([ev.start, ev.end]);
      if (evenementsVus.has(idEv)) continue;
      evenementsVus.add(idEv);
      if (ev.start.date) {
        const [a1, m1, j1] = ev.start.date.split("-").map(Number);
        const [a2, m2, j2] = ev.end.date.split("-").map(Number);
        ajouterOccupation(new Date(a1, m1 - 1, j1), new Date(a2, m2 - 1, j2), true);
      } else {
        ajouterOccupation(new Date(ev.start.dateTime), new Date(ev.end.dateTime), false);
      }
    }
  } catch (err) {
    chargements.delete(cleMois);
    console.warn("Google Agenda indisponible, seules les dates manuelles sont affichées.", err);
    return;
  }
  if (vue.getFullYear() === annee && vue.getMonth() === mois) afficherCalendrier();
}

function etatDuJour(cle) {
  const heures = occupation[cle] || 0;
  if (CONFIG.reserve.includes(cle) || heures >= (CONFIG.googleAgenda?.heuresJourneeComplete ?? 6)) return "reserve";
  if (CONFIG.partiel.includes(cle) || heures > 0) return "partiel";
  return "dispo";
}

function afficherCalendrier() {
  chargerGoogleAgenda(vue.getFullYear(), vue.getMonth());
  const grid = $("cal-grid");
  grid.innerHTML = "";
  $("mois").textContent = vue.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  $("prev").disabled = vue.getFullYear() === auj.getFullYear() && vue.getMonth() === auj.getMonth();

  ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].forEach((n) => {
    grid.insertAdjacentHTML("beforeend", `<div class="jour-nom">${n}</div>`);
  });

  const decalage = (vue.getDay() + 6) % 7; // semaine commençant le lundi
  for (let i = 0; i < decalage; i++) grid.insertAdjacentHTML("beforeend", "<div></div>");

  const nbJours = new Date(vue.getFullYear(), vue.getMonth() + 1, 0).getDate();
  for (let j = 1; j <= nbJours; j++) {
    const d = new Date(vue.getFullYear(), vue.getMonth(), j);
    const cle = iso(d);
    let etat = etatDuJour(cle);
    let titre = { dispo: "Disponible", partiel: "Quelques créneaux", reserve: "Réservé" }[etat];
    if (d < auj) { etat = "passe"; titre = ""; }
    else if (etat === "dispo" && estFerme(d)) { etat = "ferme"; titre = "Fermé"; }

    const cell = document.createElement("div");
    cell.className = `jour ${etat}${d.getTime() === auj.getTime() ? " aujourdhui" : ""}`;
    cell.textContent = j;
    cell.title = titre;
    grid.appendChild(cell);
  }
}
function changerMois(sens) {
  vue.setMonth(vue.getMonth() + sens);
  afficherCalendrier();
  $("cal-grid").classList.remove("vers-suivant", "vers-precedent");
  rejouer($("cal-grid"), sens > 0 ? "vers-suivant" : "vers-precedent");
  rejouer($("mois"));
}
$("prev").onclick = () => changerMois(-1);
$("next").onclick = () => changerMois(1);
afficherCalendrier();

// --- Coordonnées ---
const c = CONFIG.contact;
const lignes = [
  ["Email", `<a href="mailto:${c.email}">${c.email}</a>`],
  ["Téléphone", `<a href="tel:${c.telephone.replace(/\s/g, "")}">${c.telephone}</a>`],
  ["Localisation", c.ville],
];
if (c.instagram) lignes.push(["Instagram", `<a href="${c.instagram}" target="_blank" rel="noopener">Voir mon compte</a>`]);
$("coord").innerHTML = lignes.map(([k, v]) => `<li><span>${k}</span>${v}</li>`).join("");

// --- Formulaire : rendez-vous ou demande d'information ---
const form = $("form");
const estRdv = () => form.elements.demande.value === "rdv";
form.elements.date.min = iso(auj);
const selectHeure = form.elements.heure;
const champHeure = selectHeure.closest("label");
const types = Object.keys(CONFIG.dureesSeances || {});
if (types.length) form.elements.type.innerHTML = types.map((t) => `<option>${t}</option>`).join("");
const estJournee = () => CONFIG.dureesSeances?.[form.elements.type.value] === "journee";

function basculerDemande() {
  form.querySelectorAll(".rdv").forEach((el) => {
    el.hidden = !estRdv();
    el.querySelectorAll("input, select").forEach((champ) => (champ.disabled = !estRdv()));
  });
  // Séance sur la journée entière : pas d'heure à choisir
  champHeure.hidden = !estRdv() || estJournee();
  selectHeure.disabled = champHeure.hidden;
  $("bouton-envoi").textContent = estRdv() ? "Envoyer la demande de rendez-vous" : "Envoyer ma question";
}
form.querySelectorAll("input[name=demande]").forEach((r) => (r.onchange = basculerDemande));
basculerDemande();

// Heures de début libres pour une séance de ce type, selon les horaires et l'agenda
function creneauxDisponibles(d, type) {
  const dureeMin = (CONFIG.dureesSeances?.[type] ?? 2) * 60;
  const pas = CONFIG.intervalleCreneaux || 30;
  const limite = Date.now() + (CONFIG.delaiMinimumHeures ?? 0) * 3600000;
  const occupes = plagesOccupees[iso(d)] || [];
  const liste = [];
  for (const [ouverture, fermeture] of plagesDuJour(d)) {
    for (let m = ouverture; m + dureeMin <= fermeture; m += pas) {
      if (new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, m) < limite) continue;
      if (occupes.some(([a, b]) => m < b && m + dureeMin > a)) continue;
      liste.push(enHeure(m));
    }
  }
  return liste;
}

function remplirHeures(liste, texteVide) {
  const avant = selectHeure.value;
  selectHeure.innerHTML = liste.length
    ? `<option value="">Choisir une heure</option>` +
      liste.map((h) => `<option value="${h}">${h.replace(":", "h")}</option>`).join("")
    : `<option value="">${texteVide}</option>`;
  if (liste.includes(avant)) selectHeure.value = avant;
}

// Disponibilité du jour choisi : remplit la liste des heures et renvoie null
// si le jour peut être demandé, sinon la raison du refus
async function verifierDate(valeur) {
  const type = form.elements.type.value;
  const info = $("dispo-date");
  info.className = "rdv full dispo-date";
  info.textContent = "";
  remplirHeures([], "Choisissez d'abord une date");
  if (!valeur) return null;
  const [a, m, j] = valeur.split("-").map(Number);
  const d = new Date(a, m - 1, j);
  const delai = CONFIG.delaiMinimumHeures ?? 0;
  let etat, texte, refus = true;
  if (d < auj) { etat = "reserve"; texte = "Cette date est déjà passée."; }
  else {
    await chargerGoogleAgenda(a, m - 1);
    if (form.elements.date.value !== valeur || form.elements.type.value !== type) return null; // changé entre-temps
    etat = etatDuJour(valeur);
    if (etat === "dispo" && estFerme(d)) etat = "ferme";
    if (etat === "reserve") texte = "Ce jour est déjà réservé, merci de choisir une autre date.";
    else if (etat === "ferme") texte = "Je ne travaille pas ce jour-là, merci de choisir une autre date.";
    else if (estJournee()) {
      if (occupation[valeur] || etat === "partiel") { etat = "reserve"; texte = "Ce jour n'est plus entièrement libre, merci de choisir une autre date."; }
      else if (d < Date.now() + delai * 3600000) { etat = "reserve"; texte = `Les réservations se font au moins ${delai} h à l'avance.`; }
      else { etat = "dispo"; texte = "✓ Ce jour est entièrement libre."; refus = false; }
    } else {
      const liste = creneauxDisponibles(d, type);
      remplirHeures(liste, "Aucun horaire disponible");
      if (!liste.length) {
        etat = "reserve";
        texte = delai && d < Date.now() + (delai + 24) * 3600000
          ? `Plus aucun horaire disponible ce jour-là (réservation au moins ${delai} h à l'avance).`
          : "Plus aucun horaire disponible ce jour-là pour cette séance, merci de choisir une autre date.";
      } else {
        texte = etat === "partiel"
          ? `Il reste ${liste.length} horaire${liste.length > 1 ? "s" : ""} disponible${liste.length > 1 ? "s" : ""} ce jour-là.`
          : "✓ Ce jour est disponible, choisissez une heure.";
        refus = false;
      }
    }
  }
  info.classList.add(etat);
  info.textContent = texte;
  rejouer(info);
  return refus ? texte : null;
}
form.elements.date.onchange = () => verifierDate(form.elements.date.value);
form.elements.type.onchange = () => { basculerDemande(); verifierDate(form.elements.date.value); };

form.onsubmit = async (e) => {
  e.preventDefault();
  const f = new FormData(form);
  const statut = $("form-statut");
  const bouton = $("bouton-envoi");
  statut.className = "form-statut full";
  statut.textContent = "";

  if (estRdv()) {
    const heureChoisie = f.get("heure");
    const refus = await verifierDate(f.get("date"));
    if (heureChoisie) selectHeure.value = heureChoisie;
    if (refus || (!estJournee() && selectHeure.value !== heureChoisie)) {
      statut.classList.add("erreur");
      statut.textContent = refus || "Cet horaire n'est plus disponible, merci d'en choisir un autre.";
      rejouer(statut);
      return;
    }
    // Le script Google attend une heure, même pour une séance sur la journée entière
    if (estJournee()) f.set("heure", "00:00");
  }

  if (!CONFIG.urlScriptGoogle) {
    const sujet = estRdv()
      ? `Demande de rendez-vous ${f.get("type")} — ${f.get("nom")}`
      : `Demande d'information — ${f.get("nom")}`;
    const corps =
      `Nom : ${f.get("nom")}\nEmail : ${f.get("email")}\nTéléphone : ${f.get("telephone") || "—"}\n` +
      (estRdv()
        ? `Type : ${f.get("type")}\nDate souhaitée : ${f.get("date")} ${estJournee() ? "(journée entière)" : "à " + f.get("heure")}\n`
        : "") +
      `\n${f.get("message")}`;
    window.location.href = `mailto:${c.email}?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(corps)}`;
    return;
  }

  const rdv = estRdv();
  statut.textContent = "Envoi en cours…";
  bouton.disabled = true;
  try {
    // text/plain évite la requête préalable (CORS) que Google Apps Script ne sait pas traiter
    const rep = await fetch(CONFIG.urlScriptGoogle, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(Object.fromEntries(f)),
    });
    const res = await rep.json();
    if (!res.success) throw new Error(res.message);
    statut.classList.add("succes");
    statut.textContent = rdv
      ? "Merci ! Votre demande de rendez-vous a bien été envoyée. Vous recevrez un email dès qu'elle sera confirmée."
      : "Merci ! Votre message a bien été envoyé, je vous réponds rapidement.";
    form.reset();
    basculerDemande();
    verifierDate("");
  } catch {
    statut.classList.add("erreur");
    statut.innerHTML = `L'envoi a échoué. Écrivez-moi directement à <a href="mailto:${c.email}">${c.email}</a>.`;
  } finally {
    bouton.disabled = false;
    rejouer(statut);
  }
};

// --- Animations : blocs qui apparaissent au défilement ---
document.querySelectorAll(".apropos p, .section h2, .filtres, .calendrier, #form").forEach((el) => reveler(el));
document.querySelectorAll(".coord li").forEach((el, i) => reveler(el, i * 0.08));

// --- Menu : fond qui apparaît dès qu'on quitte le haut de page ---
const nav = document.querySelector(".nav");
const majMenu = () => nav.classList.toggle("defile", scrollY > 10);
addEventListener("scroll", majMenu, { passive: true });
majMenu();

// --- Le nom de l'accueil glisse vers le coin en haut à gauche au défilement ---
if (!mouvementReduit) {
  const titreHero = $("nom");
  const logo = $("logo");
  const volant = document.createElement("div");
  volant.className = "titre-volant";
  volant.setAttribute("aria-hidden", "true");
  volant.appendChild(document.createElement("span")).textContent = CONFIG.nom;
  document.body.appendChild(volant);
  racine.classList.add("titre-anime");
  const texteVolant = volant.firstChild;
  const contenuHero = document.querySelector(".hero-content");
  const ESPACE_DEBUT = 0.08, ESPACE_FIN = 0.35; // espacement des lettres du titre puis du logo (em)

  let m = null;
  function mesurer() {
    const plage = document.createRange();
    plage.selectNodeContents(titreHero);
    const t = plage.getBoundingClientRect();
    const l = logo.getBoundingClientRect();
    texteVolant.style.letterSpacing = `${ESPACE_DEBUT}em`;
    const largeurDebut = texteVolant.offsetWidth;
    texteVolant.style.letterSpacing = `${ESPACE_FIN}em`;
    const largeurFin = texteVolant.offsetWidth;
    const echelle = parseFloat(getComputedStyle(logo).fontSize) / parseFloat(getComputedStyle(titreHero).fontSize);
    m = {
      centreX: t.left + t.width / 2,
      haut: t.top + scrollY + (t.height - volant.offsetHeight) / 2, // position dans la page
      hauteur: volant.offsetHeight,
      largeurDebut, largeurFin, echelle,
      logoX: l.left,
      logoCentreY: l.top + l.height / 2,
    };
    m.distance = Math.max(m.haut - l.top, innerHeight * 0.6); // défilement nécessaire pour finir le trajet
    // Sur mobile le logo est au-dessus des liens du menu : le titre doit passer à travers
    const liens = document.querySelector(".nav nav").getBoundingClientRect();
    m.liens = l.bottom <= liens.top ? { haut: liens.top, bas: liens.bottom } : null;
    placer();
  }

  const adoucir = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
  const ralentir = (t) => 1 - (1 - t) ** 3;
  let enAttente = false;
  function placer() {
    enAttente = false;
    const p = Math.min(Math.max(scrollY / m.distance, 0), 1);
    // Le titre rétrécit vite (pour ne pas recouvrir le menu) puis se déplace en douceur
    const eTaille = ralentir(p);
    const ePosition = adoucir(p);
    const echelle = 1 + (m.echelle - 1) * eTaille;
    const largeur = m.largeurDebut + (m.largeurFin - m.largeurDebut) * eTaille;
    // Le centre du titre part du centre de l'accueil et arrive sur le centre du logo
    const centreX = m.centreX + (m.logoX + (m.largeurFin * m.echelle) / 2 - m.centreX) * ePosition;
    const hautActuel = m.haut - scrollY;
    const y = hautActuel + (m.logoCentreY - (m.hauteur * echelle) / 2 - hautActuel) * ePosition;
    volant.style.transform = `translate3d(${centreX - (largeur * echelle) / 2}px, ${y}px, 0) scale(${echelle})`;
    texteVolant.style.letterSpacing = `${ESPACE_DEBUT + (ESPACE_FIN - ESPACE_DEBUT) * eTaille}em`;
    // Fondu enchaîné avec le vrai logo (cliquable) sur la fin du trajet
    const borner = (v) => Math.min(Math.max(v, 0), 1);
    let relais = borner((p - 0.92) / 0.08);
    // ... dans ce cas le relais se fait juste avant qu'il n'atteigne les liens
    if (m.liens) relais = Math.max(relais, borner((m.liens.bas + 14 - y) / 14));
    volant.style.opacity = 1 - relais;
    logo.style.opacity = relais;
    // Le reste du texte d'accueil s'efface pour laisser passer le titre
    contenuHero.style.opacity = 1 - borner(p / 0.25);
  }

  addEventListener("scroll", () => {
    if (!enAttente) { enAttente = true; requestAnimationFrame(placer); }
  }, { passive: true });
  addEventListener("resize", mesurer);
  mesurer();
  document.fonts?.ready.then(mesurer);
}

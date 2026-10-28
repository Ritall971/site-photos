const $ = (id) => document.getElementById(id);

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
function ouvrir(i) {
  courant = (i + visibles.length) % visibles.length;
  $("lb-img").src = visibles[courant].src;
  $("lb-cap").textContent = visibles[courant].titre;
  $("lightbox").hidden = false;
  document.body.classList.add("lb-ouverte");
}
const fermer = () => {
  $("lightbox").hidden = true;
  document.body.classList.remove("lb-ouverte");
};
document.querySelector(".lb-close").onclick = fermer;
document.querySelector(".lb-prev").onclick = (e) => { e.stopPropagation(); ouvrir(courant - 1); };
document.querySelector(".lb-next").onclick = (e) => { e.stopPropagation(); ouvrir(courant + 1); };
$("lightbox").onclick = (e) => { if (e.target.id === "lightbox") fermer(); };
document.addEventListener("keydown", (e) => {
  if ($("lightbox").hidden) return;
  if (e.key === "Escape") fermer();
  if (e.key === "ArrowLeft") ouvrir(courant - 1);
  if (e.key === "ArrowRight") ouvrir(courant + 1);
});

// --- Calendrier des disponibilités ---
const auj = new Date();
auj.setHours(0, 0, 0, 0);
let vue = new Date(auj.getFullYear(), auj.getMonth(), 1);
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Occupation lue dans Google Agenda : { "AAAA-MM-JJ": nombre d'heures, ou Infinity pour une journée entière }
const occupation = {};
const chargements = new Map(); // mois -> promesse de chargement, pour ne pas interroger Google deux fois
const evenementsVus = new Set(); // un événement à cheval sur deux mois revient dans les deux requêtes

function ajouterOccupation(debut, fin, journeeEntiere) {
  for (let d = new Date(debut.getFullYear(), debut.getMonth(), debut.getDate()); d < fin; d.setDate(d.getDate() + 1)) {
    const cle = iso(d);
    if (journeeEntiere) { occupation[cle] = Infinity; continue; }
    const finJour = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    const heures = (Math.min(fin, finJour) - Math.max(debut, d)) / 3600000;
    occupation[cle] = (occupation[cle] || 0) + heures;
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
    else if (etat === "dispo" && CONFIG.joursRepos.includes(d.getDay())) { etat = "ferme"; titre = "Fermé"; }

    const cell = document.createElement("div");
    cell.className = `jour ${etat}${d.getTime() === auj.getTime() ? " aujourdhui" : ""}`;
    cell.textContent = j;
    cell.title = titre;
    grid.appendChild(cell);
  }
}
$("prev").onclick = () => { vue.setMonth(vue.getMonth() - 1); afficherCalendrier(); };
$("next").onclick = () => { vue.setMonth(vue.getMonth() + 1); afficherCalendrier(); };
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

function basculerDemande() {
  form.querySelectorAll(".rdv").forEach((el) => {
    el.hidden = !estRdv();
    el.querySelectorAll("input, select").forEach((champ) => (champ.disabled = !estRdv()));
  });
  $("bouton-envoi").textContent = estRdv() ? "Envoyer la demande de rendez-vous" : "Envoyer ma question";
}
form.querySelectorAll("input[name=demande]").forEach((r) => (r.onchange = basculerDemande));
basculerDemande();

// Disponibilité du jour choisi : null si le jour peut être demandé, sinon la raison du refus
async function verifierDate(valeur) {
  const info = $("dispo-date");
  info.className = "rdv full dispo-date";
  info.textContent = "";
  if (!valeur) return null;
  const [a, m, j] = valeur.split("-").map(Number);
  const d = new Date(a, m - 1, j);
  let etat, texte;
  if (d < auj) { etat = "reserve"; texte = "Cette date est déjà passée."; }
  else {
    await chargerGoogleAgenda(a, m - 1);
    etat = etatDuJour(valeur);
    if (etat === "dispo" && CONFIG.joursRepos.includes(d.getDay())) etat = "ferme";
    texte = {
      dispo: "✓ Ce jour est disponible.",
      partiel: "Il reste quelques créneaux ce jour-là, je vous confirmerai l'horaire.",
      reserve: "Ce jour est déjà réservé, merci de choisir une autre date.",
      ferme: "Je ne travaille pas ce jour-là, merci de choisir une autre date.",
    }[etat];
  }
  if (form.elements.date.value !== valeur) return null; // la date a changé entre-temps
  info.classList.add(etat);
  info.textContent = texte;
  return etat === "reserve" || etat === "ferme" ? texte : null;
}
form.elements.date.onchange = () => verifierDate(form.elements.date.value);

form.onsubmit = async (e) => {
  e.preventDefault();
  const f = new FormData(form);
  const statut = $("form-statut");
  const bouton = $("bouton-envoi");
  statut.className = "form-statut full";
  statut.textContent = "";

  if (estRdv()) {
    const refus = await verifierDate(f.get("date"));
    if (refus) {
      statut.classList.add("erreur");
      statut.textContent = refus;
      return;
    }
  }

  if (!CONFIG.urlScriptGoogle) {
    const sujet = estRdv()
      ? `Demande de rendez-vous ${f.get("type")} — ${f.get("nom")}`
      : `Demande d'information — ${f.get("nom")}`;
    const corps =
      `Nom : ${f.get("nom")}\nEmail : ${f.get("email")}\nTéléphone : ${f.get("telephone") || "—"}\n` +
      (estRdv() ? `Type : ${f.get("type")}\nDate souhaitée : ${f.get("date")} à ${f.get("heure")}\n` : "") +
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
    $("dispo-date").textContent = "";
  } catch {
    statut.classList.add("erreur");
    statut.innerHTML = `L'envoi a échoué. Écrivez-moi directement à <a href="mailto:${c.email}">${c.email}</a>.`;
  } finally {
    bouton.disabled = false;
  }
};

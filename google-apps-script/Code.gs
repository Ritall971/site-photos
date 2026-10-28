// ============================================================
//  SCRIPT GOOGLE DU SITE — demandes de rendez-vous et d'information
// ============================================================
//
//  INSTALLATION (une seule fois) :
//  1. Va sur https://script.google.com > "Nouveau projet". Nomme-le "Site photo".
//  2. Efface le contenu de Code.gs et colle tout ce fichier à la place. Enregistre.
//     Puis roue dentée "Paramètres du projet" > coche "Afficher le fichier manifeste
//     appsscript.json". Retourne dans l'éditeur, ouvre appsscript.json et remplace son
//     contenu par celui du fichier appsscript.json fourni à côté de ce fichier. Enregistre.
//  3. En haut, choisis la fonction "testerInstallation" puis clique sur "Exécuter".
//     Google demande des autorisations : "Examiner les autorisations" > ton compte >
//     "Paramètres avancés" > "Accéder à Site photo" > "Autoriser".
//     Le journal doit afficher le nom de ton agenda.
//  4. "Déployer" > "Nouveau déploiement" > roue dentée > "Application Web".
//       - Exécuter en tant que : Moi
//       - Qui a accès : Tout le monde
//     Clique sur "Déployer" et copie l'URL qui se termine par /exec.
//  5. Colle cette URL dans config.js du site (urlScriptGoogle).
//
//  APRÈS UNE MODIFICATION de ce fichier : "Déployer" > "Gérer les déploiements" >
//  crayon > Version : "Nouvelle version" > "Déployer". L'URL reste la même.
// ============================================================

const REGLAGES = {
  // ID de l'agenda où ajouter les rendez-vous (le même que dans config.js du site)
  idAgenda: "e9c72da66f6de9a8e8ac4fbf374a05872101c027d798a4a2b54ddebd94ad7403@group.calendar.google.com",
  // Adresse qui reçoit les demandes
  emailPhotographe: "rerefava94@gmail.com",
  nomSite: "Rebecca FAVA — Photographe",
  // Envoyer un email au client quand tu confirmes ou refuses sa demande
  prevenirClient: true,
  // Durée des séances en heures ; "journee" = événement sur toute la journée
  durees: { Portrait: 2, Mariage: "journee", "Événement": 4, "Véhicules": 2, Professionnel: 2, Autre: 2 },
};

// ---------- Réception du formulaire du site ----------

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.botcheck) return repondre({ success: true }); // robot : ignoré sans le signaler
    const dem = {
      nom: nettoyer(d.nom, 100),
      email: nettoyer(d.email, 200),
      telephone: nettoyer(d.telephone, 40),
      message: nettoyer(d.message, 5000),
    };
    if (!dem.nom || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(dem.email)) throw new Error("Nom ou email invalide.");
    if (d.demande === "rdv") enregistrerRdv(dem, d);
    else envoyerInfo(dem);
    return repondre({ success: true });
  } catch (err) {
    return repondre({ success: false, message: err.message });
  }
}

function envoyerInfo(dem) {
  MailApp.sendEmail({
    to: emailPhotographe(),
    replyTo: dem.email,
    subject: `Demande d'information — ${dem.nom}`,
    htmlBody: carte("Nouvelle demande d'information",
      infosClient(dem) + paragrapheMessage(dem) +
      `<p style="color:#888">Répondez simplement à cet email pour écrire à ${esc(dem.nom)}.</p>`),
  });
}

function enregistrerRdv(dem, d) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date) || !/^\d{2}:\d{2}$/.test(d.heure)) throw new Error("Date ou heure invalide.");
  dem.seance = nettoyer(d.type, 40) || "Autre";
  dem.date = d.date;
  dem.heure = d.heure;
  const { debut, fin, journee } = creneau(dem);
  if (fin < new Date()) throw new Error("La date demandée est déjà passée.");

  const id = Utilities.getUuid();
  PropertiesService.getScriptProperties().setProperty("rdv_" + id, JSON.stringify(dem));

  const conflits = agenda().getEvents(debut, fin);
  const alerte = conflits.length
    ? `<p style="background:#fbeaea;color:#8c3029;padding:10px 14px">⚠ Ce créneau chevauche déjà : ${conflits.map((c) => esc(c.getTitle())).join(", ")}</p>`
    : "";
  MailApp.sendEmail({
    to: emailPhotographe(),
    replyTo: dem.email,
    subject: `Demande de RDV — ${dem.seance} le ${dateLisible(dem, journee)} — ${dem.nom}`,
    htmlBody: carte("Nouvelle demande de rendez-vous",
      `<p style="font-size:18px"><b>${esc(dem.seance)}</b> — ${esc(dateLisible(dem, journee))}</p>` +
      infosClient(dem) + paragrapheMessage(dem) + alerte +
      bouton("Confirmer", lien("confirmer", id), "#2f7a45") + " " +
      bouton("Refuser", lien("refuser", id), "#8c3029")),
  });
}

// ---------- Clic sur « Confirmer » ou « Refuser » dans l'email ----------

function doGet(e) {
  const p = e.parameter || {};
  const props = PropertiesService.getScriptProperties();
  const cle = "rdv_" + p.id;
  const verrou = LockService.getScriptLock();
  verrou.waitLock(10000); // évite qu'un double clic crée deux événements
  try {
    const brut = p.id && props.getProperty(cle);
    if (!brut) return page("Demande déjà traitée", "Cette demande a déjà été confirmée ou refusée, ou n'existe pas.");
    const dem = JSON.parse(brut);
    const { debut, fin, journee } = creneau(dem);
    const quand = dateLisible(dem, journee);

    if (p.action === "refuser") {
      props.deleteProperty(cle);
      if (REGLAGES.prevenirClient) {
        MailApp.sendEmail({
          to: dem.email,
          subject: `Votre demande de séance photo du ${quand}`,
          htmlBody: carte(`Bonjour ${esc(dem.nom)},`,
            `<p>Merci pour votre demande de séance ${esc(dem.seance.toLowerCase())} du <b>${esc(quand)}</b>.</p>` +
            `<p>Malheureusement, je ne suis pas disponible à cette date. N'hésitez pas à répondre à cet email ` +
            `pour me proposer un autre jour.</p><p>${esc(REGLAGES.nomSite)}</p>`),
        });
      }
      return page("Demande refusée", `La demande de ${esc(dem.nom)} pour le ${esc(quand)} a été refusée.` +
        (REGLAGES.prevenirClient ? " Un email l'en a informé(e)." : ""));
    }

    if (p.action !== "confirmer") return page("Action inconnue", "");

    const conflits = agenda().getEvents(debut, fin);
    if (conflits.length && p.force !== "1") {
      return page("Attention : créneau déjà occupé",
        `Le ${esc(quand)} chevauche : <b>${conflits.map((c) => esc(c.getTitle())).join(", ")}</b>.<br><br>` +
        bouton("Confirmer quand même", lien("confirmer", p.id, true), "#2f7a45") + " " +
        bouton("Refuser la demande", lien("refuser", p.id), "#8c3029"));
    }

    const titre = `Séance ${dem.seance} — ${dem.nom}`;
    const options = {
      description: `Email : ${dem.email}\nTéléphone : ${dem.telephone || "—"}\n\n${dem.message}`,
    };
    if (journee) agenda().createAllDayEvent(titre, debut, options);
    else agenda().createEvent(titre, debut, fin, options);
    props.deleteProperty(cle);

    if (REGLAGES.prevenirClient) {
      MailApp.sendEmail({
        to: dem.email,
        subject: `Votre séance photo est confirmée — ${quand}`,
        htmlBody: carte(`Bonjour ${esc(dem.nom)},`,
          `<p>Bonne nouvelle : votre séance ${esc(dem.seance.toLowerCase())} est confirmée pour le <b>${esc(quand)}</b>.</p>` +
          `<p>Pour toute question, répondez simplement à cet email.</p><p>À bientôt,<br>${esc(REGLAGES.nomSite)}</p>`),
      });
    }
    return page("Rendez-vous confirmé ✓",
      `« ${esc(titre)} » a été ajouté à ton agenda le ${esc(quand)}.<br>` +
      `Le calendrier du site affichera ce jour comme occupé.` +
      (REGLAGES.prevenirClient ? `<br>${esc(dem.nom)} a reçu un email de confirmation.` : ""));
  } finally {
    verrou.releaseLock();
  }
}

// ---------- Outils ----------

function testerInstallation() {
  const a = agenda();
  Logger.log(`Agenda trouvé : "${a.getName()}" (fuseau ${a.getTimeZone()})`);
  Logger.log(`Les demandes seront envoyées à : ${emailPhotographe()}`);
}

function agenda() {
  const a = CalendarApp.getCalendarById(REGLAGES.idAgenda);
  if (!a) throw new Error("Agenda introuvable : vérifie idAgenda dans REGLAGES.");
  return a;
}

function creneau(dem) {
  const tz = agenda().getTimeZone();
  const duree = REGLAGES.durees[dem.seance] ?? 2;
  if (duree === "journee") {
    const debut = Utilities.parseDate(`${dem.date} 00:00`, tz, "yyyy-MM-dd HH:mm");
    return { debut, fin: new Date(debut.getTime() + 24 * 3600000), journee: true };
  }
  const debut = Utilities.parseDate(`${dem.date} ${dem.heure}`, tz, "yyyy-MM-dd HH:mm");
  return { debut, fin: new Date(debut.getTime() + duree * 3600000), journee: false };
}

function dateLisible(dem, journee) {
  const [a, m, j] = dem.date.split("-").map(Number);
  const jours = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
  const mois = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  const texte = `${jours[new Date(Date.UTC(a, m - 1, j)).getUTCDay()]} ${j} ${mois[m - 1]} ${a}`;
  return journee ? texte : `${texte} à ${dem.heure.replace(":", "h")}`;
}

function emailPhotographe() {
  if (!REGLAGES.emailPhotographe) throw new Error("Renseigne emailPhotographe dans REGLAGES.");
  return REGLAGES.emailPhotographe;
}

function lien(action, id, forcer) {
  return `${ScriptApp.getService().getUrl()}?action=${action}&id=${encodeURIComponent(id)}${forcer ? "&force=1" : ""}`;
}

function nettoyer(v, max) {
  return String(v || "").trim().slice(0, max);
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function infosClient(dem) {
  return `<table style="border-collapse:collapse;margin:12px 0">` +
    [["Nom", dem.nom], ["Email", dem.email], ["Téléphone", dem.telephone || "—"]]
      .map(([k, v]) => `<tr><td style="color:#888;padding:4px 16px 4px 0">${k}</td><td>${esc(v)}</td></tr>`).join("") +
    `</table>`;
}

function paragrapheMessage(dem) {
  return dem.message ? `<p style="white-space:pre-wrap;border-left:3px solid #d6c3a1;padding-left:12px">${esc(dem.message)}</p>` : "";
}

function bouton(texte, url, couleur) {
  return `<a href="${url}" target="_top" style="display:inline-block;padding:12px 26px;margin:8px 4px 0 0;background:${couleur};` +
    `color:#fff;text-decoration:none;font-family:sans-serif;font-size:14px;border-radius:4px">${texte}</a>`;
}

function carte(titre, contenu) {
  return `<div style="font-family:sans-serif;max-width:560px;color:#222;line-height:1.5">` +
    `<h2 style="font-weight:400">${titre}</h2>${contenu}</div>`;
}

function page(titre, contenu) {
  return HtmlService.createHtmlOutput(
    `<div style="font-family:sans-serif;max-width:560px;margin:60px auto;padding:0 16px;line-height:1.6">` +
    `<h1 style="font-weight:300">${titre}</h1><p>${contenu}</p></div>`
  ).setTitle(titre);
}

function repondre(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

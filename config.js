// ============================================================
//  CONFIGURATION DU SITE — modifie uniquement ce fichier
// ============================================================

const CONFIG = {
  nom: "Rebecca FAVA",
  metier: "Photographe",
  accroche: "Portraits, événements, Vehicules et paysages — des images qui racontent votre histoire.",
  apropos:
    "Passionné par la lumière et les instants vrais, je vous accompagne pour vos portraits, " +
    "mariages, événements et projets professionnels. Chaque séance est pensée sur mesure.",

  // --- Coordonnées ---
  contact: {
    email: "rerefava94@gmail.com",
    telephone: "01 23 45 67 89",
    ville: "Vitry-sur-Seine",
    instagram: "https://instagram.com/votre_compte", // laisse "" pour masquer
  },

  // --- Envoi des demandes (rendez-vous et informations) ---
  // URL du script Google qui reçoit les demandes, se termine par /exec.
  // Voir les étapes d'installation en haut du fichier google-apps-script/Code.gs.
  // Sans URL, le formulaire ouvre simplement la messagerie du client.
  urlScriptGoogle: "https://script.google.com/home/projects/1JC1CcppNvrhyZWrRJDm631UOyJtQA30CpUxhAjuJxDARWAKcCtvYJHD0/edit",

  // --- Photos ---
  // Mets tes fichiers dans le dossier "photos/" puis remplace les liens ci-dessous,
  // par exemple : { src: "photos/mariage-1.jpg", titre: "Mariage à Lyon", categorie: "Mariage" }
  photos: [
    { src: "https://picsum.photos/id/1011/1200/800", titre: "Lac au matin", categorie: "Paysage" },
    { src: "https://picsum.photos/id/1027/800/1100", titre: "Portrait en extérieur", categorie: "Portrait" },
    { src: "https://picsum.photos/id/1015/1200/800", titre: "Vallée", categorie: "Paysage" },
    { src: "https://picsum.photos/id/64/800/1100", titre: "Regard", categorie: "Portrait" },
    { src: "https://picsum.photos/id/1059/1200/800", titre: "Soirée", categorie: "Événement" },
    { src: "https://picsum.photos/id/1036/1200/800", titre: "Hiver", categorie: "Paysage" },
    { src: "https://picsum.photos/id/338/800/1100", titre: "Studio", categorie: "Portrait" },
    { src: "https://picsum.photos/id/1080/1200/800", titre: "Détails", categorie: "Événement" },
    { src: "https://picsum.photos/id/1043/1200/800", titre: "Lumière dorée", categorie: "Paysage" },
  ],

  // --- Disponibilités automatiques (Google Agenda) ---
  // Chaque rendez-vous de cet agenda bloque le jour correspondant sur le site.
  //  - un événement "toute la journée", ou des rendez-vous qui cumulent au moins
  //    "heuresJourneeComplete" heures -> le jour s'affiche "Réservé"
  //  - des rendez-vous plus courts -> le jour s'affiche "Quelques créneaux"
  // Laisse idAgenda ou cleApi vide pour n'utiliser que les dates manuelles ci-dessous.
  googleAgenda: {
    idAgenda: "e9c72da66f6de9a8e8ac4fbf374a05872101c027d798a4a2b54ddebd94ad7403@group.calendar.google.com", // ex. "abc123@group.calendar.google.com"
    cleApi: "AIzaSyBC6p-6I0aKXNIsiQocaKd1HIbWS6Da-V0",   // ex. "AIzaSy..."
    heuresJourneeComplete: 6,
  },

  // --- Disponibilités manuelles ---
  // Dates au format "AAAA-MM-JJ", ajoutées à celles de Google Agenda.
  // "reserve" = jour pris, "partiel" = quelques créneaux restants.
  // Tous les autres jours (hors jours de repos) s'affichent comme disponibles.
  reserve: ["", "", "", "", "", "", ""],
  partiel: ["", "", "", ""],
  joursRepos: [1], // 0 = dimanche, 1 = lundi, ... 6 = samedi

  // Texte affiché sous le calendrier
  noteDispo: "Séances possibles du mardi au dimanche. Réservez de préférence 2 semaines à l'avance.",
};

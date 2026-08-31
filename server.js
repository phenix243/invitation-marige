const express = require('express');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode'); // <-- C'EST CETTE LIGNE QUI MANQUAIT

const app = express();
const PORT = process.env || 3000;
const DB_FILE = path.join(__dirname, 'database.json');


// Middlewares obligatoires pour le traitement du JSON et des fichiers statiques
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Lecture sécurisée de la base de données (s'assure de toujours retourner un tableau)
const readDB = () => {
    if (!fs.existsSync(DB_FILE)) {
        fs.writeFileSync(DB_FILE, JSON.stringify([], null, 2));
        return [];
    }
    try {
        const data = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(data);
        return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
        return [];
    }
};

// Écriture sécurisée dans la BDD JSON
const writeDB = (data) => {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
};
// --- ROUTE PUBLIQUE : CONFIRMATION DE PRÉSENCE (RSVP) ---
const handleRSVP = async (req, res) => {
    try {
        const { prenom, nom, presence, boisson, motDoux } = req.body || {};

        if (!prenom || !nom) {
            return res.status(400).json({ error: "Le prénom et le nom sont requis." });
        }

        let invites = readDB();
        let targetGuest;

        const index = invites.findIndex(i => 
            i.prenom && i.nom &&
            i.prenom.trim().toLowerCase() === prenom.trim().toLowerCase() && 
            i.nom.trim().toLowerCase() === nom.trim().toLowerCase()
        );

        if (index !== -1) {
            invites[index].confirmed = true;
            invites[index].presence = presence || 'Oui';
            invites[index].boisson = boisson || 'Non spécifié';
            if (motDoux) invites[index].motDoux = motDoux;
            targetGuest = invites[index];
            writeDB(invites);
            console.log(`🎉 Présence mise à jour : ${prenom} ${nom}`);
        } else {
            // SI L'INVITÉ N'EST PAS DANS LA LISTE -> ON REFUSE
            return res.status(403).json({
                success: false,
                message: "Désolé, votre nom ne figure pas sur la liste officielle des invités."
            });
        }


        // Génération de l'image QR Code au format Data URL (base64)
        const qrCodeImage = await QRCode.toDataURL(targetGuest.id);

        const guestData = {
            ...targetGuest,
            qrCode: qrCodeImage
        };

        return res.json({ 
            success: true, 
            status: "ok", 
            ok: true, 
            message: "Votre présence a bien été enregistrée !",
            invite: guestData,
            qrCode: qrCodeImage
        });

    } catch (err) {
        console.error("Erreur serveur lors du RSVP :", err);
        return res.status(500).json({ error: "Erreur serveur." });
    }
};


// Intercepter toutes les routes possibles demandées par la page d'invitation
app.post('/api/rsvp', handleRSVP);
app.post('/api/confirm', handleRSVP);
app.post('/api/guests/confirm', handleRSVP);


// --- ROUTES ADMINISTRATION (DASHBOARD) ---
app.get('/admin', (req, res) => {
    res.sendFile('admin.html', { root: path.join(__dirname, 'public') });
});


// 1. Récupérer la liste complète des invités
app.get('/api/admin/invites', (req, res) => {
    const invites = readDB();
    res.json(invites);
});

// 2. Ajouter / Pré-enregistrer un invité VIP
// 2. Ajouter / Pré-enregistrer un invité VIP (avec Civilité)
app.post('/api/admin/add-guest', (req, res) => {
    try {
        const { title, prenom, nom, table } = req.body || {};

        if (!prenom || !nom) {
            return res.status(400).json({ error: 'Le prénom et le nom sont requis.' });
        }

        let invites = readDB();
        const newGuest = {
            id: 'INV-' + Date.now(),
            title: title || 'Mr/Mme', // Ex: "Monsieur", "Madame", "Mr & Mme" / "Couple"
            prenom: prenom.trim(),
            nom: nom.trim(),
            table: table ? table.trim() : 'Non assignée',
            confirmed: false,
            presence: 'En attente',
            boisson: 'Non spécifié',
            scanned: false,
            scannedAt: null,
            createdAt: new Date().toISOString()
        };

        invites.push(newGuest);
        writeDB(invites);

        console.log(`✅ Nouvel invité VIP pré-enregistré : ${title || ''} ${prenom} ${nom}`);
        res.json({ success: true, status: "ok", invite: newGuest });
    } catch (err) {
        console.error("Erreur ajout invité :", err);
        res.status(500).json({ error: "Erreur serveur lors de l'ajout." });
    }
});


// 3. Modifier les informations d'un invité
app.put('/api/admin/invites/:id', (req, res) => {
    const { id } = req.params;
    const { prenom, nom } = req.body;

    // Mise à jour de l'invité dans le tableau global / fichier JSON
    const invite = invites.find(i => i.id === id);
    if (invite) {
        if (prenom !== undefined) invite.prenom = prenom;
        if (nom !== undefined) invite.nom = nom;
        
        // Sauvegarde dans database.json
        fs.writeFileSync(dbPath, JSON.stringify(invites, null, 2));
        return res.json({ success: true, invite });
    }
    
    res.status(404).json({ error: "Invité non trouvé" });
});

// 4. Assigner ou modifier une table
// Route d'ajout VIP sécurisée
app.post('/api/admin/invites', (req, res) => {
    const fs = require('fs');
    const path = require('path');
    const dbPath = path.join(__dirname, 'database.json');

    const { prenom, nom, table } = req.body;

    // Relire systématiquement le fichier avant d'ajouter
    fs.readFile(dbPath, 'utf8', (err, data) => {
        let currentInvites = [];
        if (!err && data) {
            try {
                currentInvites = JSON.parse(data);
            } catch (e) {
                console.error("Erreur parsing JSON :", e);
            }
        }

        const newInvite = {
            id: Date.now().toString(),
            prenom: prenom || '',
            nom: nom || '',
            presence: 'Non spécifié',
            boisson: 'Non spécifié',
            table: table || 'Non assignée',
            scanned: false
        };

        currentInvites.push(newInvite);

        // Sauvegarde sécurisée
        fs.writeFile(dbPath, JSON.stringify(currentInvites, null, 2), (errWrite) => {
            if (errWrite) {
                return res.status(500).json({ error: "Erreur d'écriture dans la base" });
            }
            res.status(201).json(newInvite);
        });
    });
});

// 5. Supprimer un invité de la liste
app.delete('/api/admin/delete-guest/:id', (req, res) => {
    let invites = readDB();
    invites = invites.filter(i => i.id !== req.params.id);
    writeDB(invites);
    res.json({ success: true, status: "ok" });
});

// 6. Scanner un QR Code à l'entrée
app.post('/api/admin/scan-qr', (req, res) => {
    const { id } = req.body;
    let invites = readDB();
    const index = invites.findIndex(i => i.id === id);

    if (index === -1) {
        return res.json({ status: 'INVALID', message: 'Pass invalide ou non reconnu.' });
    }

    if (invites[index].scanned) {
        return res.json({ 
            status: 'ALREADY_USED', 
            message: 'Ce pass a déjà été scanné !',
            scannedAt: invites[index].scannedAt 
        });
    }

    invites[index].scanned = true;
    invites[index].scannedAt = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    writeDB(invites);

    res.json({
        status: 'VALID',
        message: 'Accès autorisé !',
        invite: invites[index]
    });
});

// Démarrage du serveur Node.js
// Démarrage du serveur Node.js
const serverPort = process.env.PORT || 3000;

app.listen(serverPort, () => {
    console.log(`Serveur démarré sur le port ${serverPort}`);
});

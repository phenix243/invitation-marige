// --- 1. SÉCURITÉ IMMÉDIATE ---
function protocoleAuth() {
    const CODE_SECRET = "2026";

    if (sessionStorage.getItem("protocole_auth") !== "true") {
        const saisie = prompt("Accès Protocole - Entrez le code d'accès :");

        if (saisie === CODE_SECRET) {
            sessionStorage.setItem("protocole_auth", "true");
            return true;
        } else {
            alert("Code d'accès incorrect.");
            window.location.href = "/";
            return false;
        }
    }
    return true;
}

// -----------------------------------------------------


// Bloque l'initialisation du tableau de bord si le code est faux
document.addEventListener('DOMContentLoaded', () => {
    // Si la fonction protocoleAuth existe et renvoie false, on stoppe tout
    if (typeof protocoleAuth === 'function' && !protocoleAuth()) {
        console.warn("Accès refusé par le protocole d'authentification.");
        return;
    }

    // Éléments du DOM
    const adminInvitesList = document.getElementById('adminInvitesList');
    const statTotal = document.getElementById('statTotal');
    const statPresent = document.getElementById('statPresent');
    const statTables = document.getElementById('statTables');
    const scanResult = document.getElementById('scanResult');
    const startScanBtn = document.getElementById('startScanBtn');
    const addGuestForm = document.getElementById('addGuestForm');
    const searchBar = document.getElementById('searchBar');

    let allInvites = [];
    let html5QrcodeScanner = null;

   
    window.renderTable = (invites) => {
        // Récupération dynamique de l'élément tbody
        const targetList = document.getElementById('adminInvitesList') || document.querySelector('tbody');
        if (!targetList) {
            console.error("Élément #adminInvitesList ou tbody introuvable dans le HTML !");
            return;
        }
        targetList.innerHTML = '';

        if (!invites || !Array.isArray(invites) || invites.length === 0) {
            targetList.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; color: #94a3b8; padding: 20px;">
                        Aucun invité trouvé.
                    </td>
                </tr>`;
            return;
        }
        
    invites.forEach(inv => {
        const tr = document.createElement('tr');
        
        // Gestion souple du nom (supporte "nom", "prenom", ou les deux)
        const namePart = [inv.prenom, inv.nom].filter(Boolean).join(' ');
        const fullName = namePart || inv.nom || 'Sans nom';
        
        const rawStatus = String(inv.presence || '').toLowerCase();
let presenceStatus = 'En attente';

if (rawStatus === 'pending') {
    presenceStatus = 'En attente';
} else if (rawStatus.includes('oui') || rawStatus === 'confirmed' || rawStatus === 'present') {
    presenceStatus = 'Confirmé';
} else if (rawStatus.includes('non') || rawStatus === 'declined') {
    presenceStatus = 'Absent';
}

const isConfirmed = presenceStatus === 'Confirmé';

        tr.innerHTML = `
            <td><strong>${fullName}</strong></td>
            <td>
                <span style="color: ${isConfirmed ? '#16a34a' : '#eab308'}; font-weight: 500;">
                    ${presenceStatus}
                </span>
            </td>
            <td>${inv.boisson || 'Non spécifié'}</td>
            <td>
                <input type="text" class="table-input" id="table-${inv.id}" value="${inv.table || ''}" placeholder="Non assignée">
            </td>
            <td>
                <span style="color: ${inv.scanned ? '#16a34a' : '#94a3b8'}; font-weight: bold;">
                    ${inv.scanned ? '✅ Entré' : '❌ Non scanné'}
                </span>
            </td>
            <td>
                <button class="btn-sm" style="background: #2563eb; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;" title="Modifier" onclick="editInvite('${inv.id}')">✏️</button>
                <button class="btn-sm" style="background: #d4af37; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;" title="Sauvegarder" onclick="saveTable('${inv.id}')">💾</button>
                <button class="btn-sm" style="background: #dc2626; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;" title="Supprimer" onclick="deleteInvite('${inv.id}')">🗑️</button>
            </td>
        `;
        targetList.appendChild(tr);
    });
};

window.loadAdminData = async () => {
    try {
        const res = await fetch('/api/admin/invites');
        if (!res.ok) {
            console.error("Erreur HTTP lors du fetch :", res.status);
            return;
        }

        const data = await res.json();
        allInvites = data;

        let presentCount = 0;
        let tablesCount = 0;

        allInvites.forEach(inv => {
            if (inv.scanned) presentCount++;
            const t = String(inv.table || '').trim();
            if (t && t !== 'Non assignée') tablesCount++;
        });

        const statTotal = document.getElementById('statTotal');
        const statPresent = document.getElementById('statPresent');
        const statTables = document.getElementById('statTables');

        if (statTotal) statTotal.innerText = allInvites.length;
        if (statPresent) statPresent.innerText = presentCount;
        if (statTables) statTables.innerText = tablesCount;

        window.renderTable(allInvites);
    } catch (err) {
        console.error("Erreur lors du chargement des données :", err);
    }
};

// 3. Lancement automatique au chargement
document.addEventListener('DOMContentLoaded', () => {
    if (typeof protocoleAuth === 'function' && !protocoleAuth()) return;
    window.loadAdminData();
});

// 3. Lancement automatique au chargement
document.addEventListener('DOMContentLoaded', () => {
    if (typeof protocoleAuth === 'function' && !protocoleAuth()) return;
    window.loadAdminData();
});

    // --- 3. RECHERCHE EN TEMPS RÉEL ---
    if (searchBar) {
        searchBar.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase().trim();
            const filtered = allInvites.filter(inv => 
                (inv.prenom && inv.prenom.toLowerCase().includes(term)) || 
                (inv.nom && inv.nom.toLowerCase().includes(term)) ||
                (inv.title && inv.title.toLowerCase().includes(term))
            );
            renderTable(filtered);
        });
    }

    // --- 4. FORMULAIRE D'AJOUT D'INVITÉ VIP (AVEC CIVILITÉ) ---
    if (addGuestForm) {
        addGuestForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const titleInput = document.getElementById('addTitle');
            const prenomInput = document.getElementById('addPrenom');
            const nomInput = document.getElementById('addNom');
            const tableInput = document.getElementById('addTable');

            const title = titleInput ? titleInput.value : 'Monsieur';
            const prenom = prenomInput ? prenomInput.value.trim() : '';
            const nom = nomInput ? nomInput.value.trim() : '';
            const table = tableInput ? tableInput.value.trim() : '';

            try {
                const res = await fetch('/api/admin/add-guest', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title, prenom, nom, table })
                });

                const data = await res.json();

                if (res.ok) {
                    alert(`✅ Invité enregistré : ${title} ${prenom} ${nom}`);
                    prenomInput.value = '';
                    nomInput.value = '';
                    if (tableInput) tableInput.value = '';
                    if (searchBar) searchBar.value = '';
                    await loadAdminData();
                } else {
                    alert(`⚠️ ${data.error || 'Erreur lors du pré-enregistrement.'}`);
                }
            } catch (err) {
                alert('Erreur de connexion au serveur.');
            }
        });
    }

    // --- 5. FONCTIONS GLOBALES (MODIFIER, SAUVEGARDER TABLE, SUPPRIMER) ---

    window.editInvite = async (id) => {
        const invite = allInvites.find(i => i.id === id);
        if (!invite) return;
    
        const nouveauPrenom = prompt("Prénom de l'invité :", invite.prenom || "");
        const nouveauNom = prompt("Nom de l'invité :", invite.nom || "");
    
        if (nouveauPrenom === null && nouveauNom === null) return;
    
        try {
            const res = await fetch(`/api/admin/invites/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    prenom: nouveauPrenom ? nouveauPrenom.trim() : "",
                    nom: nouveauNom ? nouveauNom.trim() : ""
                })
            });
    
            if (res.ok) {
                loadAdminData();
            } else {
                alert("Erreur lors de la modification.");
            }
        } catch (err) {
            console.error("Erreur serveur :", err);
        }
    };
    

// Sauvegarder l'assignation de table
window.saveTable = async (id) => {
    const input = document.getElementById(`table-${id}`);
    if (!input) return;

    try {
        const res = await fetch('/api/admin/assign-table', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, table: input.value.trim() })
        });

        if (res.ok) {
            alert('Table enregistrée avec succès !');
            loadAdminData();
        } else {
            alert("Erreur lors de l'assignation de la table.");
        }
    } catch (err) {
        alert('Erreur de connexion au serveur.');
    }
};

// Supprimer un invité
window.deleteInvite = async (id) => {
    const invite = allInvites.find(i => i.id === id);
    const nomAffiche = invite ? invite.nom : "";

    if (!confirm(`Voulez-vous vraiment supprimer ${nomAffiche} ?`)) return;

    try {
        const res = await fetch(`/api/admin/delete-guest/${id}`, { method: 'DELETE' });
        if (res.ok) {
            loadAdminData();
        } else {
            alert("Erreur lors de la suppression.");
        }
    } catch (err) {
        console.error("Erreur serveur :", err);
    }
};


    // --- 6. GESTION DU SCANNER QR CODE ---
    const onScanSuccess = async (decodedText) => {
        try {
            const res = await fetch('/api/admin/scan-qr', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: decodedText })
            });

            const data = await res.json();
            
            if (!scanResult) return;
            scanResult.classList.remove('hidden', 'scan-valid', 'scan-used', 'scan-invalid');

            if (data.status === 'VALID') {
                scanResult.classList.add('scan-valid');
                scanResult.innerHTML = `
                    🎉 <strong>Accès Autorisé !</strong><br>
                    ${data.invite.title || ''} ${data.invite.prenom} ${data.invite.nom}<br>
                    Table : <strong>${data.invite.table || 'Non assignée'}</strong>
                `;
            } else if (data.status === 'ALREADY_USED') {
                scanResult.classList.add('scan-used');
                scanResult.innerHTML = `
                    ⚠️ <strong>Pass déjà utilisé !</strong><br>
                    Scanné précédemment à : ${data.scannedAt}
                `;
            } else {
                scanResult.classList.add('scan-invalid');
                scanResult.innerHTML = `❌ <strong>PASS INVALIDE !</strong>`;
            }

            loadAdminData();
        } catch (err) {
            console.error('Erreur lors du scan du QR Code :', err);
        }
    };

    if (startScanBtn) {
        startScanBtn.addEventListener('click', () => {
            if (!html5QrcodeScanner) {
                html5QrcodeScanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 });
                html5QrcodeScanner.render(onScanSuccess);
                startScanBtn.innerText = "🛑 Scanner Actif";
            }
        });
    }

    // CHARGEMENT INITIAL DE LA LISTE DES INVITÉS
    loadAdminData();

});

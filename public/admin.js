document.addEventListener('DOMContentLoaded', () => {

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

    // --- 1. RENDU DU TABLEAU D'INVITÉS ---
    const renderTable = (invites) => {
        if (!adminInvitesList) return;
        adminInvitesList.innerHTML = '';

        if (invites.length === 0) {
            adminInvitesList.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; color: #94a3b8; padding: 20px;">
                        Aucun invité trouvé.
                    </td>
                </tr>`;
            return;
        }

        invites.forEach(inv => {
            const tr = document.createElement('tr');
            
            // Formatage de l'affichage avec la Civilité (Titre)
            const fullTitle = inv.title ? `${inv.title} ` : '';
            const fullName = `${fullTitle}${inv.prenom} ${inv.nom}`;

            tr.innerHTML = `
                <td><strong>${fullName}</strong></td>
                <td>
                    <span style="color: ${inv.confirmed ? '#16a34a' : '#eab308'}; font-weight: 500;">
                        ${inv.confirmed ? `Confirmé (${inv.presence})` : 'En attente'}
                    </span>
                </td>
                <td>${inv.boisson || 'Non spécifié'}</td>
                <td>
                    <input type="text" class="table-input" id="table-${inv.id}" value="${inv.table || ''}" placeholder="Ex: Table 1">
                </td>
                <td>
                    <span style="color: ${inv.scanned ? '#16a34a' : '#94a3b8'}; font-weight: bold;">
                        ${inv.scanned ? `✓ Entré (${inv.scannedAt || ''})` : 'Non scanné'}
                    </span>
                </td>
                <td>
                    <button class="btn-sm" style="background: #2563eb;" title="Modifier" onclick="editGuest('${inv.id}', '${inv.prenom}', '${inv.nom}', '${inv.title || 'Monsieur'}')">✏️</button>
                    <button class="btn-sm" style="background: #d4af37;" title="Sauvegarder la table" onclick="saveTable('${inv.id}')">💾</button>
                    <button class="btn-sm" style="background: #dc2626;" title="Supprimer" onclick="deleteGuest('${inv.id}', '${inv.prenom} ${inv.nom}')">🗑️</button>
                </td>
            `;
            adminInvitesList.appendChild(tr);
        });
    };

    // --- 2. CHARGEMENT DES DONNÉES DU SERVEUR ---
    const loadAdminData = async () => {
        try {
            const res = await fetch('/api/admin/invites');
            allInvites = await res.json();

            let presentCount = 0;
            let tablesCount = 0;

            allInvites.forEach(inv => {
                if (inv.scanned) presentCount++;
                if (inv.table && inv.table !== 'Non assignée' && inv.table.trim() !== '') tablesCount++;
            });

            // Mise à jour des compteurs du Dashboard
            if (statTotal) statTotal.innerText = allInvites.length;
            if (statPresent) statPresent.innerText = presentCount;
            if (statTables) statTables.innerText = tablesCount;

            renderTable(allInvites);
        } catch (err) {
            console.error('Erreur de chargement des données admin :', err);
        }
    };

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

    // Modifier les infos d'un invité
    window.editGuest = async (id, currentPrenom, currentNom, currentTitle) => {
        const newTitle = prompt("Civilité (Monsieur, Madame, Mr & Mme) :", currentTitle);
        const newPrenom = prompt("Nouveau prénom :", currentPrenom);
        const newNom = prompt("Nouveau nom :", currentNom);

        if (newPrenom && newNom) {
            try {
                const res = await fetch(`/api/admin/update-guest/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title: newTitle, prenom: newPrenom, nom: newNom })
                });

                if (res.ok) {
                    loadAdminData();
                } else {
                    alert('Erreur lors de la modification.');
                }
            } catch (err) {
                alert('Erreur réseau.');
            }
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
                alert('Erreur lors de l’assignation de la table.');
            }
        } catch (err) {
            alert('Erreur de connexion au serveur.');
        }
    };

    // Supprimer un invité
    window.deleteGuest = async (id, name) => {
        if (confirm(`Voulez-vous vraiment supprimer ${name} ?`)) {
            try {
                const res = await fetch(`/api/admin/delete-guest/${id}`, { method: 'DELETE' });
                if (res.ok) {
                    loadAdminData();
                } else {
                    alert('Erreur lors de la suppression.');
                }
            } catch (err) {
                alert('Erreur réseau.');
            }
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

    // Chargement initial des données au démarrage de la page
    loadAdminData();
});

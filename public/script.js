document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // 1. GESTION DE LA MUSIQUE DE FOND
    // ==========================================
    const musicBtn = document.getElementById('musicBtn');
    const bgMusic = document.getElementById('bgMusic');
    let isPlaying = false;

    if (musicBtn && bgMusic) {
        musicBtn.addEventListener('click', () => {
            if (isPlaying) {
                bgMusic.pause();
                musicBtn.innerText = '🎵 Jouer la musique';
            } else {
                bgMusic.play().then(() => {
                    musicBtn.innerText = '⏸️ Pause';
                }).catch(err => {
                    console.error("Erreur de lecture audio :", err);
                });
            }
            isPlaying = !isPlaying;
        });
    }

    // ==========================================
    // 2. COMPTE À REBOURS (COUNTDOWN)
    // ==========================================
    // Target : 13 Septembre 2026 à 19h30
    const targetDate = new Date('2026-09-13T19:30:00').getTime();

    const updateCountdown = () => {
        const now = new Date().getTime();
        const difference = targetDate - now;

        if (difference > 0) {
            const days = Math.floor(difference / (1000 * 60 * 60 * 24));
            const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((difference % (1000 * 60)) / 1000);

            const daysEl = document.getElementById('days');
            const hoursEl = document.getElementById('hours');
            const minutesEl = document.getElementById('minutes');
            const secondsEl = document.getElementById('seconds');

            if (daysEl) daysEl.innerText = String(days).padStart(2, '0');
            if (hoursEl) hoursEl.innerText = String(hours).padStart(2, '0');
            if (minutesEl) minutesEl.innerText = String(minutes).padStart(2, '0');
            if (secondsEl) secondsEl.innerText = String(seconds).padStart(2, '0');
        }
    };

    setInterval(updateCountdown, 1000);
    updateCountdown();

    // ==========================================
    // 3. CHARGEMENT DU LIVRE D'OR
    // ==========================================
    const messagesList = document.getElementById('messagesList');

    const loadGuestbook = async () => {
        if (!messagesList) return;

        try {
            const res = await fetch('/api/livre-dor');
            const messages = await res.json();
            
            messagesList.innerHTML = '';

            if (!messages || messages.length === 0) {
                messagesList.innerHTML = '<p style="color: #94a3b8; grid-column: 1/-1; text-align: center;">Soyez le premier à laisser un message !</p>';
                return;
            }

            messages.forEach(item => {
                const card = document.createElement('div');
                card.className = 'guest-card';
                card.innerHTML = `<strong>${item.nom} ${item.prenom || ''}</strong><p>"${item.message}"</p>`;
                messagesList.appendChild(card);
            });
        } catch (err) {
            console.error('Erreur chargement livre d\'or:', err);
        }
    };

    // ==========================================
    // 4. SOUMISSION DU FORMULAIRE RSVP
    // ==========================================
    const rsvpForm = document.getElementById('rsvpForm');
    const confirmationResult = document.getElementById('confirmationResult');
    const qrCodeImg = document.getElementById('qrCodeImg');
    const guestFullName = document.getElementById('guestFullName');

    if (rsvpForm) {
        rsvpForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const prenom = document.getElementById('prenom').value.trim();
            const nom = document.getElementById('nom').value.trim();
            const presence = document.getElementById('presence').value;
            const boisson = document.getElementById('boisson').value;
            const message = document.getElementById('message').value.trim();

            const data = { prenom, nom, presence, boisson, message };

            try {
                const res = await fetch('/api/rsvp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });

                const result = await res.json();

                if (res.ok) {
                    // Mettre à jour le pass invité
                    if (qrCodeImg) qrCodeImg.src = result.invite.qrCode;
                    if (guestFullName) guestFullName.innerText = `${prenom} ${nom}`;

                    // Afficher la zone de confirmation
                    if (confirmationResult) confirmationResult.classList.remove('hidden');

                    // Réinitialiser le formulaire & recharger le livre d'or
                    rsvpForm.reset();
                    loadGuestbook();

                    // Faire défiler vers le pass généré
                    confirmationResult.scrollIntoView({ behavior: 'smooth' });
                } else {
                    alert(result.error || 'Une erreur est survenue lors de l\'enregistrement.');
                }
            } catch (err) {
                console.error("Erreur serveur :", err);
                alert('Impossible de contacter le serveur.');
            }
        });
    }

    // ==========================================
    // 5. TÉLÉCHARGEMENT DU PASS PDF (html2pdf.js)
    // ==========================================
    const downloadPdfBtn = document.getElementById('downloadPdfBtn');

    if (downloadPdfBtn) {
        downloadPdfBtn.addEventListener('click', () => {
            const ticketElement = document.getElementById('ticketToPrint');

            if (!ticketElement) {
                alert("Erreur : Impossible de trouver le ticket à imprimer.");
                return;
            }

            const originalBtnText = downloadPdfBtn.innerText;
            downloadPdfBtn.innerText = "⏳ Génération du PDF...";
            downloadPdfBtn.disabled = true;

            const options = {
                margin:       [10, 10, 10, 10],
                filename:     'Pass_VIP_Franchou_et_David.pdf',
                image:        { type: 'jpeg', quality: 0.98 },
                html2canvas:  { 
                    scale: 2, 
                    useCORS: true, 
                    logging: false,
                    scrollX: 0,
                    scrollY: 0
                },
                jsPDF:        { unit: 'mm', format: 'a5', orientation: 'portrait' }
            };

            html2pdf().set(options).from(ticketElement).save().then(() => {
                downloadPdfBtn.innerText = originalBtnText;
                downloadPdfBtn.disabled = false;
            }).catch(err => {
                console.error("Erreur génération PDF :", err);
                alert("Erreur lors de la création du PDF.");
                downloadPdfBtn.innerText = originalBtnText;
                downloadPdfBtn.disabled = false;
            });
        });
    }

    // Premier chargement des messages du livre d'or
    loadGuestbook();
});

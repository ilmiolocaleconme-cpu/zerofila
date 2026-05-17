// onboarding.js
import { supabaseClient } from './supabase.js';

const selectRistorante = document.getElementById("select-ristorante");
const logoInput = document.getElementById("logo-ristorante");
const menuInput = document.getElementById("foto-menu");
const checkQrGenerico = document.getElementById("check-qr-generico");
const numTavoliInput = document.getElementById("num-tavoli-qr");
const btnAvvia = document.getElementById("btn-avvia-onboarding");
const statusDiv = document.getElementById("status");
const qrPreviewBox = document.getElementById("qr-preview-box");
const titleQrBox = document.getElementById("title-qr-box");

let listaLocaliCompleta = [];

/**
 * Recupera l'elenco completo dei ristoranti inseriti nel SaaS per popolare il menu a tendina
 */
async function caricaRistoranti() {
    try {
        const { data: ristoranti, error } = await supabaseClient
            .from("ristoranti")
            .select("*")
            .order("nome", { ascending: true });

        if (error) throw error;
        listaLocaliCompleta = ristoranti;

        selectRistorante.innerHTML = '<option value="">-- Seleziona un ristorante --</option>';
        ristoranti.forEach(locale => {
            const option = document.createElement("option");
            option.value = locale.id;
            option.textContent = locale.nome;
            selectRistorante.appendChild(option);
        });
    } catch (err) {
        console.error("Errore lettura ristoranti:", err);
        selectRistorante.innerHTML = '<option value="">Errore caricamento locali</option>';
    }
}

/**
 * Gestisce l'upload sicuro del Logo aziendale nel bucket pubblico 'assets' di Supabase
 */
async function uploadLogoA_Storage(file, locale) {
    const fileExt = file.name.split('.').pop();
    const fileName = `${locale.slug}-logo-${Date.now()}.${fileExt}`;
    const filePath = `loghi/${fileName}`;

    // Upload fisico del file binary nel bucket di Supabase
    const { error: uploadError } = await supabaseClient.storage
        .from('assets')
        .upload(filePath, file);

    if (uploadError) throw uploadError;

    // Estrazione dell'URL pubblico definitivo generato dal CDN
    const { data } = supabaseClient.storage
        .from('assets')
        .getPublicUrl(filePath);

    // Salva il link del logo direttamente nel record del ristorante
    const { error: updateError } = await supabaseClient
        .from("ristoranti")
        .update({ logo: data.publicUrl })
        .eq("id", locale.id);

    if (updateError) throw updateError;
    return data.publicUrl;
}

/**
 * Genera vettorialmente i QR Code a schermo senza subire rallentamenti di memoria
 */
function generaQrKitGrafico(locale, generaGenerico, numeroTavoli) {
    qrPreviewBox.innerHTML = "";
    titleQrBox.style.display = "block";
    const hiddenGen = document.getElementById("qr-hidden-generator");

    const baseLink = `https://zerofila.it{locale.slug}`;

    // 1. Generazione del QR Code Generico (Social, Packaging, Asporto)
    if (generaGenerico === "si") {
        const card = document.createElement("div");
        card.className = "qr-card";
        card.innerHTML = `<strong>🔗 QR GENERICO</strong><br><div id="qr-gen-target"></div><span style="font-size:0.7rem; color:var(--color-pronto);">${locale.slug}</span>`;
        qrPreviewBox.appendChild(card);
        
        hiddenGen.innerHTML = "";
        new QRCode(hiddenGen, { text: baseLink, width: 150, height: 150 });
        setTimeout(() => { 
            const img = hiddenGen.querySelector("img");
            if (img) document.getElementById("qr-gen-target").appendChild(img.cloneNode(true)); 
        }, 100);
    }

    // 2. Generazione controllata e sequenziale dei QR Code dei singoli tavoli sala
    if (numeroTavoli > 0) {
        for (let i = 1; i <= numeroTavoli; i++) {
            const tavoloLink = `${baseLink}?tavolo=${i}`;
            const cardTavolo = document.createElement("div");
            cardTavolo.className = "qr-card";
            
            const targetId = `qr-tavolo-target-${i}`;
            cardTavolo.innerHTML = `<strong>🪑 TAVOLO ${i}</strong><br><div id="${targetId}"></div><span style="font-size:0.7rem; color:var(--text-muted);">?tavolo=${i}</span>`;
            qrPreviewBox.appendChild(cardTavolo);

            // Utilizziamo un micro-timeout scalato per non sovraccaricare il motore grafico del browser
            setTimeout(() => {
                const tempDiv = document.createElement("div");
                new QRCode(tempDiv, { text: tavoloLink, width: 150, height: 150 });
                setTimeout(() => {
                    const img = tempDiv.querySelector("img");
                    if (img) document.getElementById(targetId).appendChild(img);
                }, 50);
            }, i * 80);
        }
    }
}

/**
 * Event Listener Principale di Esecuzione Onboarding Amministratore
 */
btnAvvia.onclick = async () => {
    const ristoranteId = selectRistorante.value;
    const logoFile = logoInput.files[0];
    const menuFile = menuInput.files[0];
    const generaGenerico = checkQrGenerico.value;
    const numeroTavoli = parseInt(numTavoliInput.value) || 0;

    if (!ristoranteId) return alert("Seleziona il ristorante su cui lavorare!");

    const localeSelezionato = listaLocaliCompleta.find(r => r.id === ristoranteId);
    
    statusDiv.style.display = "block";
    statusDiv.style.background = "rgba(234, 179, 8, 0.1)";
    statusDiv.style.color = "#eab308";
    statusDiv.style.border = "1px solid #eab308";
    statusDiv.innerHTML = "⏳ Avvio configurazione avanzata SuperAdmin...<br>";

    btnAvvia.disabled = true;

    try {
        // STEP 1: Upload e Collegamento del Logo del ristorante
        if (logoFile) {
            statusDiv.innerHTML += "🖼️ Upload del logo aziendale in corso...<br>";
            await uploadLogoA_Storage(logoFile, localeSelezionato);
            statusDiv.innerHTML += "✅ Logo inserito nello storage pubblico e collegato al locale.<br>";
        }

        // STEP 2: Calcolo visivo dei QR Code a schermo
        if (generaGenerico === "si" || numeroTavoli > 0) {
            statusDiv.innerHTML += "📐 Generazione grafica del QR-Kit in corso...<br>";
            generaQrKitGrafico(localeSelezionato, generaGenerico, numeroTavoli);
            statusDiv.innerHTML += "✅ QR Code pronti e visualizzati a schermo.<br>";
        }

        // STEP 3: Spinta dell'immagine del menù verso GPT-4o Vision (Asincrona)
        if (menuFile) {
            statusDiv.innerHTML += "🧠 Invio immagine a GPT-4o Vision per la digitalizzazione del listino... (Attendi circa 10-15 secondi)<br>";
            
            const reader = new FileReader();
            reader.readAsDataURL(menuFile);
            reader.onloadend = async () => {
                const base64String = reader.result.split(',')[1];

                try {
                    // Chiama la Edge Function centralizzata di Supabase
                    const response = await fetch("https://supabase.co", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            ristorante_id: ristoranteId,
                            immagine_base64: base64String
                        })
                    });

                    const result = await response.json();
                    
                    if (response.ok && result.status === "success") {
                        mostraSuccessoFinale();
                    } else {
                        throw new Error(result.error || "Errore scrittura record menu.");
                    }
                } catch (apiErr) {
                    mostraErroreFinale(apiErr.message);
                }
            };
        } else {
            // Se non c'era nessun menù da scannerizzare, chiude l'onboarding (es: caricamento solo del logo/QR)
            mostraSuccessoFinale();
        }

    } catch (err) {
        mostraErroreFinale(err.message);
    }
};

function mostraSuccessoFinale() {
    statusDiv.style.background = "rgba(46, 196, 182, 0.1)";
    statusDiv.style.color = "#2ec4b6";
    statusDiv.style.border = "1px solid #2ec4b6";
    statusDiv.innerHTML += "<br>🏆 <strong>ONBOARDING COMPLETATO CON SUCCESSO!</strong> Il ristorante è configurato, le tabelle sono popolate e il locale è attivo su ZeroFila.";
    btnAvvia.disabled = false;
    menuInput.value = "";
    logoInput.value = "";
}

function mostraErroreFinale(msg) {
    statusDiv.style.background = "rgba(239, 68, 68, 0.1)";
    statusDiv.style.color = "#ef4444";
    statusDiv.style.border = "1px solid #ef4444";
    statusDiv.innerHTML += `<br>❌ <strong>Errore critico durante l'operazione:</strong> ${msg}`;
    btnAvvia.disabled = false;
}

// Avvia il caricamento iniziale dei locali registrati
caricaRistoranti();

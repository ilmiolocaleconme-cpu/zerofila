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

const linksBox = document.getElementById("links-ristoratore-box");
const linkUtenteTarget = document.getElementById("link-utente-target");
const linkCucinaTarget = document.getElementById("link-cucina-target");

let listaLocaliCompleta = [];

async function caricaRistoranti() {
    try {
        const { data: ristoranti, error } = await supabaseClient
            .from("ristoranti")
            .select("*")
            .order("nome", { ascending: true });

        if (error) throw error;
        listaLocaliCompleta = ristoranti || [];

        selectRistorante.innerHTML = '<option value="">-- Seleziona un ristorante --</option>';
        listaLocaliCompleta.forEach(locale => {
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

async function uploadLogoA_Storage(file, locale) {
    const fileExt = file.name.split('.').pop();
    const fileName = locale.slug + "-logo-" + Date.now() + "." + fileExt;
    const filePath = "loghi/" + fileName;

    const { error: uploadError } = await supabaseClient.storage
        .from('assets')
        .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data } = supabaseClient.storage
        .from('assets')
        .getPublicUrl(filePath);

    const { error: updateError } = await supabaseClient
        .from("ristoranti")
        .update({ logo: data.publicUrl })
        .eq("id", locale.id);

    if (updateError) throw updateError;
    return data.publicUrl;
}

function generaQrKitGrafico(locale, generaGenerico, numeroTavoli) {
    qrPreviewBox.innerHTML = "";
    titleQrBox.style.display = "block";
    const hiddenGen = document.getElementById("qr-hidden-generator");

    const baseLink = "https://vercel.app" + locale.slug;

    if (generaGenerico === "si") {
        const card = document.createElement("div");
        card.className = "qr-card";
        card.innerHTML = "<strong>🔗 QR GENERICO</strong><br><div id='qr-gen-target' style='display:flex; justify-content:center; margin:10px 0;'></div><span style='font-size:0.7rem; color:var(--color-pronto);'>" + locale.slug + "</span>";
        qrPreviewBox.appendChild(card);
        
        hiddenGen.innerHTML = "";
        new QRCode(hiddenGen, { text: baseLink, width: 150, height: 150 });
        setTimeout(() => { 
            const img = hiddenGen.querySelector("img");
            if (img) document.getElementById("qr-gen-target").appendChild(img.cloneNode(true)); 
        }, 150);
    }

    if (numeroTavoli > 0) {
        for (let i = 1; i <= numeroTavoli; i++) {
            const tavoloLink = baseLink + "&tavolo=" + i;
            const cardTavolo = document.createElement("div");
            cardTavolo.className = "qr-card";
            
            const targetId = "qr-tavolo-target-" + i;
            cardTavolo.innerHTML = "<strong>🪑 TAVOLO " + i + "</strong><br><div id='" + targetId + "' style='display:flex; justify-content:center; margin:10px 0;'></div><span style='font-size:0.7rem; color:var(--text-muted);'>?tavolo=" + i + "</span>";
            qrPreviewBox.appendChild(cardTavolo);

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

btnAvvia.onclick = async () => {
    const ristoranteId = selectRistorante.value;
    const logoFile = logoInput.files[0];
    const generaGenerico = checkQrGenerico.value;
    const numeroTavoli = parseInt(numTavoliInput.value) || 0;

    if (!ristoranteId) return alert("Seleziona il ristorante su cui lavorare!");

    const localeSelezionato = listaLocaliCompleta.find(r => r.id === ristoranteId);
    
    statusDiv.style.display = "block";
    statusDiv.style.background = "rgba(234, 179, 8, 0.1)";
    statusDiv.style.color = "#eab308";
    statusDiv.style.border = "1px solid #eab308";
    statusDiv.innerHTML = "⏳ Generazione configurazioni in corso...<br>";

    btnAvvia.disabled = true;

    try {
        // CORREZIONE STRUTTURALE DEFINITIVA CON LO SLASH INSERITO ALLA FINE DEL DOMINIO
        const urlMenuClienti = "https://vercel.app" + localeSelezionato.slug;
        const urlPannelloCucina = "https://vercel.app" + localeSelezionato.slug;
        
        linkUtenteTarget.href = urlMenuClienti;
        linkUtenteTarget.textContent = urlMenuClienti;
        
        linkCucinaTarget.href = urlPannelloCucina;
        linkCucinaTarget.textContent = urlPannelloCucina;
        
        if (linksBox) linksBox.style.display = "block";

        if (logoFile) {
            statusDiv.innerHTML += "🖼️ Upload del logo aziendale in corso...<br>";
            await uploadLogoA_Storage(logoFile, localeSelezionato);
            statusDiv.innerHTML += "✅ Logo inserito nello storage pubblico e collegato.<br>";
        }

        if (generaGenerico === "si" || numeroTavoli > 0) {
            statusDiv.innerHTML += "📐 Generazione grafica del QR-Kit in corso...<br>";
            generaQrKitGrafico(localeSelezionato, generaGenerico, numeroTavoli);
            statusDiv.innerHTML += "✅ QR Code pronti e visualizzati a schermo.<br>";
        }

        mostraSuccessoFinale();

    } catch (err) {
        mostraErroreFinale(err.message);
    }
};

function montreSuccessoFinale() { // Allineamento interno nomi funzioni
    mostraSuccessoFinale();
}

function mostraSuccessoFinale() {
    statusDiv.style.background = "rgba(16, 185, 129, 0.1)";
    statusDiv.style.color = "#10b981";
    statusDiv.style.border = "1px solid #10b981";
    statusDiv.innerHTML += "🚀 <strong>Onboarding completato! Collegamenti pronti per il commerciante.</strong><br>";
    btnAvvia.disabled = false;
}

function mostraErroreFinale(messaggio) {
    statusDiv.style.display = "block";
    statusDiv.style.background = "rgba(239, 68, 68, 0.1)";
    statusDiv.style.color = "#ef4444";
    statusDiv.style.border = "1px solid #ef4444";
    statusDiv.innerHTML += "❌ <strong>ERRORE PROCEDURA:</strong> " + messaggio + "<br>";
    btnAvvia.disabled = false;
}

caricaRistoranti();

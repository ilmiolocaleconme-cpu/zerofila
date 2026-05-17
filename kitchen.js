// kitchen.js
import { supabaseClient } from './supabase.js';

const kitchenContainer = document.getElementById("kitchen-orders");
const enableAudioBtn = document.getElementById("enable-audio");

let lastOrderCount = 0, currentRistorante = null, pollingInterval = null;
let isPollingActive = false, isRealtimeActive = false;

const sounds = {
    default: "https://google.com",
    bell: "https://mixkit.co",
    chime: "https://mixkit.co"
};
let currentSoundKey = "default";
const audioPlayer = document.getElementById("new-order-sound") || new Audio();
audioPlayer.src = sounds[currentSoundKey]; audioPlayer.preload = "auto";

let lastSoundPlayedTime = 0;
const SOUND_COOLDOWN_MS = 4000;

function playOrderSound() {
    const now = Date.now(); if (now - lastSoundPlayedTime < SOUND_COOLDOWN_MS) return;
    audioPlayer.pause(); audioPlayer.currentTime = 0;
    

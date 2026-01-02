export class AudioManager {
    constructor() {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
        this.buffers = {};
        this.isMuted = false;
        
        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.value = 1.0;
        this.sfxGain.connect(this.ctx.destination);

        // Música (opcional, com try/catch para não travar)
        try {
            this.bgMusic = new Audio('/sounds/background_jazz.mp3');
            this.bgMusic.loop = true;
            this.bgMusic.volume = 0.08;
        } catch (e) {
            console.log("Música de fundo não configurada.");
        }
    }

    async loadSounds() {
        console.log("🔊 Iniciando carregamento dos sons...");
        const sounds = {
            'hit_hard': '/sounds/ball_hit_hard.mp3',
            'hit_soft': '/sounds/ball_hit_soft.mp3',
            'cushion':  '/sounds/cushion_hit.mp3',
            'cue':      '/sounds/cue_hit.mp3',
            'pocket':   '/sounds/pocket_drop.mp3'
        };

        const promises = Object.entries(sounds).map(async ([name, url]) => {
            try {
                const res = await fetch(url);
                if (!res.ok) throw new Error(`Status ${res.status}`);
                const buffer = await res.arrayBuffer();
                this.buffers[name] = await this.ctx.decodeAudioData(buffer);
                console.log(`✅ Som carregado: ${name}`);
            } catch (err) {
                console.warn(`❌ ERRO ao carregar som [${name}]:`, err.message);
            }
        });

        await Promise.all(promises);
    }

    play(name, force = 1.0) {
        // Log para ver se o comando está chegando
        // console.log(`Tentando tocar: ${name}, Força: ${force}`); 

        if (this.isMuted) return;
        if (!this.buffers[name]) {
            // console.warn(`Som não encontrado na memória: ${name}`);
            return;
        }
        
        if (this.ctx.state === 'suspended') {
            this.ctx.resume().then(() => console.log("🔊 AudioContext ativado!"));
        }

        const source = this.ctx.createBufferSource();
        source.buffer = this.buffers[name];

        const gainNode = this.ctx.createGain();
        const volume = Math.max(0.1, Math.min(1.0, force)); 
        gainNode.gain.value = volume;

        source.playbackRate.value = 0.95 + (Math.random() * 0.1);

        source.connect(gainNode);
        gainNode.connect(this.sfxGain);
        source.start(0);
    }

    toggleMusic() {
        if (!this.bgMusic) return;
        if (this.bgMusic.paused) {
            this.bgMusic.play().catch(e => console.log("Interaja com a página primeiro"));
        } else {
            this.bgMusic.pause();
        }
    }
}

export const audioSystem = new AudioManager();
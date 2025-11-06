/* script.js */
'use strict';

// Wait for the DOM to be fully loaded before starting
document.addEventListener('DOMContentLoaded', () => {

    // --- DOM Elements ---
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');

    // UI Elements
    const scoreText = document.getElementById('scoreText');
    const coinText = document.getElementById('coinText');
    const distanceTimeText = document.getElementById('distanceTimeText');
    const heightText = document.getElementById('heightText');
    const coinIcon = document.getElementById('coinIcon');

    // Overlays
    const loadingOverlay = document.getElementById('loadingOverlay');
    const startOverlay = document.getElementById('startOverlay');
    const gameOverOverlay = document.getElementById('gameOverOverlay');
    const pauseOverlay = document.getElementById('pauseOverlay');

    // Overlay UI
    const finalScoreText = document.getElementById('finalScoreText');
    const finalCoinText = document.getElementById('finalCoinText');

    // Buttons
    const startButton = document.getElementById('startButton');
    const restartButton = document.getElementById('restartButton');
    const pauseButton = document.getElementById('pauseButton');
    const resumeButton = document.getElementById('resumeButton');

    // --- Game Configuration ---
    const CONFIG = {
        // Physics
        GRAVITY: 0.35,
        FLAP_STRENGTH: 6.5,
        BIRD_X_POSITION: 100,
        MAX_ROTATION: 5, // degrees
        MIN_ROTATION: -5, // degrees
        ROTATION_SPEED: 0.5,

        // Pipes
        PIPE_SPEED: 10,
        PIPE_WIDTH: 80,
        PIPE_GAP: 180, // Vertical gap
        PIPE_SPAWN_RATE: 120, // Frames between spawns

        // Coins
        COIN_SPAWN_CHANCE: 0.4, // 40% chance to spawn with pipes
        COIN_RADIUS: 20,
        COIN_GLOW: 20,

        // Scenery
        CLOUD_SPEED: 0.5,
        NUM_CLOUDS: 5,

        // Particles
        PARTICLE_COUNT: 15,
        PARTICLE_LIFE: 60, // frames
        PARTICLE_SPEED: 3,
    };

    // --- Asset Paths ---
    const ASSET_PATHS = {
        images: {
            bird: 'modi.png',
            pipe: 'pipe.png',
            coin: 'coin.png',
            cloud: 'cloud.png',
        },
        sounds: {
            flap: '.mp3',
            coin: 'coin.mp3',
            hit: 'hit.mp3',
            bg_music: 'coral-chorus.mp3'
        }
    };

    // --- Game State ---
    let gameState = 'loading'; // loading, start, playing, paused, over
    let score = 0;
    let coins = 0;
    let frame = 0;
    let countdownValue = 3;
    const FPS = 60;
    let assets = { images: {}, sounds: {} }; // Will hold loaded assets
    let fallbacks = { images: {}, sounds: {} }; // Will hold fallback drawing/sound functions

    // Game Objects
    let bird;
    let pipes = [];
    let coinsArray = [];
    let particles = [];
    let clouds = [];

    // --- Utility Functions ---
    const getRandom = (min, max) => Math.random() * (max - min) + min;
    const degToRad = (d) => d * (Math.PI / 180);

    // --- Asset Fallbacks ---
    // Functions to draw shapes if images fail to load
    fallbacks.images.bird = (ctx, x, y, w, h, rotation) => {
        ctx.save();
        ctx.translate(x + w / 2, y + h / 2);
        ctx.rotate(rotation);
        ctx.fillStyle = '#f0e68c'; // Yellow
        ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.fillStyle = 'white';
        ctx.fillRect(w / 4, -h / 4, 10, 10); // Eye
        ctx.fillStyle = 'orange';
        ctx.fillRect(w / 2, 0, 10, 5); // Beak
        ctx.restore();
    };

    fallbacks.images.pipe = (ctx, x, y, w, h) => {
        ctx.fillStyle = '#2e7d32'; // Green
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, w, h);
    };

    fallbacks.images.coin = (ctx, x, y, r) => {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = '#ffd700'; // Gold
        ctx.fill();
        ctx.fillStyle = '#b8860b'; // Darker gold for detail
        ctx.fillText('$', x, y + r / 4, { font: `${r}px Arial`, textAlign: 'center' });
    };

    fallbacks.images.cloud = (ctx, x, y, w, h) => {
        ctx.beginPath();
        ctx.arc(x + w * 0.25, y + h * 0.5, w * 0.25, 0, Math.PI * 2);
        ctx.arc(x + w * 0.5, y + h * 0.3, w * 0.3, 0, Math.PI * 2);
        ctx.arc(x + w * 0.75, y + h * 0.5, w * 0.25, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.fill();
    };

    // Fallback for sound: just an empty function
    fallbacks.sounds.flap = () => { };
    fallbacks.sounds.coin = () => { };
    fallbacks.sounds.hit = () => { };
    fallbacks.sounds.bg_music = () => { };


    // --- Asset Loading ---
    function loadImage(src, fallback) {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => resolve(img);
            img.onerror = () => {
                console.warn(`Failed to load image: ${src}. Using fallback.`);
                resolve(fallback); // Resolve with the fallback function
            };
            img.src = src;
        });
    }

    function loadAudio(src, fallback) {
        return new Promise((resolve) => {
            const audio = new Audio();
            audio.crossOrigin = "anonymous";
            audio.oncanplaythrough = () => resolve(audio);
            audio.onerror = () => {
                console.warn(`Failed to load audio: ${src}. Using fallback.`);
                resolve(fallback); // Resolve with the fallback function
            };
            audio.src = src;
        });
    }

    function loadAudio(src, fallback) {
        return new Promise((resolve) => {
            const audio = new Audio();
            audio.crossOrigin = "anonymous";


            audio.oncanplaythrough = () => {

                if (src.includes('coral-chorus') || src.includes('bg_music')) {
                    audio.loop = true;
                }
                resolve(audio);
            };
            audio.onerror = () => {
                console.warn(`Failed to load audio: ${src}. Using fallback.`);
                resolve(fallback);
            };
            audio.src = src;

        });
    }

    async function loadAllAssets() {
        // Load Images
        const imagePromises = Object.entries(ASSET_PATHS.images).map(([key, path]) =>
            loadImage(path, fallbacks.images[key]).then(img => {
                assets.images[key] = img;
            })
        );

        // Load Sounds
        const soundPromises = Object.entries(ASSET_PATHS.sounds).map(([key, path]) =>
            loadAudio(path, fallbacks.sounds[key]).then(sound => {
                assets.sounds[key] = sound;
            })
        );

        await Promise.all([...imagePromises, ...soundPromises]);

        // Assets loaded, transition to start screen
        coinIcon.src = ASSET_PATHS.images.coin; // Update UI icon
        loadingOverlay.classList.add('hidden');
        startOverlay.classList.remove('hidden');
        gameState = 'start';

        // Start the game loop (it will idle on 'start' screen)
        initGame();
        gameLoop();
    }

    // --- Sound Player ---
    function playSound(sound) {
        if (sound && typeof sound.play === 'function') {
            sound.currentTime = 0;
            sound.play().catch(e => console.warn("Audio play failed. User may need to interact first.", e));
        } else if (typeof sound === 'function') {
            sound(); // Call fallback function
        }
    }

    // --- Game Classes ---
    class Bird {
        constructor() {
            this.w = 80;
            this.h = 80;
            this.x = CONFIG.BIRD_X_POSITION;
            this.y = canvas.height / 2 - this.h / 2;
            this.vy = 0; // Vertical velocity
            this.rotation = 0;
            this.sprite = assets.images.bird;
        }

        update() {
            // Apply gravity
            this.vy += CONFIG.GRAVITY;
            this.y += this.vy;

            // Calculate rotation
            let targetRotation;
            if (this.vy < 0) { // Flapping up
                targetRotation = CONFIG.MIN_ROTATION;
            } else { // Falling down
                targetRotation = Math.min(this.vy * CONFIG.ROTATION_SPEED, CONFIG.MAX_ROTATION);
            }
            // Smoothly interpolate rotation
            this.rotation = (this.rotation + targetRotation) / 2;

            // Check for ground/sky collision
            if (this.y + this.h > canvas.height) { // Ground
                this.y = canvas.height - this.h;
                this.vy = 0;
                gameOver();
            }
            if (this.y < 0) { // Sky
                this.y = 0;
                this.vy = 0;
            }
        }

        draw() {
            ctx.save();
            ctx.translate(this.x + this.w / 2, this.y + this.h / 2);
            ctx.rotate(degToRad(this.rotation));

            if (typeof this.sprite === 'function') {
                // Use fallback drawing function
                this.sprite(ctx, -this.w / 2, -this.h / 2, this.w, this.h, 0); // Rotation is already applied
            } else {
                // Draw image
                ctx.drawImage(this.sprite, -this.w / 2, -this.h / 2, this.w, this.h);
            }
            ctx.restore();
        }

        flap() {
            this.vy = -CONFIG.FLAP_STRENGTH;
            playSound(assets.sounds.flap);
        }

        getRect() {
            return { x: this.x, y: this.y, width: this.w, height: this.h };
        }
    }

    class Pipe {
        constructor(isTop, x, gapY) {
            this.isTop = isTop;
            this.x = x;
            this.w = CONFIG.PIPE_WIDTH;
            this.sprite = assets.images.pipe;
            this.passed = false; // For scoring

            if (isTop) {
                this.y = 0;
                this.h = gapY - (CONFIG.PIPE_GAP / 2);
            } else {
                this.y = gapY + (CONFIG.PIPE_GAP / 2);
                this.h = canvas.height - this.y;
            }
        }

        update() {
            this.x -= CONFIG.PIPE_SPEED;
        }

        draw() {
            if (typeof this.sprite === 'function') {
                // Use fallback drawing function
                this.sprite(ctx, this.x, this.y, this.w, this.h);
            } else {
                // Draw image
                if (this.isTop) {
                    // Draw top pipe (rotated 180 deg)
                    ctx.save();
                    ctx.translate(this.x + this.w / 2, this.y + this.h / 2);
                    ctx.rotate(Math.PI); // Rotate 180 degrees
                    ctx.drawImage(this.sprite, -this.w / 2, -this.h / 2, this.w, this.h);
                    ctx.restore();
                } else {
                    // Draw bottom pipe (normal)
                    ctx.drawImage(this.sprite, this.x, this.y, this.w, this.h);
                }
            }
        }

        getRect() {
            return { x: this.x, y: this.y, width: this.w, height: this.h };
        }
    }

    class Coin {
        constructor(x, y) {
            this.x = x;
            this.y = y;
            this.r = CONFIG.COIN_RADIUS;
            this.sprite = assets.images.coin;
        }

        update() {
            this.x -= CONFIG.PIPE_SPEED;
        }

        draw() {
            // Apply bloom effect
            ctx.save();
            ctx.shadowBlur = CONFIG.COIN_GLOW;
            ctx.shadowColor = 'yellow';

            if (typeof this.sprite === 'function') {
                // Use fallback drawing function
                this.sprite(ctx, this.x, this.y, this.r);
            } else {
                // Draw image
                ctx.drawImage(this.sprite, this.x - this.r, this.y - this.r, this.r * 2, this.r * 2);
            }

            ctx.restore();
        }

        getRect() {
            return { x: this.x - this.r, y: this.y - this.r, width: this.r * 2, height: this.r * 2 };
        }
    }

    class Particle {
        constructor(x, y) {
            this.x = x;
            this.y = y;
            this.size = getRandom(2, 5);
            this.life = CONFIG.PARTICLE_LIFE;
            this.vx = getRandom(-CONFIG.PARTICLE_SPEED, CONFIG.PARTICLE_SPEED);
            this.vy = getRandom(-CONFIG.PARTICLE_SPEED, CONFIG.PARTICLE_SPEED);
            this.color = `rgba(255, 215, 0, ${this.life / CONFIG.PARTICLE_LIFE})`; // Gold
        }

        update() {
            this.x += this.vx;
            this.y += this.vy;
            this.vy += 0.1; // Slight gravity
            this.life--;
            this.color = `rgba(255, 215, 0, ${this.life / CONFIG.PARTICLE_LIFE})`;
        }

        draw() {
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    class Cloud {
        constructor(x, y, scale) {
            this.x = x;
            this.y = y;
            this.w = 120 * scale;
            this.h = 60 * scale;
            this.speed = CONFIG.CLOUD_SPEED * scale;
            this.sprite = assets.images.cloud;
        }

        update() {
            this.x -= this.speed;
            // Wrap around
            if (this.x + this.w < 0) {
                this.x = canvas.width + 50;
                this.y = getRandom(0, canvas.height / 3);
            }
        }

        draw() {
            ctx.globalAlpha = 0.7; // Make clouds semi-transparent
            if (typeof this.sprite === 'function') {
                this.sprite(ctx, this.x, this.y, this.w, this.h);
            } else {
                ctx.drawImage(this.sprite, this.x, this.y, this.w, this.h);
            }
            ctx.globalAlpha = 1.0;
        }
    }

    // --- Game Logic ---
    function initGame() {
        // Reset state
        score = 0;
        coins = 0;
        frame = -60;
        countdownValue = 3; // reset to 3 every time it starts
        pipes = [];
        coinsArray = [];
        particles = [];
        clouds = [];

        // Update UI
        scoreText.textContent = `SCORE: ${score}`;
        coinText.textContent = `x ${coins}`;
        distanceTimeText.textContent = `TIME: 0s`;
        heightText.textContent = `HEIGHT: 0px`;

        // Create initial objects
        bird = new Bird();
        for (let i = 0; i < CONFIG.NUM_CLOUDS; i++) {
            clouds.push(new Cloud(
                getRandom(0, canvas.width),
                getRandom(0, canvas.height / 3),
                getRandom(0.5, 1.2)
            ));
        }
    }

    function startGame() {
        initGame(); // Reset everything
        gameState = 'countdown';
        startOverlay.classList.add('hidden');
        gameOverOverlay.classList.add('hidden');
        pauseOverlay.classList.add('hidden');

        if (assets.sounds.bg_music && typeof assets.sounds.bg_music.play === 'function') {
            assets.sounds.bg_music.volume = 0.3;
            assets.sounds.bg_music.play().catch(e => console.warn("Background music play failed."));
        }
    }

    function gameOver() {
        if (gameState === 'over') return; // Prevent multiple calls
        gameState = 'over';
        playSound(assets.sounds.hit);
        screenShake();

        if (assets.sounds.bg_music && typeof assets.sounds.bg_music.pause === 'function') {
            assets.sounds.bg_music.pause();
            assets.sounds.bg_music.currentTime = 0; // Rewind to start
        }

        // Show game over screen
        finalScoreText.textContent = `Score: ${score}`;
        finalCoinText.textContent = `Coins: ${coins}`;
        gameOverOverlay.classList.remove('hidden');
    }

    function pauseGame() {
        if (gameState !== 'playing') return;
        gameState = 'paused';
        pauseOverlay.classList.remove('hidden');

        if (assets.sounds.bg_music && typeof assets.sounds.bg_music.pause === 'function') {
            assets.sounds.bg_music.pause();
        }
    }

    function resumeGame() {
        if (gameState !== 'paused') return;
        gameState = 'playing';
        pauseOverlay.classList.add('hidden');

        if (assets.sounds.bg_music && typeof assets.sounds.bg_music.play === 'function') {
            assets.sounds.bg_music.play().catch(e => console.warn("Background music resume failed."));
        }
    }

    function collectCoin(coin) {
        coins++;
        coinText.textContent = `x ${coins}`;
        playSound(assets.sounds.coin);
        createParticleBurst(coin.x, coin.y);

        // Remove coin
        coinsArray = coinsArray.filter(c => c !== coin);

        // Animate coin icon
        coinIcon.style.transform = 'scale(1.3)';
        setTimeout(() => {
            coinIcon.style.transform = 'scale(1)';
        }, 150);
    }

    function createParticleBurst(x, y) {
        for (let i = 0; i < CONFIG.PARTICLE_COUNT; i++) {
            particles.push(new Particle(x, y));
        }
    }

    function screenShake() {
        canvas.classList.add('shake');
        setTimeout(() => {
            canvas.classList.remove('shake');
        }, 300); // Duration of shake
    }

    function handleInput(e) {
        // Prevent default behavior (like scrolling on space/touch)
        if (e.type === 'keydown' && e.code === 'Space') e.preventDefault();
        if (e.type === 'touchstart') e.preventDefault();

        switch (gameState) {
            case 'start':
                startGame();
                bird.flap(); // Give an initial flap
                break;
            case 'playing':
                bird.flap();
                break;
            case 'over':
                // Restart is handled by button, not screen tap
                break;
        }
    }

    // --- Collision Detection ---
    function checkCollision(rect1, rect2) {
        return (
            rect1.x < rect2.x + rect2.width &&
            rect1.x + rect1.width > rect2.x &&
            rect1.y < rect2.y + rect2.height &&
            rect1.y + rect1.height > rect2.y
        );
    }

    // --- Game Loop Functions ---
    function update() {
        if (gameState === 'countdown') {
            frame++;
            if (frame % FPS === 0) { // हर 60 फ्रेम (1 सेकंड) पर
                if (countdownValue > 1) {
                    countdownValue--;
                } else {
                    gameState = 'playing'; // 1 के बाद 'GO!' स्टेट को छोड़ते हुए सीधे खेलना शुरू
                    frame = 0; // खेलने के लिए फ्रेम को 0 से शुरू करें
                }
                if (gameState !== 'playing') return;

                frame++;
                bird.update();

                // **[नया]** IN-GAME TIMER & HEIGHT DISPLAY
                const timeInSeconds = Math.floor(frame / FPS);
                distanceTimeText.textContent = `TIME: ${timeInSeconds}s`;

                // ऊँचाई: कैनवास के निचले किनारे (canvas.height) से बर्ड की दूरी
                const effectiveHeight = Math.max(0, canvas.height - bird.y - bird.h);
                heightText.textContent = `HEIGHT: ${Math.round(effectiveHeight)}px`;
            }
            // बर्ड को स्थिर रखें लेकिन बादल चलते रहें
            clouds.forEach(cloud => cloud.update());
            return;
        }


        // Handle game states that pause updates
        if (gameState !== 'playing') return;

        frame++;
        bird.update();

        // Update clouds
        clouds.forEach(cloud => cloud.update());

        // Update particles
        particles = particles.filter(p => p.life > 0);
        particles.forEach(p => p.update());

        // Update pipes
        pipes.forEach(pipe => pipe.update());

        // Update coins
        coinsArray.forEach(coin => coin.update());

        // Check for collisions
        const birdRect = bird.getRect();

        // Pipe collisions
        for (const pipe of pipes) {
            if (checkCollision(birdRect, pipe.getRect())) {
                gameOver();
                return; // Stop update on death
            }

            // Check for passing a pipe
            if (!pipe.passed && pipe.x + pipe.w < bird.x) {
                pipe.passed = true;
                // Only score for passing a pair (bottom pipe)
                if (!pipe.isTop) {
                    score++;
                    scoreText.textContent = `SCORE: ${score}`;
                }
            }
        }

        // Coin collisions
        for (const coin of coinsArray) {
            if (checkCollision(birdRect, coin.getRect())) {
                collectCoin(coin);
            }
        }

        // Remove off-screen objects
        pipes = pipes.filter(pipe => pipe.x + pipe.w > 0);
        coinsArray = coinsArray.filter(coin => coin.x + coin.r * 2 > 0);

        // Spawn new pipes (and possibly coins)
        if (frame % CONFIG.PIPE_SPAWN_RATE === 0) {
            const gapY = getRandom(CONFIG.PIPE_GAP, canvas.height - CONFIG.PIPE_GAP);
            const pipeX = canvas.width;

            pipes.push(new Pipe(true, pipeX, gapY)); // Top pipe
            pipes.push(new Pipe(false, pipeX, gapY)); // Bottom pipe

            // Chance to spawn a coin
            if (Math.random() < CONFIG.COIN_SPAWN_CHANCE) {
                coinsArray.push(new Coin(pipeX + CONFIG.PIPE_WIDTH / 2, gapY));
            }
        }
    }

    function draw() {
        // Clear canvas with a gradient background
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, '#00aaff'); // Sky blue
        gradient.addColorStop(1, '#0066cc'); // Deeper blue
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw game objects
        clouds.forEach(cloud => cloud.draw());
        pipes.forEach(pipe => pipe.draw());
        coinsArray.forEach(coin => coin.draw());
        particles.forEach(particle => particle.draw());

        // Don't draw bird if in 'loading' state
        if (gameState !== 'loading') {
            bird.draw();
        }
        if (gameState === 'countdown') {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'; // हल्का काला बैकग्राउंड
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            ctx.font = 'bold 150px Arial';
            ctx.textAlign = 'center';
            ctx.fillStyle = 'white';
            ctx.shadowColor = '#f0e68c'; // ग्लो इफ़ेक्ट
            ctx.shadowBlur = 20;

            const displayValue = countdownValue === 1 ? 'GO!' : countdownValue;
            
            ctx.fillText(displayValue, canvas.width / 2, canvas.height / 2 + 50);
            
            ctx.shadowBlur = 0; // ग्लो रीसेट करें
        }
    }

    function gameLoop() {
        update();
        draw();
        requestAnimationFrame(gameLoop);
    }

    // --- Event Listeners ---
    function setupEventListeners() {
        // Game Controls
        window.addEventListener('keydown', handleInput);
        canvas.addEventListener('mousedown', handleInput);
        canvas.addEventListener('touchstart', handleInput, { passive: false });

        // Button Clicks
        startButton.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent canvas click
            startGame();
        });

        restartButton.addEventListener('click', (e) => {
            e.stopPropagation();
            startGame();
        });

        pauseButton.addEventListener('click', (e) => {
            e.stopPropagation();
            if (gameState === 'playing') {
                pauseGame();
            } else if (gameState === 'paused') {
                resumeGame();
            }
        });

        resumeButton.addEventListener('click', (e) => {
            e.stopPropagation();
            resumeGame();
        });

        // Window Resize
        window.addEventListener('resize', () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            // Re-initialize game to adjust object positions if needed
            if (gameState !== 'loading') {
                initGame();
                if (gameState === 'over') {
                    gameOverOverlay.classList.remove('hidden');
                } else {
                    startOverlay.classList.remove('hidden');
                    gameState = 'start';
                }
            }
        });
    }

    // --- Initialization ---
    // Set initial canvas size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Setup listeners and load assets to start the game
    setupEventListeners();
    loadAllAssets();

});
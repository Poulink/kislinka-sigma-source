
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Player, Enemy, Platform, Projectile, Item } from './types';
import { GRAVITY, JUMP_FORCE, MOVE_SPEED, CANVAS_WIDTH, CANVAS_HEIGHT, ASSETS } from './constants';

const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'menu' | 'levelSelect' | 'playing' | 'gameover' | 'win' | 'cutscene' | 'reward'>('menu');
  const [currentLevel, setCurrentLevel] = useState(0);
  const [playerHp, setPlayerHp] = useState(3);
  const [playerAmmo, setPlayerAmmo] = useState(12);
  const [activeWeapon, setActiveWeapon] = useState<'gun' | 'rod' | 'trident'>('gun');
  const [dialogText, setDialogText] = useState<string | null>(null);
  const [infiniteAmmoTimer, setInfiniteAmmoTimer] = useState(0);
  
  const audioCtx = useRef<AudioContext | null>(null);
  const aimAngle = useRef(0);
  const frameCount = useRef(0);
  const screenShake = useRef(0);
  const landSquash = useRef(1);
  const activeHookPoint = useRef<{x: number, y: number} | null>(null);
  const rewardPos = useRef({ x: 0, y: 0, alpha: 0 });

  const playerRef = useRef<Player>({
    x: 50, y: 500, width: 45, height: 45, vx: 0, vy: 0,
    isJumping: false, isFacingLeft: false, score: 0, health: 3,
    ammo: 12, hasGun: true, activeWeapon: 'gun', isFireTrident: false
  });

  const keys = useRef<Record<string, boolean>>({});
  const enemiesRef = useRef<Enemy[]>([]);
  const projectilesRef = useRef<Projectile[]>([]);
  const itemsRef = useRef<Item[]>([]);
  const platformsRef = useRef<Platform[]>([]);
  const goalRef = useRef({ x: 750, y: 100, width: 60, height: 60 });
  const images = useRef<Record<string, HTMLImageElement>>({});

  const isImageValid = (img: HTMLImageElement | undefined) => img && img.complete && img.naturalWidth !== 0;

  const playSound = (type: 'jump' | 'hurt' | 'shoot' | 'hook' | 'trident' | 'pickup') => {
    try {
      if (!audioCtx.current) audioCtx.current = new AudioContext();
      const ctx = audioCtx.current;
      if (ctx.state === 'suspended') ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      const now = ctx.currentTime;
      
      if (type === 'jump') {
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.1);
        gain.gain.setValueAtTime(0.05, now);
        osc.start(); osc.stop(now + 0.1);
      } else if (type === 'shoot') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(400, now);
        gain.gain.setValueAtTime(0.02, now);
        osc.start(); osc.stop(now + 0.05);
      } else if (type === 'pickup' || type === 'trident') {
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.linearRampToValueAtTime(880, now + 0.2);
        gain.gain.setValueAtTime(0.05, now);
        osc.start(); osc.stop(now + 0.2);
      }
    } catch (e) {}
  };

  const spawnAmmo = useCallback(() => {
    const validPlatforms = platformsRef.current.filter(p => p.width > 50);
    if (validPlatforms.length === 0) return;
    const plat = validPlatforms[Math.floor(Math.random() * validPlatforms.length)];
    itemsRef.current.push({
      x: plat.x + Math.random() * (plat.width - 30),
      y: plat.y - 35,
      width: 30, height: 30, vx: 0, vy: 0, active: true, type: 'ammo'
    });
  }, []);

  const initLevel = useCallback((levelIdx: number) => {
    setPlayerHp(3);
    setPlayerAmmo(12);
    setDialogText(null);
    setInfiniteAmmoTimer(0);
    setGameState('playing');
    
    activeHookPoint.current = null;
    playerRef.current = { 
        ...playerRef.current, x: 50, y: 400, vx: 0, vy: 0, isJumping: false,
        activeWeapon: levelIdx === 9 ? 'trident' : (levelIdx >= 7 ? 'rod' : 'gun')
    };
    setActiveWeapon(playerRef.current.activeWeapon);
    projectilesRef.current = [];
    enemiesRef.current = [];
    platformsRef.current = [];
    itemsRef.current = [];

    const colors = ['#4ade80', '#fbbf24', '#f87171', '#60a5fa', '#a78bfa', '#f472b6'];

    if (levelIdx === 1 || levelIdx === 6) { 
      platformsRef.current = [{ x: 0, y: 580, width: 800, height: 20, color: '#fef3c7' }];
      enemiesRef.current = [{ 
        x: 400, y: 200, width: 140, height: 140, vx: 3, vy: 1, 
        type: 'boss', direction: 1, isDead: false, 
        hp: levelIdx === 1 ? 40 : 70, maxHp: levelIdx === 1 ? 40 : 70 
      }];
      goalRef.current = { x: 720, y: 500, width: 60, height: 60 };
    } 
    else if (levelIdx === 9) { 
      setGameState('cutscene');
      platformsRef.current = [{ x: 0, y: 550, width: 800, height: 50, color: '#111' }];
      enemiesRef.current = [{ 
        x: 600, y: 350, width: 180, height: 180, vx: 0, vy: 0, 
        type: 'king', direction: -1, isDead: false, hp: 150, maxHp: 150 
      }];
      goalRef.current = { x: -200, y: -200, width: 0, height: 0 };
      setTimeout(() => setDialogText("ТЫ ПРИШЕЛ ЗА СИЛОЙ..."), 1000);
      setTimeout(() => setDialogText("ГЛАВНЫЙ КИСЛИНКА: ПОКАЖИ, НА ЧТО ТЫ СПОСОБЕН!"), 3000);
      setTimeout(() => { setDialogText(null); setGameState('playing'); }, 5000);
    }
    else {
      const c = colors[levelIdx % colors.length];
      platformsRef.current = [
        { x: 0, y: 580, width: 250, height: 20, color: c },
        { x: 300, y: 450, width: 200, height: 20, color: c },
        { x: 550, y: 320, width: 250, height: 20, color: c }
      ];
      if (levelIdx % 2 === 0 && levelIdx > 0) {
        itemsRef.current.push({ x: 350, y: 400, width: 35, height: 35, vx: 0, vy: 0, active: true, type: 'potion' });
      }
      enemiesRef.current = [{ x: 400, y: 405, width: 45, height: 45, vx: 2, vy: 0, type: 'sour', direction: 1, isDead: false }];
      goalRef.current = { x: 720, y: 260, width: 60, height: 60 };
    }
  }, []);

  const shoot = useCallback(() => {
    const p = playerRef.current;
    if (gameState !== 'playing') return;
    if (p.activeWeapon === 'gun' && playerAmmo <= 0 && infiniteAmmoTimer <= 0) return;

    const angle = aimAngle.current;
    if (p.activeWeapon === 'trident') {
      projectilesRef.current.push({ x: p.x+20, y: p.y+20, width: 30, height: 30, vx: Math.cos(angle)*20, vy: Math.sin(angle)*20, active: true, isPlayerOwned: true, isTrident: true, isFire: p.isFireTrident });
    } else if (p.activeWeapon === 'rod') {
      if (projectilesRef.current.some(pr => pr.isHook && pr.active)) return;
      projectilesRef.current.push({ x: p.x+20, y: p.y+20, width: 12, height: 12, vx: Math.cos(angle)*25, vy: Math.sin(angle)*25, active: true, isPlayerOwned: true, isHook: true });
    } else {
      const isMop = infiniteAmmoTimer > 0;
      projectilesRef.current.push({ 
        x: p.x+20, y: p.y+20, width: 12, height: 12, vx: Math.cos(angle)*18, vy: Math.sin(angle)*18, 
        active: true, isPlayerOwned: true, isMop, color: isMop ? 'orange' : '#60a5fa' 
      });
      if (!isMop) setPlayerAmmo(a => Math.max(0, a - 1));
    }
    playSound('shoot');
  }, [gameState, playerAmmo, infiniteAmmoTimer]);

  useEffect(() => {
    Object.entries(ASSETS).forEach(([k, s]) => {
      const img = new Image(); img.src = s;
      img.onload = () => images.current[k.toLowerCase()] = img;
    });
    const handleKeyDown = (e: KeyboardEvent) => { keys.current[e.code] = true; };
    const handleKeyUp = (e: KeyboardEvent) => { keys.current[e.code] = false; };
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) aimAngle.current = Math.atan2(e.clientY - (rect.top + playerRef.current.y + 20), e.clientX - (rect.left + playerRef.current.x + 20));
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  const update = useCallback(() => {
    if (gameState !== 'playing' && gameState !== 'reward') return;
    frameCount.current++;
    if (infiniteAmmoTimer > 0) setInfiniteAmmoTimer(t => Math.max(0, t - 1/60));
    if (screenShake.current > 0) screenShake.current *= 0.9;

    const p = playerRef.current;

    if (gameState === 'reward') {
      rewardPos.current.alpha = Math.min(1, rewardPos.current.alpha + 0.02);
      const dx = (p.x + 22) - rewardPos.current.x;
      const dy = (p.y + 22) - rewardPos.current.y;
      if (Math.sqrt(dx*dx + dy*dy) < 50) {
        p.isFireTrident = true;
        playSound('trident');
        setGameState('win');
      }
    }

    if (keys.current['KeyA'] || keys.current['ArrowLeft']) { p.vx = -MOVE_SPEED; p.isFacingLeft = true; }
    else if (keys.current['KeyD'] || keys.current['ArrowRight']) { p.vx = MOVE_SPEED; p.isFacingLeft = false; }
    else p.vx *= 0.8;

    if ((keys.current['KeyW'] || keys.current['Space'] || keys.current['ArrowUp']) && !p.isJumping) {
      p.vy = JUMP_FORCE; p.isJumping = true; playSound('jump');
    }

    p.vy += GRAVITY; p.x += p.vx; p.y += p.vy;

    platformsRef.current.forEach(plat => {
      if (p.x < plat.x + plat.width && p.x + p.width > plat.x && p.y + p.height > plat.y && p.y + p.height < plat.y + 10 + p.vy && p.vy > 0) {
        p.y = plat.y - p.height; p.vy = 0; p.isJumping = false;
      }
    });

    if (p.y > CANVAS_HEIGHT) {
      setPlayerHp(h => {
        const next = h - 1;
        if (next <= 0) { setGameState('gameover'); return 0; }
        p.x = 50; p.y = 400; p.vy = 0;
        return next;
      });
    }

    itemsRef.current.forEach(it => {
      if (!it.active) return;
      if (p.x < it.x + it.width && p.x + p.width > it.x && p.y < it.y + it.height && p.y + p.height > it.y) {
        it.active = false; playSound('pickup');
        if (it.type === 'ammo') setPlayerAmmo(a => a + 15);
        if (it.type === 'potion') setInfiniteAmmoTimer(5);
      }
    });

    projectilesRef.current.forEach(proj => {
      if (!proj.active) return;
      proj.x += proj.vx; proj.y += proj.vy;
      enemiesRef.current.forEach(en => {
        if (!en.isDead && proj.x > en.x && proj.x < en.x + en.width && proj.y > en.y && proj.y < en.y + en.height) {
          if (proj.isPlayerOwned) {
            proj.active = false;
            if (en.hp !== undefined) {
              en.hp -= proj.isTrident ? 15 : (proj.isMop ? 10 : 2);
              if (en.hp <= 0) {
                en.isDead = true;
                if (en.type === 'king') {
                  setGameState('reward');
                  rewardPos.current = { x: en.x + en.width/2, y: en.y + en.height/2, alpha: 0 };
                }
              }
            } else { en.isDead = true; }
          }
        }
      });
    });

    enemiesRef.current.forEach(en => {
      if (en.isDead) return;
      if (en.type === 'boss' || en.type === 'king') {
        en.y += Math.sin(frameCount.current * 0.05) * 1.5;
      }
      en.x += en.vx * en.direction;
      if (en.x < 0 || en.x + en.width > CANVAS_WIDTH) en.direction *= -1;
      if (p.x < en.x + en.width && p.x + p.width > en.x && p.y < en.y + en.height && p.y + p.height > en.y) {
        setPlayerHp(h => {
          const next = h - 1;
          if (next <= 0) { setGameState('gameover'); return 0; }
          p.vx = p.x < en.x ? -15 : 15; screenShake.current = 10;
          return next;
        });
      }
    });

    if (p.x < goalRef.current.x + goalRef.current.width && p.x + p.width > goalRef.current.x && p.y < goalRef.current.y + goalRef.current.height && p.y + p.height > goalRef.current.y) {
      const next = currentLevel + 1;
      if (next < 10) { setCurrentLevel(next); initLevel(next); }
      else setGameState('win');
    }
  }, [gameState, currentLevel, playerHp]);

  const draw = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    if (images.current.background) ctx.drawImage(images.current.background, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    platformsRef.current.forEach(plat => {
      ctx.fillStyle = plat.color;
      ctx.fillRect(plat.x, plat.y, plat.width, plat.height);
    });

    const p = playerRef.current;
    
    // Прицел для мобилок (линия)
    if (gameState === 'playing') {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(p.x + p.width/2, p.y + p.height/2);
      ctx.lineTo(
        (p.x + p.width/2) + Math.cos(aimAngle.current) * 100,
        (p.y + p.height/2) + Math.sin(aimAngle.current) * 100
      );
      ctx.stroke();
      ctx.restore();
    }

    itemsRef.current.forEach(it => {
      if (!it.active) return;
      const img = it.type === 'ammo' ? images.current.ammo : images.current.potion;
      if (img) ctx.drawImage(img, it.x, it.y, it.width, it.height);
    });

    enemiesRef.current.forEach(en => {
      if (en.isDead) return;
      ctx.save();
      const isGod = en.type === 'boss' || en.type === 'king';
      if (isGod) {
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        const wHeight = Math.max(10, 40 + Math.sin(frameCount.current * 0.1) * 30);
        ctx.beginPath();
        ctx.ellipse(en.x - 20, en.y + 40, 60, wHeight, -0.4, 0, Math.PI * 2);
        ctx.ellipse(en.x + en.width + 20, en.y + 40, 60, wHeight, 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
      const img = en.type === 'king' ? images.current.player : (en.type === 'boss' ? (currentLevel === 1 ? images.current.boss : images.current.wild_pug) : images.current.enemy);
      if (en.type === 'king') ctx.filter = 'hue-rotate(180deg) brightness(1.5)';
      if (img) ctx.drawImage(img, en.x, en.y, en.width, en.height);
      if (en.hp !== undefined) {
        ctx.fillStyle = 'red'; ctx.fillRect(en.x, en.y - 15, en.width, 8);
        ctx.fillStyle = 'green'; ctx.fillRect(en.x, en.y - 15, (en.hp/en.maxHp!) * en.width, 8);
      }
      ctx.restore();
    });

    if (gameState === 'reward') {
      ctx.save();
      ctx.globalAlpha = rewardPos.current.alpha;
      ctx.shadowBlur = 40; ctx.shadowColor = 'orange';
      const size = 120 + Math.sin(frameCount.current * 0.1) * 10;
      if (images.current.fire_trident) ctx.drawImage(images.current.fire_trident, rewardPos.current.x - size/2, rewardPos.current.y - size/2, size, size);
      ctx.restore();
      ctx.fillStyle = 'white'; ctx.font = 'bold 30px Arial'; ctx.textAlign = 'center';
      ctx.fillText("ВОЗЬМИ СИЛУ ГЛАВНОГО КИСЛИНКИ!", CANVAS_WIDTH/2, 100);
    }

    projectilesRef.current.forEach(pr => {
      if (!pr.active) return;
      if (pr.isTrident) {
        ctx.save(); ctx.translate(pr.x, pr.y); ctx.rotate(frameCount.current * 0.2);
        const img = pr.isFire ? images.current.fire_trident : images.current.trident;
        if (img) ctx.drawImage(img, -25, -25, 50, 50);
        ctx.restore();
      } else {
        ctx.fillStyle = pr.color || 'white';
        ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.width/2, 0, Math.PI*2); ctx.fill();
      }
    });

    if (images.current.player) {
      ctx.save();
      if (infiniteAmmoTimer > 0) {
        ctx.shadowBlur = 30;
        ctx.shadowColor = `hsl(${frameCount.current * 10 % 360}, 100%, 50%)`;
      }
      ctx.translate(p.x + p.width/2, p.y + p.height/2);
      if (p.isFacingLeft) ctx.scale(-1, 1);
      ctx.drawImage(images.current.player, -p.width/2, -p.height/2, p.width, p.height);
      ctx.restore();
    }
  }, [gameState, currentLevel, infiniteAmmoTimer]);

  useEffect(() => {
    let id: number;
    const loop = () => { update(); draw(); id = requestAnimationFrame(loop); };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [update, draw]);

  const handleMobileInput = (e: React.TouchEvent) => {
    if (gameState !== 'playing') return;
    const touches = Array.from(e.touches);
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;
    
    // Сбрасываем только ходьбу, не трогаем прыжок/стрельбу если они зажаты другими пальцами
    let aPressed = false, dPressed = false, wPressed = false;

    touches.forEach(t => {
      // Левая часть: ходьба
      if (t.clientX < screenW * 0.2) aPressed = true;
      else if (t.clientX < screenW * 0.45) dPressed = true;
      // Правая верхняя часть: прыжок
      if (t.clientX > screenW * 0.7 && t.clientY < screenH * 0.5) wPressed = true;
      
      // Зона огня: правая нижняя
      const fireZone = document.getElementById('mobile-fire')?.getBoundingClientRect();
      if (fireZone && t.clientX > fireZone.left && t.clientX < fireZone.right && t.clientY > fireZone.top && t.clientY < fireZone.bottom) {
        // Джойстик прицеливания: рассчитываем направление от центра кнопки
        const dx = t.clientX - (fireZone.left + fireZone.width/2);
        const dy = t.clientY - (fireZone.top + fireZone.height/2);
        // Не меняем угол если палец слишком близко к центру
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
          aimAngle.current = Math.atan2(dy, dx);
        }
        // Стреляем при каждом "движении" или тапе в зоне огня
        if (frameCount.current % 10 === 0) shoot();
      }
    });

    keys.current['KeyA'] = aPressed;
    keys.current['KeyD'] = dPressed;
    keys.current['KeyW'] = wPressed;
  };

  return (
    <div className="relative w-full h-screen bg-black flex items-center justify-center overflow-hidden font-sans select-none touch-none" 
         onTouchStart={handleMobileInput} 
         onTouchMove={handleMobileInput} 
         onTouchEnd={handleMobileInput}>
      <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} className="max-w-full max-h-full border-4 border-zinc-800 rounded-3xl shadow-2xl" onMouseDown={shoot} />
      
      {gameState === 'menu' && (
        <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center text-white z-50">
          <h1 className="text-9xl font-black text-yellow-500 mb-10 italic">KISLINKA</h1>
          <button onClick={() => setGameState('levelSelect')} className="px-20 py-8 bg-yellow-500 text-black text-4xl font-black rounded-full hover:scale-110 transition-transform">PLAY GAME</button>
        </div>
      )}

      {gameState === 'levelSelect' && (
        <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center text-white z-50 p-10">
          <h2 className="text-6xl font-black mb-10 text-yellow-500">STAGE SELECT</h2>
          <div className="grid grid-cols-5 gap-6">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => (
              <button key={i} onClick={() => { setCurrentLevel(i); initLevel(i); }} className="w-24 h-24 bg-zinc-800 border-4 border-white/20 rounded-2xl flex items-center justify-center text-4xl font-black hover:bg-yellow-500 hover:text-black transition-all">
                {i + 1}
              </button>
            ))}
          </div>
          <button onClick={() => setGameState('menu')} className="mt-10 text-xl font-bold underline">BACK TO MENU</button>
        </div>
      )}

      {(gameState === 'playing' || gameState === 'reward') && (
        <div className="absolute top-6 left-6 flex gap-6 pointer-events-none">
          <div className="bg-red-600 px-6 py-2 rounded-xl text-white font-black text-2xl shadow-lg border-2 border-white/20">HP: {playerHp}</div>
          <div className={`px-6 py-2 rounded-xl text-white font-black text-2xl shadow-lg border-2 border-white/20 ${infiniteAmmoTimer > 0 ? 'bg-yellow-500 animate-pulse' : 'bg-blue-600'}`}>
            AMMO: {infiniteAmmoTimer > 0 ? '∞' : playerAmmo}
          </div>
          <div className="bg-zinc-800 px-6 py-2 rounded-xl text-white font-black text-2xl shadow-lg border-2 border-white/20">STAGE: {currentLevel + 1}</div>
        </div>
      )}

      {/* Мобильные кнопки */}
      <div className="absolute bottom-10 left-10 flex gap-6 pointer-events-none md:hidden">
        <div className={`w-24 h-24 bg-white/10 border-4 border-white/20 rounded-3xl flex items-center justify-center text-white text-5xl transition-colors ${keys.current['KeyA'] ? 'bg-white/40' : ''}`}>←</div>
        <div className={`w-24 h-24 bg-white/10 border-4 border-white/20 rounded-3xl flex items-center justify-center text-white text-5xl transition-colors ${keys.current['KeyD'] ? 'bg-white/40' : ''}`}>→</div>
      </div>

      <div className="absolute bottom-10 right-10 flex flex-col gap-6 items-end md:hidden pointer-events-none">
        <div className={`w-24 h-24 bg-yellow-500/20 border-4 border-white/40 rounded-3xl flex items-center justify-center text-white text-3xl font-black transition-colors ${keys.current['KeyW'] ? 'bg-yellow-500/60' : ''}`}>UP</div>
        <div id="mobile-fire" className="w-40 h-40 bg-red-600/20 border-8 border-white/30 rounded-full flex flex-col items-center justify-center text-white font-black text-2xl relative pointer-events-auto shadow-2xl">
          FIRE
          <div className="text-[10px] opacity-60">AIM DRAG</div>
          {/* Визуальный стик прицела */}
          <div className="absolute w-4 h-4 bg-white rounded-full transition-transform" 
               style={{ transform: `translate(${Math.cos(aimAngle.current) * 40}px, ${Math.sin(aimAngle.current) * 40}px)` }}></div>
        </div>
      </div>

      {gameState === 'gameover' && (
        <div className="absolute inset-0 bg-red-950/95 flex flex-col items-center justify-center text-white z-50">
          <h2 className="text-9xl font-black mb-10 tracking-tighter uppercase">Defeated</h2>
          <button onClick={() => initLevel(currentLevel)} className="px-16 py-6 bg-white text-black text-3xl font-black rounded-full hover:scale-110 transition-transform shadow-xl">RESURRECT</button>
        </div>
      )}

      {gameState === 'cutscene' && (
        <div className="absolute inset-0 bg-black flex flex-col items-center justify-center z-50 p-10 text-center">
          <p className="text-white text-6xl font-black italic animate-pulse uppercase leading-tight">{dialogText}</p>
        </div>
      )}

      {gameState === 'win' && (
        <div className="absolute inset-0 bg-yellow-500 flex flex-col items-center justify-center text-black z-50 p-10 text-center">
          <h2 className="text-8xl font-black mb-6 uppercase">NEW OVERLORD</h2>
          <p className="text-3xl font-bold mb-12 italic">Вы победили Главного Кислинку и заняли его трон!</p>
          <button onClick={() => setGameState('menu')} className="px-16 py-8 bg-black text-white text-4xl font-black rounded-full hover:scale-110 transition-transform">MAIN MENU</button>
        </div>
      )}
    </div>
  );
};

export default App;


export interface Entity {
  x: number;
  y: number;
  width: number;
  height: number;
  vx: number;
  vy: number;
}

export interface Player extends Entity {
  isJumping: boolean;
  isFacingLeft: boolean;
  score: number;
  health: number;
  ammo: number;
  hasGun: boolean;
  mopTimer?: number;
  activeWeapon: 'gun' | 'rod' | 'trident';
  isFireTrident?: boolean;
}

export interface Enemy extends Entity {
  type: 'sour' | 'boss' | 'king';
  direction: number;
  isDead: boolean;
  hp?: number;
  maxHp?: number;
  lastShootTime?: number;
  isRed?: boolean;
  isHooked?: boolean;
  phase?: number;
}

export interface Projectile extends Entity {
  active: boolean;
  isPlayerOwned: boolean;
  color?: string;
  isHeal?: boolean;
  isMop?: boolean;
  isHook?: boolean;
  isTrident?: boolean;
  isFire?: boolean;
}

export interface Item extends Entity {
    active: boolean;
    type: 'ammo' | 'potion' | 'trident_pickup';
}

export interface Platform {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

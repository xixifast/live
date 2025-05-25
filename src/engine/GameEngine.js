import Phaser from 'phaser';
import { GameScene } from './GameScene.js';
import { MenuScene } from './MenuScene.js';

export class GameEngine {
  constructor(containerId = 'game-container') {
    this.containerId = containerId;
    this.game = null;
    this.isInitialized = false;
  }

  // 初始化游戏引擎
  init() {
    if (this.isInitialized) return;

    const config = {
      type: Phaser.AUTO,
      width: window.innerWidth,
      height: window.innerHeight,
      parent: this.containerId,
      backgroundColor: '#2c3e50',
      scene: [MenuScene, GameScene],
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { y: 0 },
          debug: false
        }
      },
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH
      },
      render: {
        pixelArt: false,
        antialias: true
      }
    };

    this.game = new Phaser.Game(config);
    this.isInitialized = true;

    // 处理窗口大小变化
    window.addEventListener('resize', () => {
      this.game.scale.resize(window.innerWidth, window.innerHeight);
    });

    // 隐藏加载界面
    const loading = document.getElementById('loading');
    if (loading) {
      loading.style.display = 'none';
    }

    return this.game;
  }

  // 销毁游戏引擎
  destroy() {
    if (this.game) {
      this.game.destroy(true);
      this.game = null;
      this.isInitialized = false;
    }
  }

  // 获取当前活动场景
  getCurrentScene() {
    if (!this.game) return null;
    return this.game.scene.getScene('GameScene');
  }

  // 切换到游戏场景
  startGame(saveData = null) {
    if (!this.game) return;
    
    this.game.scene.stop('MenuScene');
    this.game.scene.start('GameScene', { saveData });
  }

  // 切换到菜单场景
  showMenu() {
    if (!this.game) return;
    
    this.game.scene.stop('GameScene');
    this.game.scene.start('MenuScene');
  }

  // 暂停游戏
  pause() {
    if (!this.game) return;
    
    const gameScene = this.getCurrentScene();
    if (gameScene) {
      gameScene.scene.pause();
    }
  }

  // 恢复游戏
  resume() {
    if (!this.game) return;
    
    const gameScene = this.getCurrentScene();
    if (gameScene) {
      gameScene.scene.resume();
    }
  }
}

// 导出单例实例
export const gameEngine = new GameEngine(); 
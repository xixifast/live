import Phaser from 'phaser';
import { gameDB } from '../data/database.js';
import { GAME_CONFIG } from '../data/gameConfig.js';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
    this.menuItems = [];
  }

  preload() {
    // 在这里可以加载菜单所需的资源
  }

  create() {
    console.log('菜单场景创建');
    
    // 设置背景
    this.cameras.main.setBackgroundColor('#2c3e50');
    
    // 创建菜单UI
    this.createMenuUI();
    
    // 加载存档列表
    this.loadSavesList();
  }

  createMenuUI() {
    const centerX = this.cameras.main.width / 2;
    const centerY = this.cameras.main.height / 2;
    
    // 游戏标题
    const title = this.add.text(centerX, centerY - 200, '城市建造者', {
      fontSize: '48px',
      fontFamily: 'Arial',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5);
    
    // 版本信息
    const version = this.add.text(centerX, centerY - 150, 'v1.0.0 - Alpha', {
      fontSize: '16px',
      fontFamily: 'Arial',
      color: '#bdc3c7'
    }).setOrigin(0.5);
    
    // 新游戏按钮
    const newGameBtn = this.createMenuButton(centerX, centerY - 50, '新游戏', () => {
      this.startNewGame();
    });
    
    // 读取存档按钮
    const loadGameBtn = this.createMenuButton(centerX, centerY, '读取存档', () => {
      this.showSavesList();
    });
    
    // 设置按钮
    const settingsBtn = this.createMenuButton(centerX, centerY + 50, '设置', () => {
      this.showSettings();
    });
    
    // 退出按钮（仅在桌面环境下显示）
    if (!this.sys.game.device.os.android && !this.sys.game.device.os.iOS) {
      const exitBtn = this.createMenuButton(centerX, centerY + 100, '退出', () => {
        window.close();
      });
    }
    
    this.menuItems = [newGameBtn, loadGameBtn, settingsBtn];
  }

  createMenuButton(x, y, text, callback) {
    const button = this.add.container(x, y);
    
    // 按钮背景
    const bg = this.add.rectangle(0, 0, 200, 50, 0x3498db);
    bg.setStrokeStyle(2, 0x2980b9);
    
    // 按钮文字
    const label = this.add.text(0, 0, text, {
      fontSize: '20px',
      fontFamily: 'Arial',
      color: '#ffffff'
    }).setOrigin(0.5);
    
    button.add([bg, label]);
    
    // 交互效果
    button.setSize(200, 50);
    button.setInteractive();
    
    button.on('pointerover', () => {
      bg.setFillStyle(0x2980b9);
      this.tweens.add({
        targets: button,
        scaleX: 1.05,
        scaleY: 1.05,
        duration: 100
      });
    });
    
    button.on('pointerout', () => {
      bg.setFillStyle(0x3498db);
      this.tweens.add({
        targets: button,
        scaleX: 1,
        scaleY: 1,
        duration: 100
      });
    });
    
    button.on('pointerdown', () => {
      this.tweens.add({
        targets: button,
        scaleX: 0.95,
        scaleY: 0.95,
        duration: 50,
        yoyo: true,
        onComplete: callback
      });
    });
    
    return button;
  }

  async startNewGame() {
    try {
      // 创建新的存档
      const saveId = await gameDB.createSave('新城市', {
        resources: { ...GAME_CONFIG.INITIAL_RESOURCES },
        camera: { x: 0, y: 0, zoom: 1 },
        gameTime: 0
      });
      
      // 启动游戏
      this.scene.start('GameScene', {
        saveData: {
          id: saveId,
          resources: { ...GAME_CONFIG.INITIAL_RESOURCES },
          buildings: [],
          camera: { x: 0, y: 0, zoom: 1 },
          gameTime: 0
        }
      });
    } catch (error) {
      console.error('创建新游戏失败:', error);
      this.showNotification('创建新游戏失败，请重试。', 'error');
    }
  }

  async loadSavesList() {
    try {
      this.saves = await gameDB.getAllSaves();
    } catch (error) {
      console.error('加载存档列表失败:', error);
      this.saves = [];
    }
  }

  showSavesList() {
    // 清除当前菜单
    this.clearMenu();
    
    const centerX = this.cameras.main.width / 2;
    const centerY = this.cameras.main.height / 2;
    
    // 标题
    const title = this.add.text(centerX, centerY - 200, '选择存档', {
      fontSize: '32px',
      fontFamily: 'Arial',
      color: '#ffffff'
    }).setOrigin(0.5);
    
    if (this.saves.length === 0) {
      // 没有存档
      const noSaves = this.add.text(centerX, centerY - 100, '没有找到存档', {
        fontSize: '20px',
        fontFamily: 'Arial',
        color: '#bdc3c7'
      }).setOrigin(0.5);
    } else {
      // 显示存档列表
      this.saves.forEach((save, index) => {
        const y = centerY - 100 + index * 70;
        this.createSaveItem(centerX, y, save);
      });
    }
    
    // 返回按钮
    const backBtn = this.createMenuButton(centerX, centerY + 150, '返回', () => {
      this.showMainMenu();
    });
  }

  createSaveItem(x, y, save) {
    const container = this.add.container(x, y);
    
    // 背景
    const bg = this.add.rectangle(0, 0, 400, 60, 0x34495e);
    bg.setStrokeStyle(1, 0x7f8c8d);
    
    // 存档名称
    const name = this.add.text(-180, -10, save.name, {
      fontSize: '18px',
      fontFamily: 'Arial',
      color: '#ffffff'
    });
    
    // 时间信息
    const date = new Date(save.timestamp);
    const timeStr = date.toLocaleString();
    const time = this.add.text(-180, 10, timeStr, {
      fontSize: '14px',
      fontFamily: 'Arial',
      color: '#bdc3c7'
    });
    
    // 加载按钮
    const loadBtn = this.add.rectangle(150, 0, 80, 40, 0x27ae60);
    loadBtn.setStrokeStyle(1, 0x229954);
    
    const loadText = this.add.text(150, 0, '加载', {
      fontSize: '16px',
      fontFamily: 'Arial',
      color: '#ffffff'
    }).setOrigin(0.5);
    
    container.add([bg, name, time, loadBtn, loadText]);
    
    // 设置交互
    container.setSize(400, 60);
    container.setInteractive();
    
    loadBtn.setInteractive();
    loadBtn.on('pointerdown', async () => {
      await this.loadGame(save);
    });
    
    // 悬停效果
    container.on('pointerover', () => {
      bg.setFillStyle(0x3d566e);
    });
    
    container.on('pointerout', () => {
      bg.setFillStyle(0x34495e);
    });
    
    return container;
  }

  async loadGame(save) {
    try {
      const saveData = await gameDB.loadSave(save.id);
      if (saveData) {
        this.scene.start('GameScene', { saveData });
      } else {
        this.showNotification('加载存档失败', 'error');
      }
    } catch (error) {
      console.error('加载游戏失败:', error);
      this.showNotification('加载游戏失败，请重试。', 'error');
    }
  }

  showSettings() {
    // TODO: 实现设置界面
    this.showNotification('设置功能敬请期待', 'info');
  }

  showMainMenu() {
    this.clearMenu();
    this.createMenuUI();
  }

  clearMenu() {
    // 清除所有显示对象
    this.children.removeAll(true);
  }

  showNotification(message, type = 'info') {
    const centerX = this.cameras.main.width / 2;
    const centerY = this.cameras.main.height / 2;
    
    // 根据类型设置颜色
    let color = 0x3498db;
    switch (type) {
      case 'error':
        color = 0xe74c3c;
        break;
      case 'success':
        color = 0x27ae60;
        break;
      case 'warning':
        color = 0xf39c12;
        break;
    }
    
    // 创建通知
    const notification = this.add.container(centerX, centerY + 100);
    
    const bg = this.add.rectangle(0, 0, 300, 50, color, 0.9);
    const text = this.add.text(0, 0, message, {
      fontSize: '16px',
      fontFamily: 'Arial',
      color: '#ffffff',
      wordWrap: { width: 280 }
    }).setOrigin(0.5);
    
    notification.add([bg, text]);
    
    // 自动消失
    this.time.delayedCall(3000, () => {
      notification.destroy();
    });
  }
} 
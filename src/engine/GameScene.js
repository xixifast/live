import Phaser from 'phaser';
import { GAME_CONFIG, canPlaceBuilding } from '../data/gameConfig.js';
import { gameDB } from '../data/database.js';
import { CityManager } from '../systems/CityManager.js';
import { UIManager } from '../components/UIManager.js';
import { AIPlanner } from '../systems/AIPlanner.js';

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
    
    // 游戏状态
    this.gameState = {
      resources: { ...GAME_CONFIG.INITIAL_RESOURCES },
      buildings: [],
      selectedBuildingType: null,
      camera: { x: 0, y: 0, zoom: 1 },
      gameTime: 0,
      saveId: null
    };
    
    // 系统管理器
    this.cityManager = null;
    this.uiManager = null;
    this.aiPlanner = null;
    
    // 地图相关
    this.gridGraphics = null;
    this.buildingGraphics = null;
    this.previewGraphics = null;
    
    // 相机控制
    this.dragStart = null;
    this.isDragging = false;
    
    // 自动保存定时器
    this.autosaveTimer = null;
    this.updateTimer = null;
  }

  init(data = {}) {
    if (data.saveData) {
      this.gameState = { ...this.gameState, ...data.saveData };
      this.gameState.saveId = data.saveData.id;
    }
  }

  preload() {
    // 创建简单的几何图形纹理
    this.createTextures();
  }

  create() {
    console.log('游戏场景创建');
    
    // 初始化图形层
    this.setupGraphics();
    
    // 初始化相机控制
    this.setupCamera();
    
    // 初始化输入控制
    this.setupInput();
    
    // 初始化系统管理器
    this.cityManager = new CityManager(this);
    this.uiManager = new UIManager(this);
    this.aiPlanner = new AIPlanner(this);
    
    // 渲染初始地图
    this.renderMap();
    
    // 开始游戏循环
    this.startGameLoop();
    
    // 加载建筑
    this.loadBuildings();
  }

  createTextures() {
    // 创建瓦片纹理
    const tileSize = GAME_CONFIG.MAP.TILE_SIZE;
    
    // 草地瓦片
    this.add.graphics()
      .fillStyle(0x90EE90)
      .fillRect(0, 0, tileSize, tileSize)
      .generateTexture('grass', tileSize, tileSize);
    
    // 建筑纹理
    Object.keys(GAME_CONFIG.BUILDINGS).forEach(type => {
      const config = GAME_CONFIG.BUILDINGS[type];
      const width = config.size.width * tileSize;
      const height = config.size.height * tileSize;
      
      this.add.graphics()
        .fillStyle(config.color)
        .fillRect(0, 0, width, height)
        .lineStyle(2, 0x000000)
        .strokeRect(0, 0, width, height)
        .generateTexture(`building_${type}`, width, height);
    });
  }

  setupGraphics() {
    // 网格层
    this.gridGraphics = this.add.graphics();
    this.gridGraphics.setDepth(0);
    
    // 建筑层
    this.buildingGraphics = this.add.graphics();
    this.buildingGraphics.setDepth(1);
    
    // 预览层
    this.previewGraphics = this.add.graphics();
    this.previewGraphics.setDepth(2);
  }

  setupCamera() {
    // 设置相机边界
    this.cameras.main.setBounds(-1000, -1000, 2000, 2000);
    
    // 设置缩放限制
    this.cameras.main.setZoom(1);
    this.cameras.main.centerOn(0, 0);
  }

  setupInput() {
    // 鼠标控制
    this.input.on('pointerdown', this.onPointerDown, this);
    this.input.on('pointermove', this.onPointerMove, this);
    this.input.on('pointerup', this.onPointerUp, this);
    
    // 滚轮缩放
    this.input.on('wheel', this.onWheel, this);
    
    // 键盘控制
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys('W,S,A,D');
  }

  onPointerDown(pointer) {
    if (pointer.rightButtonDown()) {
      // 右键开始拖拽
      this.dragStart = { x: pointer.x, y: pointer.y };
      this.isDragging = false;
    } else if (pointer.leftButtonDown()) {
      // 左键放置建筑
      this.handleLeftClick(pointer);
    }
  }

  onPointerMove(pointer) {
    if (this.dragStart && pointer.rightButtonDown()) {
      // 处理相机拖拽
      if (!this.isDragging) {
        this.isDragging = true;
      }
      
      const deltaX = (pointer.x - this.dragStart.x) / this.cameras.main.zoom;
      const deltaY = (pointer.y - this.dragStart.y) / this.cameras.main.zoom;
      
      this.cameras.main.scrollX -= deltaX;
      this.cameras.main.scrollY -= deltaY;
      
      this.dragStart = { x: pointer.x, y: pointer.y };
    }
    
    // 更新建筑预览
    this.updateBuildingPreview(pointer);
  }

  onPointerUp(pointer) {
    if (pointer.rightButtonReleased()) {
      this.dragStart = null;
      this.isDragging = false;
    }
  }

  onWheel(pointer, gameObjects, deltaX, deltaY, deltaZ) {
    // 缩放控制
    const zoomFactor = deltaY > 0 ? 0.9 : 1.1;
    let newZoom = this.cameras.main.zoom * zoomFactor;
    
    // 限制缩放范围
    newZoom = Phaser.Math.Clamp(newZoom, 0.5, 3);
    
    this.cameras.main.setZoom(newZoom);
  }

  handleLeftClick(pointer) {
    if (!this.gameState.selectedBuildingType) return;
    
    // 将屏幕坐标转换为世界坐标
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    
    // 转换为网格坐标
    const gridX = Math.floor(worldPoint.x / GAME_CONFIG.MAP.TILE_SIZE);
    const gridY = Math.floor(worldPoint.y / GAME_CONFIG.MAP.TILE_SIZE);
    
    // 尝试放置建筑
    this.tryPlaceBuilding(this.gameState.selectedBuildingType, gridX, gridY);
  }

  tryPlaceBuilding(buildingType, gridX, gridY) {
    const validation = canPlaceBuilding(buildingType, gridX, gridY, this.gameState);
    
    if (!validation.canPlace) {
      this.uiManager.showNotification(validation.reason, 'error');
      return false;
    }
    
    // 创建建筑
    const building = {
      id: Date.now() + Math.random(),
      type: buildingType,
      x: gridX,
      y: gridY,
      level: 1,
      createdAt: Date.now()
    };
    
    // 扣除资金
    const cost = GAME_CONFIG.BUILDINGS[buildingType].cost;
    this.gameState.resources.money -= cost;
    
    // 添加到建筑列表
    this.gameState.buildings.push(building);
    
    // 重新渲染地图
    this.renderMap();
    
    // 更新资源显示
    this.uiManager.updateResources();
    
    // 显示成功消息
    this.uiManager.showNotification(`${GAME_CONFIG.BUILDINGS[buildingType].name}建造成功！`, 'success');
    
    return true;
  }

  updateBuildingPreview(pointer) {
    this.previewGraphics.clear();
    
    if (!this.gameState.selectedBuildingType) return;
    
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const gridX = Math.floor(worldPoint.x / GAME_CONFIG.MAP.TILE_SIZE);
    const gridY = Math.floor(worldPoint.y / GAME_CONFIG.MAP.TILE_SIZE);
    
    const config = GAME_CONFIG.BUILDINGS[this.gameState.selectedBuildingType];
    const tileSize = GAME_CONFIG.MAP.TILE_SIZE;
    const x = gridX * tileSize;
    const y = gridY * tileSize;
    const width = config.size.width * tileSize;
    const height = config.size.height * tileSize;
    
    // 检查是否可以放置
    const validation = canPlaceBuilding(this.gameState.selectedBuildingType, gridX, gridY, this.gameState);
    const color = validation.canPlace ? 0x00ff00 : 0xff0000;
    const alpha = 0.5;
    
    this.previewGraphics
      .fillStyle(color, alpha)
      .fillRect(x, y, width, height)
      .lineStyle(2, color, 0.8)
      .strokeRect(x, y, width, height);
  }

  renderMap() {
    const tileSize = GAME_CONFIG.MAP.TILE_SIZE;
    
    // 清除之前的图形
    this.gridGraphics.clear();
    this.buildingGraphics.clear();
    
    // 绘制网格
    this.drawGrid();
    
    // 绘制建筑
    this.gameState.buildings.forEach(building => {
      const config = GAME_CONFIG.BUILDINGS[building.type];
      if (!config) return;
      
      const x = building.x * tileSize;
      const y = building.y * tileSize;
      const width = config.size.width * tileSize;
      const height = config.size.height * tileSize;
      
      // 绘制建筑
      let buildingColor = config.color;
      
      // AI建造的建筑使用特殊边框
      if (building.aiBuilt) {
        // AI建筑使用紫色边框
        this.buildingGraphics
          .fillStyle(buildingColor)
          .fillRect(x, y, width, height)
          .lineStyle(3, 0x9b59b6, 1) // 紫色边框表示AI建造
          .strokeRect(x, y, width, height);
        
        // 添加AI图标
        this.buildingGraphics
          .fillStyle(0x9b59b6)
          .fillCircle(x + width - 8, y + 8, 6)
          .fillStyle(0xffffff)
          .fillCircle(x + width - 8, y + 8, 4);
      } else {
        // 玩家建造的建筑使用普通边框
        this.buildingGraphics
          .fillStyle(buildingColor)
          .fillRect(x, y, width, height)
          .lineStyle(1, 0x000000)
          .strokeRect(x, y, width, height);
      }
      
      // 添加建筑图标
      const centerX = x + width / 2;
      const centerY = y + height / 2;
      
      // 这里可以添加文字或图标
      // 暂时用简单的颜色区分
    });
  }

  drawGrid() {
    const tileSize = GAME_CONFIG.MAP.TILE_SIZE;
    const camera = this.cameras.main;
    
    // 计算可见区域
    const startX = Math.floor((camera.scrollX - 100) / tileSize) * tileSize;
    const startY = Math.floor((camera.scrollY - 100) / tileSize) * tileSize;
    const endX = startX + (camera.width / camera.zoom + 200);
    const endY = startY + (camera.height / camera.zoom + 200);
    
    // 绘制网格线
    this.gridGraphics.lineStyle(1, 0x444444, 0.3);
    
    for (let x = startX; x <= endX; x += tileSize) {
      this.gridGraphics.moveTo(x, startY);
      this.gridGraphics.lineTo(x, endY);
    }
    
    for (let y = startY; y <= endY; y += tileSize) {
      this.gridGraphics.moveTo(startX, y);
      this.gridGraphics.lineTo(endX, y);
    }
    
    this.gridGraphics.strokePath();
  }

  startGameLoop() {
    // 游戏更新循环
    this.updateTimer = this.time.addEvent({
      delay: GAME_CONFIG.MECHANICS.UPDATE_INTERVAL,
      callback: this.updateGame,
      callbackScope: this,
      loop: true
    });
    
    // 自动保存循环
    this.autosaveTimer = this.time.addEvent({
      delay: GAME_CONFIG.MECHANICS.AUTOSAVE_INTERVAL,
      callback: this.autoSave,
      callbackScope: this,
      loop: true
    });
  }

  updateGame() {
    // 更新游戏时间
    this.gameState.gameTime += GAME_CONFIG.MECHANICS.UPDATE_INTERVAL;
    
    // 计算资源变化
    this.cityManager.updateResources();
    
    // 更新UI
    this.uiManager.updateResources();
  }

  async autoSave() {
    if (this.gameState.saveId) {
      try {
        await gameDB.saveGameState(
          this.gameState.saveId,
          {
            resources: this.gameState.resources,
            camera: this.gameState.camera,
            gameTime: this.gameState.gameTime
          },
          this.gameState.buildings,
          [], // 道路系统待实现
          this.cityManager.getStatistics()
        );
        console.log('自动保存成功');
      } catch (error) {
        console.error('自动保存失败:', error);
      }
    }
  }

  loadBuildings() {
    // 如果有保存的建筑数据，渲染地图
    if (this.gameState.buildings && this.gameState.buildings.length > 0) {
      this.renderMap();
    }
  }

  update() {
    // 键盘相机控制
    const speed = 5 / this.cameras.main.zoom;
    
    if (this.cursors.left.isDown || this.wasd.A.isDown) {
      this.cameras.main.scrollX -= speed;
    }
    if (this.cursors.right.isDown || this.wasd.D.isDown) {
      this.cameras.main.scrollX += speed;
    }
    if (this.cursors.up.isDown || this.wasd.W.isDown) {
      this.cameras.main.scrollY -= speed;
    }
    if (this.cursors.down.isDown || this.wasd.S.isDown) {
      this.cameras.main.scrollY += speed;
    }
  }

  // 设置选中的建筑类型
  setSelectedBuildingType(type) {
    this.gameState.selectedBuildingType = type;
  }

  // 获取游戏状态
  getGameState() {
    return this.gameState;
  }

  // 添加AI建造动画效果
  showAIBuildingAnimation(x, y, buildingType) {
    const tileSize = GAME_CONFIG.MAP.TILE_SIZE;
    const config = GAME_CONFIG.BUILDINGS[buildingType];
    const worldX = x * tileSize;
    const worldY = y * tileSize;
    const width = config.size.width * tileSize;
    const height = config.size.height * tileSize;
    
    // 创建建造动画
    const buildEffect = this.add.graphics();
    buildEffect.setDepth(3);
    
    // 闪烁效果
    let alpha = 1;
    const flashTween = this.tweens.add({
      targets: { alpha: 1 },
      alpha: 0,
      duration: 200,
      yoyo: true,
      repeat: 2,
      onUpdate: (tween, target) => {
        buildEffect.clear();
        buildEffect.fillStyle(0x9b59b6, target.alpha * 0.7);
        buildEffect.fillRect(worldX, worldY, width, height);
        buildEffect.lineStyle(3, 0x9b59b6, target.alpha);
        buildEffect.strokeRect(worldX, worldY, width, height);
      },
      onComplete: () => {
        buildEffect.destroy();
        // 重新渲染地图
        this.renderMap();
      }
    });
    
    // 粒子效果
    this.createBuildParticles(worldX + width/2, worldY + height/2);
  }
  
  createBuildParticles(x, y) {
    // 简单的粒子效果
    for (let i = 0; i < 8; i++) {
      const particle = this.add.graphics();
      particle.fillStyle(0x9b59b6);
      particle.fillCircle(0, 0, 3);
      particle.setPosition(x, y);
      particle.setDepth(4);
      
      // 随机方向
      const angle = (Math.PI * 2 * i) / 8;
      const speed = 50 + Math.random() * 30;
      
      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed,
        alpha: 0,
        scale: 0.1,
        duration: 800,
        ease: 'Power2',
        onComplete: () => {
          particle.destroy();
        }
      });
    }
  }
} 
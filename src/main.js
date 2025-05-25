import { gameEngine } from './engine/GameEngine.js';
import { gameDB } from './data/database.js';

// 游戏主类
class CityBuilderGame {
  constructor() {
    this.isInitialized = false;
  }

  async init() {
    if (this.isInitialized) return;

    try {
      console.log('城市建造者游戏启动中...');
      
      // 初始化数据库
      await this.initDatabase();
      
      // 初始化游戏引擎
      this.initGameEngine();
      
      // 添加全局错误处理
      this.setupErrorHandling();
      
      // 添加性能监控
      this.setupPerformanceMonitoring();
      
      this.isInitialized = true;
      console.log('游戏初始化完成！');
      
    } catch (error) {
      console.error('游戏初始化失败:', error);
      this.showErrorMessage('游戏初始化失败，请刷新页面重试。');
    }
  }

  async initDatabase() {
    try {
      await gameDB.open();
      console.log('数据库连接成功');
      
      // 检查并升级数据库版本
      await this.checkDatabaseVersion();
      
    } catch (error) {
      console.error('数据库初始化失败:', error);
      throw new Error('数据库初始化失败');
    }
  }

  async checkDatabaseVersion() {
    try {
      const version = await gameDB.loadSetting('dbVersion', '1.0.0');
      const currentVersion = '1.0.0';
      
      if (version !== currentVersion) {
        console.log(`数据库版本从 ${version} 升级到 ${currentVersion}`);
        await gameDB.saveSetting('dbVersion', currentVersion);
      }
    } catch (error) {
      console.warn('数据库版本检查失败:', error);
    }
  }

  initGameEngine() {
    try {
      gameEngine.init();
      console.log('游戏引擎初始化成功');
    } catch (error) {
      console.error('游戏引擎初始化失败:', error);
      throw new Error('游戏引擎初始化失败');
    }
  }

  setupErrorHandling() {
    // 全局错误处理
    window.addEventListener('error', (event) => {
      console.error('全局错误:', event.error);
      this.handleGameError(event.error);
    });

    // Promise 错误处理
    window.addEventListener('unhandledrejection', (event) => {
      console.error('未处理的Promise错误:', event.reason);
      this.handleGameError(event.reason);
      event.preventDefault();
    });
  }

  setupPerformanceMonitoring() {
    // 性能监控
    let lastTime = performance.now();
    let frameCount = 0;
    let fps = 60;

    const updateFPS = () => {
      frameCount++;
      const currentTime = performance.now();
      
      if (currentTime >= lastTime + 1000) {
        fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
        frameCount = 0;
        lastTime = currentTime;
        
        // 更新FPS显示
        this.updateFPSDisplay(fps);
        
        // 检查性能警告
        if (fps < 30) {
          console.warn('游戏性能较低, FPS:', fps);
        }
      }
      
      requestAnimationFrame(updateFPS);
    };
    
    requestAnimationFrame(updateFPS);
  }

  updateFPSDisplay(fps) {
    // 通过游戏引擎获取UI管理器并更新FPS
    const gameScene = gameEngine.getCurrentScene();
    if (gameScene && gameScene.uiManager) {
      gameScene.uiManager.updateFPS(fps);
    }
  }

  handleGameError(error) {
    // 游戏错误处理
    const errorMessage = error?.message || '未知错误';
    
    // 显示用户友好的错误信息
    this.showErrorMessage(`游戏遇到问题: ${errorMessage}`);
    
    // 可以在这里添加错误上报逻辑
    this.reportError(error);
  }

  showErrorMessage(message) {
    // 创建错误提示
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #e74c3c;
      color: white;
      padding: 20px;
      border-radius: 8px;
      z-index: 9999;
      max-width: 400px;
      text-align: center;
      box-shadow: 0 4px 8px rgba(0,0,0,0.3);
    `;
    
    errorDiv.innerHTML = `
      <h3>游戏错误</h3>
      <p>${message}</p>
      <button id="close-error" style="
        background: white;
        color: #e74c3c;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
        margin-top: 10px;
      ">确定</button>
    `;
    
    document.body.appendChild(errorDiv);
    
    // 关闭按钮事件
    document.getElementById('close-error').addEventListener('click', () => {
      document.body.removeChild(errorDiv);
    });
    
    // 5秒后自动关闭
    setTimeout(() => {
      if (errorDiv.parentNode) {
        document.body.removeChild(errorDiv);
      }
    }, 5000);
  }

  reportError(error) {
    // 这里可以添加错误上报到服务器的逻辑
    console.log('错误上报:', {
      message: error?.message,
      stack: error?.stack,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      url: window.location.href
    });
  }

  // 游戏退出清理
  destroy() {
    try {
      gameEngine.destroy();
      console.log('游戏已退出');
    } catch (error) {
      console.error('游戏退出时发生错误:', error);
    }
  }
}

// 创建游戏实例
const game = new CityBuilderGame();

// 页面加载完成后初始化游戏
document.addEventListener('DOMContentLoaded', async () => {
  await game.init();
});

// 页面卸载时清理游戏
window.addEventListener('beforeunload', () => {
  game.destroy();
});

// 导出游戏实例以便调试
window.CityBuilderGame = game; 
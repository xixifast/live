import { GAME_CONFIG } from '../data/gameConfig.js';

export class UIManager {
  constructor(gameScene) {
    this.scene = gameScene;
    this.gameState = gameScene.gameState;
    this.notifications = [];
    
    // 绑定UI事件
    this.bindUIEvents();
    
    // 初始化UI
    this.updateResources();
    
    // 初始化AI界面
    this.initAIInterface();
  }

  bindUIEvents() {
    // 建造按钮事件
    const buildButtons = document.querySelectorAll('.build-button');
    buildButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const buildingType = e.target.getAttribute('data-type');
        this.selectBuildingType(buildingType);
      });
    });

    // 键盘快捷键
    document.addEventListener('keydown', (e) => {
      this.handleKeyboardInput(e);
    });

    // ESC键取消选择
    document.addEventListener('keyup', (e) => {
      if (e.key === 'Escape') {
        this.clearSelection();
      }
    });
  }

  initAIInterface() {
    // AI开关按钮
    const aiToggle = document.getElementById('ai-toggle');
    if (aiToggle) {
      aiToggle.addEventListener('click', () => {
        this.toggleAI();
      });
    }

    // AI控制按钮
    const aiSuggestions = document.getElementById('ai-suggestions');
    if (aiSuggestions) {
      aiSuggestions.addEventListener('click', () => {
        this.showAISuggestions();
      });
    }

    const aiStats = document.getElementById('ai-stats');
    if (aiStats) {
      aiStats.addEventListener('click', () => {
        this.showAIStats();
      });
    }

    const aiSettings = document.getElementById('ai-settings');
    if (aiSettings) {
      aiSettings.addEventListener('click', () => {
        this.showAISettings();
      });
    }

    // 定期更新AI状态
    setInterval(() => {
      this.updateAIStatus();
    }, 2000);
  }

  toggleAI() {
    const aiPlanner = this.scene.aiPlanner;
    const currentStatus = aiPlanner.getAIStatus();
    
    aiPlanner.setEnabled(!currentStatus.enabled);
    this.updateAIToggleButton();
  }

  updateAIToggleButton() {
    const aiToggle = document.getElementById('ai-toggle');
    const aiPlanner = this.scene.aiPlanner;
    const status = aiPlanner.getAIStatus();
    
    if (aiToggle) {
      if (status.enabled) {
        aiToggle.className = 'ai-toggle enabled';
        aiToggle.textContent = '禁用AI规划';
      } else {
        aiToggle.className = 'ai-toggle disabled';
        aiToggle.textContent = '启用AI规划';
      }
    }
  }

  updateAIStatus() {
    const aiStatus = document.getElementById('ai-status');
    const aiPlanner = this.scene.aiPlanner;
    const status = aiPlanner.getAIStatus();
    
    if (aiStatus) {
      let statusText = 'AI状态: ';
      
      if (!status.enabled) {
        statusText += '未启用';
      } else if (status.isPlanning) {
        statusText += '🤖 规划中...';
      } else {
        statusText += `🤖 活跃 (已规划${status.totalPlans}次)`;
      }
      
      // 添加大模型状态
      if (status.useAIAnalysis) {
        statusText += status.lastAIAnalysis ? ' | 🧠 AI已连接' : ' | 🧠 AI待机';
      }
      
      aiStatus.textContent = statusText;
    }

    // 自动更新AI建议
    if (status.enabled) {
      this.updateAISuggestionsDisplay();
    }
  }

  showAISuggestions() {
    const aiPlanner = this.scene.aiPlanner;
    
    // 使用异步方法获取AI建议
    aiPlanner.getAISuggestions().then(suggestions => {
      this.updateAISuggestionsDisplay(suggestions);
      this.showNotification('🧠 AI建议已更新', 'info');
    }).catch(error => {
      console.error('Failed to get AI suggestions:', error);
      this.showNotification('获取AI建议失败', 'error');
    });
  }

  updateAISuggestionsDisplay(suggestions = null) {
    const suggestionsContent = document.getElementById('suggestions-content');
    
    if (!suggestionsContent) return;

    if (!suggestions) {
      const aiPlanner = this.scene.aiPlanner;
      // 使用异步方法
      aiPlanner.getAISuggestions().then(newSuggestions => {
        this.updateAISuggestionsDisplay(newSuggestions);
      });
      return;
    }

    if (suggestions.length === 0) {
      suggestionsContent.innerHTML = '<div class="ai-status">暂无建议</div>';
      return;
    }

    const html = suggestions.map((suggestion, index) => {
      const config = GAME_CONFIG.BUILDINGS[suggestion.buildingType];
      const sourceIcon = suggestion.source === 'ai' ? '🧠' : '🤖';
      const sourceClass = suggestion.source === 'ai' ? 'ai-smart' : 'ai-local';
      
      return `
        <div class="ai-suggestion ${sourceClass}" data-building-type="${suggestion.buildingType}">
          <div class="building-type">
            ${sourceIcon} ${config.emoji} ${config.name} ($${suggestion.cost})
          </div>
          <div class="reason">${suggestion.reason}</div>
          ${suggestion.aiAnalysis ? `<div class="ai-detail">${suggestion.aiAnalysis.substring(0, 80)}...</div>` : ''}
        </div>
      `;
    }).join('');

    suggestionsContent.innerHTML = html;

    // 添加样式
    const style = document.createElement('style');
    style.textContent = `
      .ai-suggestion.ai-smart {
        background: rgba(76, 175, 80, 0.3);
        border-left: 3px solid #4CAF50;
      }
      .ai-suggestion.ai-local {
        background: rgba(155, 89, 182, 0.3);
        border-left: 3px solid #9b59b6;
      }
      .ai-detail {
        font-size: 10px;
        color: #95a5a6;
        margin-top: 3px;
        line-height: 1.2;
      }
    `;
    if (!document.querySelector('#ai-suggestions-style')) {
      style.id = 'ai-suggestions-style';
      document.head.appendChild(style);
    }

    // 添加点击事件 - 点击建议自动选择建筑类型
    const suggestionElements = suggestionsContent.querySelectorAll('.ai-suggestion');
    suggestionElements.forEach(element => {
      element.addEventListener('click', () => {
        const buildingType = element.getAttribute('data-building-type');
        this.selectBuildingType(buildingType);
        
        const suggestion = suggestions.find(s => s.buildingType === buildingType);
        const message = suggestion.source === 'ai' ? 
          `已选择🧠大模型建议: ${GAME_CONFIG.BUILDINGS[buildingType].name}` :
          `已选择🤖AI建议: ${GAME_CONFIG.BUILDINGS[buildingType].name}`;
        this.showNotification(message, 'success');
      });
      
      // 添加悬停效果
      element.style.cursor = 'pointer';
      element.addEventListener('mouseenter', () => {
        element.style.transform = 'scale(1.02)';
        element.style.transition = 'transform 0.2s';
      });
      element.addEventListener('mouseleave', () => {
        element.style.transform = 'scale(1)';
      });
    });
  }

  showAIStats() {
    const aiPlanner = this.scene.aiPlanner;
    const status = aiPlanner.getAIStatus();
    
    const statsPanel = document.createElement('div');
    statsPanel.className = 'ai-stats-panel ui-panel';
    statsPanel.innerHTML = `
      <h3>AI规划统计</h3>
      <div class="stats-content">
        <div class="stat-item">
          <span>AI状态:</span>
          <span>${status.enabled ? '已启用' : '未启用'}</span>
        </div>
        <div class="stat-item">
          <span>总规划次数:</span>
          <span>${status.totalPlans}</span>
        </div>
        <div class="stat-item">
          <span>当前状态:</span>
          <span>${status.isPlanning ? '规划中' : '等待中'}</span>
        </div>
        ${status.lastPlan ? `
          <div class="stat-item">
            <span>上次规划:</span>
            <span>${new Date(status.lastPlan.timestamp).toLocaleTimeString()}</span>
          </div>
          <div class="stat-item">
            <span>规划建筑数:</span>
            <span>${status.lastPlan.plan.actions.length}</span>
          </div>
          <div class="stat-item">
            <span>规划成本:</span>
            <span>$${status.lastPlan.plan.totalCost}</span>
          </div>
        ` : ''}
      </div>
      <button class="close-stats">关闭</button>
    `;

    // 设置位置
    Object.assign(statsPanel.style, {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      zIndex: '3000',
      minWidth: '300px',
      maxWidth: '400px'
    });

    document.body.appendChild(statsPanel);

    // 关闭按钮
    const closeBtn = statsPanel.querySelector('.close-stats');
    closeBtn.addEventListener('click', () => {
      document.body.removeChild(statsPanel);
    });

    // 点击外部关闭
    const closeOnClickOutside = (e) => {
      if (!statsPanel.contains(e.target)) {
        document.body.removeChild(statsPanel);
        document.removeEventListener('click', closeOnClickOutside);
      }
    };
    setTimeout(() => {
      document.addEventListener('click', closeOnClickOutside);
    }, 100);
  }

  showAISettings() {
    const aiPlanner = this.scene.aiPlanner;
    const config = aiPlanner.config;
    
    const settingsPanel = document.createElement('div');
    settingsPanel.className = 'ai-settings-panel ui-panel';
    settingsPanel.innerHTML = `
      <h3>🤖 AI设置</h3>
      <div class="settings-content">
        <div class="setting-item">
          <label>启用大模型分析:</label>
          <input type="checkbox" id="use-ai-analysis" ${config.useAIAnalysis ? 'checked' : ''}>
        </div>
        
        <div class="setting-item">
          <label>规划间隔 (秒):</label>
          <input type="range" id="planning-interval" min="5" max="60" value="${config.planningInterval / 1000}">
          <span id="interval-value">${config.planningInterval / 1000}s</span>
        </div>
        
        <div class="setting-item">
          <label>保留资金:</label>
          <input type="range" id="budget-reserve" min="0" max="5000" step="100" value="${config.budgetReserve}">
          <span id="reserve-value">$${config.budgetReserve}</span>
        </div>
        
        <div class="setting-item">
          <label>每次最大建造数:</label>
          <input type="range" id="max-buildings" min="1" max="10" value="${config.maxBuildingsPerCycle}">
          <span id="buildings-value">${config.maxBuildingsPerCycle}</span>
        </div>
        
        <div class="setting-item">
          <label>AI模式:</label>
          <select id="ai-mode">
            <option value="balanced">平衡发展</option>
            <option value="growth">快速增长</option>
            <option value="happiness">幸福优先</option>
            <option value="economy">经济优先</option>
          </select>
        </div>
        
        <div class="setting-item" style="margin-top: 15px;">
          <button id="test-ai-connection" class="ai-control-button" style="background: #3498db; width: 100%;">
            🧠 测试大模型连接
          </button>
        </div>
      </div>
      
      <div style="margin-top: 10px;">
        <button id="save-settings" class="ai-control-button" style="background: #27ae60;">保存设置</button>
        <button id="reset-settings" class="ai-control-button" style="background: #e74c3c;">重置默认</button>
        <button class="close-settings" style="float: right;">关闭</button>
      </div>
    `;

    // 设置样式
    Object.assign(settingsPanel.style, {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      zIndex: '3000',
      minWidth: '350px',
      maxWidth: '450px'
    });

    // 添加设置面板样式
    const style = document.createElement('style');
    style.textContent = `
      .setting-item {
        margin: 10px 0;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .setting-item label {
        font-size: 12px;
        color: #bdc3c7;
        flex: 1;
      }
      .setting-item input, .setting-item select {
        margin: 0 10px;
        flex: 1;
      }
      .setting-item input[type="checkbox"] {
        flex: none;
        width: auto;
      }
      .setting-item span {
        font-size: 12px;
        min-width: 50px;
        text-align: right;
      }
    `;
    settingsPanel.appendChild(style);

    document.body.appendChild(settingsPanel);

    // 绑定事件
    const useAICheckbox = settingsPanel.querySelector('#use-ai-analysis');
    
    const intervalSlider = settingsPanel.querySelector('#planning-interval');
    const intervalValue = settingsPanel.querySelector('#interval-value');
    intervalSlider.addEventListener('input', (e) => {
      intervalValue.textContent = e.target.value + 's';
    });

    const reserveSlider = settingsPanel.querySelector('#budget-reserve');
    const reserveValue = settingsPanel.querySelector('#reserve-value');
    reserveSlider.addEventListener('input', (e) => {
      reserveValue.textContent = '$' + e.target.value;
    });

    const buildingsSlider = settingsPanel.querySelector('#max-buildings');
    const buildingsValue = settingsPanel.querySelector('#buildings-value');
    buildingsSlider.addEventListener('input', (e) => {
      buildingsValue.textContent = e.target.value;
    });

    // 测试大模型连接
    const testButton = settingsPanel.querySelector('#test-ai-connection');
    testButton.addEventListener('click', async () => {
      testButton.textContent = '🔄 测试中...';
      testButton.disabled = true;
      
      try {
        // 动态导入AI服务
        const { aiService } = await import('../services/AIService.js');
        const result = await aiService.testConnection();
        
        if (result.success) {
          this.showNotification('🧠 大模型连接成功！', 'success');
          testButton.textContent = '✅ 连接成功';
          testButton.style.background = '#27ae60';
        } else {
          this.showNotification('❌ 大模型连接失败: ' + result.error, 'error');
          testButton.textContent = '❌ 连接失败';
          testButton.style.background = '#e74c3c';
        }
      } catch (error) {
        this.showNotification('❌ 大模型服务不可用', 'error');
        testButton.textContent = '❌ 服务不可用';
        testButton.style.background = '#e74c3c';
      }
      
      setTimeout(() => {
        testButton.textContent = '🧠 测试大模型连接';
        testButton.style.background = '#3498db';
        testButton.disabled = false;
      }, 3000);
    });

    // 保存设置
    const saveBtn = settingsPanel.querySelector('#save-settings');
    saveBtn.addEventListener('click', () => {
      aiPlanner.config.useAIAnalysis = useAICheckbox.checked;
      aiPlanner.config.planningInterval = parseInt(intervalSlider.value) * 1000;
      aiPlanner.config.budgetReserve = parseInt(reserveSlider.value);
      aiPlanner.config.maxBuildingsPerCycle = parseInt(buildingsSlider.value);
      
      // 重启AI规划器以应用新设置
      if (aiPlanner.config.enabled) {
        aiPlanner.startPlanning();
      }
      
      this.showNotification('🤖 AI设置已保存', 'success');
      document.body.removeChild(settingsPanel);
    });

    // 重置设置
    const resetBtn = settingsPanel.querySelector('#reset-settings');
    resetBtn.addEventListener('click', () => {
      useAICheckbox.checked = true;
      intervalSlider.value = 10;
      intervalValue.textContent = '10s';
      reserveSlider.value = 1000;
      reserveValue.textContent = '$1000';
      buildingsSlider.value = 3;
      buildingsValue.textContent = '3';
    });

    // 关闭按钮
    const closeBtn = settingsPanel.querySelector('.close-settings');
    closeBtn.addEventListener('click', () => {
      document.body.removeChild(settingsPanel);
    });
  }

  selectBuildingType(type) {
    // 清除之前的选择
    this.clearSelection();
    
    // 检查是否有效的建筑类型
    if (!GAME_CONFIG.BUILDINGS[type]) {
      console.warn('未知的建筑类型:', type);
      return;
    }

    // 检查资金是否足够
    const cost = GAME_CONFIG.BUILDINGS[type].cost;
    if (this.gameState.resources.money < cost) {
      this.showNotification('资金不足！', 'error');
      return;
    }

    // 设置选中的建筑类型
    this.gameState.selectedBuildingType = type;
    this.scene.setSelectedBuildingType(type);

    // 更新UI状态
    const button = document.querySelector(`[data-type="${type}"]`);
    if (button) {
      button.classList.add('active');
    }

    // 显示提示
    const buildingName = GAME_CONFIG.BUILDINGS[type].name;
    this.showNotification(`已选择 ${buildingName}，点击地图放置建筑`, 'info');
  }

  clearSelection() {
    this.gameState.selectedBuildingType = null;
    this.scene.setSelectedBuildingType(null);

    // 清除所有按钮的激活状态
    const buttons = document.querySelectorAll('.build-button');
    buttons.forEach(button => {
      button.classList.remove('active');
    });
  }

  updateResources() {
    const resources = this.gameState.resources;

    // 更新资源显示
    this.updateElement('money', this.formatNumber(resources.money));
    this.updateElement('population', resources.population || 0);
    this.updateElement('happiness', `${resources.happiness || 50}%`);
    
    // 更新电力显示
    const powerUsed = resources.powerUsed || 0;
    const powerTotal = resources.power || 100;
    this.updateElement('power', `${powerUsed}/${powerTotal}`);

    // 更新建造按钮状态
    this.updateBuildButtonStates();
  }

  updateBuildButtonStates() {
    const money = this.gameState.resources.money;
    
    Object.keys(GAME_CONFIG.BUILDINGS).forEach(type => {
      const cost = GAME_CONFIG.BUILDINGS[type].cost;
      const button = document.querySelector(`[data-type="${type}"]`);
      
      if (button) {
        if (money < cost) {
          button.classList.add('disabled');
          button.disabled = true;
        } else {
          button.classList.remove('disabled');
          button.disabled = false;
        }
      }
    });
  }

  updateElement(id, value) {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
    }
  }

  formatNumber(num) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return Math.floor(num).toString();
  }

  showNotification(message, type = 'info', duration = 3000) {
    // 创建通知元素
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;

    // 设置样式
    Object.assign(notification.style, {
      position: 'fixed',
      top: '70px',
      right: '20px',
      padding: '12px 20px',
      borderRadius: '6px',
      color: 'white',
      fontWeight: 'bold',
      zIndex: '2000',
      opacity: '0',
      transform: 'translateX(100%)',
      transition: 'all 0.3s ease',
      maxWidth: '300px',
      wordWrap: 'break-word'
    });

    // 根据类型设置背景颜色
    switch (type) {
      case 'success':
        notification.style.backgroundColor = '#27ae60';
        break;
      case 'error':
        notification.style.backgroundColor = '#e74c3c';
        break;
      case 'warning':
        notification.style.backgroundColor = '#f39c12';
        break;
      default:
        notification.style.backgroundColor = '#3498db';
    }

    // 添加到页面
    document.body.appendChild(notification);

    // 计算正确的位置（避免重叠）
    const topOffset = 70 + this.notifications.length * 60;
    notification.style.top = `${topOffset}px`;

    // 动画显示
    setTimeout(() => {
      notification.style.opacity = '1';
      notification.style.transform = 'translateX(0)';
    }, 10);

    // 添加到通知列表
    this.notifications.push(notification);

    // 自动移除
    setTimeout(() => {
      this.removeNotification(notification);
    }, duration);

    // 点击移除
    notification.addEventListener('click', () => {
      this.removeNotification(notification);
    });
  }

  removeNotification(notification) {
    const index = this.notifications.indexOf(notification);
    if (index === -1) return;

    // 移除动画
    notification.style.opacity = '0';
    notification.style.transform = 'translateX(100%)';

    // 从列表移除
    this.notifications.splice(index, 1);

    // 重新排列其他通知
    this.notifications.forEach((notif, i) => {
      notif.style.top = `${70 + i * 60}px`;
    });

    // 从DOM移除
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }

  handleKeyboardInput(e) {
    // 数字键快速选择建筑
    const keyMap = {
      '1': 'road',
      '2': 'residential',
      '3': 'commercial',
      '4': 'industrial',
      '5': 'park',
      '6': 'power',
      '7': 'school',
      '8': 'hospital',
      '9': 'police'
    };

    if (keyMap[e.key]) {
      e.preventDefault();
      this.selectBuildingType(keyMap[e.key]);
    }

    // 其他快捷键
    switch (e.key) {
      case ' ': // 空格键暂停
        e.preventDefault();
        this.togglePause();
        break;
      case 's': // S键保存
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          this.saveGame();
        }
        break;
      case 'm': // M键切换菜单
        e.preventDefault();
        this.toggleMenu();
        break;
      case 'a': // A键切换AI
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          this.toggleAI();
        }
        break;
    }
  }

  togglePause() {
    // TODO: 实现暂停功能
    this.showNotification('暂停功能敬请期待', 'info');
  }

  async saveGame() {
    try {
      if (this.scene.gameState.saveId) {
        await this.scene.autoSave();
        this.showNotification('游戏已保存', 'success');
      } else {
        this.showNotification('没有可保存的游戏', 'warning');
      }
    } catch (error) {
      console.error('保存失败:', error);
      this.showNotification('保存失败', 'error');
    }
  }

  toggleMenu() {
    // TODO: 实现游戏内菜单
    this.showNotification('游戏菜单敬请期待', 'info');
  }

  // 显示建筑信息面板
  showBuildingInfo(building) {
    const config = GAME_CONFIG.BUILDINGS[building.type];
    if (!config) return;

    // 创建信息面板
    const infoPanel = document.createElement('div');
    infoPanel.className = 'building-info-panel';
    infoPanel.innerHTML = `
      <div class="info-header">
        <h3>${config.emoji} ${config.name}</h3>
        <button class="close-btn">&times;</button>
      </div>
      <div class="info-content">
        <p><strong>等级:</strong> ${building.level || 1}</p>
        <p><strong>建造成本:</strong> $${config.cost}</p>
        <div class="effects">
          <h4>效果:</h4>
          ${this.renderBuildingEffects(config.effects)}
        </div>
      </div>
    `;

    // 设置样式
    Object.assign(infoPanel.style, {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      background: 'rgba(52, 73, 94, 0.95)',
      color: 'white',
      padding: '20px',
      borderRadius: '8px',
      zIndex: '3000',
      minWidth: '250px',
      maxWidth: '400px'
    });

    // 添加到页面
    document.body.appendChild(infoPanel);

    // 关闭按钮事件
    const closeBtn = infoPanel.querySelector('.close-btn');
    closeBtn.addEventListener('click', () => {
      document.body.removeChild(infoPanel);
    });

    // 点击外部关闭
    const closeOnClickOutside = (e) => {
      if (!infoPanel.contains(e.target)) {
        document.body.removeChild(infoPanel);
        document.removeEventListener('click', closeOnClickOutside);
      }
    };
    setTimeout(() => {
      document.addEventListener('click', closeOnClickOutside);
    }, 100);
  }

  renderBuildingEffects(effects) {
    if (!effects) return '<p>无特殊效果</p>';

    return Object.keys(effects).map(effect => {
      const value = effects[effect];
      const effectName = this.getEffectDisplayName(effect);
      const sign = value > 0 ? '+' : '';
      return `<p>${effectName}: ${sign}${value}</p>`;
    }).join('');
  }

  getEffectDisplayName(effect) {
    const displayNames = {
      population: '人口',
      happiness: '幸福度',
      powerGeneration: '发电量',
      powerConsumption: '耗电量',
      income: '收入',
      jobs: '就业',
      education: '教育',
      health: '健康',
      safety: '安全',
      pollution: '污染',
      environment: '环境',
      traffic: '交通'
    };

    return displayNames[effect] || effect;
  }

  // 显示统计信息
  showStatistics() {
    const stats = this.scene.cityManager.getStatistics();
    
    const statsPanel = document.createElement('div');
    statsPanel.className = 'stats-panel ui-panel';
    statsPanel.innerHTML = `
      <h3>城市统计</h3>
      <div class="stats-content">
        <div class="stat-item">
          <span>总建筑数:</span>
          <span>${stats.totalBuildings}</span>
        </div>
        <div class="stat-item">
          <span>总收入:</span>
          <span>$${stats.totalIncome}</span>
        </div>
        <div class="stat-item">
          <span>总支出:</span>
          <span>$${stats.totalExpenses}</span>
        </div>
        <div class="stat-item">
          <span>净收入:</span>
          <span>$${stats.netIncome}</span>
        </div>
        <div class="stat-item">
          <span>电力平衡:</span>
          <span>${stats.powerBalance}</span>
        </div>
        <div class="stat-item">
          <span>平均地价:</span>
          <span>$${stats.landValueAverage}</span>
        </div>
      </div>
      <button class="close-stats">关闭</button>
    `;

    // 设置位置
    Object.assign(statsPanel.style, {
      position: 'fixed',
      top: '10px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: '1500',
      minWidth: '250px'
    });

    document.body.appendChild(statsPanel);

    // 关闭按钮
    const closeBtn = statsPanel.querySelector('.close-stats');
    closeBtn.addEventListener('click', () => {
      document.body.removeChild(statsPanel);
    });
  }

  // 更新帧率显示
  updateFPS(fps) {
    let fpsDisplay = document.getElementById('fps-display');
    if (!fpsDisplay) {
      fpsDisplay = document.createElement('div');
      fpsDisplay.id = 'fps-display';
      fpsDisplay.style.cssText = `
        position: fixed;
        bottom: 10px;
        left: 10px;
        background: rgba(0,0,0,0.7);
        color: white;
        padding: 5px 10px;
        border-radius: 4px;
        font-size: 12px;
        z-index: 1000;
      `;
      document.body.appendChild(fpsDisplay);
    }
    fpsDisplay.textContent = `FPS: ${Math.round(fps)}`;
  }
} 
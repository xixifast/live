import { GAME_CONFIG, canPlaceBuilding } from '../data/gameConfig.js';
import { aiService } from '../services/AIService.js';

export class AIPlanner {
  constructor(gameScene) {
    this.scene = gameScene;
    this.gameState = gameScene.gameState;
    this.cityManager = gameScene.cityManager;
    
    // AI配置
    this.config = {
      enabled: false,
      planningInterval: 10000, // 10秒规划一次
      budgetReserve: 1000, // 保留资金
      maxBuildingsPerCycle: 3, // 每次规划最多建造3个建筑
      useAIAnalysis: true, // 启用大模型分析
      priorityWeights: {
        population: 0.3,
        happiness: 0.25,
        income: 0.2,
        power: 0.15,
        services: 0.1
      }
    };
    
    // AI状态
    this.planningTimer = null;
    this.currentPlan = null;
    this.planHistory = [];
    this.isPlanning = false;
    this.lastAIAnalysis = null;
    
    // 建筑优先级策略
    this.buildingStrategies = {
      road: { priority: 10, condition: this.needsRoads.bind(this) },
      residential: { priority: 8, condition: this.needsHousing.bind(this) },
      power: { priority: 9, condition: this.needsPower.bind(this) },
      commercial: { priority: 6, condition: this.needsCommerce.bind(this) },
      industrial: { priority: 5, condition: this.needsIndustry.bind(this) },
      park: { priority: 4, condition: this.needsHappiness.bind(this) },
      school: { priority: 3, condition: this.needsEducation.bind(this) },
      hospital: { priority: 3, condition: this.needsHealth.bind(this) },
      police: { priority: 2, condition: this.needsSafety.bind(this) }
    };
  }

  // 启用/禁用AI规划
  setEnabled(enabled) {
    this.config.enabled = enabled;
    
    if (enabled) {
      this.startPlanning();
      this.scene.uiManager.showNotification('🤖 AI城市规划已启用', 'success');
      
      // 测试AI服务连接
      this.testAIService();
    } else {
      this.stopPlanning();
      this.scene.uiManager.showNotification('AI城市规划已禁用', 'info');
    }
  }

  async testAIService() {
    try {
      const result = await aiService.testConnection();
      if (result.success) {
        this.scene.uiManager.showNotification('🧠 大模型AI已连接', 'success');
      } else {
        this.scene.uiManager.showNotification('⚠️ 大模型连接失败，使用本地AI', 'warning');
      }
    } catch (error) {
      console.error('AI service test failed:', error);
    }
  }

  startPlanning() {
    if (this.planningTimer) {
      clearInterval(this.planningTimer);
    }
    
    this.planningTimer = setInterval(() => {
      if (this.config.enabled && !this.isPlanning) {
        this.executePlanningCycle();
      }
    }, this.config.planningInterval);
  }

  stopPlanning() {
    if (this.planningTimer) {
      clearInterval(this.planningTimer);
      this.planningTimer = null;
    }
  }

  // 执行规划周期
  async executePlanningCycle() {
    this.isPlanning = true;
    
    try {
      // 1. 分析当前城市状态
      const analysis = this.analyzeCityState();
      
      // 2. 使用大模型进行深度分析（如果启用）
      let aiAnalysis = null;
      if (this.config.useAIAnalysis) {
        aiAnalysis = await this.getAIAnalysis({ analysis });
        this.lastAIAnalysis = aiAnalysis;
      }
      
      // 3. 生成建造计划
      const plan = this.generateBuildPlan(analysis, aiAnalysis);
      
      // 4. 执行计划
      if (plan.actions.length > 0) {
        await this.executePlan(plan);
        this.planHistory.push({
          timestamp: Date.now(),
          analysis,
          aiAnalysis,
          plan,
          success: true
        });
      }
      
    } catch (error) {
      console.error('AI规划执行失败:', error);
    } finally {
      this.isPlanning = false;
    }
  }

  // 获取大模型分析
  async getAIAnalysis(cityData) {
    try {
      const result = await aiService.analyzeCityState(cityData);
      if (result.success) {
        return result;
      }
    } catch (error) {
      console.error('AI analysis failed:', error);
    }
    return null;
  }

  // 分析城市状态
  analyzeCityState() {
    const resources = this.gameState.resources;
    const buildings = this.gameState.buildings;
    const stats = this.cityManager.getStatistics();
    
    // 确保buildingCounts总是有效的对象
    const buildingCounts = stats.buildingCounts || {};
    
    return {
      // 基础数据
      population: resources.population,
      money: resources.money,
      happiness: resources.happiness,
      powerBalance: stats.powerBalance,
      
      // 建筑统计
      buildingCounts: buildingCounts,
      
      // 需求分析
      needs: {
        housing: this.calculateHousingNeed(),
        power: this.calculatePowerNeed(),
        happiness: this.calculateHappinessNeed(),
        income: this.calculateIncomeNeed(),
        services: this.calculateServiceNeed()
      },
      
      // 发展阶段
      developmentStage: this.getDevelopmentStage(),
      
      // 可用资金（扣除保留资金）
      availableBudget: Math.max(0, resources.money - this.config.budgetReserve)
    };
  }

  // 生成建造计划（增强版，考虑AI分析）
  generateBuildPlan(analysis, aiAnalysis = null) {
    const plan = {
      timestamp: Date.now(),
      analysis,
      aiAnalysis,
      actions: [],
      totalCost: 0,
      expectedBenefit: 0
    };

    // 获取建筑优先级列表
    const priorities = this.calculateBuildingPriorities(analysis, aiAnalysis);
    
    // 按优先级顺序尝试建造
    let remainingBudget = analysis.availableBudget;
    let buildingsPlanned = 0;
    
    for (const item of priorities) {
      if (buildingsPlanned >= this.config.maxBuildingsPerCycle) break;
      if (remainingBudget < item.cost) continue;
      
      // 寻找最佳建造位置
      const location = this.findBestLocation(item.type, analysis);
      if (location) {
        plan.actions.push({
          type: 'build',
          buildingType: item.type,
          location,
          cost: item.cost,
          priority: item.priority,
          reason: item.reason,
          aiReason: item.aiReason // 大模型提供的原因
        });
        
        remainingBudget -= item.cost;
        plan.totalCost += item.cost;
        buildingsPlanned++;
      }
    }

    return plan;
  }

  // 计算建筑优先级（增强版，考虑AI分析）
  calculateBuildingPriorities(analysis, aiAnalysis = null) {
    const priorities = [];
    
    Object.keys(this.buildingStrategies).forEach(buildingType => {
      const strategy = this.buildingStrategies[buildingType];
      const config = GAME_CONFIG.BUILDINGS[buildingType];
      
      if (strategy.condition(analysis)) {
        const priority = this.calculatePriorityScore(buildingType, analysis, aiAnalysis);
        const reason = this.getPriorityReason(buildingType, analysis);
        
        let aiReason = null;
        if (aiAnalysis && aiAnalysis.priorities.includes(buildingType)) {
          aiReason = `AI推荐: ${aiAnalysis.suggestions}`;
        }
        
        priorities.push({
          type: buildingType,
          priority,
          cost: config.cost,
          reason,
          aiReason
        });
      }
    });

    // 如果有AI分析，调整优先级
    if (aiAnalysis && aiAnalysis.priorities) {
      priorities.forEach(item => {
        const aiIndex = aiAnalysis.priorities.indexOf(item.type);
        if (aiIndex !== -1) {
          // AI推荐的建筑增加优先级分数
          item.priority += (3 - aiIndex) * 20; // 第一推荐+60，第二+40，第三+20
        }
      });
    }

    // 按优先级排序（高到低）
    return priorities.sort((a, b) => b.priority - a.priority);
  }

  // 计算优先级分数（增强版）
  calculatePriorityScore(buildingType, analysis, aiAnalysis = null) {
    const strategy = this.buildingStrategies[buildingType];
    let score = strategy.priority * 10; // 基础分数

    // 根据城市需求调整分数
    switch (buildingType) {
      case 'residential':
        if (analysis.needs.housing > 0.7) score += 30;
        break;
      case 'power':
        if (analysis.powerBalance < 10) score += 50;
        break;
      case 'commercial':
        if (analysis.needs.income > 0.6) score += 20;
        break;
      case 'park':
        if (analysis.happiness < 40) score += 25;
        break;
    }

    // 发展阶段调整
    switch (analysis.developmentStage) {
      case 'early':
        if (['road', 'residential', 'power'].includes(buildingType)) score += 15;
        break;
      case 'growth':
        if (['commercial', 'industrial'].includes(buildingType)) score += 15;
        break;
      case 'mature':
        if (['school', 'hospital', 'park'].includes(buildingType)) score += 15;
        break;
    }

    return score;
  }

  // 执行建造计划（增强版，显示AI分析）
  async executePlan(plan) {
    for (const action of plan.actions) {
      if (action.type === 'build') {
        const success = this.executeBuilding(action);
        if (success) {
          // 显示增强的通知信息
          let message = `🤖 AI建造: ${GAME_CONFIG.BUILDINGS[action.buildingType].name}`;
          if (action.aiReason) {
            message += ` (${action.reason})`;
          } else {
            message += ` (${action.reason})`;
          }
          
          this.scene.uiManager.showNotification(message, 'success');
          
          // 添加建造延迟，让玩家能看到过程
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
  }

  // 执行单个建筑建造
  executeBuilding(action) {
    const { buildingType, location } = action;
    
    // 检查资金
    const cost = GAME_CONFIG.BUILDINGS[buildingType].cost;
    if (this.gameState.resources.money < cost) {
      return false;
    }

    // 再次验证位置
    const validation = canPlaceBuilding(buildingType, location.x, location.y, this.gameState);
    if (!validation.canPlace) {
      return false;
    }

    // 创建建筑
    const building = {
      id: Date.now() + Math.random(),
      type: buildingType,
      x: location.x,
      y: location.y,
      level: 1,
      createdAt: Date.now(),
      aiBuilt: true, // 标记为AI建造
      aiReason: action.aiReason // 保存AI推荐原因
    };

    // 扣除资金
    this.gameState.resources.money -= cost;
    
    // 添加到建筑列表
    this.gameState.buildings.push(building);
    
    // 显示AI建造动画
    this.scene.showAIBuildingAnimation(location.x, location.y, buildingType);
    
    // 更新资源显示
    this.scene.uiManager.updateResources();

    return true;
  }

  // 获取AI建议（供玩家参考）
  async getAISuggestions() {
    const analysis = this.analyzeCityState();
    
    // 首先获取本地分析
    const localPriorities = this.calculateBuildingPriorities(analysis);
    
    // 如果启用AI分析，尝试获取大模型建议
    if (this.config.useAIAnalysis) {
      try {
        const aiAnalysis = await this.getAIAnalysis({ analysis });
        if (aiAnalysis && aiAnalysis.success) {
          // 合并AI建议和本地分析
          return this.mergeAISuggestions(localPriorities, aiAnalysis);
        }
      } catch (error) {
        console.error('Failed to get AI suggestions:', error);
      }
    }
    
    // 返回本地分析结果
    return localPriorities.slice(0, 5).map(item => ({
      buildingType: item.type,
      reason: item.reason,
      priority: item.priority,
      cost: item.cost,
      source: 'local'
    }));
  }

  mergeAISuggestions(localPriorities, aiAnalysis) {
    const suggestions = [];
    
    // 优先显示AI推荐的建筑
    aiAnalysis.priorities.forEach((buildingType, index) => {
      const localItem = localPriorities.find(item => item.type === buildingType);
      if (localItem) {
        suggestions.push({
          buildingType,
          reason: `🧠 AI建议: ${aiAnalysis.analysis}`,
          priority: 100 - index * 10, // AI建议优先级最高
          cost: localItem.cost,
          source: 'ai',
          aiAnalysis: aiAnalysis.suggestions
        });
      }
    });
    
    // 补充本地分析的建筑
    localPriorities.slice(0, 5 - suggestions.length).forEach(item => {
      if (!suggestions.find(s => s.buildingType === item.type)) {
        suggestions.push({
          buildingType: item.type,
          reason: item.reason,
          priority: item.priority,
          cost: item.cost,
          source: 'local'
        });
      }
    });
    
    return suggestions.slice(0, 5);
  }

  // 需求判断函数
  needsRoads(analysis) {
    const buildingCounts = analysis.buildingCounts || {};
    const roadCount = buildingCounts.road || 0;
    const totalBuildings = (buildingCounts.residential || 0) + 
                          (buildingCounts.commercial || 0) + 
                          (buildingCounts.industrial || 0);
    return roadCount < totalBuildings * 0.3; // 道路数量应该是其他建筑的30%
  }

  needsHousing(analysis) {
    const buildingCounts = analysis.buildingCounts || {};
    const housing = buildingCounts.residential || 0;
    const population = analysis.population;
    const capacity = housing * 4;
    return population > capacity * 0.8; // 入住率超过80%需要更多住房
  }

  needsPower(analysis) {
    return analysis.powerBalance < 20; // 电力余量小于20
  }

  needsCommerce(analysis) {
    const buildingCounts = analysis.buildingCounts || {};
    const commercial = buildingCounts.commercial || 0;
    const residential = buildingCounts.residential || 0;
    return residential > 0 && commercial < residential * 0.5; // 商业建筑少于住宅的50%
  }

  needsIndustry(analysis) {
    const buildingCounts = analysis.buildingCounts || {};
    const industrial = buildingCounts.industrial || 0;
    const population = analysis.population;
    return population > 20 && industrial < Math.floor(population / 20); // 每20人需要1个工业建筑
  }

  needsHappiness(analysis) {
    return analysis.happiness < 60; // 幸福度低于60%
  }

  needsEducation(analysis) {
    const buildingCounts = analysis.buildingCounts || {};
    const schools = buildingCounts.school || 0;
    const population = analysis.population;
    return population > 50 && schools < Math.floor(population / 50); // 每50人需要1个学校
  }

  needsHealth(analysis) {
    const buildingCounts = analysis.buildingCounts || {};
    const hospitals = buildingCounts.hospital || 0;
    const population = analysis.population;
    return population > 80 && hospitals < Math.floor(population / 80); // 每80人需要1个医院
  }

  needsSafety(analysis) {
    const buildingCounts = analysis.buildingCounts || {};
    const police = buildingCounts.police || 0;
    const population = analysis.population;
    return population > 60 && police < Math.floor(population / 60); // 每60人需要1个警察局
  }

  // 计算各种需求指数
  calculateHousingNeed() {
    const housing = (this.gameState.buildings.filter(b => b.type === 'residential').length || 0) * 4;
    const population = this.gameState.resources.population;
    return population / Math.max(housing, 1);
  }

  calculatePowerNeed() {
    const stats = this.cityManager.getStatistics();
    return Math.max(0, 1 - stats.powerBalance / 50);
  }

  calculateHappinessNeed() {
    return Math.max(0, (60 - this.gameState.resources.happiness) / 60);
  }

  calculateIncomeNeed() {
    const stats = this.cityManager.getStatistics();
    return Math.max(0, -stats.netIncome / 100);
  }

  calculateServiceNeed() {
    const population = this.gameState.resources.population;
    const services = ['school', 'hospital', 'police'].reduce((sum, type) => {
      return sum + (this.gameState.buildings.filter(b => b.type === type).length || 0);
    }, 0);
    return Math.max(0, population / 30 - services);
  }

  // 获取发展阶段
  getDevelopmentStage() {
    const population = this.gameState.resources.population;
    const totalBuildings = this.gameState.buildings.length;
    
    if (population < 20 || totalBuildings < 10) return 'early';
    if (population < 100 || totalBuildings < 30) return 'growth';
    return 'mature';
  }

  // 寻找最佳建造位置
  findBestLocation(buildingType, analysis) {
    const config = GAME_CONFIG.BUILDINGS[buildingType];
    const searchRadius = 10; // 搜索半径
    
    let bestLocation = null;
    let bestScore = -1;

    // 获取搜索中心点
    const centers = this.getSearchCenters();
    
    for (const center of centers) {
      for (let x = center.x - searchRadius; x <= center.x + searchRadius; x++) {
        for (let y = center.y - searchRadius; y <= center.y + searchRadius; y++) {
          // 检查是否可以建造
          const validation = canPlaceBuilding(buildingType, x, y, this.gameState);
          if (!validation.canPlace) continue;

          // 评估位置分数
          const score = this.evaluateLocation(buildingType, x, y, analysis);
          if (score > bestScore) {
            bestScore = score;
            bestLocation = { x, y, score };
          }
        }
      }
    }

    return bestLocation;
  }

  // 获取搜索中心点
  getSearchCenters() {
    const centers = [{ x: 0, y: 0 }]; // 默认中心点
    
    // 添加现有建筑附近的点
    this.gameState.buildings.forEach(building => {
      if (building.type === 'residential' || building.type === 'commercial') {
        centers.push({ x: building.x, y: building.y });
      }
    });

    return centers;
  }

  // 评估建造位置
  evaluateLocation(buildingType, x, y, analysis) {
    let score = 50; // 基础分数

    // 使用城市管理器的位置评估
    const evaluation = this.cityManager.evaluateBuildingLocation(x, y, buildingType);
    score += evaluation.score * 0.5;

    // 距离现有建筑的影响
    const distanceScore = this.calculateDistanceScore(buildingType, x, y);
    score += distanceScore;

    // 特殊建筑类型的额外考虑
    switch (buildingType) {
      case 'industrial':
        // 工业建筑远离住宅区
        const residentialDistance = this.getMinDistanceToType(x, y, 'residential');
        if (residentialDistance > 3) score += 20;
        break;
        
      case 'park':
        // 公园靠近住宅区
        const nearResidential = this.countNearbyBuildings(x, y, 'residential', 3);
        score += nearResidential * 5;
        break;
    }

    return score;
  }

  // 辅助函数
  calculateDistanceScore(buildingType, x, y) {
    // 根据建筑类型计算与其他建筑的距离分数
    let score = 0;
    
    this.gameState.buildings.forEach(building => {
      const distance = Math.sqrt(Math.pow(x - building.x, 2) + Math.pow(y - building.y, 2));
      
      if (buildingType === 'commercial' && building.type === 'residential') {
        // 商业建筑靠近住宅加分
        score += Math.max(0, 10 - distance);
      } else if (buildingType === 'industrial' && building.type === 'residential') {
        // 工业建筑远离住宅加分
        score += Math.min(10, distance);
      }
    });
    
    return score;
  }

  getMinDistanceToType(x, y, buildingType) {
    let minDistance = Infinity;
    
    this.gameState.buildings.forEach(building => {
      if (building.type === buildingType) {
        const distance = Math.sqrt(Math.pow(x - building.x, 2) + Math.pow(y - building.y, 2));
        minDistance = Math.min(minDistance, distance);
      }
    });
    
    return minDistance === Infinity ? 0 : minDistance;
  }

  countNearbyBuildings(x, y, buildingType, radius) {
    return this.gameState.buildings.filter(building => {
      if (building.type !== buildingType) return false;
      const distance = Math.sqrt(Math.pow(x - building.x, 2) + Math.pow(y - building.y, 2));
      return distance <= radius;
    }).length;
  }

  getPriorityReason(buildingType, analysis) {
    switch (buildingType) {
      case 'road': return '改善交通';
      case 'residential': return '增加人口';
      case 'power': return '电力不足';
      case 'commercial': return '提升收入';
      case 'industrial': return '增加就业';
      case 'park': return '改善幸福度';
      case 'school': return '提供教育';
      case 'hospital': return '医疗保障';
      case 'police': return '维护治安';
      default: return '城市发展';
    }
  }

  // 获取AI状态信息
  getAIStatus() {
    return {
      enabled: this.config.enabled,
      isPlanning: this.isPlanning,
      useAIAnalysis: this.config.useAIAnalysis,
      lastPlan: this.planHistory[this.planHistory.length - 1] || null,
      totalPlans: this.planHistory.length,
      lastAIAnalysis: this.lastAIAnalysis
    };
  }
} 
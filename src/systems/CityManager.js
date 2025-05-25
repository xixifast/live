import { GAME_CONFIG } from '../data/gameConfig.js';

export class CityManager {
  constructor(gameScene) {
    this.scene = gameScene;
    this.gameState = gameScene.gameState;
    this.statistics = {
      totalBuildings: 0,
      totalIncome: 0,
      totalExpenses: 0,
      happinessFactors: {},
      powerGeneration: 0,
      powerConsumption: 0
    };
    
    // 初始化建筑统计，防止undefined错误
    this.buildingCounts = {};
    this.buildingEffects = {};
  }

  // 更新所有资源
  updateResources() {
    // 重置统计数据
    this.resetStatistics();
    
    // 计算建筑效果
    this.calculateBuildingEffects();
    
    // 计算税收
    this.calculateTaxIncome();
    
    // 计算维护费用
    this.calculateMaintenanceCosts();
    
    // 更新资源
    this.applyResourceChanges();
    
    // 检查资源限制
    this.checkResourceLimits();
  }

  resetStatistics() {
    this.statistics = {
      totalBuildings: this.gameState.buildings.length,
      totalIncome: 0,
      totalExpenses: 0,
      happinessFactors: {
        base: 50,
        buildings: 0,
        services: 0,
        pollution: 0,
        overcrowding: 0
      },
      powerGeneration: 0,
      powerConsumption: 0,
      populationGrowth: 0,
      educationLevel: 0,
      healthLevel: 0,
      safetyLevel: 0,
      pollutionLevel: 0
    };
  }

  calculateBuildingEffects() {
    const buildingCounts = {};
    const buildingEffects = {
      population: 0,
      happiness: 0,
      powerGeneration: 0,
      powerConsumption: 0,
      income: 0,
      jobs: 0,
      education: 0,
      health: 0,
      safety: 0,
      pollution: 0,
      environment: 0
    };

    // 统计建筑数量和效果
    this.gameState.buildings.forEach(building => {
      const config = GAME_CONFIG.BUILDINGS[building.type];
      if (!config || !config.effects) return;

      // 计数
      buildingCounts[building.type] = (buildingCounts[building.type] || 0) + 1;

      // 累加效果
      Object.keys(config.effects).forEach(effect => {
        if (buildingEffects.hasOwnProperty(effect)) {
          buildingEffects[effect] += config.effects[effect];
        }
      });
    });

    // 更新游戏状态
    this.gameState.resources.population = Math.max(0, buildingEffects.population);
    this.statistics.powerGeneration = buildingEffects.powerGeneration;
    this.statistics.powerConsumption = buildingEffects.powerConsumption;
    
    // 更新幸福度因子
    this.statistics.happinessFactors.buildings = buildingEffects.happiness;
    this.statistics.happinessFactors.services = this.calculateServiceBonus();
    this.statistics.happinessFactors.pollution = -buildingEffects.pollution * 2;
    this.statistics.happinessFactors.overcrowding = this.calculateOvercrowdingPenalty();

    // 更新其他资源
    this.gameState.resources.education = Math.max(0, buildingEffects.education);
    this.gameState.resources.health = Math.max(0, buildingEffects.health);
    this.gameState.resources.safety = Math.max(0, buildingEffects.safety);
    this.gameState.resources.pollution = Math.max(0, buildingEffects.pollution);

    // 存储建筑计数以供其他计算使用
    this.buildingCounts = buildingCounts;
    this.buildingEffects = buildingEffects;
  }

  calculateServiceBonus() {
    // 根据服务建筑的覆盖率计算服务奖励
    const serviceBuildings = ['school', 'hospital', 'police', 'park'];
    const totalPopulation = this.gameState.resources.population;
    
    if (totalPopulation === 0) return 0;

    // 安全获取建筑统计
    const buildingCounts = this.buildingCounts || {};

    let serviceBonus = 0;
    serviceBuildings.forEach(type => {
      const count = buildingCounts[type] || 0;
      const config = GAME_CONFIG.BUILDINGS[type];
      if (config && config.effects) {
        // 简单的服务覆盖率计算
        const serviceCapacity = count * 20; // 每个服务建筑服务20人
        const coverage = Math.min(1, serviceCapacity / totalPopulation);
        serviceBonus += coverage * 5; // 每种服务满覆盖提供5点幸福度
      }
    });

    return Math.floor(serviceBonus);
  }

  calculateOvercrowdingPenalty() {
    // 计算过度拥挤惩罚
    const population = this.gameState.resources.population;
    
    // 安全获取建筑统计
    const buildingCounts = this.buildingCounts || {};
    const residentialBuildings = buildingCounts.residential || 0;
    
    if (residentialBuildings === 0) return 0;

    const averageOccupancy = population / (residentialBuildings * 4); // 每个住宅容纳4人
    
    if (averageOccupancy > 1.5) {
      return -Math.floor((averageOccupancy - 1.5) * 10);
    }
    
    return 0;
  }

  calculateTaxIncome() {
    const population = this.gameState.resources.population;
    
    // 安全获取建筑统计
    const buildingCounts = this.buildingCounts || {};
    const commercialBuildings = buildingCounts.commercial || 0;
    const industrialBuildings = buildingCounts.industrial || 0;

    // 住宅税收
    const residentialTax = population * GAME_CONFIG.MECHANICS.TAX_RATE_RESIDENTIAL;
    
    // 商业税收
    const commercialTax = commercialBuildings * GAME_CONFIG.MECHANICS.TAX_RATE_COMMERCIAL;
    
    // 工业税收
    const industrialTax = industrialBuildings * GAME_CONFIG.MECHANICS.TAX_RATE_INDUSTRIAL;

    // 幸福度影响税收效率
    const happiness = this.calculateHappiness();
    const taxEfficiency = Math.max(0.5, happiness / 100); // 50%-100%效率

    this.statistics.totalIncome = Math.floor(
      (residentialTax + commercialTax + industrialTax) * taxEfficiency
    );
  }

  calculateMaintenanceCosts() {
    let totalMaintenance = 0;

    this.gameState.buildings.forEach(building => {
      const config = GAME_CONFIG.BUILDINGS[building.type];
      if (config) {
        totalMaintenance += config.cost * GAME_CONFIG.MECHANICS.MAINTENANCE_RATE;
      }
    });

    this.statistics.totalExpenses = Math.floor(totalMaintenance);
  }

  calculateHappiness() {
    const factors = this.statistics.happinessFactors;
    let totalHappiness = factors.base + factors.buildings + factors.services + 
                        factors.pollution + factors.overcrowding;

    // 电力不足的惩罚
    if (this.statistics.powerConsumption > this.statistics.powerGeneration) {
      totalHappiness -= 20;
    }

    return Math.max(0, Math.min(100, totalHappiness));
  }

  applyResourceChanges() {
    // 应用收入和支出
    const netIncome = this.statistics.totalIncome - this.statistics.totalExpenses;
    this.gameState.resources.money += netIncome;

    // 更新幸福度
    this.gameState.resources.happiness = this.calculateHappiness();

    // 更新电力状态
    this.gameState.resources.power = this.statistics.powerGeneration;
    this.gameState.resources.powerUsed = this.statistics.powerConsumption;
  }

  checkResourceLimits() {
    // 防止资金为负数
    if (this.gameState.resources.money < 0) {
      this.gameState.resources.money = 0;
      // 可以在这里添加破产逻辑
    }

    // 限制各种资源的范围
    this.gameState.resources.happiness = Math.max(0, Math.min(100, this.gameState.resources.happiness));
    this.gameState.resources.education = Math.max(0, this.gameState.resources.education);
    this.gameState.resources.health = Math.max(0, this.gameState.resources.health);
    this.gameState.resources.safety = Math.max(0, this.gameState.resources.safety);
    this.gameState.resources.pollution = Math.max(0, this.gameState.resources.pollution);
  }

  // 获取建筑在特定位置的影响
  getBuildingInfluenceAt(x, y, influenceType) {
    let totalInfluence = 0;

    this.gameState.buildings.forEach(building => {
      const config = GAME_CONFIG.BUILDINGS[building.type];
      if (!config || !config.effects || !config.effects[influenceType]) return;

      const radius = GAME_CONFIG.MECHANICS.INFLUENCE_RADIUS[building.type] || 0;
      if (radius === 0) return;

      const distance = Math.sqrt(
        Math.pow(x - building.x, 2) + Math.pow(y - building.y, 2)
      );

      if (distance <= radius) {
        // 距离越近影响越大
        const influence = config.effects[influenceType] * (1 - distance / radius);
        totalInfluence += influence;
      }
    });

    return totalInfluence;
  }

  // 获取指定区域的土地价值
  getLandValue(x, y) {
    let baseValue = 100; // 基础土地价值

    // 考虑周围建筑的影响
    const parkInfluence = this.getBuildingInfluenceAt(x, y, 'happiness');
    const pollutionInfluence = this.getBuildingInfluenceAt(x, y, 'pollution');
    const serviceInfluence = this.getBuildingInfluenceAt(x, y, 'education') +
                           this.getBuildingInfluenceAt(x, y, 'health') +
                           this.getBuildingInfluenceAt(x, y, 'safety');

    let value = baseValue + parkInfluence * 5 + serviceInfluence * 2 - pollutionInfluence * 3;
    
    return Math.max(50, Math.floor(value)); // 最低50的土地价值
  }

  // 检查某个位置是否适合建造特定类型的建筑
  evaluateBuildingLocation(x, y, buildingType) {
    const config = GAME_CONFIG.BUILDINGS[buildingType];
    if (!config) return { score: 0, reasons: [] };

    let score = 50; // 基础分数
    const reasons = [];

    // 根据建筑类型评估
    switch (buildingType) {
      case 'residential':
        // 住宅喜欢靠近服务设施，远离污染
        const serviceBonus = this.getBuildingInfluenceAt(x, y, 'education') +
                           this.getBuildingInfluenceAt(x, y, 'health') +
                           this.getBuildingInfluenceAt(x, y, 'safety');
        const pollutionPenalty = this.getBuildingInfluenceAt(x, y, 'pollution');
        
        score += serviceBonus * 2 - pollutionPenalty * 3;
        if (serviceBonus > 0) reasons.push('靠近服务设施');
        if (pollutionPenalty > 0) reasons.push('污染严重');
        break;

      case 'commercial':
        // 商业喜欢人流量大的地方
        const nearbyPopulation = this.getBuildingInfluenceAt(x, y, 'population');
        score += nearbyPopulation * 1.5;
        if (nearbyPopulation > 0) reasons.push('人口密集');
        break;

      case 'industrial':
        // 工业可以远离住宅区
        const residentialNearby = this.countNearbyBuildings(x, y, 'residential', 3);
        score -= residentialNearby * 5;
        if (residentialNearby > 0) reasons.push('靠近住宅区');
        break;
    }

    return {
      score: Math.max(0, Math.min(100, score)),
      reasons
    };
  }

  // 计算附近特定类型建筑的数量
  countNearbyBuildings(x, y, buildingType, radius) {
    return this.gameState.buildings.filter(building => {
      if (building.type !== buildingType) return false;
      const distance = Math.sqrt(
        Math.pow(x - building.x, 2) + Math.pow(y - building.y, 2)
      );
      return distance <= radius;
    }).length;
  }

  // 获取当前统计数据
  getStatistics() {
    // 确保buildingCounts总是有效的
    const buildingCounts = this.buildingCounts || {};
    
    // 如果buildingCounts为空，重新计算
    if (Object.keys(buildingCounts).length === 0) {
      this.gameState.buildings.forEach(building => {
        buildingCounts[building.type] = (buildingCounts[building.type] || 0) + 1;
      });
    }
    
    return {
      ...this.statistics,
      netIncome: this.statistics.totalIncome - this.statistics.totalExpenses,
      powerBalance: this.statistics.powerGeneration - this.statistics.powerConsumption,
      buildingCounts: buildingCounts,
      landValueAverage: this.calculateAverageLandValue()
    };
  }

  calculateAverageLandValue() {
    if (this.gameState.buildings.length === 0) return 100;

    let totalValue = 0;
    this.gameState.buildings.forEach(building => {
      totalValue += this.getLandValue(building.x, building.y);
    });

    return Math.floor(totalValue / this.gameState.buildings.length);
  }

  // 模拟人口增长
  simulatePopulationGrowth() {
    const happiness = this.gameState.resources.happiness;
    const currentPopulation = this.gameState.resources.population;
    
    // 安全获取建筑统计
    const buildingCounts = this.buildingCounts || {};
    const housingCapacity = (buildingCounts.residential || 0) * 4;

    if (currentPopulation < housingCapacity && happiness > 60) {
      // 幸福的城市会吸引新居民
      const growthRate = (happiness - 60) / 100;
      const newResidents = Math.floor(growthRate * 2);
      this.statistics.populationGrowth = newResidents;
    } else if (happiness < 40) {
      // 不幸福的城市会失去居民
      const shrinkRate = (40 - happiness) / 100;
      const leavingResidents = Math.floor(shrinkRate * 2);
      this.statistics.populationGrowth = -leavingResidents;
    }
  }
} 
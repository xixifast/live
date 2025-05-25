// 游戏配置文件
export const GAME_CONFIG = {
  // 地图设置
  MAP: {
    TILE_SIZE: 32,
    CHUNK_SIZE: 16,
    INITIAL_VIEW_SIZE: { width: 50, height: 50 }
  },

  // 建筑类型配置
  BUILDINGS: {
    road: {
      name: '道路',
      emoji: '🛣️',
      cost: 10,
      size: { width: 1, height: 1 },
      effects: {
        traffic: 1
      },
      color: 0x666666
    },
    
    residential: {
      name: '住宅',
      emoji: '🏠',
      cost: 100,
      size: { width: 1, height: 1 },
      effects: {
        population: 4,
        happiness: 2,
        powerConsumption: 2
      },
      color: 0x90EE90,
      requirements: {
        nearRoad: true
      }
    },
    
    commercial: {
      name: '商业',
      emoji: '🏪',
      cost: 150,
      size: { width: 1, height: 1 },
      effects: {
        income: 8,
        jobs: 6,
        happiness: 1,
        powerConsumption: 3
      },
      color: 0x87CEEB,
      requirements: {
        nearRoad: true,
        nearResidential: true
      }
    },
    
    industrial: {
      name: '工业',
      emoji: '🏭',
      cost: 200,
      size: { width: 2, height: 2 },
      effects: {
        income: 15,
        jobs: 10,
        pollution: 3,
        powerConsumption: 5
      },
      color: 0xCD853F,
      requirements: {
        nearRoad: true
      }
    },
    
    park: {
      name: '公园',
      emoji: '🌳',
      cost: 50,
      size: { width: 1, height: 1 },
      effects: {
        happiness: 8,
        environment: 5
      },
      color: 0x228B22
    },
    
    power: {
      name: '发电厂',
      emoji: '⚡',
      cost: 500,
      size: { width: 2, height: 2 },
      effects: {
        powerGeneration: 50,
        pollution: 2,
        jobs: 5
      },
      color: 0xFFD700,
      requirements: {
        nearRoad: true
      }
    },
    
    school: {
      name: '学校',
      emoji: '🏫',
      cost: 300,
      size: { width: 2, height: 2 },
      effects: {
        education: 15,
        happiness: 3,
        jobs: 8,
        powerConsumption: 4
      },
      color: 0x4169E1,
      requirements: {
        nearRoad: true
      }
    },
    
    hospital: {
      name: '医院',
      emoji: '🏥',
      cost: 400,
      size: { width: 2, height: 2 },
      effects: {
        health: 20,
        happiness: 5,
        jobs: 12,
        powerConsumption: 6
      },
      color: 0xDC143C,
      requirements: {
        nearRoad: true
      }
    },
    
    police: {
      name: '警察局',
      emoji: '👮',
      cost: 250,
      size: { width: 1, height: 1 },
      effects: {
        safety: 15,
        happiness: 2,
        jobs: 6,
        powerConsumption: 3
      },
      color: 0x000080,
      requirements: {
        nearRoad: true
      }
    }
  },

  // 初始资源
  INITIAL_RESOURCES: {
    money: 10000,
    population: 0,
    happiness: 50,
    power: 100,
    powerUsed: 0,
    pollution: 0,
    education: 0,
    health: 0,
    safety: 0
  },

  // 游戏机制常量
  MECHANICS: {
    // 税收相关
    TAX_RATE_RESIDENTIAL: 5, // 每个人口单位的税收
    TAX_RATE_COMMERCIAL: 10, // 每个商业建筑的基础税收
    TAX_RATE_INDUSTRIAL: 15, // 每个工业建筑的基础税收
    
    // 维护成本
    MAINTENANCE_RATE: 0.01, // 建筑价值的1%作为维护费用
    
    // 影响半径
    INFLUENCE_RADIUS: {
      park: 3,
      school: 5,
      hospital: 4,
      police: 4,
      power: 6
    },
    
    // 道路检查半径
    ROAD_CHECK_RADIUS: 2,
    
    // 游戏循环
    UPDATE_INTERVAL: 5000, // 5秒更新一次
    AUTOSAVE_INTERVAL: 30000 // 30秒自动保存
  },

  // UI 常量
  UI: {
    RESOURCE_PANEL_WIDTH: 200,
    BUILD_PANEL_WIDTH: 150,
    NOTIFICATION_DURATION: 3000
  }
};

// 建筑验证函数
export function canPlaceBuilding(buildingType, x, y, gameState) {
  const config = GAME_CONFIG.BUILDINGS[buildingType];
  if (!config) return false;

  // 检查资金
  if (gameState.resources.money < config.cost) {
    return { canPlace: false, reason: '资金不足' };
  }

  // 检查区域是否空闲
  for (let dx = 0; dx < config.size.width; dx++) {
    for (let dy = 0; dy < config.size.height; dy++) {
      const checkX = x + dx;
      const checkY = y + dy;
      
      if (gameState.buildings.some(b => 
        b.x === checkX && b.y === checkY
      )) {
        return { canPlace: false, reason: '位置被占用' };
      }
    }
  }

  // 检查特殊要求
  if (config.requirements) {
    if (config.requirements.nearRoad) {
      const hasNearbyRoad = checkNearbyRoad(x, y, config.size, gameState);
      if (!hasNearbyRoad) {
        return { canPlace: false, reason: '需要靠近道路' };
      }
    }

    if (config.requirements.nearResidential) {
      const hasNearbyResidential = checkNearbyBuilding(x, y, config.size, gameState, 'residential');
      if (!hasNearbyResidential) {
        return { canPlace: false, reason: '需要靠近住宅区' };
      }
    }
  }

  return { canPlace: true };
}

// 检查附近是否有道路
function checkNearbyRoad(x, y, size, gameState) {
  const radius = GAME_CONFIG.MECHANICS.ROAD_CHECK_RADIUS;
  
  for (let dx = -radius; dx <= size.width + radius; dx++) {
    for (let dy = -radius; dy <= size.height + radius; dy++) {
      const checkX = x + dx;
      const checkY = y + dy;
      
      if (gameState.buildings.some(b => 
        b.x === checkX && b.y === checkY && b.type === 'road'
      )) {
        return true;
      }
    }
  }
  
  return false;
}

// 检查附近是否有特定类型的建筑
function checkNearbyBuilding(x, y, size, gameState, buildingType) {
  const radius = 3;
  
  for (let dx = -radius; dx <= size.width + radius; dx++) {
    for (let dy = -radius; dy <= size.height + radius; dy++) {
      const checkX = x + dx;
      const checkY = y + dy;
      
      if (gameState.buildings.some(b => 
        b.x === checkX && b.y === checkY && b.type === buildingType
      )) {
        return true;
      }
    }
  }
  
  return false;
} 
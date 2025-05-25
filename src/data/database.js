import Dexie from 'dexie';

// 游戏数据库类
class CityBuilderDB extends Dexie {
  constructor() {
    super('CityBuilderDB');
    
    this.version(1).stores({
      // 游戏存档
      saves: '++id, name, timestamp, gameData',
      
      // 地图数据
      maps: '++id, name, size, tiles',
      
      // 建筑数据
      buildings: '++id, saveId, type, x, y, level, data',
      
      // 道路网络
      roads: '++id, saveId, fromX, fromY, toX, toY, type',
      
      // 统计数据
      statistics: '++id, saveId, timestamp, metrics',
      
      // 设置
      settings: 'key, value'
    });
  }

  // 创建新的游戏存档
  async createSave(name, gameData) {
    const saveId = await this.saves.add({
      name,
      timestamp: Date.now(),
      gameData
    });
    return saveId;
  }

  // 加载游戏存档
  async loadSave(id) {
    const save = await this.saves.get(id);
    if (!save) return null;

    const buildings = await this.buildings.where('saveId').equals(id).toArray();
    const roads = await this.roads.where('saveId').equals(id).toArray();
    const stats = await this.statistics.where('saveId').equals(id).orderBy('timestamp').last();

    return {
      ...save,
      buildings,
      roads,
      statistics: stats?.metrics || {}
    };
  }

  // 保存游戏状态
  async saveGameState(saveId, gameData, buildings, roads, stats) {
    await this.transaction('rw', this.saves, this.buildings, this.roads, this.statistics, async () => {
      // 更新存档基本信息
      await this.saves.update(saveId, {
        timestamp: Date.now(),
        gameData
      });

      // 清除旧的建筑和道路数据
      await this.buildings.where('saveId').equals(saveId).delete();
      await this.roads.where('saveId').equals(saveId).delete();

      // 保存新的建筑数据
      if (buildings.length > 0) {
        await this.buildings.bulkAdd(buildings.map(b => ({ ...b, saveId })));
      }

      // 保存新的道路数据
      if (roads.length > 0) {
        await this.roads.bulkAdd(roads.map(r => ({ ...r, saveId })));
      }

      // 保存统计数据
      await this.statistics.add({
        saveId,
        timestamp: Date.now(),
        metrics: stats
      });
    });
  }

  // 获取所有存档
  async getAllSaves() {
    return await this.saves.orderBy('timestamp').reverse().toArray();
  }

  // 删除存档
  async deleteSave(id) {
    await this.transaction('rw', this.saves, this.buildings, this.roads, this.statistics, async () => {
      await this.saves.delete(id);
      await this.buildings.where('saveId').equals(id).delete();
      await this.roads.where('saveId').equals(id).delete();
      await this.statistics.where('saveId').equals(id).delete();
    });
  }

  // 保存设置
  async saveSetting(key, value) {
    await this.settings.put({ key, value });
  }

  // 加载设置
  async loadSetting(key, defaultValue = null) {
    const setting = await this.settings.get(key);
    return setting ? setting.value : defaultValue;
  }
}

// 导出数据库实例
export const gameDB = new CityBuilderDB(); 
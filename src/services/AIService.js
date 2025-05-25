import OpenAI from "openai";

class AIService {
  constructor() {
    this.openai = null;
    this.isInitialized = false;
    this.initializeClient();
  }

  initializeClient() {
    try {
      // 从环境变量获取API密钥
      const apiKey = this.getAPIKey();
      
      if (!apiKey) {
        console.warn('DASHSCOPE_API_KEY not found in environment variables');
        return;
      }

      this.openai = new OpenAI({
        apiKey: apiKey,
        baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1"
      });
      
      this.isInitialized = true;
      console.log('AI Service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize AI Service:', error);
    }
  }

  getAPIKey() {
    // 尝试从不同来源获取API密钥
    if (typeof process !== 'undefined' && process.env) {
      return process.env.DASHSCOPE_API_KEY;
    }
    
    // 浏览器环境下从localStorage获取（开发用）
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('DASHSCOPE_API_KEY');
    }
    
    return null;
  }

  async testConnection() {
    if (!this.isInitialized) {
      throw new Error('AI Service not initialized');
    }

    try {
      const completion = await this.openai.chat.completions.create({
        model: "qwen-plus",
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: "Hello" }
        ],
        max_tokens: 50
      });

      return {
        success: true,
        response: completion.choices[0].message.content
      };
    } catch (error) {
      console.error('AI Service test failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async analyzeCityState(cityData) {
    if (!this.isInitialized) {
      return this.getFallbackAnalysis(cityData);
    }

    try {
      const prompt = this.buildCityAnalysisPrompt(cityData);
      
      const completion = await this.openai.chat.completions.create({
        model: "qwen-plus",
        messages: [
          { 
            role: "system", 
            content: "你是一个专业的城市规划专家，擅长分析城市发展状况并提供建设建议。请用简洁明了的中文回答。" 
          },
          { role: "user", content: prompt }
        ],
        max_tokens: 800,
        temperature: 0.7
      });

      const response = completion.choices[0].message.content;
      return this.parseAIResponse(response, cityData);
      
    } catch (error) {
      console.error('AI analysis failed:', error);
      return this.getFallbackAnalysis(cityData);
    }
  }

  buildCityAnalysisPrompt(cityData) {
    const { analysis } = cityData;
    
    // 安全获取建筑统计，防止undefined错误
    const buildingCounts = analysis.buildingCounts || {};
    
    return `请分析以下城市状况并提供发展建议：

城市基本状况：
- 人口：${analysis.population}人
- 资金：$${analysis.money}
- 幸福度：${analysis.happiness}%
- 电力平衡：${analysis.powerBalance}

建筑统计：
- 住宅：${buildingCounts.residential || 0}栋
- 商业：${buildingCounts.commercial || 0}栋
- 工业：${buildingCounts.industrial || 0}栋
- 道路：${buildingCounts.road || 0}条
- 发电厂：${buildingCounts.power || 0}座
- 学校：${buildingCounts.school || 0}所
- 医院：${buildingCounts.hospital || 0}所
- 警察局：${buildingCounts.police || 0}所
- 公园：${buildingCounts.park || 0}个

发展阶段：${analysis.developmentStage === 'early' ? '早期' : analysis.developmentStage === 'growth' ? '成长期' : '成熟期'}

可用预算：$${analysis.availableBudget}

请分析：
1. 当前城市的主要问题和优势
2. 下一步发展的重点方向
3. 具体的建设建议（优先级排序）
4. 潜在的风险和解决方案

请用JSON格式回复，包含以下字段：
{
  "analysis": "城市状况分析",
  "priorities": ["优先建设项目1", "优先建设项目2", "优先建设项目3"],
  "suggestions": "详细建议",
  "risks": "风险提示"
}`;
  }

  parseAIResponse(response, cityData) {
    try {
      // 尝试解析JSON响应
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          success: true,
          analysis: parsed.analysis || "AI分析中...",
          priorities: parsed.priorities || [],
          suggestions: parsed.suggestions || "正在生成建议...",
          risks: parsed.risks || "暂无风险提示",
          rawResponse: response
        };
      }
      
      // 如果不是JSON格式，尝试提取关键信息
      return {
        success: true,
        analysis: response.substring(0, 200) + "...",
        priorities: this.extractPriorities(response),
        suggestions: response,
        risks: "请关注资源平衡",
        rawResponse: response
      };
      
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      return this.getFallbackAnalysis(cityData);
    }
  }

  extractPriorities(text) {
    // 简单的优先级提取逻辑
    const priorities = [];
    const keywords = {
      '道路': 'road',
      '住宅': 'residential', 
      '电力': 'power',
      '发电': 'power',
      '商业': 'commercial',
      '工业': 'industrial',
      '学校': 'school',
      '医院': 'hospital',
      '警察': 'police',
      '公园': 'park'
    };

    Object.keys(keywords).forEach(keyword => {
      if (text.includes(keyword) && priorities.length < 3) {
        priorities.push(keywords[keyword]);
      }
    });

    return priorities;
  }

  getFallbackAnalysis(cityData) {
    const { analysis } = cityData;
    
    // 安全获取建筑统计
    const buildingCounts = analysis.buildingCounts || {};
    
    // 基于规则的后备分析
    let mainIssue = "城市发展良好";
    let priority = "residential";
    
    if (analysis.powerBalance < 0) {
      mainIssue = "电力供应不足，需要建设发电厂";
      priority = "power";
    } else if (analysis.happiness < 40) {
      mainIssue = "居民幸福度较低，需要改善生活环境";
      priority = "park";
    } else if (analysis.population > (buildingCounts.residential || 0) * 4) {
      mainIssue = "住房需求紧张，需要增加住宅建设";
      priority = "residential";
    }

    return {
      success: false,
      analysis: mainIssue,
      priorities: [priority, "road", "commercial"],
      suggestions: "建议优先解决基础设施问题，然后发展经济和改善民生。",
      risks: "注意保持资源平衡，避免过度发展导致财政困难。",
      rawResponse: "使用本地分析"
    };
  }

  async generateBuildingSuggestion(buildingType, context) {
    if (!this.isInitialized) {
      return this.getFallbackSuggestion(buildingType);
    }

    try {
      const prompt = `作为城市规划专家，请为建造${this.getBuildingName(buildingType)}提供简短建议。
      
当前城市情况：人口${context.population}，幸福度${context.happiness}%，资金$${context.money}

请简洁回答（不超过50字）：为什么现在建造${this.getBuildingName(buildingType)}是好的选择？`;

      const completion = await this.openai.chat.completions.create({
        model: "qwen-plus",
        messages: [
          { role: "system", content: "你是城市规划专家，请用简洁的中文提供建设建议。" },
          { role: "user", content: prompt }
        ],
        max_tokens: 100,
        temperature: 0.5
      });

      return completion.choices[0].message.content.trim();
      
    } catch (error) {
      console.error('Failed to generate building suggestion:', error);
      return this.getFallbackSuggestion(buildingType);
    }
  }

  getBuildingName(buildingType) {
    const names = {
      road: "道路",
      residential: "住宅",
      commercial: "商业建筑",
      industrial: "工业建筑", 
      power: "发电厂",
      school: "学校",
      hospital: "医院",
      police: "警察局",
      park: "公园"
    };
    return names[buildingType] || buildingType;
  }

  getFallbackSuggestion(buildingType) {
    const suggestions = {
      road: "改善交通连接，促进城市发展",
      residential: "满足人口增长需求，提供住房",
      commercial: "增加就业机会，提升经济收入",
      industrial: "发展制造业，创造更多就业",
      power: "保障电力供应，支撑城市运转",
      school: "提供教育服务，提升居民素质",
      hospital: "改善医疗条件，保障居民健康",
      police: "维护社会治安，提升安全感",
      park: "改善环境质量，提升居民幸福度"
    };
    
    return suggestions[buildingType] || "促进城市均衡发展";
  }

  async generateCityName(cityCharacteristics) {
    if (!this.isInitialized) {
      return this.getFallbackCityName();
    }

    try {
      const prompt = `请为一个城市起一个有意思的中文名字。城市特点：
      人口：${cityCharacteristics.population}
      主要建筑：${cityCharacteristics.mainBuildings.join('、')}
      发展特色：${cityCharacteristics.stage}
      
      请只返回城市名字，不超过4个字。`;

      const completion = await this.openai.chat.completions.create({
        model: "qwen-plus",
        messages: [
          { role: "system", content: "你是一个创意命名专家，擅长为城市起有趣的名字。" },
          { role: "user", content: prompt }
        ],
        max_tokens: 20,
        temperature: 0.8
      });

      const name = completion.choices[0].message.content.trim();
      return name.replace(/[""''《》]/g, ''); // 移除引号
      
    } catch (error) {
      console.error('Failed to generate city name:', error);
      return this.getFallbackCityName();
    }
  }

  getFallbackCityName() {
    const names = ['新春城', '繁华镇', '绿洲市', '科技城', '和谐区', '幸福港'];
    return names[Math.floor(Math.random() * names.length)];
  }

  // 设置API密钥（开发环境）
  setAPIKey(apiKey) {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('DASHSCOPE_API_KEY', apiKey);
      this.initializeClient();
    }
  }
}

// 导出单例实例
export const aiService = new AIService(); 
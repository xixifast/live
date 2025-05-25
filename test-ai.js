import OpenAI from "openai";
import dotenv from "dotenv";

// 加载环境变量
dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.DASHSCOPE_API_KEY,
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1"
});

async function testAI() {
    console.log('🧠 测试大模型连接...');
    console.log('API Key:', process.env.DASHSCOPE_API_KEY ? '已配置' : '未配置');
    
    try {
        const completion = await openai.chat.completions.create({
            model: "qwen-plus",
            messages: [
                { role: "system", content: "你是一个城市规划专家。" },
                { role: "user", content: "请为一个新城市提供3个建设建议，每个建议不超过20字。" }
            ],
            max_tokens: 200
        });

        console.log('✅ 连接成功!');
        console.log('AI回复:', completion.choices[0].message.content);
        
        // 测试城市分析功能
        const cityAnalysis = await openai.chat.completions.create({
            model: "qwen-plus",
            messages: [
                { 
                    role: "system", 
                    content: "你是城市规划专家，请分析城市状况并以JSON格式回复。" 
                },
                { 
                    role: "user", 
                    content: `分析这个城市：人口100，资金5000，幸福度60%，住宅5栋，商业2栋。
                    
                    请回复JSON格式：
                    {
                      "analysis": "城市状况分析",
                      "priorities": ["建筑类型1", "建筑类型2", "建筑类型3"],
                      "suggestions": "建设建议"
                    }`
                }
            ],
            max_tokens: 300
        });
        
        console.log('\n🏙️ 城市分析测试:');
        console.log(cityAnalysis.choices[0].message.content);
        
    } catch (error) {
        console.error('❌ 连接失败:', error.message);
        if (error.response) {
            console.error('错误详情:', error.response.data);
        }
    }
}

testAI();
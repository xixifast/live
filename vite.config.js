import { defineConfig, loadEnv } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig(({ mode }) => {
  // 加载环境变量
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [
      viteStaticCopy({
        targets: [
          {
            src: 'src/assets/**/*',
            dest: 'assets'
          }
        ]
      })
    ],
    server: {
      port: 3000,
      host: true
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: true
    },
    resolve: {
      alias: {
        '@': '/src'
      }
    },
    define: {
      // 将环境变量注入到客户端代码中
      'process.env.DASHSCOPE_API_KEY': JSON.stringify(env.DASHSCOPE_API_KEY)
    }
  };
}); 
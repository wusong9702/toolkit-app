import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Capacitor 配置：把网页包进原生壳子的关键文件。
 *
 * webDir 指向 Vite 的构建产物目录 —— 必须和 vite.config.ts 的 build.outDir 一致，
 * 对不上就白屏，这是新手最常踩的坑。
 */
const config: CapacitorConfig = {
  // 注意：appId（包名）是应用的身份证号，上架后永久无法修改，改前务必想清楚。
  appId: 'com.mimaxing.toolkit',
  appName: '密码本',
  webDir: 'dist',

  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: '#ffffffff',
      showSpinner: false,
    },
  },

  server: {
    // 开发时想让 App 连电脑上的 dev server 实时刷新，把下面两行的注释打开，
    // 并把 192.168.x.x 换成你电脑的局域网 IP。
    // 注意：上架前务必注释掉，否则用户打开的是你的电脑。
    // url: 'http://192.168.1.100:5173',
    // cleartext: true,

    androidScheme: 'https',
  },

  ios: {
    contentInset: 'always',
  },

  android: {
    allowMixedContent: false,
  },
}

export default config

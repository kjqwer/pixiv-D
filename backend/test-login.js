const PixivBackend = require('./core');
const proxyConfig = require('./config');
const readline = require('readline');

// 创建命令行交互接口
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// 询问用户输入
function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

// 测试登录流程
async function testLogin() {
  console.log('=== Pixiv 登录测试脚本 ===\n');
  
  try {
    // 1. 设置代理环境变量
    console.log('1. 设置代理配置...');
    proxyConfig.setEnvironmentVariables();
    
    // 2. 初始化后端
    console.log('\n2. 初始化 Pixiv 后端...');
    const backend = new PixivBackend();
    await backend.init();
    
    // 3. 检查登录状态
    console.log('\n3. 检查当前登录状态...');
    const loginStatus = backend.getLoginStatus();
    console.log('登录状态:', loginStatus);
    
    if (loginStatus.isLoggedIn) {
      console.log('✅ 已登录，用户:', loginStatus.username);
      return;
    }
    
    // 4. 获取登录URL
    console.log('\n4. 获取登录URL...');
    const loginData = backend.getLoginUrl();
    console.log('请访问以下URL进行登录:');
    console.log(loginData.login_url);
    console.log('\n登录完成后，请复制回调URL中的code参数');
    
    // 5. 等待用户输入授权码
    const code = await askQuestion('\n请输入授权码 (code参数): ');
    
    if (!code || code.trim() === '') {
      console.log('❌ 未输入授权码，测试终止');
      return;
    }
    
    // 6. 处理登录回调
    console.log('\n5. 处理登录回调...');
    const loginResult = await backend.handleLoginCallback(code.trim());
    
    if (loginResult.success) {
      console.log('✅ 登录成功！');
      console.log('用户信息:', loginResult.user);
      
      // 7. 再次检查登录状态
      console.log('\n6. 验证登录状态...');
      const finalStatus = backend.getLoginStatus();
      console.log('最终登录状态:', finalStatus);
      
      // 8. 测试获取用户信息
      console.log('\n7. 测试获取用户信息...');
      const auth = backend.getAuth();
      const userInfo = await auth.getUserInfo();
      
      if (userInfo.success) {
        console.log('✅ 获取用户信息成功:', userInfo.user);
      } else {
        console.log('❌ 获取用户信息失败:', userInfo.error);
      }
      
    } else {
      console.log('❌ 登录失败:', loginResult.error);
    }
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error.message);
    console.error('错误详情:', error);
  } finally {
    // 清理资源
    rl.close();
    console.log('\n=== 测试完成 ===');
  }
}

// 测试重新登录功能
async function testRelogin() {
  console.log('=== 测试重新登录功能 ===\n');
  
  try {
    // 设置代理
    proxyConfig.setEnvironmentVariables();
    
    // 初始化后端
    const backend = new PixivBackend();
    await backend.init();
    
    // 检查是否有保存的登录信息
    const loginStatus = backend.getLoginStatus();
    
    if (loginStatus.isLoggedIn) {
      console.log('✅ 检测到已保存的登录信息');
      console.log('用户:', loginStatus.username);
      console.log('用户ID:', loginStatus.user_id);
    } else {
      console.log('❌ 没有保存的登录信息，无法测试重新登录');
    }
    
  } catch (error) {
    console.error('❌ 重新登录测试失败:', error.message);
  }
}

// 测试登出功能
async function testLogout() {
  console.log('=== 测试登出功能 ===\n');
  
  try {
    // 设置代理
    proxyConfig.setEnvironmentVariables();
    
    // 初始化后端
    const backend = new PixivBackend();
    await backend.init();
    
    // 执行登出
    const logoutResult = backend.logout();
    
    if (logoutResult.success) {
      console.log('✅ 登出成功');
      
      // 验证登出状态
      const loginStatus = backend.getLoginStatus();
      console.log('登出后状态:', loginStatus);
    } else {
      console.log('❌ 登出失败');
    }
    
  } catch (error) {
    console.error('❌ 登出测试失败:', error.message);
  }
}

// 主函数
async function main() {
  console.log('请选择测试功能:');
  console.log('1. 测试完整登录流程');
  console.log('2. 测试重新登录');
  console.log('3. 测试登出');
  console.log('4. 运行所有测试');
  
  const choice = await askQuestion('\n请输入选择 (1-4): ');
  
  switch (choice.trim()) {
    case '1':
      await testLogin();
      break;
    case '2':
      await testRelogin();
      break;
    case '3':
      await testLogout();
      break;
    case '4':
      console.log('\n=== 运行所有测试 ===\n');
      await testLogin();
      console.log('\n' + '='.repeat(50) + '\n');
      await testRelogin();
      console.log('\n' + '='.repeat(50) + '\n');
      await testLogout();
      break;
    default:
      console.log('❌ 无效选择');
      rl.close();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  testLogin,
  testRelogin,
  testLogout
}; 
// 获取当前语言环境的辅助函数
export function getCurrentLocale(): string {
  // 在服务器端渲染时，我们无法直接获取用户的语言环境
  // 因此这里使用默认逻辑或根据请求头判断
  // 对于客户端，我们可以在组件中使用 useLanguage Hook
  
  // 从 localStorage 获取保存的语言设置，如果没有则默认为中文
  if (typeof window !== 'undefined') {
    const savedLocale = localStorage.getItem('locale');
    if (savedLocale && ['zh-CN', 'en'].includes(savedLocale)) {
      return savedLocale;
    }
  }
  
  // 检测浏览器语言
  if (typeof window !== 'undefined') {
    const browserLang = window.navigator.language;
    if (browserLang.startsWith('zh')) {
      return 'zh-CN';
    } else if (browserLang.startsWith('en')) {
      return 'en';
    }
  }
  
  // 默认返回中文
  return 'zh-CN';
}

// 动态获取元数据
export async function getDynamicMetadata() {
  const locale = getCurrentLocale();
  
  // 根据语言环境返回相应的元数据
  if (locale === 'zh-CN') {
    return {
      title: "NextTools - 程序员的工具箱",
      description: "一站式开发者工具平台，集成Redis、Kafka、Postman、ZooKeeper和SSH客户端",
    };
  } else {
    return {
      title: "NextTools - Developer's Toolbox",
      description: "All-in-one developer tools platform integrating Redis, Kafka, Postman, ZooKeeper, and SSH clients",
    };
  }
}
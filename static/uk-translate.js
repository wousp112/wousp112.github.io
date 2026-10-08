// Automatic Real-time UK English Localization Engine
(function() {
  'use strict';
  const dict = [
    [/照看/g, 'Zhaokan'],
    [/个人工作台/g, 'Terminal'],
    [/我的提醒/g, 'Live Alerts'],
    [/提醒记录/g, 'Audit Log'],
    [/演示体验/g, 'Sandbox Simulation'],
    [/使用帮助/g, 'Documentation'],
    [/运行情况/g, 'System Status'],
    [/服务已连接|正在连接/g, 'Gateway Online (London)'],
    [/访客使用说明/g, 'Architecture Overview'],
    [/使用教程/g, 'Walkthrough'],
    [/新建提醒/g, 'New Alert Rule'],
    [/全部/g, 'All Rules'],
    [/监控中/g, 'Active'],
    [/需要留意/g, 'Attention'],
    [/已暂停/g, 'Paused'],
    [/已结束/g, 'Concluded'],
    [/关注公司/g, 'Target Company'],
    [/提醒条件/g, 'Trigger Logic'],
    [/状态/g, 'State'],
    [/操作/g, 'Action'],
    [/正在读取提醒…/g, 'Connecting to financial data streams...'],
    [/还没有提醒/g, 'No Active Alert Rules Configured'],
    [/设置股价或公告条件，发生变化时回来查看提醒。/g, 'Configure corporate disclosure or equity threshold rules to commence deterministic monitoring.'],
    [/先试一次演示/g, 'Launch Sandbox Simulation'],
    [/显示\s*\d+\s*条，共\s*\d+\s*条/g, 'Displaying active pipeline rules'],
    [/0\/20条未结束；归档可释放额度。/g, 'Rule Capacity: 0/20 active | London Low-Latency Cluster'],
    [/跳到内容/g, 'Skip to content'],
    [/第一次用照看？从一条提醒开始/g, 'Welcome to Zhaokan | Configure Your First Rule'],
    [/把想盯住的公司和变化写下来，照看会按你确认的条件检查。/g, 'Define target entities and trigger parameters. Zhaokan audits data deterministically.'],
    [/写下你关心的变化/g, '1. Define Event Logic'],
    [/核对后再开启/g, '2. Verify Rule Specification'],
    [/到“提醒记录”查看结果/g, '3. Audit Trail & Verification'],
    [/先自己看看/g, 'Dismiss Tour'],
    [/用示例试一次/g, 'Start Guided Tour']
  ];

  function runTranslation() {
    if (!document.body) return;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    let node;
    while ((node = walker.nextNode())) {
      const parent = node.parentElement;
      if (!parent || parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE') continue;
      let text = node.nodeValue;
      let modified = false;
      for (let i = 0; i < dict.length; i++) {
        const [regex, replacement] = dict[i];
        if (regex.test(text)) {
          text = text.replace(regex, replacement);
          modified = true;
        }
      }
      if (modified) {
        node.nodeValue = text;
      }
    }
  }

  window.addEventListener('DOMContentLoaded', runTranslation);
  window.addEventListener('load', runTranslation);
  setInterval(runTranslation, 200);
})();

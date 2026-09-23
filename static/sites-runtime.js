(function (root) {
  'use strict';

  const KEY = 'zhaokan-sites-runtime-v1';
  const symbols = [
    ['600519.SH','贵州茅台'],['000001.SZ','平安银行'],['000858.SZ','五粮液'],
    ['300750.SZ','宁德时代'],['601318.SH','中国平安'],['600036.SH','招商银行'],
    ['600900.SH','长江电力'],['601012.SH','隆基绿能'],['000333.SZ','美的集团'],
    ['002594.SZ','比亚迪'],['600276.SH','恒瑞医药'],['688981.SH','中芯国际']
  ].map(([symbol,name])=>({symbol,name,market:'A_SHARE'}));

  const now = () => new Date().toISOString();
  const uid = prefix => prefix + '_' + crypto.randomUUID().replaceAll('-','').slice(0,16);
  const clone = value => JSON.parse(JSON.stringify(value));
  const initial = () => ({tasks:[],alerts:[],audits:{},versions:{},events:{parse_requested:0,parse_ready:0,parse_failed:0,created:0,checks:0},nextAlert:1});
  function load(){try{return {...initial(),...JSON.parse(localStorage.getItem(KEY)||'{}')};}catch{return initial();}}
  function save(db){localStorage.setItem(KEY,JSON.stringify(db));}
  function response(value){return clone(value);}
  function findTask(db,id){const task=db.tasks.find(t=>t.id===id);if(!task)throw new Error('找不到这条提醒。');return task;}
  function endTime(days=14){return new Date(Date.now()+days*86400000).toISOString();}
  function condition(id,type,operator,threshold,event_category=null){return {id,type,operator,threshold,event_category,at:null,display_text:'',source:type==='ANNOUNCEMENT_EVENT'?'sites_demo_events':'sites_demo_quote'};}

  function parseSpec(body){
    const prompt=(body.prompt||'').trim();
    if(!prompt)throw new Error('请写下想关注的公司和变化。');
    let target=body.target||symbols.find(s=>prompt.includes(s.name)||prompt.includes(s.symbol.slice(0,6)))||symbols[0];
    const conditions=[];
    const pct=prompt.match(/(?:下跌|跌幅|跌)(?:达到|超过|至|到|低于|不高于)?\s*(\d+(?:\.\d+)?)\s*%/);
    const rise=prompt.match(/(?:上涨|涨幅|涨)(?:达到|超过|至|到)?\s*(\d+(?:\.\d+)?)\s*%/);
    const price=prompt.match(/(?:股价)?(?:低于|不高于|跌破)\s*(\d+(?:\.\d+)?)\s*元?/);
    if(pct)conditions.push(condition(uid('c'),'PRICE_CHANGE_RATIO','<=',-Number(pct[1])/100));
    else if(rise)conditions.push(condition(uid('c'),'PRICE_CHANGE_RATIO','>=',Number(rise[1])/100));
    else if(price)conditions.push(condition(uid('c'),'PRICE','<=',Number(price[1])));
    if(/业绩预告/.test(prompt))conditions.push(condition(uid('c'),'ANNOUNCEMENT_EVENT','<=',null,'PERFORMANCE_FORECAST'));
    else if(/业绩快报/.test(prompt))conditions.push(condition(uid('c'),'ANNOUNCEMENT_EVENT','<=',null,'PERFORMANCE_REPORT'));
    else if(/公告/.test(prompt))conditions.push(condition(uid('c'),'ANNOUNCEMENT_EVENT','<=',null,'ANY_ANNOUNCEMENT'));
    if(!conditions.length)throw new Error('请写明一个具体条件，例如“下跌达到3%”或“发布业绩预告”。');
    const task_spec={schema_version:'1.0',version:1,user_intent_raw:prompt,target:clone(target),validity:{start_time:now(),end_time:endTime(),timezone:'Asia/Shanghai'},condition_logic:/并且|同时|全部/.test(prompt)?'AND':'OR',conditions,governance:{frequency_seconds:60,trading_hours_only:true,cooldown_minutes:30,deduplication_keys:['announcement_id','trading_date'],alert_channels:['WEB_INBOX']},data_mode:'replay'};
    return {task_spec,compilation:{engine:'sites-local-parser',model:'deterministic-demo',latency_ms:8,compilation_id:uid('parse'),timestamp:now(),validated:true,ai_requested:false},warnings:['评审站使用模拟数据，不代表真实行情。','提醒记录保存在当前浏览器。']};
  }

  function evidence(task,scenario='normal'){
    const observed=now();
    return task.spec.conditions.map(c=>{
      if(c.type==='PRICE_CHANGE_RATIO'){
        const actual=['drop','deeper'].includes(scenario)?(scenario==='drop'?-0.038:-0.052):0.006;
        return {...c,satisfied:c.operator.includes('<')?actual<=c.threshold:actual>=c.threshold,actual_value:actual,last:100*(1+actual),previous_close:100,formula:'(现价-昨收)/昨收',reason:`模拟昨收100元，现价${(100*(1+actual)).toFixed(1)}元。`,source:'Sites评审站模拟行情',observed_at:observed};
      }
      if(c.type==='PRICE'){
        const actual=['drop','deeper'].includes(scenario)?96.2:100.6;
        return {...c,satisfied:c.operator.includes('<')?actual<=c.threshold:actual>=c.threshold,actual_value:actual,reason:`模拟现价${actual}元。`,source:'Sites评审站模拟行情',observed_at:observed};
      }
      if(c.type==='HEAT'){
        const actual=scenario==='heat'?3.6:1.1;
        return {...c,satisfied:actual>=c.threshold,actual_value:actual,reason:`模拟量比为${actual}。`,source:'Sites评审站模拟行情',observed_at:observed};
      }
      if(c.type==='ANNOUNCEMENT_EVENT'){
        const yes=scenario==='announcement';
        return {...c,satisfied:yes,display_text:yes?'发现新的业绩预告':'未发现新的匹配公告',events:yes?[{title:`${task.spec.target.name}发布业绩预告`,published_at:observed,freshness_note:'模拟事件'}]:[],reason:yes?'发现1条新的模拟公告。':'本轮没有新的匹配公告。',source:'Sites评审站模拟公告',observed_at:observed,coverage:'模拟数据仅用于演示产品判断链路。'};
      }
      return {...c,satisfied:false,display_text:'指定时间尚未到达',reason:'指定时间尚未到达。',source:'系统时钟',observed_at:observed};
    });
  }

  function check(db,task,scenario='normal'){
    const rows=evidence(task,scenario),satisfied=task.spec.condition_logic==='AND'?rows.every(x=>x.satisfied):rows.some(x=>x.satisfied);
    const duplicate=satisfied&&['deeper','same_announcement'].includes(scenario)&&task.state.trigger_count>0;
    let action=satisfied?(duplicate?'条件满足，但同一交易日的该价格规则或相同事件已提醒，不重复发送。':'提醒已写入站内消息，进入冷却。'):'已检查，组合条件未满足，本轮不提醒。';
    if(['timeout','http500','stale','conflict','event_failure'].includes(scenario))action='部分条件缺少有效数据，本轮无法完整判断。';
    task.state.status=action.startsWith('部分')?'DEGRADED':satisfied&&!duplicate?'COOLING':'ACTIVE';
    task.state.last_check_time=now();task.state.last_decision=action;task.state.last_snapshot={quote:{status:'ok',last:scenario==='drop'?96.2:scenario==='deeper'?94.8:100.6,change:scenario==='drop'?-0.038:scenario==='deeper'?-0.052:0.006}};
    if(satisfied&&!duplicate){
      task.state.trigger_count+=1;
      const alert={id:db.nextAlert++,task_id:task.id,title:`${task.spec.target.name} · 条件满足`,message:'模拟条件已满足。',kind:'condition',mode:'replay',timestamp:now(),recorded_at:now(),rule_version:task.spec.version,evidence:rows,read_at:null,feedback:null};
      db.alerts.unshift(alert);
    }
    const audit={audit_id:uid('audit'),timestamp:now(),recorded_at:now(),data_mode:'replay',kind:'evaluation',rule_version:task.spec.version,conditions_evaluated:rows,action_taken:scenario==='normal'?action:`注入演示情景：${scenario}`,notification_sent:satisfied&&!duplicate,pending_event_count:0};
    (db.audits[task.id] ||= []).unshift(audit);db.events.checks++;
    return task;
  }

  function createTask(db,spec){
    const task={id:uid('task'),spec:clone(spec),state:{status:'ACTIVE',paused:false,last_check_time:null,last_decision:null,last_snapshot:null,next_check_time:new Date(Date.now()+60000).toISOString(),trigger_count:0,pending_events:{}}};
    db.tasks.unshift(task);db.versions[task.id]=[{version:spec.version,at:now(),reason:'创建提醒',spec:clone(spec)}];db.audits[task.id]=[];db.events.created++;return task;
  }

  async function request(path,method='GET',body){
    const db=load(),url=new URL(path,location.origin),p=url.pathname;
    if(p==='/api/meta')return {symbols,states:['PENDING','ACTIVE','SUSPENDED','COOLING','DEGRADED','EXPIRED','ARCHIVED'],ai_available:false,live_available:false,build:{version:'sites-1.0',source_sha256:'stable-review-site'},limits:{active_tasks:20,saved_tasks:100},data_disclosure:'评审站使用模拟数据，数据保存在当前浏览器。'};
    if(p==='/api/health')return {status:'ok',scheduler_enabled:true,heartbeat:now(),started_at:now(),last_error:null,heartbeat_age_seconds:0,heartbeat_stale:false,build:{version:'sites-1.0',source_sha256:'stable-review-site'}};
    if(p==='/api/workspace-status')return {active:db.tasks.filter(t=>!['ARCHIVED','EXPIRED'].includes(t.state.status)).length,active_limit:20,saved:db.tasks.length,saved_limit:100,overdue:[],alerts:{unread:db.alerts.filter(a=>!a.read_at).length,total:db.alerts.length},build:{version:'sites-1.0',source_sha256:'stable-review-site'},channels:{inbox:true,background_push:false,email:false},data:{companies:12,live_volume_ratio:false,announcement_coverage:'simulation'},as_of:now()};
    if(p==='/api/tasks'&&method==='GET')return {tasks:response(db.tasks),server_time:now()};
    if(p==='/api/tasks/parse'&&method==='POST'){db.events.parse_requested++;try{const result=parseSpec(body);db.events.parse_ready++;save(db);return result;}catch(e){db.events.parse_failed++;save(db);throw e;}}
    if(p==='/api/tasks/create'&&method==='POST'){const task=createTask(db,body.task_spec);save(db);return response(task);}
    if(p==='/api/alerts'&&method==='GET'){
      let rows=db.alerts;if(url.searchParams.get('unread_only')==='true')rows=rows.filter(a=>!a.read_at);
      const before=Number(url.searchParams.get('before_id')||Infinity),limit=Number(url.searchParams.get('limit')||50);rows=rows.filter(a=>a.id<before);
      return {alerts:response(rows.slice(0,limit)),has_more:rows.length>limit,next_cursor:rows.length>limit?rows[limit-1].id:null,unread:db.alerts.filter(a=>!a.read_at).length,total:db.alerts.length};
    }
    if(p==='/api/workspace-report')return {mode:url.searchParams.get('mode')||'replay',period_days:7,since:new Date(Date.now()-7*86400000).toISOString(),as_of:now(),scope:'当前浏览器的评审体验记录。',parse_requested:db.events.parse_requested,parse_ready:db.events.parse_ready,parse_failed:db.events.parse_failed,created:db.events.created,checks:db.events.checks,unknown_checks:0,notifications:{generated:db.alerts.length,opened:db.alerts.filter(a=>a.read_at).length,useful:db.alerts.filter(a=>a.feedback==='useful').length,noisy:db.alerts.filter(a=>a.feedback==='noisy').length,incorrect:db.alerts.filter(a=>a.feedback==='incorrect').length},timing:{sample_size:db.events.checks,p50_ms:8,p95_ms:12,scheduled_sample_size:0,delay_p95_seconds:null},ai_completed_drafts:{requested:0,model_output:0,fallback:0},limits:'评审站使用模拟数据，不代表真实市场覆盖率。',build:{version:'sites-1.0',source_sha256:'stable-review-site'}};

    let m=p.match(/^\/api\/alerts\/(\d+)(?:\/(read|feedback))?$/);
    if(m){const alert=db.alerts.find(a=>a.id===Number(m[1]));if(!alert)throw new Error('找不到这条提醒。');if(m[2]==='read')alert.read_at=now();if(m[2]==='feedback')alert.feedback=body.feedback;save(db);return response(alert);}
    m=p.match(/^\/api\/tasks\/([^/]+)(?:\/(audit-trail|versions|rollback|pause|resume|check))?$/);
    if(m){const task=findTask(db,m[1]),action=m[2];
      if(!action&&method==='PUT'){task.spec=clone(body.task_spec);task.spec.version+=1;task.state.status='ACTIVE';(db.versions[task.id]||=[]).unshift({version:task.spec.version,at:now(),reason:'修改提醒',spec:clone(task.spec)});save(db);return response(task);}
      if(!action&&method==='DELETE'){task.state.status='ARCHIVED';task.state.paused=true;save(db);return response(task);}
      if(action==='audit-trail'){const rows=db.audits[task.id]||[];return {task_id:task.id,history:response(rows),total:rows.length,has_more:false,next_cursor:null};}
      if(action==='versions')return {versions:response(db.versions[task.id]||[])};
      if(action==='pause'){task.state.status='SUSPENDED';task.state.paused=true;save(db);return response(task);}
      if(action==='resume'){task.state.status='ACTIVE';task.state.paused=false;save(db);return response(task);}
      if(action==='check'){check(db,task,'normal');save(db);return response(task);}
      if(action==='rollback'){const v=(db.versions[task.id]||[]).find(x=>x.version===body.version);if(!v)throw new Error('找不到所选历史版本。');task.spec=clone(v.spec);task.spec.version=Math.max(...db.versions[task.id].map(x=>x.version))+1;db.versions[task.id].unshift({version:task.spec.version,at:now(),reason:'恢复历史条件',spec:clone(task.spec)});save(db);return response(task);}
    }
    if(p==='/api/simulate/tick'&&method==='POST'){const task=findTask(db,body.task_id);check(db,task,'normal');save(db);return response(task);}
    if(p==='/api/simulate/inject'&&method==='POST'){const task=findTask(db,body.task_id);check(db,task,body.scenario);save(db);return response(task);}
    throw new Error('评审站暂不支持这项操作。');
  }
  root.ZhaokanSiteAPI={request};
})(window);

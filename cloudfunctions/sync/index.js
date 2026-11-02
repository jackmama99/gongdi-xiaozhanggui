/**
 * 云函数：sync
 * 作用：团队数据的拉取 / 推送，并做服务端权限校验
 *
 * 安全模型：
 * 1. 调用者必须是指定 teamId 的成员（users 集合里存在 teamId + openid 匹配的记录）
 * 2. 写入按角色限制可写的集合，避免设计师改写财务数据
 * 3. 只允许读写自己团队的数据（teamId 已在入参校验）
 *
 * 部署：微信开发者工具 → 右键 cloudfunctions/sync → 上传并部署（云端安装依赖）
 */
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

// 需要同步的业务集合
const COLLECTIONS = [
  'customers',
  'follows',
  'quotes',
  'contracts',
  'projects',
  'inspections',
  'changes',
  'receipts',
  'expenses',
  'materials',
  'aftersales',
  'todos'
];

// 角色可写集合
const WRITE_ACCESS = {
  老板: ['*'],
  设计师: ['customers', 'follows', 'quotes', 'contracts', 'projects', 'aftersales', 'todos'],
  销售: ['customers', 'follows', 'quotes', 'contracts', 'projects', 'aftersales', 'todos'],
  项目经理: ['projects', 'materials', 'aftersales', 'customers', 'todos', 'inspections', 'changes'],
  财务: ['contracts', 'receipts', 'expenses', 'customers', 'projects', 'todos']
};

// 允许自行选择的入职角色；财务/老板必须由老板授予
const JOIN_ROLES = ['设计师', '项目经理', '销售'];

/** 手机号脱敏：138****8888 */
function maskPhone(value) {
  return String(value || '').replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2');
}

function canWrite(role, collection) {
  // 未知角色一律拒绝，避免角色被篡改后回落到默认权限
  const list = WRITE_ACCESS[role] || [];
  return list.indexOf('*') > -1 || list.indexOf(collection) > -1;
}

/** 校验成员身份，返回成员记录或 null */
async function getMember(teamId, openid) {
  if (!teamId || !openid) return null;
  const res = await db.collection('users').where({ teamId, openid }).limit(1).get();
  return (res.data && res.data[0]) || null;
}

/** 判断是否团队老板 */
async function isOwner(teamId, userId) {
  const res = await db.collection('teams').doc(teamId).get().catch(() => null);
  const team = res && res.data;
  return !!(team && team.ownerId === userId);
}

/**
 * 分页拉取一个集合的全量数据（云端单次查询上限 1000 条）。
 * 最多 10 页 = 1 万条，避免单次云函数超时。
 */
async function fetchAll(name, teamId) {
  const LIMIT = 1000;
  const MAX_PAGES = 10;
  const out = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await db.collection(name)
      .where({ teamId })
      .skip(page * LIMIT)
      .limit(LIMIT)
      .get();
    const batch = (res && res.data) || [];
    out.push.apply(out, batch);
    if (batch.length < LIMIT) break;
  }
  return out;
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { action, teamId } = event || {};

  // ---------------- 微信一键登录：按 openid 反查成员与团队（公开，无需 teamId） ----------------
  if (action === 'whoami') {
    if (!OPENID) return { ok: false, msg: '无法获取 openid' };
    const userRes = await db.collection('users').where({ openid: OPENID }).limit(1).get().catch(() => null);
    const user = userRes && userRes.data && userRes.data[0];
    if (!user) return { ok: false, found: false, msg: '该微信还没有团队' };

    let team = null;
    if (user.teamId) {
      const teamRes = await db.collection('teams').doc(String(user.teamId)).get().catch(() => null);
      team = (teamRes && teamRes.data) || null;
    }
    // 不回传密码
    const safeUser = Object.assign({}, user);
    delete safeUser.password;
    return { ok: true, found: true, user: safeUser, team: team };
  }

  // ---------------- 凭邀请码加入（公开，无需 teamId / 成员身份） ----------------
  if (action === 'join') {
    const code = String((event && event.inviteCode) || '').trim().toUpperCase();
    if (!code) return { ok: false, msg: '缺少邀请码' };
    const teamRes = await db.collection('teams').where({ inviteCode: code }).limit(1).get().catch(() => null);
    const team = teamRes && teamRes.data && teamRes.data[0];
    if (!team) return { ok: false, msg: '邀请码无效' };
    if (team.status === '已停用') return { ok: false, msg: '该团队已停用' };

    // 写入/更新调用者自己的成员记录（不替别人写）
    const member = (event && event.member) || {};
    if (!member.name) return { ok: false, msg: '缺少姓名' };
    // 该微信若已有成员记录，直接复用，避免重复建号
    const mineRes = await db.collection('users').where({ openid: OPENID }).limit(1).get().catch(() => null);
    const mine = mineRes && mineRes.data && mineRes.data[0];
    let id = (mine && mine.id) || member.id || 'u_' + Date.now().toString(36);

    // 客户端传来的 id 若已被他人占用，换新 id，绝不覆盖别人的成员记录
    if (!mine && member.id) {
      const occupied = await db.collection('users').doc(String(member.id)).get().catch(() => null);
      const other = occupied && occupied.data;
      if (other && other.openid && other.openid !== OPENID) {
        id = 'u_' + Date.now().toString(36);
      }
    }

    // 角色白名单：老板/财务等敏感角色只能由老板在团队页授予，加入时不许自封
    const role = JOIN_ROLES.indexOf(member.role) > -1 ? member.role : '设计师';
    const safeMember = Object.assign({}, mine || {}, member, {
      id,
      role: (mine && mine.role) || role,
      teamId: team.id,
      openid: OPENID
    });
    delete safeMember.password; // 密码只留本机，绝不上云
    await db.collection('users').doc(String(id)).set({ data: safeMember }).catch(() => {});

    return { ok: true, team: team, memberId: id };
  }

  if (!teamId) return { ok: false, msg: '缺少 teamId' };

  // ---------------- 移除成员：服务端同步收回权限（仅老板） ----------------
  if (action === 'removeMember') {
    const teamRes = await db.collection('teams').doc(String(teamId)).get().catch(() => null);
    const team = teamRes && teamRes.data;
    if (!team || team.ownerOpenid !== OPENID) return { ok: false, msg: '只有老板可以移除成员' };
    const targetId = String((event && event.userId) || '');
    if (!targetId) return { ok: false, msg: '缺少成员 id' };
    if (team.ownerId === targetId) return { ok: false, msg: '不能移除老板' };

    // 目标必须属于当前团队，避免老板清掉别的团队成员
    const targetRes = await db.collection('users').doc(targetId).get().catch(() => null);
    const target = targetRes && targetRes.data;
    if (!target || target.teamId !== teamId) {
      return { ok: false, msg: '成员不存在或不属于当前团队' };
    }

    // 清掉云端成员关系与 openid，之后 getMember 一律查不到
    try {
      await db.collection('users').doc(targetId).update({
        data: { teamId: '', role: '', openid: '' }
      });
    } catch (e) {
      return { ok: false, msg: '移除失败，请重试' };
    }
    return { ok: true };
  }

  // ---------------- 自举：创建团队 / 加入团队 ----------------
  // 此时成员关系可能还没建立，不能走成员校验。只做轻校验：
  //  - 团队记录里的 ownerOpenid 等于调用者 → 是老板，可写全员
  //  - 否则只能写「openid 等于自己」的成员记录（新成员自建）
  if (action === 'bootstrap') {
    const { team, members } = event;

    // 已有云端团队记录：调用者是加入者/成员，不允许覆盖团队记录
    const existingTeam = await db.collection('teams').doc(String(teamId)).get().catch(() => null);
    const teamExists = !!(existingTeam && existingTeam.data);

    if (team && team.id === teamId && !teamExists) {
      // 首次创建：只有创建者本人能落团队记录，并把 openid 记为老板
      if (team.ownerOpenid && team.ownerOpenid !== OPENID) {
        return { ok: false, msg: '只能创建自己的团队' };
      }
      const safeTeam = Object.assign({}, team, { ownerOpenid: OPENID });
      await db.collection('teams').doc(String(teamId)).set({ data: safeTeam }).catch(() => {});
    }

    // 判断老板：查云端团队记录的 ownerOpenid
    const teamDoc = teamExists
      ? existingTeam
      : await db.collection('teams').doc(String(teamId)).get().catch(() => null);
    const isTeamOwner = !!(teamDoc && teamDoc.data && teamDoc.data.ownerOpenid === OPENID);

    // 老板可以更新团队信息（改名 / 换城市 / 换行业 / 重置邀请码）
    if (isTeamOwner && team && team.id === teamId) {
      const allowed = ['name', 'city', 'industry', 'phone', 'status', 'inviteCode'];
      const patch = {};
      allowed.forEach((k) => {
        if (team[k] !== undefined) patch[k] = team[k];
      });
      if (Object.keys(patch).length) {
        await db.collection('teams').doc(String(teamId)).update({ data: patch }).catch(() => {});
      }
    }

    if (Array.isArray(members)) {
      // 非老板：必须已经是该团队成员（join 流程已写入），否则一律拒绝
      // 防止猜中 teamId 后把自己塞进别人的团队
      let me = null;
      if (!isTeamOwner) {
        me = await getMember(teamId, OPENID);
        if (!me) return { ok: false, msg: '无权写入该团队' };
      }

      for (let i = 0; i < members.length; i++) {
        const m = members[i];
        if (!m || !m.id) continue;
        // 非老板只能写自己那一条
        if (!isTeamOwner && m.id !== me.id) continue;
        const safeM = Object.assign({}, m, {
          teamId: teamId,                                  // 团队归属以服务端为准
          openid: isTeamOwner ? (m.openid || '') : OPENID
        });
        delete safeM.password;                             // 密码只留本机，绝不上云
        if (!isTeamOwner) safeM.role = me.role;            // 角色只能由老板修改
        await db.collection('users').doc(String(m.id)).set({ data: safeM }).catch(() => {});
      }
    }
    return { ok: true, isOwner: isTeamOwner };
  }

  const member = await getMember(teamId, OPENID);
  if (!member) return { ok: false, msg: '无权访问该团队', openid: OPENID };

  // ---------------- 拉取 ----------------
  if (action === 'pull') {
    const collections = {};
    // 先取团队，判断调用者是否是老板（老板可见全部）
    const teamDoc = await db.collection('teams').doc(String(teamId)).get().catch(() => null);
    const teamData = teamDoc && teamDoc.data;
    const isOwner = !!(teamData && teamData.ownerId === member.id);
    const canFinance = isOwner || member.role === '财务';
    // 非财务角色不下发财务流水（客户、项目等业务数据照常）
    const hidden = canFinance ? [] : ['receipts', 'expenses'];
    for (let i = 0; i < COLLECTIONS.length; i++) {
      const name = COLLECTIONS[i];
      if (hidden.indexOf(name) > -1) continue;
      try {
        collections[name] = await fetchAll(name, teamId);
      } catch (e) {
        collections[name] = [];
      }
    }
    // 附带团队与成员（客户端用于展示 + 建立成员关系）
    const teamRes = teamDoc;
    const membersRes = await db.collection('users').where({ teamId }).limit(200).get().catch(() => null);
    collections.teams = teamRes && teamRes.data ? [teamRes.data] : [];
    collections.users = ((membersRes && membersRes.data) || []).map((u) => {
      const safe = Object.assign({}, u);
      delete safe.password;   // 密码永不下发到客户端
      return safe;
    });
    return { ok: true, collections, role: member.role };
  }

  // ---------------- 推送（业务集合，需成员身份） ----------------
  if (action === 'push') {
    const { name, records } = event;
    if (COLLECTIONS.indexOf(name) === -1) return { ok: false, msg: '未知集合：' + name };
    if (!Array.isArray(records)) return { ok: false, msg: 'records 非法' };

    const owner = await isOwner(teamId, member.id);
    const role = owner ? '老板' : member.role;
    if (!canWrite(role, name)) {
      return { ok: false, msg: '当前角色无权修改 ' + name };
    }

    let written = 0;
    const failed = [];
    for (let i = 0; i < records.length; i++) {
      const rec = records[i];
      if (!rec || !rec.id) continue;
      if (rec.teamId !== teamId) continue; // 防止越权写别的团队

      // 收款幂等：同一期已收满时拒绝再写入，防止两端重复登记
      if (name === 'receipts' && rec.planId && rec.contractId) {
        const ctRes = await db.collection('contracts').doc(String(rec.contractId)).get().catch(() => null);
        const ct = ctRes && ctRes.data;
        const plan = ct && (ct.payPlan || []).find((x) => x.id === rec.planId);
        if (plan) {
          const exist = await db.collection('receipts')
            .where({ teamId, contractId: rec.contractId, planId: rec.planId })
            .get()
            .catch(() => null);
          const paid = ((exist && exist.data) || [])
            .filter((x) => x.id !== rec.id)
            .reduce((sum, x) => sum + Number(x.amount || 0), 0);
          if (Number(rec.amount || 0) > (plan.amount || 0) - paid + 0.01) {
            failed.push({ id: rec.id, msg: '该期已收满，拒绝重复收款' });
            continue;
          }
        }
      }

      try {
        await db.collection(name).doc(String(rec.id)).set({ data: rec });
        written++;
      } catch (e) {
        failed.push({ id: rec.id, msg: e.message });
      }
    }
    return { ok: failed.length === 0, written, failed, role };
  }

  // ---------------- 团队与成员 ----------------
  if (action === 'team') {
    const res = await db.collection('teams').doc(String(teamId)).get().catch(() => null);
    const team = res && res.data;
    if (!team) return { ok: false, msg: '团队不存在' };
    const members = await db.collection('users').where({ teamId }).limit(200).get();
    // 成员信息最小化：不下发密码，手机号脱敏
    const safeMembers = (members.data || []).map((u) => {
      const safe = Object.assign({}, u);
      delete safe.password;
      safe.phone = maskPhone(safe.phone);
      return safe;
    });
    return { ok: true, team, members: safeMembers };
  }

  return { ok: false, msg: '未知操作：' + action };
};

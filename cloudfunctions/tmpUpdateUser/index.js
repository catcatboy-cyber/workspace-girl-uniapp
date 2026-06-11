const cloudbase = require('@cloudbase/node-sdk');
const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV });
const db = app.database();
exports.main = async (event) => {
  const email = event.email || '4@qq.com';
  const plan = event.plan || 'pro';
  const { data } = await db.collection('users').where({ email }).limit(1).get();
  if (!data || data.length === 0) return { ok: false, msg: 'not found' };
  const u = data[0];
  await db.collection('users').doc(u._id).update({ plan });
  return { ok: true, id: u._id, was: u.plan || 'free', now: plan };
};

const MysSRApi = require( '../runtime/MysSRApi.js')


/**
 * 此方法依赖逍遥插件
 * @returns {Promise<void>}
 */
async function getAuthKey (e, srUid, authAppid = 'csc') {
  let User
  try {
    User = require('../../xiaoyao-plugin/model/user.js')
  } catch (e) {
    return
  }
  if (!User) {
    throw new Error('未安装逍遥插件，无法自动刷新抽卡链接')
  }
  let user = new User(e)
  // set genshin uid
  await user.getCookie(e)
  let ck = await user.getStoken(e.user_id)
  ck = `stuid=${ck.stuid};stoken=${ck.stoken};mid=${ck.mid};`
  let api = new MysSRApi(srUid, ck)
  let type = 'srPayAuthKey'
  switch (authAppid) {
    case 'csc': {
      type = 'srPayAuthKey'
      break
    }
    default:
  }
  const { url, headers, body } = api.getUrl(type)
  let res = await fetch(url, {
    method: 'POST',
    headers,
    body
  })
  res = await res.json()
  return res?.data?.authkey
}

exports.getAuthKey = getAuthKey

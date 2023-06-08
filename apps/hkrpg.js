const plugin = require( '../../lib/plugins/plugin.js')
const MysSRApi = require( '../runtime/MysSRApi.js')
const User = require( '../../genshin/model/user.js')
const fetch = require( 'node-fetch')
const GsCfg = require( '../../genshin/model/gsCfg.js')
const { gatchaType, statistics } = require( '../utils/gatcha.js')
const setting = require( '../utils/setting.js')
const { getAuthKey } = require( '../utils/authkey.js')
const _ = require( 'lodash')
const MysInfo = require("../../genshin/model/mys/mysInfo");
const gsCfg = require("../../genshin/model/gsCfg");


class hkrpg extends plugin {
  constructor (ctx,session) {
    super({
      name: '星铁plugin基本信息',
      dsc: '星穹铁道基本信息',
      /** https://oicqjs.github.io/oicq/#events */
      event: 'message',
      priority: -114514,
      rule: [
        // {
        //   /** 命令正则匹配 */
        //   reg: `^${rulePrefix}绑定(uid|UID)?(\\s)?[1-9][0-9]{8}$`,
        //   /** 执行方法 */
        //   fnc: 'bindSRUid'
        // },
        // {
        //   reg: `^${rulePrefix}(卡片|探索)$`,
        //   fnc: 'card'
        // },
        // {
        //   reg: `^${rulePrefix}帮助$`,
        //   fnc: 'help'
        // },
        // {
        //   reg: `^${rulePrefix}充值记录$`,
        //   fnc: 'getPayLog'
        // },
        // {
        //   reg: `^${rulePrefix}在线(时长)?(统计|分析)?`,
        //   fnc: 'statisticsOnline'
        // }
      ],
      ctx:ctx,
      session:session
    })
    this.e.isSr = true
    this.User = new User(this.e)
  }

  get appconfig () {
    return setting.getConfig('gachaHelp')
  }

  get app2config () {
    return setting.getConfig('cookieHelp')
  }

  async card (e) {
    e = this.e
    try {
      let user = this.e.sender.user_id
      let hasPersonalCK = false
      let ck = await gsCfg.getBingCkSingle(this.e.user_id)
      if (!ck || Object.keys(ck).length==0) {
        await e.reply('尚未绑定cookie')
        return false
      }
      let targetCk = Object.keys(ck).filter(k => ck[k].isMain)
      if (!targetCk || targetCk.length == 0) {
        await e.reply('尚未绑定cookie')
        return false
      }
      ck[targetCk[0]].uid = ck[targetCk[0]].starrail_uid
      let uid = targetCk[0]
      let api = new MysSRApi(targetCk[0], ck)
      let cardData = await api.getData('srCard')
      let result = cardData?.data
      if (!result) {
        this.error(cardData)
        await e.reply('未绑定ck,发送ck帮助查看说明')
        return false
      }
      if (hasPersonalCK) {
        let userDataKey = `STAR_RAILWAY:userData:${uid}`
        let userData = JSON.parse(await redis.get(userDataKey))
        if (!userData) {
          userData = (await api.getData('srUser'))?.data?.list?.[0]
        }
        result = Object.assign(cardData.data, userData)
        result.level = result.level + '级'
      } else {
        result.game_uid = uid
        result.nickname = '开拓者'
      }
      await e.runtime.render('StarRail-plugin', '/card/card.html', result)
    } catch (err) {
      console.log(err)
      e.reply('cookie错误或未绑定ck')
    }
  }

  async miYoSummerGetUid () {
    let key = `Yz:srJson:mys:qq-uid:${this.e.user_id}`
    let ck = await gsCfg.getBingCkSingle(this.e.user_id)
    //let key = `STAR_RAILWAY:UID:${this.e.user_id}`

    if (!ck) return false
    if (await redis.get(key)) return false
    let api = new MysSRApi('', ck)
    let userData = await api.getData('srUser')
    if (!userData?.data || _.isEmpty(userData.data.list)) return false
    userData = userData.data.list[0]
    let { game_uid: gameUid } = userData
    await redis.set(key, gameUid)
    await redis.setEx(`STAR_RAILWAY:userData:${gameUid}`, 60 * 60, JSON.stringify(userData))
    return userData
  }

  async help (e) {
    e = this.e
    await e.runtime.render('StarRail-plugin', '/help/help.html')
  }

  async bindSRUid () {
    let uid = parseInt(this.e.msg.replace(/[^0-9]/ig, ''))
    let user = this.e.user_id
    await redis.set(`Yz:srJson:mys:qq-uid:${user}`, uid)
    this.reply('绑定成功', false)
  }

  async getPayLog (e) {
    await this.miYoSummerGetUid()
    let uid = await redis.get(`STAR_RAILWAY:UID:${e.user_id}`)
    if (!uid) {
      await e.reply('尚未绑定uid,请发送#星铁绑定uid进行绑定')
      return false
    }
    let authKey
    try {
      authKey = await getAuthKey(e, uid)
    } catch (err) {
      // 未安装逍遥
      await e.reply('authkey获取失败，请使用#扫码登录绑定stoken后再进行查看~')
      return false
    }
    if (!authKey) {
      await e.reply('authkey获取失败，请使用#扫码登录重新绑定stoken后再进行查看~')
      return false
    }
    authKey = encodeURIComponent(authKey)
    let result = []
    let page = 1
    let size = 10
    let payLogUrl = getPaylogUrl(authKey, page, size)
    let res = await fetch(payLogUrl)
    let payLogList = await res.json()
    result.push(...payLogList.data.list)
    page++
    while (payLogList.data.list && payLogList.data.list.length === 10) {
      await new Promise(resolve => setTimeout(resolve, 500))
      payLogUrl = getPaylogUrl(authKey, page, size)
      res = await fetch(payLogUrl)
      payLogList = await res.json()
      result.push(...payLogList.data.list)
      page++
    }
    result = result.filter(r => r.add_num > 0)
    let t = result.map(i => {
      return `${i.time}: ${i.action} 获得${i.add_num}古老梦华`
    }).join('\n')
    await e.reply(t)
  }

  async statisticsOnline (e) {
    let lock = await redis.get(`STAR_RAILWAY:CD:ONLINE:${e.user_id}`)
    if (lock) {
      await e.reply('冷却时间没到，请稍后再试')
      return true
    }
    await this.miYoSummerGetUid()
    let uid = await redis.get(`STAR_RAILWAY:UID:${e.user_id}`)
    if (!uid) {
      await e.reply('未绑定uid，请发送#星铁绑定uid进行绑定')
      return false
    }
    let authKey
    try {
      authKey = await getAuthKey(e, uid)
    } catch (err) {
      // 未安装逍遥
      await e.reply('请先使用#cookie帮助绑定cookie和星铁绑定uid后再进行查看噢')
      return false
    }
    if (!authKey) {
      await e.reply('请先使用#cookie帮助绑定cookie和星铁绑定uid后再进行查看噢')
      return false
    }
    await e.reply('正在统计中，时间可能比较久请多等一会~')
    authKey = encodeURIComponent(authKey)
    let result = []
    let page = 1
    let size = 50
    let powerUrl = getPowerUrl(authKey, page, size)
    let res = await fetch(powerUrl)
    let powerChangeRecordList = await res.json()
    result.push(...powerChangeRecordList.data.list.filter(i => i.action === '随时间回复开拓力'))
    page++
    let earliest = new Date()
    earliest.setDate(earliest.getDate() - 8)
    while (powerChangeRecordList.data.list && powerChangeRecordList.data.list.length > 0) {
      powerUrl = getPowerUrl(authKey, page, size)
      res = await fetch(powerUrl)
      try {
        powerChangeRecordList = await res.json()
        result.push(...powerChangeRecordList.data.list.filter(i => i.action === '随时间回复开拓力'))
        page++
      } catch (err) {
        // 拉完或者一直拉到报错
        break
      }
      // 只拉七天的中间图不好看。
      // if (new Date(result[result.length - 1]?.time) < earliest) {
      //   break
      // }
      await new Promise(resolve => setTimeout(resolve, 500))
      logger.info('休息0.5秒，继续拉取开拓力记录')
    }
    const { data } = statisticsOnlineDateGeneral(result)
    let details = statisticOnlinePeriods(result)
    let userDataKey = `STAR_RAILWAY:userData:${uid}`
    let userData = JSON.parse(await redis.get(userDataKey))
    if (!userData) {
      let ck = await getCk(e)
      let api = new MysSRApi(uid, ck)
      userData = (await api.getData('srUser'))?.data?.list?.[0]
    }
    let renderData = Object.assign(userData || {}, {
      general: JSON.stringify(data),
      details
    })
    await e.runtime.render('StarRail-plugin', 'online/index.html', renderData)
  }
}

module.exports = hkrpg
